-- ============================================================================
-- v178 — Purge des traces de l'ancien « 🎁 cadeau / payé comptant » (retiré de l'application en v178)
-- Projet Supabase riwamsdpynpbjfadajlz — SQL Editor.
--
-- ⚠️  CE FICHIER N'A PAS ÉTÉ EXÉCUTÉ. Il a été livré tel quel avec la v178 : aucun agent n'a touché à la production.
--     C'est le patron (ou une personne autorisée) qui l'exécute, dans l'ordre ci-dessous.
--     (Les requêtes ont seulement été essayées sur un PostgreSQL 16 local jetable, avec des données factices :
--     bons avec et sans cadeau, rentabilite.cadeau, instantanés, relance sans effet. Jamais sur la production.)
--
-- ⚠️  LA PURGE EST IRRÉVERSIBLE. Après l'étape B, on ne saura plus quels bons avaient été fermés « payé comptant » :
--     la liste (étape A) disparaît des données de l'application, des lignes 1 et 12 ET des instantanés
--     internes (tableau_sauvegardes) des lignes 1 et 12. Seuls restent les vieux fichiers sauvegarde-garage-*.json
--     téléchargés (à supprimer à la main si on veut aussi les faire disparaître) et les sauvegardes internes de
--     Supabase (qu'on ne peut pas modifier et qui expirent d'elles-mêmes).
--     Confirmer PAR ÉCRIT que c'est voulu avant l'étape B.
--
-- ORDRE OBLIGATOIRE
--   1. Tous les postes (iPad, cellulaires, PC d'atelier) affichent la v178 (fermer puis rouvrir l'application).
--      Un poste resté en v177 qui réécrit la ligne 1 RESSUSCITERAIT les champs « cadeau ».
--   2. Au moins un poste administrateur ouvert et affichant « 🟢 Connecté — partage temps réel actif » : il reçoit
--      la ligne nettoyée en direct et ne la ré-écrit pas sale. Faire la purge hors des heures d'atelier.
--   3. Exécuter CE fichier : d'abord l'étape A seule (lecture seule), la lire, décider ; puis l'étape B ; puis C.
--   4. Relancer l'étape B (et C) dans une semaine, pour attraper un poste qui aurait réécrit un instantané ou une
--      ligne entre-temps (la relance est sans effet s'il n'y a plus rien à retirer : tout est idempotent).
--   5. Supprimer à la main les anciens sauvegarde-garage-*.json téléchargés.
--
-- CE QUI EST RETIRÉ (et seulement cela)
--   • Ligne 1 de public.tableau (la liste des bons) : la clé « cadeau » de chaque bon, et la valeur
--     invSortieSource = 'cadeau' (la clé invSortieSource est retirée). Même nombre de bons : le garde-fou
--     du serveur (liste qui rétrécit) ne se déclenche pas.
--   • Ligne 12 de public.tableau (journal des mouvements d'inventaire) : le suffixe « · 🎁 cadeau » à la fin de
--     la référence. Les mouvements eux-mêmes sont gardés (le stock et les ventes ne changent pas).
--   • public.tableau_sauvegardes : les instantanés des lignes 1 et 12 qui contiennent encore ces traces.
--   JAMAIS touchés : rentabilite (y compris rentabilite.cadeau, la bascule 🎁 « offert » de la Rentabilité, qui
--   reste dans l'application), statut, livreLe, chrono, pieces, photos, invSorties, numeroBT.
--
-- Types vérifiés par lecture du schéma (7 oct. 2026, lecture seule) : tableau.donnees et tableau_sauvegardes.donnees sont jsonb ;
-- tableau_sauvegardes(id, quand, ligne_id, donnees). Si ce n'était plus le cas, la vérification ci-dessous le montre.
-- ============================================================================


-- ============================================================================
-- ÉTAPE A — CONTRÔLE (LECTURE SEULE) : exécuter ces trois requêtes SEULES, avant tout le reste.
-- ============================================================================

-- A0. Les types : doit afficher « jsonb » trois fois (sinon, ajouter ::jsonb aux requêtes de l'étape B).
select 'tableau' as table_, id, pg_typeof(donnees)::text as type_donnees from public.tableau where id in (1, 12)
union all
(select 'tableau_sauvegardes', null, pg_typeof(donnees)::text from public.tableau_sauvegardes limit 1);

-- A1. LA LISTE À CONSERVER OU À DÉCIDER : les bons fermés « payé comptant » dont la Rentabilité a aussi été
--     marquée 🎁 « offert » (leur revenu y est à 0 $). Après la purge, ces bons gardent leur 🎁 en Rentabilité
--     (c'est leur seule trace visible) : décider de les laisser ainsi, ou de les remettre « payés » dans la
--     Rentabilité AVANT la purge. Cette liste est INTROUVABLE après l'étape B : la copier maintenant.
select b->>'numeroBT'                       as bt,
       b->>'nom'                            as machine,
       b->>'client'                         as client,
       b->>'statut'                         as statut,
       b->>'livreLe'                        as livre_le,
       b->'cadeau'->>'le'                   as ferme_en_cadeau_le,
       b->'cadeau'->>'par'                  as par,
       b->'cadeau'->>'montant'              as montant_cadeau,
       b#>>'{rentabilite,revenuPotentiel}'  as revenu_potentiel_rentabilite,
       b#>>'{rentabilite,dateFin}'          as rentabilite_date_fin
from public.tableau t, jsonb_array_elements(t.donnees) as b
where t.id = 1
  and jsonb_typeof(t.donnees) = 'array'
  and jsonb_typeof(b) = 'object'
  and b->'cadeau' is not null
  and b#>>'{rentabilite,cadeau}' = 'true'
order by b->>'numeroBT';

-- A2. TOUS les bons qui portent encore la clé « cadeau » (ce que l'étape B va effacer), et les mouvements concernés.
select 'bons avec la clé cadeau' as quoi, count(*) as n
from public.tableau t, jsonb_array_elements(t.donnees) as b
where t.id = 1 and jsonb_typeof(t.donnees) = 'array' and jsonb_typeof(b) = 'object' and b->'cadeau' is not null
union all
select 'bons avec invSortieSource = cadeau', count(*)
from public.tableau t, jsonb_array_elements(t.donnees) as b
where t.id = 1 and jsonb_typeof(t.donnees) = 'array' and jsonb_typeof(b) = 'object' and b->>'invSortieSource' = 'cadeau'
union all
select 'mouvements dont la réf. porte « 🎁 cadeau »', count(*)
from public.tableau t, jsonb_array_elements(t.donnees) as x
where t.id = 12 and jsonb_typeof(t.donnees) = 'array' and jsonb_typeof(x) = 'object'
  and (x->>'ref') like '%' || chr(183) || ' ' || chr(127873) || ' cadeau%'
union all
select 'instantanés ligne 1 / 12 à supprimer', count(*)
from public.tableau_sauvegardes s
where (s.ligne_id = 1 and jsonb_typeof(s.donnees) = 'array' and exists (
         select 1 from jsonb_array_elements(s.donnees) b
         where jsonb_typeof(b) = 'object' and (b->'cadeau' is not null or b->>'invSortieSource' = 'cadeau')))
   or (s.ligne_id = 12 and jsonb_typeof(s.donnees) = 'array' and exists (
         select 1 from jsonb_array_elements(s.donnees) x
         where jsonb_typeof(x) = 'object' and (x->>'ref') like '%' || chr(183) || ' ' || chr(127873) || ' cadeau%'));


-- ============================================================================
-- ÉTAPE B — PURGE (IRRÉVERSIBLE). À n'exécuter qu'APRÈS avoir lu l'étape A, confirmé par écrit, et avec tous les
-- postes en v178. Un seul bloc : tout réussit ou rien ne change (begin … commit).
-- Le suffixe est écrit avec chr() : · = chr(183), 🎁 = chr(127873) — aucun souci d'encodage dans l'éditeur.
-- ============================================================================
begin;

-- B1. Ligne 1 : retirer « cadeau » et invSortieSource = 'cadeau' de chaque bon (ordre et nombre de bons inchangés).
update public.tableau t
set donnees = coalesce((
      select jsonb_agg(
               case
                 when jsonb_typeof(e.b) <> 'object' then e.b
                 when e.b->>'invSortieSource' = 'cadeau' then (e.b - 'cadeau') - 'invSortieSource'
                 else e.b - 'cadeau'
               end
               order by e.n)
      from jsonb_array_elements(t.donnees) with ordinality as e(b, n)
    ), '[]'::jsonb)
where t.id = 1
  and jsonb_typeof(t.donnees) = 'array'
  and jsonb_array_length(t.donnees) > 0
  and exists (select 1 from jsonb_array_elements(t.donnees) b
              where jsonb_typeof(b) = 'object' and (b->'cadeau' is not null or b->>'invSortieSource' = 'cadeau'));

-- B2. Ligne 12 : retirer le suffixe « · 🎁 cadeau » des références (les mouvements restent).
update public.tableau t
set donnees = coalesce((
      select jsonb_agg(
               case
                 when jsonb_typeof(e.x) = 'object'
                      and (e.x->>'ref') like '%' || chr(183) || ' ' || chr(127873) || ' cadeau%'
                   then jsonb_set(e.x, '{ref}',
                          to_jsonb(replace(e.x->>'ref', ' ' || chr(183) || ' ' || chr(127873) || ' cadeau', '')))
                 else e.x
               end
               order by e.n)
      from jsonb_array_elements(t.donnees) with ordinality as e(x, n)
    ), '[]'::jsonb)
where t.id = 12
  and jsonb_typeof(t.donnees) = 'array'
  and jsonb_array_length(t.donnees) > 0
  and exists (select 1 from jsonb_array_elements(t.donnees) x
              where jsonb_typeof(x) = 'object' and (x->>'ref') like '%' || chr(183) || ' ' || chr(127873) || ' cadeau%');

-- B3. Instantanés internes : les UPDATE ci-dessus en créent eux-mêmes un de l'ANCIENNE valeur (sale) — c'est
--     pourquoi ce DELETE vient APRÈS. Seul le SQL peut les supprimer (l'application n'a pas ce droit).
--     On ne supprime que ceux qui portent encore ces traces ; un instantané qui ne contient que la bascule 🎁
--     « offert » de la Rentabilité (rentabilite.cadeau, gardée) n'est pas touché : les copies de sécurité restent.
delete from public.tableau_sauvegardes s
where (s.ligne_id = 1 and jsonb_typeof(s.donnees) = 'array' and exists (
         select 1 from jsonb_array_elements(s.donnees) b
         where jsonb_typeof(b) = 'object' and (b->'cadeau' is not null or b->>'invSortieSource' = 'cadeau')))
   or (s.ligne_id = 12 and jsonb_typeof(s.donnees) = 'array' and exists (
         select 1 from jsonb_array_elements(s.donnees) x
         where jsonb_typeof(x) = 'object' and (x->>'ref') like '%' || chr(183) || ' ' || chr(127873) || ' cadeau%'));

commit;


-- ============================================================================
-- ÉTAPE C — VÉRIFICATION (LECTURE SEULE) : les quatre nombres doivent être 0. Relancer l'étape A2 revient au même.
-- Le nombre de bons (ligne 1) doit être le même qu'avant ; rentabilite.cadeau est conservé (le dernier nombre
-- doit rester égal à celui de l'étape A1, il ne baisse pas).
-- ============================================================================
select 'bons avec la clé cadeau (doit être 0)' as quoi, count(*) as n
from public.tableau t, jsonb_array_elements(t.donnees) as b
where t.id = 1 and jsonb_typeof(t.donnees) = 'array' and jsonb_typeof(b) = 'object' and b->'cadeau' is not null
union all
select 'bons avec invSortieSource = cadeau (doit être 0)', count(*)
from public.tableau t, jsonb_array_elements(t.donnees) as b
where t.id = 1 and jsonb_typeof(t.donnees) = 'array' and jsonb_typeof(b) = 'object' and b->>'invSortieSource' = 'cadeau'
union all
select 'mouvements avec « 🎁 cadeau » (doit être 0)', count(*)
from public.tableau t, jsonb_array_elements(t.donnees) as x
where t.id = 12 and jsonb_typeof(t.donnees) = 'array' and jsonb_typeof(x) = 'object'
  and (x->>'ref') like '%' || chr(183) || ' ' || chr(127873) || ' cadeau%'
union all
select 'instantanés sales restants (doit être 0)', count(*)
from public.tableau_sauvegardes s
where (s.ligne_id = 1 and jsonb_typeof(s.donnees) = 'array' and exists (
         select 1 from jsonb_array_elements(s.donnees) b
         where jsonb_typeof(b) = 'object' and (b->'cadeau' is not null or b->>'invSortieSource' = 'cadeau')))
   or (s.ligne_id = 12 and jsonb_typeof(s.donnees) = 'array' and exists (
         select 1 from jsonb_array_elements(s.donnees) x
         where jsonb_typeof(x) = 'object' and (x->>'ref') like '%' || chr(183) || ' ' || chr(127873) || ' cadeau%'))
union all
select 'bons avec rentabilite.cadeau = true (conservés, inchangé)', count(*)
from public.tableau t, jsonb_array_elements(t.donnees) as b
where t.id = 1 and jsonb_typeof(t.donnees) = 'array' and jsonb_typeof(b) = 'object' and b#>>'{rentabilite,cadeau}' = 'true';
