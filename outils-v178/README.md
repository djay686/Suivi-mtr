# outils-v178 — outillage de test de la v178 (hors zip de déploiement)

Ce dossier n'est **pas** livré dans `deploy-atelier-v178.zip`. Il sert aux agents qui réalisent la v178 et au patron
pour relancer la non-régression. Tout tourne **sans jsdom** : les `test-v1xx.js` existants, écrits pour jsdom, sont
lancés tels quels dans Chromium (Playwright, déjà installé dans l'environnement de travail ; `/opt/pw-browsers`).

| Fichier | Rôle | Usage (depuis la racine du dépôt) |
|---|---|---|
| `run-in-chromium.js` | Lance un `test-vNNN.js` dans Chromium ; `require("jsdom")` est remplacé par un iframe de même origine. `MTR_FAKE_NOW` décale l'horloge, `MTR_TZ` le fuseau. | `node outils-v178/run-in-chromium.js test-v175.js ./index.html` |
| `run-all.sh` | Toute la suite, avec les chiffres attendus des CHANGELOG. Code de sortie = nombre de fichiers en échec. | `MTR_FAKE_NOW="2026-10-07T10:00:00-04:00" outils-v178/run-all.sh ./index.html` |
| `sabotage.sh` | Applique UNE faute volontaire sur une copie d'index.html et vérifie que le test **échoue** (preuve que le test attrape le bogue). | `REPO=$PWD outils-v178/sabotage.sh test-v178-fac.js "texte exact unique" "remplacement"` |
| `run-edge-html.js` | Lance `edge/test-sms-entrant-v172.html` (ou v178) dans Chromium avec le `typescript.js` local (cdnjs est bloqué). | `node outils-v178/run-edge-html.js edge/sms-entrant/index.ts` |
| `smoke.js` | « L'app démarre sans erreur » : charge index.html avec un Supabase factice, 0 erreur exigée. | `node outils-v178/smoke.js index.html` |
| `syntaxe.py` | `node --check` sur chaque bloc `<script>` d'index.html (puis, à l'intégration, sur la concaténation : attrape un `const` redéclaré entre blocs). | `python3 -I outils-v178/syntaxe.py index.html /tmp/chk` |
| `test-lib-v178.js` | Socle commun des nouveaux tests : faux Supabase (select/insert/upsert/update/delete, eq/neq/in/is/order/limit, pannes, `pousser()` pour simuler un autre poste), chargement de l'app, faux AudioContext et `navigator.vibrate`, `jourOuvrableIso`, `connecter`, `ok()`. | `const L = require("./outils-v178/test-lib-v178.js")` |
| `test-v178-demo.js` | Exemple minimal d'utilisation du socle. | `node outils-v178/run-in-chromium.js outils-v178/test-v178-demo.js ./index.html` |

Base de référence mesurée sur la **v177** (7 oct. 2026, Chromium 141, `MTR_FAKE_NOW` = mercredi) : **804/804** sur les
19 fichiers v159 à v175 (v159 63, v159b 8, v160 16, v161 42, v162 36, v163 34, v164 63, v165 26, v166 49, v167 72,
v168 56, v168b 35, v169 54, v170 77, v172 52, v172b 24, v173 14, v174 36, v175 47 — mêmes chiffres que sur la v175),
`test-v176.js` **82/82** et `test-v177.js` **48/48** (l'exécuteur pose `win.__NAVIGATEUR = true` pour que ces deux
tests vérifient les styles calculés comme dans un vrai navigateur ; sans cela : 78/82 et 47/47). **Base complète =
934 assertions.** `edge/test-sms-entrant-v172.html` 33/33 ; `smoke.js` 0 erreur. `edge/test-quickbooks-v160.mjs`
importe `esbuild`, absent ici : non lancé (57/57 sur la v175 avec un transpileur TypeScript de remplacement).
`test-v171.js` est sauté : il exige `bt089/` et `bt089.zip`, absents du dépôt.

Règle du projet pour chaque nouveau test `test-v178-<lot>.js` : il doit **échouer** contre l'index.html v175 intact,
**passer** sur la version modifiée, puis **échouer** pour chacune de 5 à 10 fautes volontaires lancées avec
`sabotage.sh` (une faute de comportement, jamais une faute de syntaxe). Le CHANGELOG indique « Sabotages : N sur N attrapés ».
