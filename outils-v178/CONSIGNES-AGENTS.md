# Consignes communes aux agents de la v178

À lire en entier avant de toucher au code. Le maître d'œuvre (Fable) fusionne les lots dans un ordre fixé ; un lot qui
sort de ses zones ou qui ne prouve pas ses tests est renvoyé.

## 1. Où tu travailles
- Dans **ton worktree** (chemin donné dans ta mission), sur **ta branche** `v178-<lot>`. Jamais dans
  `/home/user/Suivi-mtr` directement, jamais dans le worktree d'un autre lot.
- Tu commets sur ta branche (messages en français, préfixe `v178-<LOT> :`). **Tu ne pousses rien** (`git push`
  interdit) : Fable fusionne. Pas de `git rebase`, `git merge`, `git reset --hard`, `git stash` sur une autre branche.
- Le dépôt est `index.html` + quelques fichiers : il n'y a ni build, ni `npm install`, ni formateur.

## 2. Comment tu modifies index.html (2,3 Mo, 30 435 lignes, 14 blocs `<script>`)
- **Repère le code par nom de fonction et chaîne unique**, jamais par numéro de ligne : les lignes du plan sont celles
  de la v175, le fichier est en v177 (décalage de +44 à +60 lignes). La table `outils-v178/CORRESPONDANCE-v177.md`
  donne les lignes v177 des ancres et des symboles.
- `Grep -n` puis `Read` avec `offset` / `limit`. **Ne lis jamais en entier** les lignes énormes (96, 98-99, ~1973,
  ~2037 : bibliothèques et images base64 ; `sed -n 'a,bp' | cut -c1-220` si besoin).
- **Interdits** : reformater, réindenter, trier ou déplacer du code existant ; `replace_all` ; `prettier` / `eslint
  --fix` ; toucher à `APP_VERSION`, `version.txt`, un `CHANGELOG-*`, la ligne d'historique 43 (1 160 caractères), un
  fichier de test existant qui n'est pas à toi.
- **Tes ajouts** vont (a) dans **ton bloc** `<script id="v178-<LOT>">` / `<style id="v178-<LOT>">` posés par le socle
  avant `</body>`, (b) sous **tes ancres** `//@@v178-<LOT> …` (une ligne par ancre, tu ajoutes dessous, tu ne
  déplaces pas l'ancre), (c) en **1 à 3 lignes de crochet** dans le code existant, chacune marquée d'un commentaire
  `// v178-<LOT> : …`. Le CSS neuf va dans ton `<style>`, jamais dans le CSS principal ni dans le gabarit CSS injecté
  d'une IIFE (template literal).
- Les zones listées « NE PAS toucher » dans ta mission appartiennent à un autre lot : si tu as besoin d'un crochet
  dedans, écris-le dans ton rapport (« crochet demandé à <LOT> ») et continue sans.
- Style : nommage français, commentaires courts « v178 : … », texte d'interface en français québécois, guillemets
  doubles dans les chaînes JS qui contiennent une apostrophe, **tout texte saisi par un utilisateur passe par
  `echap()`**, aucun `</script>` littéral dans une chaîne, aucun backtick dans le JS embarqué du gabarit `bonDeTravail`.
- Un nouveau champ sur un bon : `m.champ` + `sauvegarder()` ; lecture tolérante à `undefined` (anciens bons, bons
  créés par le serveur sans ce champ). Jamais renommer `echeance`, `heure`, `dureeEstimee`, `technicien`, `statut`,
  `demandeId`, `machineArrivee`, `arriveeLe`, `chrono`, `pieces`, `notesLive`, `notesTech` (lus par les fonctions
  Edge, la TV, l'impression).
- Pense : iPad et cellulaire (cibles 44 px, champs 16 px, pas de défilement horizontal), autre poste qui écrit en même
  temps (relire avant d'écrire, retrouver le bon par `id` au moment de l'écriture), impression du bon, TV du lift,
  rôle Réception (`roleDe`, options « voir les coûts » / « gestion », classes `sans-couts` / `sans-gestion`).

## 3. Serveur
- **Aucun agent n'exécute** `execute_sql`, `apply_migration`, `deploy_edge_function` ni n'envoie de SMS : le SQL est
  livré en fichier `edge/*.sql`, les fonctions Edge sont modifiées dans `edge/<nom>/index.ts` et c'est le patron qui
  déploie. Les lectures Supabase (schéma, politiques) sont permises si le connecteur est disponible.

## 4. Tests : obligatoires, et prouvés
- Tout tourne **sans jsdom**, dans Chromium : `node outils-v178/run-in-chromium.js test-xxx.js ./index.html`
  (variables `MTR_FAKE_NOW="2026-10-07T10:00:00-04:00"` pour simuler un mercredi, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).
  Un `test-vNNN.js` existant se lance tel quel ; le tien s'écrit sur `outils-v178/test-lib-v178.js` (faux Supabase,
  `chargerApp`, `connecter`, `ok()`, faux AudioContext / vibrate, `jourOuvrableIso`) — exemple : `outils-v178/test-v178-demo.js`.
- Ton fichier : `test-v178-<lot>.js` à la racine du dépôt. Il doit :
  1. **échouer** contre l'`index.html` de la base (`git show v177-base:index.html > /tmp/base.html` puis lancer contre
     `/tmp/base.html` ; tv.html / procedure.html sont dérivés du dossier de l'index : copie-les à côté) ;
  2. **passer** sur ta version ;
  3. **échouer pour chacune de 5 à 10 fautes volontaires** lancées avec `REPO=<ton worktree> outils-v178/sabotage.sh
     test-v178-<lot>.js "<texte exact, une seule occurrence>" "<remplacement>"` : fautes de **comportement** (une
     condition inversée, une écriture retirée, un garde enlevé), jamais une faute de syntaxe. Note le résultat
     « N attrapées sur N lancées ».
- Avant chaque commit : `python3 -I outils-v178/syntaxe.py index.html /tmp/chk` (node --check par bloc) puis
  `node outils-v178/smoke.js index.html` (l'app démarre, 0 erreur), puis ton test, puis les suites de régression
  listées dans ta mission (`MTR_FAKE_NOW=… outils-v178/run-all.sh ./index.html 'v16[4-9]|v17'` par exemple).
  `test-v171.js` est sauté (fichiers `bt089/` absents). Dix-huit suites exigent **zéro erreur JavaScript** : un
  `try/catch` autour de tout nouveau code appelé au chargement, sur un événement global ou dans une minuterie.
- Base de référence v177 : voir `outils-v178/README.md`.

## 5. Ton rapport (dernier message, données brutes pour Fable)
1. `git diff --stat v177-base..HEAD` de ta branche et la liste des zones touchées hors de ton bloc / tes ancres.
2. Tests : ton fichier (X/X), rouge sur la base (oui/non), sabotages N/N avec la liste des fautes, suites de
   régression relancées avec leurs chiffres.
3. Les critères d'acceptation de ta mission, un par un : ✅ / ❌ / non vérifiable (et pourquoi).
4. Ce que tu n'as pas pu vérifier (iPad réel, son, serveur…), les crochets demandés à d'autres lots, les décisions
   que tu as prises sur une ambiguïté.
5. Un fragment de changelog (3 à 10 lignes, style des `CHANGELOG-atelier-v17x.md`, avec ce qui change dans les
   habitudes de l'atelier) pour `CHANGELOG-atelier-v178.md`.
