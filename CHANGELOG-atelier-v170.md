# Suivi-Garage-Partage — v170 (29 sept. 2026)

Bâtie sur la v169.

**Serveur** : seulement pour brancher la TV par code (voir `GUIDE-TV.md`) :
- relancer `edge/ecrans.sql` ;
- déployer la fonction `tv-jumelage` avec « Verify JWT » désactivé.

Le reste de la v170 ne demande rien au serveur.

## 📦 Inventaire : « rien se calcule encore » (BT-103)
> J'avais 21 WCFQTC avant de faire la BT-103, j'ai facturé et utilisé 2.2 WCFQTC et c'est encore à 21 en inventaire.

La requête SQL de Jason montre :
- BT-103 est dans « Facturé », avec la facture QuickBooks (production) et 2,2 WCFQTC à la facturation ;
- le bon est marqué « sortie faite » ;
- **mais aucun mouvement au journal pour BT-103**, et le catalogue n'a pas bougé depuis le 16 sept.

Deux causes possibles, les deux corrigées :
- un cell ou une tablette resté ouvert **avec une vieille version de l'app** a facturé sans faire la sortie ;
- la sortie a été faite, puis **effacée**. Le catalogue et le journal étaient réécrits au complet par l'appareil qui
  enregistrait, avec sa copie. C'est le même problème que les bons en v168.

### Le journal fait foi
- Ce qu'un bon a déjà sorti du stock se lit dans le **journal des mouvements**, par bon. Un drapeau sur le bon ne
  suffit plus.
- Un bon marqué « sorti » sans mouvement sort ses pièces à la livraison, ou avec « Stock à corriger ».
- Les bons d'avant la v168 (sortie notée au journal avec le n° du bon) sont reconnus : rien de plus ne sort.
- Livrer un bon sort seulement ce qui manque, jamais deux fois.

### ⚠️ Stock à corriger (Inventaire › Articles)
- Un encadré rouge en haut, quand un bon facturé ne concorde pas avec le journal :
  - bons concernés : « Facturé », 🎁 cadeau, ou livrés depuis moins de 60 jours ;
  - articles suivis en inventaire seulement ;
  - pour chaque article : facturé, déjà sorti, ce qui sort (ou ↩️ revient en stock), en main avant → après.
- Les bons récents (moins de 30 jours) sont **cochés d'avance**. On décoche ce qu'on ne veut pas toucher.
- **📦 Mettre le stock à jour** : un mouvement par article au journal, avec le n° du bon.
- Rien ne bouge tout seul.
- BT-103 y sera : **WCFQTC 21 → 18,8**.

### Le catalogue et le journal ne sont plus écrasés
Comme la ligne des bons en v168, l'app relit le serveur avant d'écrire, et fusionne :
- **Quantités** : additionnées (serveur + ce que cet appareil a bougé). Deux sorties au même moment sur deux
  appareils font deux sorties.
- **Autres champs** (prix, description…) : ce que cet appareil a changé gagne. Le reste vient du serveur.
- **Articles** :
  - supprimé ailleurs : il ne revient pas ;
  - ajouté ailleurs : il reste ;
  - n° renommé ici : pas de doublon.
- **Journal** : chaque mouvement est gardé, peu importe l'appareil.
- **Temps réel** : fusionné, même pendant une écriture de cet appareil. Avant, il était ignoré.
- Une écriture à la fois, dans l'ordre.

### 🔄 Nouvelle version en ligne
- Un appareil resté ouvert avec une vieille version affiche un bandeau : « 🔄 Nouvelle version de l'app en ligne —
  Recharger ».
- L'app vérifie au réveil de l'appareil et aux 10 minutes. Elle lit `version.txt`, publié avec l'app.
- **À chaque version** : changer `APP_VERSION` dans `index.html` **et** `version.txt`.

## 🔢 N° de BT sur les cartes du tableau de bord
> J'aimerais voir le # de BT sur le carré de rendez-vous dans le tableau de bord aussi.

