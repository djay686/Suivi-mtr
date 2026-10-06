# Suivi-Garage-Partage — v171 (30 sept. 2026)

Bâtie sur la v170.

**Serveur** (une fois) : relancer `edge/procedures.sql` dans le SQL Editor. Ça ajoute l'espace privé **procedures**
pour les photos. Sans lui, l'import marche quand même, sans les photos, et l'app dit quoi faire.

## 📥 Importer une procédure déjà faite par Claude
> J'aimerais une place pour entrer les procédures déjà faites par Claude sur un autre ordinateur, dans le live, pour
> ensuite la visualiser sur la télé et la contrôler avec la manette de la TV. En zip si on veut les photos.

### Dans le bon de travail live → 📋 Procédure → **📥 Procédure déjà faite**
- **📄 Fichier .html ou .zip** :
  - `index.html` seul : étapes, cases, specs et mesures, sans les photos ;
  - le **.zip** : avec les photos (le dossier compressé par Windows, même avec un dossier à l'intérieur).
- **📁 Dossier de la procédure** : le dossier au complet, avec son dossier `img`. Rien à compresser.
- Avancement dans la fenêtre : lecture, nombre d'étapes, de cases et de mesures, puis « Photos : 12 / 75 ».
- Quand c'est fini, la procédure s'ouvre. Elle est dans la liste du bon, comme les autres.

### Ce qui est repris (testé avec la vraie « Procédure BT-089 »)
- Les 15 étapes :
  - titres, « pourquoi », cases à cocher (valeurs en gras gardées) ;
  - cases par côté (G / D) et par coin (AVG AVD ARG ARD) ;
  - alertes, specs de l'étape, titre de la liste ;
  - préparation et **décisions du client**.
- **Mesures avec leur verdict** : les vérifications de la page deviennent des limites.
  - Courroie : minimum 34,7 mm, « Sous la limite de 34,7 mm : appeler le client » en rouge.
  - Pincement : 2,6 à 12,8 mm.
  - Plaquettes : minimum 0,5 mm, en jaune.
  - Choix : « Éclats » sur l'aimant → rouge ; huile du diff « Claire » → vert, « Foncée » → jaune.
- Onglet **Specs** (4 groupes) et **références du manuel** par étape (« Ignition Coils and Spark Plugs p. 342-346 »).
- **Figures** :
  - galerie « Figures (11) » dans l'étape ;
  - bouton « 2 fig. » sur la case qui en parle ;
  - la figure en grand, avec sa légende et sa page du manuel.
- Faite pour **un autre bon** (ex. BT-089 importée dans BT-103) : l'app demande avant.
- Une page d'un autre format est lue « texte seulement » : chaque titre devient une étape, chaque liste des cases, et
  les images suivent.
- Pas repris : les calculs propres à une page (ex. « pneus de dimensions différentes : pas de permutation »).

### Sur la TV 📺
- Dans la procédure, **📺 TV** (comme en v169). La TV montre l'étape avec sa figure à côté : « 1 / 11 ▲▼ ».
- **Télécommande** :
  - **▶ ◀** (ou le bouton du centre) : étape suivante / précédente. Le cell suit.
  - **▲ ▼** : figure suivante / précédente de l'étape. Elle revient à la 1re figure à chaque étape.
  - Étape sans figures : ▲ ▼ changent d'étape, comme avant.
- En bas de la TV : « ◀ ▶ télécommande ou cell · ▲ ▼ figures ».

### Sécurité
- **La page importée n'est jamais exécutée dans l'app.** Elle tourne dans un cadre isolé (sandbox) :
  - sans accès à l'app, à la session de l'employé ni aux données ;
  - elle renvoie seulement ses données, avec un jeton que seule l'app connaît ;
  - tout est revalidé : textes, tailles, identifiants.
- Testé avec une page piégée : elle essaie de toucher l'app, son stockage, et d'envoyer de fausses étapes. Rien ne
  passe, et son titre `<img onerror>` reste du texte.
- Photos dans un stockage **privé** (liens signés de quelques heures), 10 Mo maximum par image.
- Import raté en cours de route : la procédure et les photos déjà envoyées sont retirées.
- Supprimer la procédure (🗑️, administration) retire aussi ses photos.

## Petite correction
- « Stock à corriger » (v170) : « livré il y a 45 j » ne dépend plus de l'heure. Le matin, ça disait 44.

## Tests
- `test-v171.js` : **65/65**, dans Chromium, avec la vraie procédure BT-089 (index.html + 75 photos) et un .zip fait
  par Windows.
  - **Import** : page seule, .zip (photos octet pour octet), dossier (photos partielles) ;
  - **Conversion** : étapes, côtés, alertes, limites et verdicts, specs, références, figures des cases ;
  - **Refus et erreurs** : autre bon (Non / Oui), page sans procédure, .zip abîmé, pas de .html, stockage absent,
    enregistrement refusé (tout retiré), tables absentes ;
  - **Sécurité** : page piégée ;
  - **Autre format** : lecture du texte seulement ;
  - **Visionneuse** : galerie, figure en grand, case partagée, mesure rouge, choix rouge, specs ;
  - **TV** : figure, ▲ ▼ avec le tour complet, ▶ remet la 1re figure, étape sans figure ;
  - **Suppression** : les photos partent aussi.
- Sabotages : **35** fautes volontaires (21 dans l'app, 7 dans la visionneuse, 7 dans la TV), toutes attrapées.
- `test-v170.js` 77/77 : il choisit maintenant des jours ouvrables pour les rendez-vous, peu importe le jour du test,
  et suit le n° de version.
- Non-régression :

  | Test | Résultat |
  |---|---|
  | `test-v170.js` | 77/77 |
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

- **Pas essayé** : sur la vraie Fire TV (▲ ▼ de la télécommande dans Silk), ni avec le vrai stockage Supabase.

## À faire au déploiement
1. Supabase → SQL Editor : relancer `edge/procedures.sql`.
2. Netlify : glisser `deploy-atelier-v171.zip`.
3. Les appareils ouverts affichent « 🔄 Nouvelle version » : toucher **Recharger**.
4. Essayer : bon BT-089 → 📋 Procédure → 📥 → le dossier « Procédure BT-089 » (ou son .zip) → 📺 TV.
