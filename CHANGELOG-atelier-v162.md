# Suivi-Garage-Partage — v162 (25 sept. 2026)

Bâtie sur la v161. Aucun changement côté serveur (la fonction `assistant-claude` v9 est correcte).

## Le problème : Assistant MTR « Non connecté (code 401) »
Relevé dans les journaux Supabase le 25 sept. :
- 12 h 50 : **« Changer d'utilisateur »** sur un appareil (compte j.blouin). L'app appelait `sb.auth.signOut()`, qui par défaut **déconnecte le compte sur TOUS les appareils**.
- 12 h 54, 13 h 04, 13 h 18 : les autres appareils essaient de renouveler leur connexion → « Refresh Token Not Found ». Ils perdent leur session serveur **sans rien dire** : l'employé reste affiché (session locale de 12 h), les données continuent de s'afficher, mais les appels au serveur partent avec la clé publique au lieu du jeton de l'employé.
- 14 h 12 : l'ordi de l'atelier (Windows) pose une question à l'Assistant → la fonction ne reconnaît aucun employé → 401 « Non connecté ». Le message de l'app laissait croire que la fonction n'était pas installée.

Même piège pour **QuickBooks** (401 sans compte d'employé) et à l'ouverture de l'app quand la session locale de 12 h était échue (cette sortie-là aussi était globale).

## Corrections
- **« Changer d'utilisateur » ne déconnecte plus que cet appareil** (`signOut({ scope: "local" })`), idem au démarrage (session de 12 h échue) et quand un compte n'a pas de dossier employé. Aucun `signOut()` global ne reste dans l'app.
- **Fenêtre « 🔒 Reconnexion au serveur »** : si le serveur déconnecte quand même l'appareil (mot de passe changé, session révoquée…), l'app le voit tout de suite et redemande **seulement le mot de passe** de l'employé à l'écran. Rien n'est effacé, on reste sur le bon ouvert. Lien « Ce n'est pas toi ? Changer d'utilisateur ».
- **Au démarrage** : employé encore affiché mais plus de session serveur → même fenêtre.
- **Assistant MTR** : la session est vérifiée **avant** d'envoyer. Si elle manque : fenêtre de reconnexion, puis la question part toute seule. « Plus tard » : rien n'est envoyé et la question reste écrite.
  - Un 401 affiche maintenant « cet appareil n'est plus connecté au serveur » et ouvre la fenêtre, au lieu de « la fonction serveur est-elle installée ? ».
  - Les autres erreurs affichent le vrai message du serveur (ex. clé Anthropic manquante).
- **QuickBooks** : même chose sur un 401 sans session. Un 401 avec session garde le message du serveur.
- Employé qui entre avec son **NIP** (pas de compte avec mot de passe) : aucune fenêtre au démarrage. S'il ouvre l'Assistant : « ton compte n'est pas encore créé, demande à l'administration (dossier employé → 🔑) ».
- La fenêtre entre dans la pile des fenêtres (v71) : elle passe par-dessus le bon live, le calendrier, etc.

## Tests
- `test-v162.js` 36/36 : aucun `signOut()` global ; vérification au démarrage ; « Changer d'utilisateur » = local sans fenêtre ; session perdue → fenêtre, rien d'effacé ; mauvais / bon mot de passe ; employé NIP ; Assistant sans session (reconnexion puis envoi automatique), « Plus tard », session bonne, 401, autre erreur ; QuickBooks 401 avec / sans session ; démarrage avec / sans session ; une seule fenêtre ; nom échappé.
- Sabotages : 12 fautes volontaires, 11 attrapées. La 12e (drapeau « déconnexion voulue » retiré) est couverte par une 2e protection : l'employé est déjà retiré de l'écran quand l'évènement arrive. `test-v162.js` sur la v161 : échoue.
- Non-régression : `test-v161.js` 42/42, `test-v160.js` 16/16, `test-v159.js` 63/63, `test-v159b.js` 8/8. Syntaxe des 12 blocs : OK.
- Captures Chromium de la fenêtre (ordinateur jour et nuit, iPhone 390 px) : lisible, par-dessus le reste, aucun débordement, 0 erreur JavaScript.

## À savoir
- Tant que la v162 n'est pas déployée **partout** (ordi de l'atelier, iPhone, tablettes : recharger l'app), un appareil encore en v161 qui fait « Changer d'utilisateur » peut encore déconnecter ce compte ailleurs. Avec la v162, la fenêtre de reconnexion rattrape le coup.