- Le n° du bon est en pastille, avant le nom de la machine, sur toutes les cartes (rendez-vous compris).
- Un bon sans numéro (vieux rendez-vous, bon venu d'une demande web) reçoit le suivant à l'enregistrement.

## 📅 L'horaire du jour suit le calendrier
> Il faut que les rendez-vous pris au calendrier priment sur les autres rendez-vous à faire.

**🔧 Ordre de travail** : les rendez-vous du calendrier passent **en premier**, à leur heure, avec le technicien du
calendrier. Les jobs commencées et le reste de la file se placent autour.
- Avant, seulement si la machine n'était pas encore arrivée. Une machine déjà là avec un rendez-vous à 10 h pouvait
  passer après d'autres jobs.
- Machine déjà là, heure dépassée : placée au plus tôt, avant le reste de la file. Note : « Rendez-vous à 08:30 : passe
  avant le reste de la file ».
- Une heure fixée à la main (📌) l'emporte toujours.
- Machine bloquée (pièce en attente) : toujours hors de l'horaire.
- Machine arrivée d'avance : on peut encore prendre de l'avance les jours d'avant, s'il y a de la place.

Ailleurs :
- Bloc 📅 encadré dans l'horaire : « Rendez-vous du calendrier — machine sur place ».
- « Mon écran » du technicien : « 📅 Rendez-vous · rendez-vous de 10:00 au calendrier ».
- Tableau de bord, « À faire ensuite » : dans l'ordre de l'horaire (par heure), et non plus dans l'ordre de la file.

## 📺 TV : brancher avec un code (option 2)
> C'est rough comme écriture, y'a pas une manière de transférer sur la TV d'un cellulaire ou de la tablette ?

La TV affiche un **code à 6 chiffres** et un **code QR**. Le technicien confirme sur son cell, avec son compte.
Rien à taper sur la TV.

**Dans l'app** :
- le code QR ouvre l'app avec le code rempli, après la connexion s'il le faut ;
- **☰ Menu → 📺 Brancher une TV** ;
- la tuile **📺 Brancher une TV** sur « Mon écran » (techniciens seulement).

**Sécurité** :
- code de 10 minutes, à usage unique ;
- la TV garde un secret que personne ne voit : le code seul ne suffit pas ;
- aucun mot de passe ne passe par la TV ;
- compte d'administration refusé (par la fonction et par la TV) ;
- le NIP seul ne suffit pas : il faut être connecté avec son mot de passe.

**Sur la TV** :
- Code expiré : le **bouton du centre** de la télécommande en affiche un nouveau.
- Fonction pas encore déployée : « Code indisponible ». Le formulaire du mot de passe s'ouvre en dessous.

**Serveur** :
- table `tv_jumelages` (dans `edge/ecrans.sql`) ;
- fonction `edge/tv-jumelage/index.ts`.

## Tests
- `test-v170.js` : **77/77**.
  - **Inventaire** :
    - BT-103 : drapeau sans mouvement → 2,2 à sortir ;
    - Stock à corriger : 60 jours, 30 jours cochés, pas suivi, concordant, décocher, 21 → 18,8, n° du bon, aucune
      2e sortie à la livraison.
  - **Fusion** :
    - vente d'un autre appareil gardée ;
    - prix d'un autre appareil gardé ;
    - ajouts et suppressions des deux côtés ;
    - deux sorties simultanées ;
    - renommage ;
    - temps réel pendant une écriture ;
    - écho de notre écriture ;
    - réécriture après un changement reçu pendant l'envoi.
  - **N° de BT** : sur les cartes, échappé, numéro donné au bon qui n'en avait pas.
  - **Horaire** :
    - rendez-vous du calendrier à son heure ;
    - job commencée autour ;
    - rendez-vous en retard en premier ;
    - 📌 l'emporte ;
    - bloquée exclue ;
    - aucun doublon ;
    - « Mon écran » et « À faire ensuite » dans l'ordre de l'horaire.
  - **TV** :
    - ?tvcode, confirmation, erreurs du serveur, 6 chiffres ;
    - tuile réservée aux techniciens ;
    - fenêtre par-dessus « Mon écran » ;
    - sur la TV : code, QR, attente puis connexion à usage unique, arrêt de l'attente, refus admin + nouveau code,
      expiration + bouton du centre, connexion refusée, fonction absente.
  - **Version** : même version, nouvelle version, réponse bizarre.
- Sabotages : **44** fautes volontaires (36 app, 8 TV), toutes attrapées.
- `test-v168.js` : le cas « sorti avant la v168 » a maintenant son mouvement au journal, comme dans la réalité. La
  fenêtre dit « ✔ déjà sorti du stock ». Mêmes attentes : rien ne sort deux fois.
- Non-régression :

  | Test | Résultat |
  |---|---|
  | `test-v169.js` | 54/54 |
  | `test-v168.js` | 56/56 |
  | `test-v168b.js` | 35/35 |
  | `test-v167.js` | 72/72 |
  | `test-v166.js` | 49/49 |
  | `test-v165.js` | 26/26 |
  | `test-v164.js` | 63/63 |
  | `test-v163.js` | 34/34 |
  | `test-v162.js` | 36/36 |
  | `test-v161.js` | 42/42 |
  | `test-v160.js` | 16/16 |
  | `test-v159.js` | 63/63 |
  | `test-v159b.js` | 8/8 |

- Tests exécutés dans Chromium, Supabase simulé. **Pas essayé** :
  - sur la vraie Fire TV ;
  - avec la vraie fonction `tv-jumelage` : la connexion à usage unique (`generateLink` / `verifyOtp`) est à essayer
    une fois déployée ;
  - avec les vrais appareils de l'atelier.

## À faire au déploiement
1. Supabase → SQL Editor : relancer `edge/ecrans.sql`.
2. Supabase → Edge Functions : `tv-jumelage`, « Verify JWT » **désactivé**.
3. Netlify : glisser `deploy-atelier-v170.zip`.
4. **Recharger tous les appareils** (cells, tablettes, postes) une dernière fois. Dès la v170, un bandeau le
   demandera tout seul.
5. Inventaire › Articles → **⚠️ Stock à corriger** : vérifier BT-103 (et les autres), puis **📦 Mettre le stock à jour**.
