# Suivi-Garage-Partage — v173 (30 sept. 2026)

Bâtie sur la v172 (délais de commande, travaux de la prise de rendez-vous), qui est comprise dans ce zip.

## 📞 Communications : la conversation au complet, réponses automatiques comprises
> Dans Communications, je ne vois pas les messages automatiques envoyés. Je veux voir la conversation complète. Après
> le « 2 », il aurait dû avoir une question envoyée directement : je ne la vois pas.

**Ce qui se passait** (fil de 819-913-9743, ce matin) :
- Appel manqué → le menu est parti (lui était noté).
- Le client répond « 2 » → la question « indiquez-nous la marque, le modèle, l'année… » **est bien partie** : il y a
  répondu une minute plus tard (« tune pour un wolverine 850 X4 2018 »). Ensuite, « bien reçu, merci » est parti aussi.
- Mais ces réponses partaient directement à Twilio (dans la réponse au texto reçu). La fonction serveur `sms-entrant`
  ne les écrivait nulle part : elles n'existaient pas dans le fil.

**Corrigé dans la fonction serveur `sms-entrant`** (déployée le 30 sept., version 19 sur Supabase) :
- Chaque réponse automatique est aussi écrite dans 📞 Communications, dans le fil du client, juste après son texto :
  - question après « 2 », « quelle est votre question ? » après « 3 », lien de réservation après « 1 » ;
  - « bien reçu, merci » ;
  - confirmation de rendez-vous, « d'autres disponibilités » (« 4 »), « appelez-nous » (deux demandes ouvertes) ;
  - AIDE, confirmation de désabonnement (STOP).
- Écrite « déjà traitée » : pas de pastille à traiter, pas de notification pour nos propres textos.
- Si l'écriture échoue, le client reçoit **quand même** sa réponse (on ne fait que noter).
- Rien n'est envoyé deux fois : la ligne notée est une trace, c'est toujours Twilio qui envoie la réponse.
- Même déploiement : le bon créé quand un client confirme par texto reçoit les **services cochés** + la description
  (correction de la v172, qui était prête mais pas encore en ligne).

**Dans l'app** :
- Les textos envoyés par le système sont marqués **« 🤖 SMS automatique · automatique »** : les réponses ci-dessus, et
  aussi le menu d'appel manqué (avant : « 📤 SMS envoyé », comme les tiens).
- Tes textos restent « 📤 SMS envoyé · Jason ».
- Une réponse automatique apparaît dans le fil en direct, sans notification.

**Les anciennes conversations** : les réponses automatiques envoyées **avant** aujourd'hui ne sont pas dans les fils
(elles n'ont jamais été écrites). Elles peuvent être reconstituées sur demande (voir plus bas).

## Tests
- `edge/test-sms-entrant-v172.html` : **33/33**. Le vrai `index.ts` de la fonction, exécuté dans le navigateur avec un
  Supabase en mémoire. Rien n'est envoyé.
  - La conversation de ce matin : menu → « 2 » → question notée, au bon numéro, après le « 2 » → réponse → « bien
    reçu » noté ; le fil complet dans l'ordre.
  - Menu 1 / 3 / question.
  - Texto libre (rien de noté), AIDE, STOP inconnu ou client.
  - Confirmation, avec les travaux du bon (services en liste, en texte, ou absents), « 4 », deux demandes ouvertes,
    chiffre sans rien.
  - Écriture refusée (le client reçoit quand même), pas de doublon, jamais « à traiter », menu expiré, `?diag`.
- `test-v173.js` (app) : **14/14**. Le fil réel de 819-913-9743 : 8 échanges dans l'ordre, étiquettes 🤖 / 📤,
  « · automatique », pas de « ✓ Traité », arrivée en direct sans notification, texte échappé, vieilles lignes sans meta.
- Sabotages : **15 sur 15 attrapés**.
  - Fonction (12) :
    - rien noté ;
    - confirmation, menu ou STOP pas notés ;
    - travaux sans services, services mal joints ;
    - noté « à traiter » ;
    - erreur d'écriture qui bloque la réponse ;
    - mauvais numéro ;
    - noté deux fois ;
    - sans lien au texto ;
    - réponse vide notée.
  - App (3) : pas d'étiquette, menu d'appel manqué oublié, étiquette sur autre chose qu'un texto envoyé.
- Non-régression : tout passe.

  | Test | Résultat |
  |---|---|
  | `test-v172.js` | 52/52 |
  | `test-v172b.js` | 24/24 |
  | `test-v171.js` | 65/65 |
  | `test-v170.js` | 77/77 |
  | `test-v169.js` | 54/54 |
  | `test-v168.js` | 56/56 |
  | `test-v168b.js` | 35/35 |
  | `test-v167.js` | 72/72 (un premier passage s'est arrêté au départ : la page n'avait pas fini de charger dans le banc ; relancé, 72/72) |
  | `test-v166.js` | 49/49 |
  | `test-v165.js` | 26/26 |
  | `test-v164.js` | 63/63 |
  | `test-v163.js` | 34/34 |
  | `test-v162.js` | 36/36 |
  | `test-v161.js` | 42/42 |
  | `test-v160.js` | 16/16 |
  | `test-v159.js` | 63/63 |
  | `test-v159b.js` | 8/8 |

## À faire au déploiement
1. **Rien à faire au serveur** : `sms-entrant` est déjà en ligne (déployée par le connecteur Supabase, vérifiée avec
   `?diag`). Le prochain texto d'un client qui répond au menu sera noté au complet.
2. Netlify : glisser `deploy-atelier-v173.zip`. Il contient aussi tout ce qui est à faire pour la v172, si elle n'est
   pas encore en ligne : voir `CHANGELOG-atelier-v172.md`, étapes 3 et 4.
3. Les appareils affichent « 🔄 Nouvelle version » : **Recharger**.
