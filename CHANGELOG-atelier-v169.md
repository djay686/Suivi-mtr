# Suivi-Garage-Partage — v169 (29 sept. 2026)

Bâtie sur la v168. **Demande une installation côté serveur** (une fois) : `edge/ecrans.sql` (voir `GUIDE-TV.md`).
Sans elle, le bouton 📺 dit quoi installer ; le reste de l'app ne change pas. **Aucun compte à créer.**

## 📺 TV du lift (brief du 29 sept.)
> Afficher sur la TV Fire TV 50 po du lift 2 colonnes le BT live et / ou les procédures pas à pas, lisibles d'en dessous
> d'un véhicule. La TV affiche seulement ; le contrôle se fait sur le cell du technicien (plus tard la tablette).
> Réponse de Jason : la TV suit **le BT en cours**.
> Puis : « les techs doivent pouvoir l'envoyer sur la Fire TV aussi, avec chaque compte, pas besoin de faire un compte de
> plus, sinon les punchs ne suivront pas ».

### La page de la TV : `tv.html?ecran=lift`
- C'est une page à part, légère pour la Fire TV : pas l'app complète de 2 Mo.
- Le lien du brief, `atelier.mtrperformance.ca/?tv=lift`, y mène aussi.
- Très gros caractères, fond noir, contraste fort, aucun bouton, aucun curseur. Tout est en unités d'écran : le même
  rendu que Silk annonce 960 × 540 ou 1920 × 1080.
- **Branchée avec le compte d'un technicien** : son nom d'utilisateur (`p.nom`) et son mot de passe, comme dans l'app.
  Pas de compte à part.
  - Elle suit aussitôt **le punch de ce technicien** : le bon où il est punché, avec son chrono.
  - Refusés :
    - un compte d'**administration** (jamais sur un écran visible de tous, comme demandé au brief) ;
    - un employé inactif ;
    - un compte inconnu.
  - Revérifié à chaque rallumage : un compte désactivé ou devenu administrateur débranche la TV.
  - Sa session est à part de celle de l'app (clé de stockage séparée). La page n'a aucun bouton : elle n'écrit que
    sa ligne d'écran.
- **Le bon en cours** :
  - en tête : n° du bon, machine, client (nom seulement, jamais le téléphone), technicien et son chrono (en marche / en pause) ;
  - travaux demandés, reste à faire, checklists (✔ / ☐, 3 / 7), pièces (utilisée / reçue / à recevoir), 3 dernières notes.
- **La TV suit le punch du technicien** : celui qui l'a branchée, ou le dernier qui a touché 📺 TV avec **son** compte.
  - Il entre dans un autre bon : la TV suit.
  - Punch fermé : elle garde son dernier bon, « pas de punch en cours » (retenu même après un rechargement).
  - Ses punchs restent à son nom : chacun pilote avec son propre compte, sur son cell ou la tablette.
- **Procédure** :
  - l'étape en cours en très gros (« Étape 3 / 8 »), specs et couples, alertes (danger en rouge) ;
  - actions à cocher avec les cases par cylindre ou par côté ; mesures et leur verdict (hors limite : alerte rouge en haut) ;
  - la page du manuel si le PDF est dans l'app ; une barre des étapes en bas.
- **Rien à afficher** : grande horloge et nom de l'écran.
- **Mise à jour en 1 à 2 s** (temps réel). Coupure : point rouge « reconnexion… », puis elle relit tout. Elle relit
  aussi tout chaque minute.
- Recharge toute seule après un déploiement (moins de 10 min) et chaque nuit (3 h 30). Signale qu'elle est allumée
  (toutes les 90 s). Empêche la mise en veille de l'écran quand le navigateur le permet.
- Le texte **rapetisse tout seul** quand un bon a beaucoup de lignes, pour que tout tienne (jamais sous 55 %).
- **Télécommande** en mode procédure :
  - ▶, ⏩, lecture / pause ou le bouton du centre : étape suivante ; ◀ ou ⏪ : précédente ;
  - le cell suit ; à essayer sur la vraie Fire TV (voir le guide).
- Aucun état partagé dans le navigateur de la TV : tout vit dans Supabase. Seule sa connexion y est gardée.
- Plusieurs écrans dès le départ. `tv.html?ecran=poste2` s'inscrit tout seul ; l'app demande alors laquelle.

### Dans le bon de travail live : **📺 TV**
- Une TV : la TV suit ton BT en cours, tout de suite. Plusieurs : on choisit, avec « 🟢 allumée » ou « ⚪ pas vue depuis
  un moment ».
- Le bouton devient **📺 Sur la TV ✓**. Le toucher encore arrête l'affichage. Il suit aussi ce qui est changé sur un
  autre appareil.
- Personne dans le bon : « entre d'abord dans le bon ». La TV suit un technicien.

### Dans la procédure (📋) : **📺 TV**
- La TV affiche cette procédure, à l'étape en cours.
- Précédent / Suivant sur le cell font avancer la TV. La télécommande de la TV fait avancer le cell, sans boucle.
- **📺 Sur la TV** (toucher encore) : la TV revient au BT en cours du technicien.
- Plusieurs TV : un petit menu pour choisir.

### Serveur (nouveau)
- `edge/ecrans.sql` : table `ecrans`, une ligne par TV. Ce n'est **pas** `tableau`, qui garde son garde-fou. Il crée la
  ligne `lift`, les accès des employés connectés et le temps réel.
- Aucune fonction Edge. Aucun service worker ajouté : la page TV n'est jamais mise en cache.

## Tests
- `test-v169.js` 54/54 :
  - **app** : lien `?tv=`, bouton, table absente, une TV sans question, arrêter, temps réel, deux TV (choix,
    échappement), personne dans le bon ;
  - **procédure** : envoyer à l'étape en cours, Suivant → TV, télécommande → cell sans réécriture, retirer, menu à deux TV ;
  - **TV** :
    - branchée avec le compte d'un technicien (`G.Brossault` → comme dans l'app) ;
    - refus : administration, employé inactif, mauvais mot de passe ; revérification au rallumage ;
    - suit le punch de celui qui l'a branchée, sans rien envoyer ; « compte de Gwendal » en bas ;
    - bon en cours (sans téléphone), checklist et pièces ;
    - case cochée en temps réel ; changement de bon suivi ; punch fermé → dernier bon gardé ; horloge ;
    - procédure (étape, spec, coches par cylindre, mesure hors spec) ; coche en temps réel ;
    - télécommande ▶ ◀ ⏩ et bornes ; signal « allumée » ; échappement ;
    - tout tient à l'écran ; nouvel écran inscrit ; table absente.
- Sabotages : 39 fautes volontaires (25 TV, 5 procédure, 9 app), toutes attrapées.
- Non-régression :

  | Test | Résultat |
  |---|---|
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

- Tests exécutés dans Chromium, Supabase simulé. **Pas essayé sur la vraie Fire TV ni avec Silk** (flèches de la
  télécommande à vérifier sur place).

## Écarts avec le brief (il décrivait la v164)
- L'app n'est plus un seul fichier : `procedure.html` (v167) et maintenant `tv.html`. La page TV est à part, plus légère
  pour la Fire TV. `?tv=lift` y redirige.
- L'id du projet Supabase dans le brief (`riwamsdpyjpbjfadajlz`) a une lettre de travers. L'app utilise
  `riwamsdpynpbjfadajlz`, qui est le bon.
- Depuis la v164, les procédures (v167) peuvent aussi aller à la TV. La v168 corrige les bons effacés par un appareil
  en retard : la TV en profite.
