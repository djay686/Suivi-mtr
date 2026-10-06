-- Migration « qbo_connexion » (appliquée le 2026-09-11 sur riwamsdpynpbjfadajlz)
create table if not exists public.qbo_connexion (
  id int primary key default 1 check (id = 1),
  client_id text, client_secret text,
  env text not null default 'production',
  realm_id text, access_token text, refresh_token text,
  access_expire timestamptz, refresh_expire timestamptz,
  company_name text, oauth_state text, oauth_expire timestamptz, retour_url text,
  config jsonb not null default '{}'::jsonb,
  maj timestamptz not null default now()
);
alter table public.qbo_connexion enable row level security;
insert into public.qbo_connexion (id) values (1) on conflict (id) do nothing;
create table if not exists public.qbo_envois (
  id bigserial primary key, quand timestamptz not null default now(),
  soumission text, numero text, estimate_id text, doc_number text,
  action text, message text, par text
);
alter table public.qbo_envois enable row level security;

-- v158 (appliquée le 2026-09-22) : le journal note aussi les FACTURES faites depuis un bon de travail
alter table public.qbo_envois add column if not exists type text not null default 'devis';
alter table public.qbo_envois add column if not exists bt text;
alter table public.qbo_envois add column if not exists invoice_id text;
create index if not exists qbo_envois_bt_idx on public.qbo_envois (bt) where invoice_id is not null;

-- v159 (appliquée le 2026-09-22) : chaque envoi note l'entreprise QuickBooks (realm) ; un id n'est réutilisé
-- que dans la même entreprise (le test n'est jamais repris dans le vrai dossier)
alter table public.qbo_envois add column if not exists realm text;
update public.qbo_envois set realm = (select realm_id from public.qbo_connexion where id = 1 and env = 'sandbox')
  where realm is null and quand >= '2026-09-22' and (select env from public.qbo_connexion where id = 1) = 'sandbox';
create index if not exists qbo_envois_bt_realm_idx on public.qbo_envois (bt, realm) where invoice_id is not null;
