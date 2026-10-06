-- v167 — Procédures de travail (bouton « 📋 Procédure » du bon de travail live) + bibliothèque de manuels d'atelier.
-- v171 — + espace « procedures » pour les photos des procédures importées (en bas).
-- À exécuter une fois dans Supabase : SQL Editor → coller → Run. On peut le relancer sans danger.

-- ── Manuels d'atelier : le PDF dans le stockage « manuels », le texte page par page pour la recherche ──
create table if not exists public.manuels (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  type        text,                 -- VTT, Côte à côte, Motoneige, Motomarine…
  marque      text,
  modele      text,                 -- ex. Maverick X3
  annee_de    int,
  annee_a     int,
  chemin      text,                 -- chemin du PDF dans le stockage « manuels » (null si trop gros pour être gardé)
  nb_pages    int not null default 0,
  ajoute_par  text,
  cree_le     timestamptz not null default now()
);
create table if not exists public.manuel_pages (
  manuel_id   uuid not null references public.manuels(id) on delete cascade,
  page        int not null,         -- numéro de page du PDF (1 = première)
  texte       text not null default '',
  primary key (manuel_id, page)
);

-- ── Procédures : une par bon de travail (on peut la refaire) ──
create table if not exists public.procedures (
  id          uuid primary key default gen_random_uuid(),
  bt_id       text not null,        -- id de la machine (bon de travail) dans l'app
  numero_bt   text,
  titre       text,
  statut      text not null default 'en_cours',   -- en_cours | prete | erreur
  contenu     jsonb,                -- étapes, specs, matériel, sources…
  manuel_id   uuid references public.manuels(id) on delete set null,
  cout        jsonb,                -- jetons et recherches web utilisés (pour le coût)
  erreur      text,
  cree_par    text,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now()
);
create index if not exists procedures_bt_idx on public.procedures (bt_id, cree_le desc);

-- ── Coches et mesures du technicien : une ligne par case (plusieurs tablettes en même temps sans s'écraser) ──
create table if not exists public.procedure_etat (
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  cle          text not null,       -- « c:s3-4-G » (case) ou « f:belt » (mesure)
  valeur       jsonb,
  par          text,
  maj_le       timestamptz not null default now(),
  primary key (procedure_id, cle)
);

-- ── Accès : employés connectés (même règle que communications) ──
alter table public.manuels enable row level security;
alter table public.manuel_pages enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_etat enable row level security;
drop policy if exists manuels_auth on public.manuels;
create policy manuels_auth on public.manuels for all to authenticated using (true) with check (true);
drop policy if exists manuel_pages_auth on public.manuel_pages;
create policy manuel_pages_auth on public.manuel_pages for all to authenticated using (true) with check (true);
drop policy if exists procedures_auth on public.procedures;
create policy procedures_auth on public.procedures for all to authenticated using (true) with check (true);
drop policy if exists procedure_etat_auth on public.procedure_etat;
create policy procedure_etat_auth on public.procedure_etat for all to authenticated using (true) with check (true);

-- ── Temps réel : les coches se voient tout de suite sur les autres tablettes ──
do $$ begin
  begin alter publication supabase_realtime add table public.procedures; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.procedure_etat; exception when duplicate_object then null; end;
end $$;

-- ── Stockage des PDF : espace privé « manuels », jusqu'à 500 Mo par fichier ──
-- Si l'ajout d'un gros manuel échoue quand même : Storage → Settings → « Upload file size limit » (limite globale du projet).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manuels', 'manuels', false, 524288000, array['application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists manuels_lire on storage.objects;
create policy manuels_lire on storage.objects for select to authenticated using (bucket_id = 'manuels');
drop policy if exists manuels_ajouter on storage.objects;
create policy manuels_ajouter on storage.objects for insert to authenticated with check (bucket_id = 'manuels');
drop policy if exists manuels_retirer on storage.objects;
create policy manuels_retirer on storage.objects for delete to authenticated using (bucket_id = 'manuels');

-- ── v171 : photos des procédures importées (procédure faite par Claude ailleurs, en .zip ou en dossier) ──
-- Espace privé « procedures » : une image jusqu'à 10 Mo, rangée sous l'id de sa procédure.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('procedures', 'procedures', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists procimg_lire on storage.objects;
create policy procimg_lire on storage.objects for select to authenticated using (bucket_id = 'procedures');
drop policy if exists procimg_ajouter on storage.objects;
create policy procimg_ajouter on storage.objects for insert to authenticated with check (bucket_id = 'procedures');
drop policy if exists procimg_modifier on storage.objects;
create policy procimg_modifier on storage.objects for update to authenticated using (bucket_id = 'procedures') with check (bucket_id = 'procedures');
drop policy if exists procimg_retirer on storage.objects;
create policy procimg_retirer on storage.objects for delete to authenticated using (bucket_id = 'procedures');
