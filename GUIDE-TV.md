# 📺 TV du lift — installation (v170)

La TV **affiche seulement**. Chaque technicien pilote avec **son propre compte**, depuis son cell ou plus tard depuis
la tablette Galaxy Tab A11+. Ses punchs restent à son nom. **Aucun compte à créer.**
**Rien à taper sur la TV** : elle affiche un code, le technicien le confirme sur son cell.

## 1. La table des écrans (1 min)

Supabase → **SQL Editor** → **New query** → coller tout `edge/ecrans.sql` → **Run**.

- Crée la table `ecrans`, une ligne par TV. Ce que la TV affiche vit là, **pas** dans `tableau`, qui reste protégée
  par son garde-fou.
- Crée aussi la table `tv_jumelages` (les codes de branchement). Seule la fonction du point 2 y a accès.
- La ligne `lift` est créée. Le script se relance sans danger (déjà fait en v169 : le relancer quand même, pour
  `tv_jumelages`).

## 2. La fonction « tv-jumelage » (2 min)

Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.

1. Nom : `tv-jumelage` (exactement).
2. Coller tout `edge/tv-jumelage/index.ts` → **Deploy**.
3. Dans la fonction → **Details** (ou **Settings**) : **désactiver « Verify JWT »** (ou « Enforce JWT verification »),
   puis enregistrer.
   - Pourquoi : la TV n'a pas encore de session quand elle demande son code. La fonction vérifie elle-même le compte
     du technicien qui confirme.
   - Sans ça, la TV affiche « Code indisponible » et propose le mot de passe (ça marche quand même, mais il faut taper).

Aucune clé à ajouter : la fonction utilise celles du projet.

## 3. La TV Fire TV (5 min)

1. Appstore Amazon → installer **Silk** (gratuit).
2. Ouvrir `atelier.mtrperformance.ca/tv.html?ecran=lift`. Le lien `atelier.mtrperformance.ca/?tv=lift` mène au même endroit.
3. La TV affiche un **code à 6 chiffres** et un **code QR**. Avec son cell, le technicien :
   - vise le code QR avec l'appareil photo : l'app s'ouvre avec le code déjà rempli → **📺 Brancher** ;
   - ou, dans l'app : **☰ Menu → 📺 Brancher une TV** (ou la tuile **📺 Brancher une TV** de « Mon écran ») → taper le
     code → **📺 Brancher**.
   - Il doit être connecté à l'app avec son **mot de passe** (le NIP seul ne suffit pas).
   - En 3 secondes, la TV se branche avec **son** compte et suit tout de suite **son punch** : le bon où il est punché.
   - Elle reste branchée, même rallumée : on ne le fait qu'une fois.
4. Le code vit 10 minutes. Expiré : appuyer sur le **bouton du centre** de la télécommande pour en avoir un nouveau.
5. Mettre la page en favori ou en page d'accueil de Silk, et la laisser ouverte en permanence.
6. Fire TV → **Paramètres** → **Affichage et sons** → **Économiseur d'écran** → **Heure de début** : **Jamais**.

**Sans le cell** : sous le code, « ou avec ton mot de passe » ouvre le formulaire (`p.nom` et son mot de passe).

Sécurité du code :
- à usage unique, 10 minutes ;
- le code affiché ne suffit pas : la TV garde un secret que personne ne voit ;
- aucun mot de passe ne passe par la TV.

La page refuse :
- un **compte d'administration** : jamais sur un écran visible de tous ;
- un employé inactif ;
- un employé qui n'a qu'un NIP : il faut un compte avec mot de passe, comme pour se connecter à l'app.

## 4. Au quotidien

**Le bon de travail**
- La TV suit **le punch** du technicien qui l'a branchée : il entre dans un bon, la TV l'affiche ; il change de bon,
  elle suit.
- **Un autre technicien travaille au lift ?** Dans son bon live, avec son compte, il touche **📺 TV**. La TV suit
  alors **son** punch. Rien à rebrancher, ses punchs restent à son nom.
