-- v169 — Écrans TV de l'atelier (TV du lift) : ce que chaque TV affiche.
-- À exécuter dans Supabase : SQL Editor → coller → Run. On peut le relancer sans danger.
-- Pas de compte à créer : la TV se branche avec le compte d'un technicien (le même que dans l'app),
-- par un code confirmé sur son cell (fonction « tv-jumelage ») ou en tapant son mot de passe.

-- ── Un écran = une ligne. La TV s'abonne à SA ligne ; le cell / la tablette l'écrit. (Jamais dans « tableau ».) ──
create table if not exists public.ecrans (
  id            text primary key,                 -- « lift » (tv.html?ecran=lift)
  nom           text not null default '',         -- « Lift 2 colonnes »
  mode          text not null default 'rien',     -- bt (suit le punch du technicien) | procedure | rien
  tech          text,                             -- le technicien que la TV suit
  bt_id         text,                             -- dernier bon affiché (gardé quand le punch se ferme)
  procedure_id  text,                             -- procédure affichée (mode procedure)
  etape         int  not null default 0,          -- étape en cours de la procédure
  maj_le        timestamptz not null default now(),
  maj_par       text,
  vu_le         timestamptz                       -- la TV signale qu'elle est allumée (toutes les 90 s)
);
insert into public.ecrans (id, nom) values ('lift', 'Lift 2 colonnes') on conflict (id) do nothing;

-- Accès : employés connectés (même règle que communications et procédures)
alter table public.ecrans enable row level security;
drop policy if exists ecrans_lire on public.ecrans;
create policy ecrans_lire on public.ecrans for select to authenticated using (true);
drop policy if exists ecrans_ecrire on public.ecrans;
create policy ecrans_ecrire on public.ecrans for insert to authenticated with check (true);
drop policy if exists ecrans_modifier on public.ecrans;
create policy ecrans_modifier on public.ecrans for update to authenticated using (true) with check (true);
-- (pas de suppression depuis l'app)

-- Temps réel : la TV change en 1 à 2 secondes
do $$ begin
  begin alter publication supabase_realtime add table public.ecrans; exception when duplicate_object then null; end;
end $$;

-- ── Brancher la TV avec un code (fonction « tv-jumelage ») : rien à taper sur la TV ──
-- La TV affiche un code, le technicien le confirme dans l'app avec son compte. Codes de 10 minutes, à usage unique.
-- Aucune politique : seule la fonction serveur (clé de service) lit et écrit cette table.
create table if not exists public.tv_jumelages (
  code          text primary key,                 -- 6 chiffres affichés sur la TV
  secret_hash   text not null,                    -- empreinte du secret que seule la TV connaît
  ecran         text not null default 'lift',
  tech          text,                             -- qui a confirmé
  token_hash    text,                             -- connexion à usage unique, remise à la TV puis effacée
  cree_le       timestamptz not null default now(),
  confirme_le   timestamptz,
  expire_le     timestamptz not null
);
alter table public.tv_jumelages enable row level security;
