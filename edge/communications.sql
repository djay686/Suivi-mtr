-- ============================================================
-- v150 — 📞 Communications : un seul fil par client pour les SMS,
-- appels manqués (PBX Yeastar), notes d'appel (Linkus) et demandes.
-- Appliqué directement sur le projet Supabase riwamsdpynpbjfadajlz
-- le 22 sept. 2026 (copie ici pour la trace).
-- ============================================================

create or replace function public.tel10(t text) returns text
language sql immutable as $$
  select case when length(regexp_replace(coalesce(t,''), '\D', '', 'g')) >= 10
              then right(regexp_replace(coalesce(t,''), '\D', '', 'g'), 10) else '' end
$$;

-- ── Le fil ────────────────────────────────────────────────────
create table if not exists public.communications (
  id            bigserial primary key,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  tel           text,                 -- 10 chiffres, clé du fil
  tel_brut      text,
  client_id     text,
  client_nom    text,
  canal         text not null,        -- sms_in | sms_out | appel_manque | appel_repondu | appel_sortant | note | demande | systeme
  direction     text not null default 'in',   -- in | out | interne
  raison        text,                 -- rdv | statut | pieces | performance | plainte | question | autre
  contenu       text,
  meta          jsonb not null default '{}'::jsonb,
  statut        text not null default 'traite',   -- a_traiter | rappel | traite
  rappel_le     timestamptz,
  traite_le     timestamptz,
  traite_par    text,
  ref_bt        text,
  ref_soum      text,
  appel_id      text,                 -- id d'appel du PBX
  source_table  text,
  source_id     text,
  par           text
);
create index if not exists communications_tel_idx on public.communications (tel, cree_le desc);
create index if not exists communications_cree_idx on public.communications (cree_le desc);
create index if not exists communications_statut_idx on public.communications (statut) where statut <> 'traite';
create unique index if not exists communications_source_uq on public.communications (source_table, source_id) where source_table is not null and source_id is not null;
create index if not exists communications_appel_idx on public.communications (appel_id) where appel_id is not null;

alter table public.communications enable row level security;
drop policy if exists comm_auth on public.communications;
create policy comm_auth on public.communications for all to authenticated using (true) with check (true);

create or replace function public.communications_maj() returns trigger language plpgsql as $$
begin new.maj_le := now(); if new.tel is null or new.tel = '' then new.tel := public.tel10(new.tel_brut); end if; return new; end $$;
drop trigger if exists trg_comm_maj on public.communications;
create trigger trg_comm_maj before insert or update on public.communications for each row execute function public.communications_maj();

-- ── État du menu SMS d'appel manqué (par numéro) ──────────────
create table if not exists public.sms_menu_etat (
  tel           text primary key,     -- 10 chiffres
  etape         text not null,        -- menu | perf_attente | question_attente
  comm_id       bigint,               -- la ligne « appel manqué » d'origine
  envoye_le     timestamptz not null default now(),
  expire_le     timestamptz not null,
  maj_le        timestamptz not null default now()
);
alter table public.sms_menu_etat enable row level security;
drop policy if exists menu_auth on public.sms_menu_etat;
create policy menu_auth on public.sms_menu_etat for all to authenticated using (true) with check (true);

-- ── Réglages téléphonie (une seule ligne, id = 1) ─────────────
create table if not exists public.telephonie_config (
  id                int primary key default 1 check (id = 1),
  actif             boolean not null default true,
  lien_reservation  text not null default 'https://www.mtrperformance.ca',
  delai_min         int not null default 240,       -- minutes entre deux SMS d'appel manqué au même numéro
  menu_valide_h     int not null default 24,        -- durée de validité du menu
  heures            jsonb not null default '{"1":[8,17],"2":[8,17],"3":[8,17],"4":[8,17],"5":[8,17]}'::jsonb,  -- 0=dim … 6=sam
  liste_noire       text[] not null default '{}',
  sms_menu          text not null default 'MTR Performance : on a manque votre appel. Repondez :
1 - Prendre un rendez-vous
2 - Ajouts de performance
3 - Poser une question',
  sms_hors_heures   text not null default 'MTR Performance : on est ferme pour le moment, on vous revient a la prochaine journee ouvrable. Repondez :
1 - Prendre un rendez-vous
2 - Ajouts de performance
3 - Poser une question',
  sms_rep_1         text not null default 'MTR Performance : reservez votre date directement ici : {lien}',
  sms_rep_2         text not null default 'MTR Performance : pour bien vous conseiller, indiquez-nous la marque, le modele, l''annee et ce que vous recherchez (plus de puissance, tenue de route, les deux). Un technicien vous rappelle d''ici la fin de la prochaine journee ouvrable.',
  sms_rep_3         text not null default 'MTR Performance : quelle est votre question ?',
  sms_merci         text not null default 'MTR Performance : bien recu, merci! On vous revient d''ici la fin de la prochaine journee ouvrable.',
  maj_le            timestamptz not null default now()
);
insert into public.telephonie_config (id) values (1) on conflict (id) do nothing;
alter table public.telephonie_config enable row level security;
drop policy if exists telcfg_auth on public.telephonie_config;
create policy telcfg_auth on public.telephonie_config for all to authenticated using (true) with check (true);

