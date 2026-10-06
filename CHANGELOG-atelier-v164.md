# Suivi-Garage-Partage — v164 (28 sept. 2026)

Bâtie sur la v163. Aucun changement côté serveur (tout est gardé sur les machines, ligne 1).

## 🔧 Ordre de travail (demande de Jason)
> Un ordre des machines à faire, qui tient compte des rendez-vous et des machines arrivées ; on peut prendre de l'avance
> sur l'horaire pour se débourrer ; jamais deux côte à côte en même temps (même espace de travail) ; un ordre de priorité
> manuel ; un horaire de la journée automatique pour chaque machine arrivée, modifiable à la main.

Nouveau bouton **🔧 Ordre de travail** (en haut du tableau, dans le menu et en tuile sur « Mon écran »).

### La file (ordre automatique)
1. **En cours** — un technicien est branché sur le bon (travail live) ;
2. **Réparations commencées** ;
3. **Rendez-vous dépassés ou du jour** (machine arrivée) ;
4. **Machines déjà arrivées dont le rendez-vous est plus tard** → on prend de l'avance ;
5. **Sans rendez-vous**, par date d'arrivée.

À part : **🔒 Bloquées** (en attente de pièce, pièces pas toutes reçues) et **📅 rendez-vous dont la machine n'est pas encore arrivée**.
Les dossiers facturés, prêts à facturer, à l'assurance et les commandes de pièce n'y sont pas.

### L'horaire de la journée (automatique)
- Une colonne par technicien à l'horaire ce jour-là : Disponibilités, vacances, dîner et compétences du dossier employé. L'homme à tout faire ne prend pas de machines.
- **Ce qui est en cours** continue maintenant, pour le temps qui reste (durée estimée − temps déjà pointé).
- **Rendez-vous dont la machine n'est pas arrivée** : à leur heure, avec leur technicien (ou le premier libre). Rien ne se place par-dessus.
- **Le reste de la file**, dans l'ordre, au plus tôt, chez le premier technicien libre. Le technicien assigné passe d'abord ; s'il est complet ce jour-là, un autre prend la machine (noté sur la job).
- **🚙 Un seul côte à côte à la fois**, tous techniciens confondus : le 2e attend que l'espace se libère, et une machine ordinaire passe pendant ce temps. Reconnu par le type « Côte à côte » (ou « côte à côte » dans le nom).
- Pas de travail pendant le **dîner** ; une job trop longue **se continue le jour de travail suivant**, reprise en premier par le même technicien. On n'entame pas une job à moins de 30 min de la fermeture.
- Navigation ‹ › sur 14 jours. Ligne rouge = maintenant ; le passé est grisé.
- Le rendez-vous au calendrier (date, heure, technicien) **n'est jamais modifié** par l'ordre de travail.

### Modifiable à la main (administration)
- **Ordre manuel** : ⤒ (en premier), ▲, ▼, ou glisser une ligne (ordinateur). Une nouvelle arrivée se glisse juste avant la machine qui la suit dans l'ordre automatique, sans défaire l'ordre placé à la main. **↺ Revenir à l'ordre automatique** efface l'ordre manuel.
- **✏️ Horaire de la machine** (ou clic sur un bloc de l'horaire) : jour, heure, technicien, temps prévu → **📌 Fixer cet horaire**. Le reste de la file s'organise autour. Conflit (même technicien, ou deux côte à côte en même temps) → avertissement avant d'enregistrer. **↺ Horaire automatique** retire l'heure fixée. Une heure fixée à une date passée est ignorée.
- Clic sur un rendez-vous (machine pas arrivée) → la fiche, comme au calendrier ; clic sur un bloc en cours → le travail live.
- Les techniciens voient l'ordre et l'horaire, sans pouvoir les modifier.

### Ailleurs dans l'app
- **Tableau de bord** : bandeau **« 🔧 À faire ensuite »** (les 6 prochaines, heure et technicien). Se masque dans ⚙️ Mon tableau de bord → « Sur le tableau ».
- **Mon écran** (technicien) : **« 🕐 Mon horaire aujourd'hui »** — sa machine en cours, puis **▶ Ensuite**. Un clic ouvre le travail live.
- **Écran d'atelier** (2e moniteur) : ligne **« 🔧 À faire ensuite »**.
- Tout se met à jour en temps réel (machines, Disponibilités, dossiers employés, heures d'ouverture) et chaque minute.

### Enregistré sur la machine
- `ordreRang` : ordre manuel ; `planif = { jour, heure, tech, duree, par, quand }` : horaire fixé à la main.
- Droit **« Ordre de travail »** (section `ordre`) : administration et techniciens oui, homme à tout faire non ; modifiable au dossier employé.

## Tests
- `test-v164.js` 63/63 : ordre de la file ; bloquées et rendez-vous pas arrivés à part ; techniciens du jour (congé, homme à tout faire) ; en cours ; rendez-vous à heure fixe ; on prend de l'avance ; dîner ; aucun conflit ; côte à côte (type et nom, jamais deux en même temps, attente de l'espace, une machine ordinaire passe entre-temps) ; job de 10 h sur deux jours ; 16 h 50 ; compétences ; vacances ; ⤒ ▲ ▼ ; nouvelle arrivée dans un ordre manuel ; ↺ ; 📌 fixé / date passée / conflit ; écran complet ; fenêtre ✏️ ; bandeau ; écran d'atelier ; Mon écran ; droits (admin, technicien, homme à tout faire) ; noms échappés.
- Sabotages : 12 fautes volontaires, toutes attrapées. `test-v164.js` sur la v163 : échoue.
- Non-régression : `test-v163.js` 34/34, `test-v162.js` 36/36, `test-v161.js` 42/42, `test-v160.js` 16/16, `test-v159.js` 63/63, `test-v159b.js` 8/8.
- Tests exécutés dans Chromium (navigateur intégré), l'app dans une page avec Supabase bouchonné. Captures ordinateur (jour et nuit) et téléphone 375 px : lisibles, aucun débordement horizontal, 0 erreur JavaScript.
