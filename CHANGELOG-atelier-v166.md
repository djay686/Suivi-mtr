# Suivi-Garage-Partage — v166 (28 sept. 2026)

Bâtie sur la v165. Aucun changement côté serveur : un rappel est une ligne de la table `communications` déjà en place
(`canal: note`, `statut: rappel`, `rappel_le` = quand).

## ⏰ Rappels clients + 📞 Communications au tableau de bord (demande de Jason)
> Les notifications des communications sur le tableau de bord, et une place de note pour rappel de client :
> rappeler tel client pour telle job, dans tant de temps.

### Bandeau « 📞 Communications » au tableau de bord
- Ce qui attend : **📵 appels manqués**, **💬 textos reçus**, **📝 autres à traiter** (clic → 📞 Communications).
- **Les rappels** : ceux qui sont dus (en rouge, « en retard de 20 min ») puis ceux qui viennent plus tard aujourd'hui, par heure ;
  « ⏰ 3 plus tard » pour les jours suivants.
- Sur chaque rappel : **📞 le numéro** (un clic appelle — Linkus sur l'ordi, le téléphone sur le cellulaire), **✓ Fait**,
  **+1 h**, **Demain** (prochain jour ouvrable, 9 h). Clic sur le texte : modifier le rappel (ou ouvrir le fil du client).
- **➕ Rappel** toujours là. Se masque dans ⚙️ Mon tableau de bord → « Sur le tableau ».

### ⏰ Rappel client
- **Qui** : le carnet est proposé en tapant (le numéro se remplit tout seul), ou un nom et un numéro libres.
- **Pour quelle job** : les bons du client à l'atelier (ex. « 2021 Can-Am Outlander 650 · BT-112 »), les machines de son carnet, ou texte libre.
- **Pourquoi** : ex. « lui dire que la pièce est arrivée ».
- **Quand** : dans 30 min, 1 h, 2 h, demain matin, dans 2 jours (ouvrables), dans 1 semaine, ou une date et une heure précises.
  L'heure exacte s'affiche avant d'enregistrer ; une date passée est refusée.
- Ouvrir un rappel déjà prérempli :
  - **⏰ sur la carte de chaque machine** (client, numéro et job remplis) ;
  - **⏰ Rappel** en haut de 📞 Communications ;
  - **⏰ Rappel** dans le fil d'un client.
- Le rappel est dans le fil du client (📞 Communications), avec « ✎ Modifier le rappel » et « Supprimer ».

### Quand l'heure arrive
- Il passe **« à traiter »** : pastille de 📞 Communications, bandeau du tableau de bord.
- **Notification** dans l'app (« ⏰ Rappeler Marc Tremblay — Outlander… », ou « ⏰ 3 rappels à faire : … »), une seule fois par
  rappel et par appareil ; notification du bureau si l'app est ouverte en arrière-plan et que les notifications sont permises.
  Vérifié toutes les 30 s, et au démarrage (rappels arrivés pendant que l'app était fermée).

### Note d'appel
- « 🔔 Garder la note en rappel » a maintenant son délai : **dans 30 min … dans 1 semaine** (avant : toujours demain 9 h).

### Droits
- Tout ça suit la section **Communications** (administration par défaut). Un technicien sans ce droit ne voit ni le bandeau,
  ni le ⏰ des cartes, ni les notifications.

## Tests
- `test-v166.js` 49/49 : bandeau (comptes, ordre en retard → plus tard, « en retard de 20 min », bouton 📞, ➕) ; notification une
  seule fois, groupée ou détaillée ; +1 h, Demain (jour ouvrable), ✓ Fait ; jours ouvrables (vendredi → lundi) ; ➕ Rappel avec client
  du carnet, jobs, pourquoi, dans 2 h ; ⏰ de la carte prérempli ; date précise / passée ; sans numéro ; client hors carnet ;
  modifier sans doublon ; supprimer ; rappel venu d'une note → fil ; délai de la note d'appel ; boutons de 📞 Communications et du fil ;
  réglage ⚙️ ; droits du technicien ; noms échappés.
- Sabotages : 11 fautes volontaires, toutes attrapées. `test-v166.js` sur la v165 : échoue.
- Non-régression : `test-v165.js` 26/26, `test-v164.js` 63/63, `test-v163.js` 34/34, `test-v162.js` 36/36, `test-v161.js` 42/42,
  `test-v160.js` 16/16, `test-v159.js` 63/63, `test-v159b.js` 8/8.
- Tests exécutés dans Chromium (navigateur intégré), l'app dans une page avec Supabase bouchonné ; 0 erreur JavaScript.

## À savoir
- Les notifications viennent de l'app ouverte (ordi de l'atelier, téléphone avec l'app ouverte). Une notification sur le
  téléphone **app fermée** demanderait une tâche planifiée au serveur (Supabase) — pas fait dans cette version.
