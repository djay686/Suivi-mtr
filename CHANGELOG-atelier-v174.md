# Suivi-Garage-Partage — v174 (30 sept. 2026)

Bâtie sur la v173 (conversation complète dans Communications) et la v172, qui sont comprises dans ce zip.
**Rien à faire au serveur.**

## 🖨️ Bon de travail imprimé : étiquette, clé du client, dommages
> Dans les bons de travail que j'imprime pour avoir la signature du client : une case à cocher si on a la clé du
> client, un endroit pour écrire les dommages, soit machine ou remorque. Un rectangle en haut pour écrire le numéro de
> l'étiquette qu'on lui donne, si j'ai fait imprimer le BT avant de l'inscrire. Si elle est déjà entrée, l'indiquer
> en haut en gros, bien visible.

### En haut : « 🏷️ N° d'étiquette »
- Un cadre au trait épais entre « BON DE TRAVAIL BT-… » et les codes à scanner.
- **Étiquette déjà inscrite** (le « N° machine / carton » de la fiche) : le numéro y est en très gros.
- **Pas encore inscrite** : le rectangle s'imprime vide, pour l'écrire à la main.
- Il remplace la petite pastille orange « 🏷️ Machine n° … ».
- On peut aussi l'écrire à l'écran dans le bon : la ligne « N° machine » suit, et c'est enregistré sur la fiche.

### Nouvelle section « État à l'arrivée » (au recto, avant les travaux)
- **☐ 🔑 Clé du client — laissée à l'atelier** : case à cocher à la main, ou à l'écran (enregistrée tout de suite).
- **Dommages — machine** et **Dommages — remorque** :
  - deux zones de 4 lignes pour écrire à la main ;
  - on peut aussi les taper à l'écran : enregistrées sur la fiche, et réimprimées au prochain bon.
- L'autorisation que le client signe dit maintenant aussi : « Je confirme l'état à l'arrivée noté ci-dessus (clé,
  dommages de la machine et de la remorque). »
- Un bon resté ouvert n'efface pas une étiquette inscrite ailleurs entre-temps (ex. « Machine arrivée ») : seul ce qui
  a changé dans le bon est enregistré.

### Corrigé au passage : pièce en double
- Une pièce ajoutée à la main dans le bon était ajoutée **deux fois** à la fiche si on faisait 🖨️ Imprimer puis
  💾 Enregistrer / Fermer (vérifié : « Courroie, Filtre à huile, Filtre à huile »).
- Maintenant, une fois enregistrée, la ligne sait qu'elle est sur la fiche : la corriger la modifie, sans en ajouter
  une autre.

## Tests
- `test-v174.js` : **36/36**.
  - Étiquette inscrite : en gros (42 px), cadre épais, en haut entre le n° de BT et les codes.
  - Étiquette pas inscrite : rectangle vide à l'impression (« à écrire » seulement à l'écran), assez haut pour écrire.
  - Clé cochée ou pas selon la fiche.
  - Dommages déjà notés, réimprimés avec leurs retours de ligne ; 4 lignes de 20 px à l'impression.
  - Section au recto avant les travaux ; phrase de l'autorisation.
  - Écrire à l'écran :
    - étiquette dans le rectangle ou dans la ligne « N° machine » (l'un suit l'autre), Entrée sans retour de ligne ;
    - cocher / décocher la clé, dommages ;
    - rien d'écrit si rien n'a changé ;
    - un bon resté ouvert ne remplace pas une étiquette inscrite ailleurs ;
    - 💾 Enregistrer garde tout.
  - Texte échappé.
  - Recto d'un bon ordinaire : 856 px sur 900, tient sur une page lettre sans réduction. Un bon avec beaucoup de
    pièces ou de longs travaux est réduit pour tenir sur la page, comme avant.
  - Pièces ajoutées à la main : une seule fois après deux enregistrements, corrigées sur place, une 2e ajoutée une fois.
- Sabotages : **15 sur 15 attrapés** :
  - étiquette absente du cadre, « à écrire » imprimé, rectangle pas relié à la ligne « N° machine » ;
  - tout renvoyer au lieu des changements, pas d'enregistrement ;
  - clé jamais lue, clé pas cochée à l'ouverture ;
  - état absent de 💾 Enregistrer ;
  - dommages non échappés ;
  - phrase de l'autorisation retirée, Entrée qui fait un retour de ligne, lignes trop serrées à l'impression ;
  - pièces : ligne pas marquée, place pas renvoyée, place fausse.
- Non-régression : tout passe.

  | Test | Résultat |
  |---|---|
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
1. Netlify : glisser `deploy-atelier-v174.zip`. Si la v172 ou la v173 n'étaient pas encore en ligne, elles y sont :
   voir leurs changelogs.
2. Les appareils affichent « 🔄 Nouvelle version » : **Recharger**.
3. Imprime un bon pour voir : le cadre de l'étiquette en haut, et « État à l'arrivée » sous les infos du client.
