# Suivi-Garage-Partage — v167 (28 sept. 2026)

Bâtie sur la v166. **Demande une installation côté serveur** (une fois) : voir `GUIDE-PROCEDURES.md`
(`edge/procedures.sql` + fonction `edge/procedure-claude`). Sans elle, le bouton dit quoi installer ; le reste de l'app ne change pas.

## 📋 Procédure de travail créée par Claude (demande de Jason)
> Dans le bon de travail live, un bouton « Créer procédure » : Claude crée une procédure de travail interactive comme celle
> du BT-089, avec liste de matériel et tout, pour aider le tech. Option : ajouter le manuel d'atelier si on ne l'a pas ;
> sinon, recherche internet. Même style, aux couleurs de MTR Performance.

### Dans le bon de travail live : **📋 Procédure**
- La fenêtre montre les procédures déjà faites pour ce bon (prête / incomplète, qui, quand, coût approximatif) avec
  **Ouvrir**, **↻ Compléter** (incomplète) et **🗑️** (administration seulement).
- **Créer / Refaire la procédure** :
  - **Manuel d'atelier** : les manuels de la bibliothèque, celui du bon modèle (et de la bonne année) en premier, marqué ★
    et choisi d'office ; « texte seulement » si le PDF n'a pas pu être gardé.
  - **🔎 Recherche internet** (specs du fabricant, huiles, couples, n° de pièces) : cochée d'office ; obligatoire sans manuel.
  - **Précisions pour Claude** (facultatif) : ex. « machine reprogrammée, le client fournit ses plaquettes ».
  - On voit ce que Claude reçoit : travaux, pièces du bon, lignes de la soumission, notes du technicien, n° de série, compteur.
- Création en 2 à 5 minutes, avec l'avancement (plan, puis détail des étapes). On peut fermer la fenêtre : la création
  continue tant que l'app reste ouverte sur l'appareil. Quand c'est prêt : toast « 📋 Procédure prête (≈ 0,80 $) »
  et la procédure s'ouvre si la fenêtre est encore ouverte.
- Un morceau qui échoue est réessayé une fois ; s'il échoue encore, la procédure est **incomplète** mais utilisable
  (les étapes manquantes gardent la liste du plan) et **↻ Compléter** refait seulement ce qui manque.

### La procédure (procedure.html, même moteur que le BT-089, couleurs MTR)
- En-tête noir MTR avec le logo, le n° de bon, le client, la machine ; accent or ; thème nuit si l'app est en nuit.
- **Préparation** : pièces, produits et outils à sortir ; **décisions du client** en boutons (ex. purge approuvée / refusée),
  rappelées ensuite en haut de chaque étape ; alertes générales.
- **Étapes** : pourquoi, specs de l'étape, cases à cocher (heure et nom de qui a coché), cases **par côté ou par cylindre**
  (G/D, 1-2-3), valeurs clés en gras, **mesures avec limites** (verdict vert / rouge et alerte en haut de l'étape),
  choix avec verdict, notes de l'étape, pages du manuel (« p. 171 » → la page du PDF s'affiche dans l'app).
- **Specs** : tableau cherchable, liens vers les pages du manuel et les sources web.
- **Résumé** : bon, décisions, mesures (avec verdicts), notes, ce qui reste ; **Ajouter aux notes du BT** (une ligne dans les
  notes du technicien), Copier, Tout effacer (avec confirmation).
- **Partagée entre les tablettes** : une ligne par case au serveur, en temps réel ; deux techs sur le même bon ne s'écrasent pas.
  Hors réseau : « Cet appareil seulement », les coches attendent sur l'appareil et partent au retour du réseau.

### 📚 Bibliothèque de manuels
- « ➕ Ajouter un manuel (PDF) » dans la fenêtre : type, marque, modèle et années préremplis avec la machine du bon ;
  titre proposé d'après le nom du fichier.
- Le texte est lu sur l'appareil, page par page, puis le PDF va dans le stockage privé « manuels ». Trop gros pour le
  stockage : le texte est gardé quand même (Claude le lit ; les pages ne s'affichent pas). PDF numérisé sans texte : averti.
- Pour chaque procédure, le serveur choisit les pages du manuel qui parlent des travaux du bon (mots clés français → anglais).

### Serveur (nouveau)
- `edge/procedures.sql` : tables `procedures`, `procedure_etat`, `manuels`, `manuel_pages`, espace de stockage `manuels`,
  temps réel. Accès : employés connectés.
- `edge/procedure-claude/index.ts` : fonction Supabase (Claude Opus 5.5, recherche web, outils à schéma strict).
  Deux étapes (plan, puis détail par groupes de 3 étapes, 4 en parallèle) pour rester sous la limite de temps des fonctions.
- Coût : environ 0,50 $ à 1,50 $ US par procédure.

## Tests
- `test-v167.js` 72/72 : bouton et fenêtre ; ★ du manuel du bon modèle (pas pour un autre modèle de même marque et année) ;
  recherche internet obligatoire sans manuel, décochable avec ; contexte envoyé ; groupes (1,2,3)(4,5,6)(7) en parallèle ;
  assemblage (Préparation, décisions, cases G/D, mesures, pages) ; coût ; ouverture ; groupe en échec 2 fois → incomplète,
  « Compléter » seulement ce qui manque ; erreurs du serveur ; tables absentes ; ajout de manuel (texte, stockage, trop gros,
  échec → manuel retiré) ; autre bon (pas le manuel ni les précisions du bon d'avant) ; notes du BT ; droits ; échappement ;
  visionneuse : en-tête, thème, décisions, cylindres, coches partagées, temps réel (ajout, suppression d'une autre procédure
  ignorée), mesures et verdicts, hors ligne puis synchronisé, specs, résumé, tout effacer ; 0 erreur JavaScript.
- Sabotages : 47 fautes volontaires (28 dans l'app, 19 dans la visionneuse), toutes attrapées. `test-v167.js` sur la v166 : échoue.
- Non-régression : `test-v166.js` 49/49, `test-v165.js` 26/26, `test-v164.js` 63/63, `test-v163.js` 34/34, `test-v162.js` 36/36,
  `test-v161.js` 42/42, `test-v160.js` 16/16, `test-v159.js` 63/63, `test-v159b.js` 8/8.
- Tests exécutés dans Chromium (navigateur intégré), Supabase et Claude simulés. **La fonction `procedure-claude` n'a pas pu
  être essayée pour vrai ici** (pas de Deno, pas d'accès au projet Supabase) : le premier essai réel se fait après l'installation.