-- ── Journal brut des événements du PBX (pour voir ce qu'il envoie vraiment) ──
create table if not exists public.pbx_evenements (
  id        bigserial primary key,
  recu_le   timestamptz not null default now(),
  type      text,
  appel_id  text,
  brut      jsonb,
  action    text,          -- ce que la fonction en a fait
  note      text
);
create index if not exists pbx_evenements_recu_idx on public.pbx_evenements (recu_le desc);
alter table public.pbx_evenements enable row level security;
drop policy if exists pbx_auth on public.pbx_evenements;
create policy pbx_auth on public.pbx_evenements for select to authenticated using (true);

-- ── Miroirs : ce qui existe déjà alimente le fil sans toucher aux fonctions ──
-- SMS reçus
create or replace function public.comm_depuis_sms_recus() returns trigger language plpgsql security definer as $$
declare st text;
begin
  st := case when new.traite and coalesce(new.resultat,'') not in ('autre','aucune_correspondance','ambigu') then 'traite' else 'a_traiter' end;
  if tg_op = 'INSERT' then
    insert into public.communications (cree_le, tel, tel_brut, canal, direction, contenu, statut, source_table, source_id, meta)
    values (coalesce(new.recu_le, now()), public.tel10(new.de), new.de, 'sms_in', 'in', new.corps, st, 'sms_recus', new.id::text,
            jsonb_build_object('message_sid', new.message_sid))
    on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;
  else
    update public.communications set statut = case when statut = 'rappel' then 'rappel' else st end,
      traite_le = case when st = 'traite' and traite_le is null then now() else traite_le end,
      meta = meta || jsonb_build_object('resultat', new.resultat, 'demande_id', new.demande_id)
    where source_table = 'sms_recus' and source_id = new.id::text;
  end if;
  return new;
end $$;
drop trigger if exists trg_comm_sms_recus on public.sms_recus;
create trigger trg_comm_sms_recus after insert or update on public.sms_recus for each row execute function public.comm_depuis_sms_recus();

-- SMS envoyés par le serveur (rappels, confirmations)
create or replace function public.comm_depuis_rappels() returns trigger language plpgsql security definer as $$
begin
  if coalesce(new.canal,'sms') <> 'sms' then return new; end if;
  insert into public.communications (cree_le, tel, tel_brut, client_nom, canal, direction, contenu, statut, ref_bt, source_table, source_id, meta)
  values (coalesce(new.envoye_le, now()), public.tel10(new.destinataire), new.destinataire, new.client, 'sms_out', 'out', new.message, 'traite', new.bt_id,
          'rappels_envoyes', new.id::text, jsonb_build_object('type', new.type, 'statut', new.statut, 'erreur', new.erreur, 'twilio_sid', new.twilio_sid))
  on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;
  return new;
end $$;
drop trigger if exists trg_comm_rappels on public.rappels_envoyes;
create trigger trg_comm_rappels after insert on public.rappels_envoyes for each row execute function public.comm_depuis_rappels();

-- Demandes de service (site web) : visibles dans le fil, traitées dans 📨 Demandes
create or replace function public.comm_depuis_demandes() returns trigger language plpgsql security definer as $$
begin
  insert into public.communications (cree_le, tel, tel_brut, client_id, client_nom, canal, direction, raison, contenu, statut, source_table, source_id, meta)
  values (coalesce(new.cree_le, now()), public.tel10(new.tel), new.tel, new.client_id, new.nom, 'demande', 'in', 'rdv',
          concat_ws(' — ', nullif(concat_ws(' ', new.annee, new.marque, new.modele), ''), new.description), 'traite',
          'demandes_service', new.id::text, jsonb_build_object('source', new.source, 'type_machine', new.type_machine))
  on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;
  return new;
end $$;
drop trigger if exists trg_comm_demandes on public.demandes_service;
create trigger trg_comm_demandes after insert on public.demandes_service for each row execute function public.comm_depuis_demandes();

-- Historique : on importe ce qui existe déjà (une fois; les doublons sont ignorés)
insert into public.communications (cree_le, tel, tel_brut, canal, direction, contenu, statut, source_table, source_id, meta)
select recu_le, public.tel10(de), de, 'sms_in', 'in', corps,
       case when traite and coalesce(resultat,'') not in ('autre','aucune_correspondance','ambigu') then 'traite' else 'a_traiter' end,
       'sms_recus', id::text, jsonb_build_object('message_sid', message_sid, 'resultat', resultat)
from public.sms_recus
on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;

insert into public.communications (cree_le, tel, tel_brut, client_nom, canal, direction, contenu, statut, ref_bt, source_table, source_id, meta)
select envoye_le, public.tel10(destinataire), destinataire, client, 'sms_out', 'out', message, 'traite', bt_id, 'rappels_envoyes', id::text,
       jsonb_build_object('type', type, 'statut', statut, 'erreur', erreur)
from public.rappels_envoyes where coalesce(canal,'sms') = 'sms'
on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;

insert into public.communications (cree_le, tel, tel_brut, client_id, client_nom, canal, direction, raison, contenu, statut, source_table, source_id, meta)
select cree_le, public.tel10(tel), tel, client_id, nom, 'demande', 'in', 'rdv',
       concat_ws(' — ', nullif(concat_ws(' ', annee, marque, modele), ''), description), 'traite', 'demandes_service', id::text,
       jsonb_build_object('source', source, 'type_machine', type_machine)
from public.demandes_service
on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;

-- Temps réel
do $$ begin
  begin alter publication supabase_realtime add table public.communications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sms_menu_etat; exception when duplicate_object then null; end;
end $$;