- Le bouton devient **📺 Sur la TV ✓**. Le toucher encore arrête l'affichage.
- Punch fermé : la TV garde le dernier bon, avec « pas de punch en cours ».
- Sur la TV : n° du bon, machine, client (le nom seulement, jamais le téléphone), le chrono du punch, travaux,
  reste à faire, checklists (✔ / ☐), pièces (utilisée / reçue / à recevoir), dernières notes.
- On coche sur le cell : la TV change en 1 à 2 secondes.

**Une procédure (📋)**
- Dans la procédure, touche **📺 TV**. La TV montre l'étape en cours, en très gros : spec et couple, alertes, actions à
  cocher (par cylindre ou par côté), mesures avec leur verdict. Elle montre aussi la page du manuel si le PDF est dans l'app.
- **Précédent / Suivant** sur le cell font avancer la TV.
- **Cocher sur la TV (v175)** : la ligne en cours est encadrée en or. En arrivant sur une étape, c'est la 1re ligne
  pas encore cochée (là où tu es rendu).
  - **▲ ▼** : ligne précédente / suivante. La liste défile pour la suivre ; en bas, « ▼ 5 plus bas » dit ce qui
    reste hors de l'écran.
  - **Bouton du centre (OK)** : coche la ligne, et passe tout seul à la prochaine pas cochée. Encore OK sur une ligne
    cochée : décochée. Une ligne par côté ou par cylindre : un côté à chaque OK.
  - C'est la même case que sur le cell : le cell et la tablette la voient cochée en 1 à 2 secondes, et l'inverse.
- **Figures d'une ligne (v175)** : à droite de la ligne, le badge « 📷 Fig. » (ou « 📷 4 fig. ») dit qu'elle a des
  figures. Quand la ligne est en cours, ses figures s'ouvrent à droite, et **⏯** (lecture / pause) passe de l'une à
  l'autre (« 2 / 4 ⏯ »). Une ligne sans figure : ce sont les figures de l'étape, comme avant.
- **◀ ▶** de la télécommande : étape précédente / suivante. ⏩ et ⏪ marchent aussi, et le cell suit.
- Étape sans cases (rare) : comme avant, ▲ ▼ passent d'une figure à l'autre et le bouton du centre fait avancer.
- Au pointeur (mode curseur de Silk) ou au doigt : toucher une ligne la coche, toucher son badge 📷 ouvre ses figures.
- **À essayer** : selon le mode de Silk, les flèches peuvent déplacer le curseur au lieu d'agir sur la page. Dans ce
  cas, le pointeur marche aussi : viser la ligne et appuyer au centre.
- **📺 Sur la TV** (toucher encore) : la TV revient au bon en cours.

**Rien à afficher** : grande horloge et nom de l'écran.

## Toute seule

- Coupure du réseau ou du temps réel : point rouge « reconnexion… ». Elle se rebranche et relit tout. En plus, elle
  relit tout chaque minute.
- Après un déploiement Netlify, elle se recharge d'elle-même en moins de 10 minutes. Elle se recharge aussi la nuit
  (3 h 30).
- Au rallumage, elle revérifie le compte. Un employé parti, désactivé ou devenu administrateur : elle se débranche
  et redemande un compte.
- Elle signale qu'elle est allumée toutes les 90 s. Dans l'app, le choix de la TV affiche 🟢 allumée ou ⚪ pas vue
  depuis un moment.
- Le texte rapetisse tout seul quand un bon a beaucoup de lignes, pour que tout tienne à l'écran.

## Une 2e TV (plus tard)

Sur la 2e TV : `atelier.mtrperformance.ca/tv.html?ecran=poste2`, puis la brancher avec son code (ou un mot de passe de technicien).
L'écran s'inscrit tout seul, et dans l'app, 📺 TV demande alors laquelle.

## Débrancher une TV

Changer le mot de passe du technicien dont le compte a branché la TV (Administration → Dossiers employés), ou le
désactiver. La TV revient à l'écran de connexion.
