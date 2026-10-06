# Suivi-Garage-Partage — v175 (30 sept. 2026)

Bâtie sur la v174. **Rien à faire au serveur** : la TV écrit ses coches dans la même table que le cell
(`procedure_etat`), que le compte de technicien de la TV peut déjà modifier (vérifié).

## 📺 TV : cocher chaque case à la télécommande, et ouvrir les figures de la ligne
> J'aimerais cocher chaque petit checkbox pour savoir où je suis rendu, et dans la ligne, tassé à droite, ouvrir les
> figures reliées. Sinon j'aime le rendu.

### La ligne en cours
- Une ligne est **encadrée en or** : c'est la ligne en cours.
- En arrivant sur une étape (à la télécommande ou envoyée du cell), c'est la **1re ligne pas encore cochée** : là où tu
  es rendu.
- **▲ ▼** : ligne précédente / suivante.
- **Bouton du centre (OK)** : coche la ligne et passe tout seul à la prochaine pas cochée.
  - OK sur une ligne déjà cochée : décochée.
  - Ligne par côté ou par cylindre (G / D…) : un côté à chaque OK (« ✔ G · OK pour D »).
  - Dernière case : « ✅ Étape terminée · ▶ étape suivante ». Une ligne sautée plus haut : OK y ramène.
- La coche va **dans la même case que le cell** : le cell et la tablette la voient cochée en 1 à 2 secondes, et ce qui
  est coché sur le cell apparaît sur la TV.
- Réseau coupé : la case redevient vide et la TV affiche « ⚠️ Pas enregistré (réseau) : refais OK ».

### Les figures de la ligne
- **À droite de chaque ligne** qui en a : un badge « 📷 Fig. » ou « 📷 4 fig. ».
- La ligne en cours **ouvre ses figures** dans le panneau de droite, et son badge s'allume.
- **⏯ (lecture / pause)** : figure suivante de la ligne (« 2 / 4 ⏯ »).
- Une ligne sans figure : les figures de l'étape, comme avant.

### Les étapes
- **◀ ▶** : étape précédente / suivante, comme avant. ⏩ ⏪ aussi.
- Une étape sans cases (rare) : comme avant, ▲ ▼ passent d'une figure à l'autre et OK fait avancer.
- Au pointeur (mode curseur de Silk) ou au doigt : toucher une ligne la coche ; toucher son badge 📷 ouvre ses figures.

### Les longues étapes
- Avant, une étape trop longue était **coupée en bas** : sur ta photo, l'étape 2 (bougies) montrait 10 lignes sur 15,
  et les mesures « État des vieilles bougies » n'étaient pas à l'écran.
- Maintenant, la liste **défile pour suivre la ligne en cours**. Le titre, les specs et les mesures restent en place.
  En bas : « ▼ 6 plus bas », « ▲ 3 plus haut ».
- Le cadre de la ligne en cours ne prend pas de place : à 960 × 540 (Fire TV), 9 lignes de l'étape 2 sont visibles,
  avec les mesures en dessous.

### Ce qui change dans les habitudes
- **▲ ▼ changent de ligne**. Avant, ils changeaient de figure : c'est maintenant **⏯**.
- **Le bouton du centre coche**. Avant, il passait à l'étape suivante : c'est maintenant **▶**.
- Le bas de l'écran le rappelle : « ▲ ▼ ligne · OK cocher · ◀ ▶ étape · ⏯ figures ».

## Tests
- `test-v175.js` : **47/47**. Procédure d'essai : figures par ligne, côtés G / D, une étape sans cases, une de 40
  lignes.
  - Arrivée sur la 1re ligne pas cochée, cadre en or.
  - Badges à droite (une photo absente ne compte pas).
  - Figures de la ligne ou de l'étape ; ⏯ et le tour.
  - OK coche / décoche, écrit dans `procedure_etat` par le technicien, passe à la suivante.
  - Bouton du centre de la Fire TV (code 23) ; côtés un à la fois.
  - Coché sur le cell → TV ; « Étape terminée » ; « il en reste plus haut » ; réseau coupé.
  - Pointeur : ligne et badge.
  - ◀ ▶ ; étape sans cases comme avant.
  - 40 lignes : défile vers le bas et vers le haut, « ▲ / ▼ N », le titre reste en place.
  - Étape envoyée du cell → 1re ligne pas finie.
- `test-v171.js` : la partie TV est mise à jour pour les nouvelles touches, avec la vraie procédure BT-089 : la ligne
  des vis de l'intercooler ouvre ses 4 figures, ⏯ passe à 2 / 4, ▲ ouvre les 2 figures de la 1re ligne, une ligne sans
  figure montre les 11 figures de l'étape. **65/65**.
- Vu à l'écran (960 × 540) avec la vraie procédure BT-089.
- Sabotages : **15 sur 15 attrapés** :
  - pas la 1re ligne pas cochée, rien écrit au serveur, pas d'avance ;
  - tous les côtés d'un coup, pas de retour en arrière si le réseau refuse ;
  - pas de badge, figures de la ligne ignorées, ⏯ ignoré, ▲ ▼ qui changent encore de figure ;
  - la liste qui ne remonte pas, la liste qui saute à chaque rendu ;
  - le badge touché qui coche ;
  - étape sans cases qui n'avance plus ;
  - photo absente comptée, coche sans le nom du technicien.
  - Un 1er essai du sabotage « la liste ne remonte pas » n'était pas attrapé : la liste était recréée en haut à chaque
    rendu, et la ligne en cours retombait toujours en bas. Corrigé (la liste garde sa position) et vérifié.
- Non-régression : tout passe.

  | Test | Résultat |
  |---|---|
  | `test-v174.js` | 36/36 |
  | `test-v173.js` | 14/14 |
  | `test-v172.js` | 52/52 |
  | `test-v172b.js` | 24/24 |
  | `test-v171.js` | 65/65 |
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

## À faire au déploiement
1. Netlify : glisser `deploy-atelier-v175.zip` (il contient la v174).
2. La TV se recharge d'elle-même en moins de 10 minutes (ou débranche / rebranche-la). Les appareils : « 🔄 Nouvelle
   version » → **Recharger**.
3. Sur la TV, dans une procédure : ▲ ▼ pour choisir la ligne, OK pour cocher, ⏯ pour les figures.
