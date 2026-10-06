# Suivi-Garage-Partage — v165 (28 sept. 2026)

Bâtie sur la v164 (ordre de travail). Aucun changement côté serveur.

## ✏️ Corriger le cellulaire d'une demande de rendez-vous (demande de Jason)
Un client s'était trompé dans son numéro au formulaire du site : impossible de le corriger, donc les créneaux et la
confirmation partaient au mauvais numéro.

- Dans la fiche d'une demande (📨 Demandes rendez-vous → Ouvrir), bouton **✏️ Corriger** à côté du numéro et du courriel.
- Formulaire prérempli : **cellulaire** et **courriel**. Le numéro est remis en forme (ex. `(819) 555 1234` → `819-555-1234`).
- **Les prochains textos partent au nouveau numéro** : proposer des créneaux, demander des renseignements, renvoyer la confirmation.
  Le serveur retrouve la demande par ce numéro : la réponse du client (1, 2 ou 3) sera reconnue.
- **Corriger aussi** (case cochée d'office) là où l'ancien numéro avait été recopié :
  - la fiche du **carnet** rattachée à la demande (ou trouvée par le même numéro / courriel — jamais un homonyme trouvé par le nom seulement) ;
  - le **bon de travail** créé à la confirmation (les rappels SMS le lisent) ;
  - la **soumission** liée.
  Seul le champ qui avait encore l'ancienne valeur est changé.
- Après la correction, l'app dit quoi faire :
  - créneaux déjà envoyés → « renvoie-les avec 📅 Proposer des créneaux » ;
  - rendez-vous confirmé → « 📲 Renvoyer la confirmation » ;
  - le nouveau numéro a déjà écrit (message non rattaché) → « regarde l'onglet Messages reçus ».
- **Historique** de la demande : « coordonnées corrigées · cellulaire : ancien → nouveau · aussi : … », avec le nom de qui l'a fait.
- Badge **📱 numéro incomplet** quand le numéro n'a pas 10 chiffres (l'erreur la plus courante).
- Garde-fous : un cellulaire doit avoir 10 chiffres ; courriel vérifié ; il faut garder au moins un moyen de joindre le client,
  et un cellulaire si le client préfère les textos. Rien n'est écrit si rien n'a changé.

## Tests
- `test-v165.js` 26/26 : bouton et badge ; formulaire prérempli ; Annuler ; numéro invalide refusé ; correction (remise en forme,
  seul le champ changé est envoyé) ; carnet corrigé ; historique ; conseils (créneaux à renvoyer, message déjà reçu) ;
  le texto suivant part au +1 du nouveau numéro ; bon de travail et soumission corrigés, homonyme du carnet jamais touché ;
  case décochée ; rien de changé ; courriel invalide ; cellulaire obligatoire si textos ; courriel seul ; nom échappé.
  Le faux serveur des tests rafraîchit la demande pendant l'écriture (comme le temps réel) : l'ancien numéro doit être lu avant.
- Sabotages : 7 fautes volontaires, toutes attrapées. `test-v165.js` sur la v164 : échoue.
- Non-régression : `test-v164.js` 63/63, `test-v163.js` 34/34, `test-v162.js` 36/36, `test-v161.js` 42/42, `test-v160.js` 16/16,
  `test-v159.js` 63/63, `test-v159b.js` 8/8.
- Tests exécutés dans Chromium (navigateur intégré), l'app dans une page avec Supabase bouchonné ; 0 erreur JavaScript.
