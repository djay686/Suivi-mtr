-- ============================================================================================
-- v178 — SMS de confirmation tracé (A1) : colonne, contrôles, rattrapage optionnel
-- MTR Performance · projet Supabase riwamsdpynpbjfadajlz (suivi-garage-mtr)
--
-- ⚠ CE FICHIER N'A PAS ÉTÉ EXÉCUTÉ. Il est livré tel quel, à lancer par le patron dans Supabase > SQL Editor.
--
-- ORDRE DE DÉPLOIEMENT (PLAN-v178, section 8) :
--   1. CE SQL (étape 1 ci-dessous : sans effet si la colonne existe déjà ; les étapes 2 à 4 sont des lectures).
--   2. Les fonctions Edge, avec « Verify JWT » DÉSACTIVÉ (Twilio n'envoie pas de JWT) :
--        supabase functions deploy sms-entrant   --project-ref riwamsdpynpbjfadajlz --no-verify-jwt
--        supabase functions deploy rdv-confirmer --project-ref riwamsdpynpbjfadajlz --no-verify-jwt   (capacité par technicien)
--        supabase functions deploy envoyer-rappels --project-ref riwamsdpynpbjfadajlz                 (variable {adresse} seulement ; garder son réglage JWT actuel)
--      Variable d'environnement facultative : SHOP_ADRESSE (valeur par défaut dans le code : 1856 rue Jérôme-Hamel, Trois-Rivières).
--   3. Le site (zip deploy-atelier-v178).
--   Sans risque pour la v177 en ligne : tant que les créneaux n'ont pas la clé « techs », la capacité reste 1.
--
-- PAS d'index unique sur rappels_envoyes : la contrainte (bt_id, rappel_id) existe déjà et ne protège pas les lignes
-- à rappel_id NULL (confirmations, envois manuels) ; un index unique sur (bt_id, type) casserait le renvoi manuel
-- d'une confirmation. Le doublon est évité par le verrou atomique de sms-entrant, pas par la base.
--
-- État constaté en lecture seule le 7 oct. 2026 (information_schema / catalogues) :
--   • demandes_service.confirmation_envoyee_le existe déjà (timestamptz, nullable) → l'étape 1 est un no-op ;
--   • demandes_service.creneaux est de type jsonb ;
--   • rappels_envoyes : CHECK seulement sur « type » (confirmation / rappel / manuel), AUCUN CHECK sur « canal » ni « statut » ;
--     rappel_id est nullable (clé étrangère vers rappels_config, ON DELETE SET NULL) ; UNIQUE (bt_id, rappel_id) ne
--     compte pas les NULL comme égaux → plusieurs lignes à rappel_id NULL par bon sont permises ;
--   • le déclencheur comm_depuis_rappels ignore tout canal différent de « sms » (et le statut « saute ») → la trace de
--     la confirmation, écrite avec le canal « twiml », ne crée PAS de 2e ligne dans 📞 Communications.
-- ============================================================================================


-- ── 1. La colonne lue par la fiche de la demande (« ✓ envoyé » / « Renvoyer la confirmation ») ───────────────
alter table public.demandes_service add column if not exists confirmation_envoyee_le timestamptz;


-- ── 2. CONTRÔLE (lecture seule) : la colonne est là, du bon type ─────────────────────────────────────────────
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'demandes_service' and column_name = 'confirmation_envoyee_le';
-- attendu : 1 ligne, « timestamp with time zone », YES


-- ── 3. CONTRÔLE (lecture seule) : où en sont les confirmations passées ───────────────────────────────────────
select
  count(*)                                                                         as demandes_confirmees_avec_bon,
  count(*) filter (where d.confirmation_envoyee_le is not null)                    as avec_confirmation_envoyee_le,
  count(*) filter (where exists (select 1 from public.rappels_envoyes r
                                 where r.bt_id = d.bt_id and r.type = 'confirmation')) as avec_trace_rappels_envoyes,
  count(*) filter (where d.confirmation_envoyee_le is null
                     and not exists (select 1 from public.rappels_envoyes r
                                     where r.bt_id = d.bt_id and r.type = 'confirmation')) as sans_aucune_trace
from public.demandes_service d
where d.statut = 'confirmee' and d.bt_id is not null;
-- « sans_aucune_trace » = les cartes qui affichent encore « pas envoyée » même si le client a bien reçu son texto.


-- ── 4. CONTRÔLE (lecture seule) : les candidates au rattrapage (confirmation par texto reçue, sans trace) ────
-- Une candidate = demande confirmée par le « 1 » du client (sms_recus.resultat = 'confirme'), sans ligne rappels_envoyes
-- de type confirmation pour son bon. Le texte vient du fil 📞 (réponse automatique notée depuis la v172), sinon il reste vide.
select distinct on (d.bt_id)
       d.id as demande_id, d.nom, d.tel, d.bt_id, d.confirme_le, s.recu_le as texto_recu_le, c.cree_le as reponse_notee_le,
       left(c.contenu, 80) as debut_du_texte
from public.demandes_service d
join public.sms_recus s on s.demande_id = d.id and s.resultat = 'confirme'
left join public.communications c on c.canal = 'sms_out' and c.par = 'automatique'
                                 and c.meta->>'declencheur' = 'confirmation' and c.meta->>'en_reponse_a' = s.id::text
where d.statut = 'confirmee' and d.bt_id is not null
  and not exists (select 1 from public.rappels_envoyes r where r.bt_id = d.bt_id and r.type = 'confirmation')
order by d.bt_id, s.recu_le;


-- ── 5. RATTRAPAGE OPTIONNEL (désactivé : retirer les « -- » pour l'exécuter, après avoir regardé l'étape 4) ──────
-- Écrit, pour chaque candidate, la ligne de trace qu'écrira désormais sms-entrant (canal « twiml » : aucun doublon dans
-- le fil 📞 Communications), puis pose demandes_service.confirmation_envoyee_le, sans quoi l'ancienne carte reste « pas envoyée ».
-- À lancer UNE fois ; le « not exists » l'empêche de doubler une trace existante.
--
-- begin;
--
-- insert into public.rappels_envoyes (bt_id, rappel_id, type, canal, destinataire, client, message, statut, envoye_le)
-- select distinct on (d.bt_id)
--        d.bt_id, null, 'confirmation', 'twiml', d.tel, d.nom, c.contenu, 'envoye', coalesce(c.cree_le, s.recu_le, d.confirme_le, now())
-- from public.demandes_service d
-- join public.sms_recus s on s.demande_id = d.id and s.resultat = 'confirme'
-- left join public.communications c on c.canal = 'sms_out' and c.par = 'automatique'
--                                  and c.meta->>'declencheur' = 'confirmation' and c.meta->>'en_reponse_a' = s.id::text
-- where d.statut = 'confirmee' and d.bt_id is not null
--   and not exists (select 1 from public.rappels_envoyes r where r.bt_id = d.bt_id and r.type = 'confirmation')
-- order by d.bt_id, s.recu_le;
--
-- update public.demandes_service d
--    set confirmation_envoyee_le = coalesce(
--          (select min(r.envoye_le) from public.rappels_envoyes r where r.bt_id = d.bt_id and r.type = 'confirmation'),
--          d.confirme_le)
--  where d.statut = 'confirmee' and d.bt_id is not null and d.confirmation_envoyee_le is null
--    and exists (select 1 from public.rappels_envoyes r where r.bt_id = d.bt_id and r.type = 'confirmation');
--
-- -- relire l'étape 3 : « sans_aucune_trace » doit avoir baissé du nombre de candidates ; puis :
-- commit;   -- (ou rollback; si les chiffres ne sont pas ceux attendus)


-- ── 6. APRÈS le déploiement de sms-entrant : vérifier un vrai « 1 » (lecture seule) ──────────────────────────
-- La dernière confirmation doit avoir : type confirmation, canal twiml, statut envoye, rappel_id NULL, bt_id = le bon créé.
select id, bt_id, rappel_id, type, canal, statut, destinataire, left(message, 90) as debut_du_texte, envoye_le
from public.rappels_envoyes
where type = 'confirmation' and canal = 'twiml'
order by envoye_le desc
limit 5;
-- et dans le fil du client, UNE seule ligne 🤖 pour ce texto (pas deux) :
select id, cree_le, tel, par, left(contenu, 90) as debut_du_texte, meta
from public.communications
where canal = 'sms_out' and meta->>'declencheur' = 'confirmation'
order by cree_le desc
limit 5;
