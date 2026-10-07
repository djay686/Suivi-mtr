# Suivi-Garage-Partage — v177 (6 oct. 2026)

Bâtie sur la v176 (rôle Réception), qui est comprise dans ce zip. **Rien à faire au serveur.**

## 🛎️ « Mon poste » : l'accueil de la réception
> C'est la même interface, il n'y a aucun changement à part le bouton des 2 interfaces tech et admin. Je veux la
> version poste.

Avec la v176, la réception arrivait sur le tableau de bord, comme toi, avec des boutons en moins. Maintenant elle
arrive sur **« Mon poste »** : un écran plein, dans le même cadre que « Mon écran » des techniciens (en-tête avec
bonjour, date, heure, « Changer d'utilisateur » ; la ligne de punch tout en haut), mais à la place des tuiles :

### En haut
- **Actions rapides** : 📞 Communications · ➕ Nouveau bon · 📅 Appel rendez-vous · 📝 Note d'appel · 🧾 Soumission ·
  📦 Pièces à commander · 🗃️ Stock · **📋 Tableau de bord** (la vue complète, comme avant). Seuls les boutons des
  sections ouvertes à l'employé apparaissent.
- **Recherche « Où en est la machine de… »** : nom, client, téléphone (même sans tirets), NIV, n° de BT, n° de carton,
  plaque, travaux — **archives comprises** (marquées 🗂️ Archivée). Chaque résultat montre le statut, le technicien,
  la date, le lieu et le « reste à faire ». Un clic ouvre la fiche (ou le bon de travail pour une archive). Le texte
  tapé n'est jamais perdu quand l'écran se redessine.

### Les cartes (chacune avec son compteur et « Ouvrir → »)
| Carte | Ce qu'elle montre | Un clic pour |
|---|---|---|
| **📞 À traiter** | appels manqués, textos reçus, autres à traiter, **rappels à faire** (en retard en premier) | 📞 Rappeler (numéro cliquable), ✓ Fait, Ouvrir le fil, Répondre |
| **📅 Aujourd'hui / Demain** | les rendez-vous et échéances des deux jours (heure, client, machine, technicien), ⚠️ Sans soumission | Ouvrir la fiche ; Ouvrir → le calendrier |
| **📦 Pièces** | à commander, en route, **en retard** (fournisseur, pièce, retard), machines en attente de pièce | 📞 Relancé, ✓ Reçue, 🔮 Prévisions inventaire |
| **📨 Demandes de rendez-vous** | nouvelles, « veut d'autres choix », conflits, confirmées sans soumission ; textos sans correspondance ; rendez-vous confirmés disparus du calendrier | Ouvrir la demande, ↩️ Remettre au calendrier |
| **🧾 Soumissions** | acceptées à traiter, envoyées sans réponse (la plus vieille), brouillons, rendez-vous sans soumission | Ouvrir → |
| **🏁 À remettre au client** | les machines **Facturé** (prêtes à remettre), et le nombre de bons « Prêt à facturer » qui t'attendent (le plus vieux) | 📱 Aviser, ✓ Livrée, 💬 Prévenir (message d'équipe) |

### En bas
- **Le reste des sections** ouvertes à l'employé, en petits boutons : Archives, Clients, Historique SMS, Rappels,
  Demandes, Calendrier, Ordre de travail, Messages d'équipe (avec le nombre de non-lus), Tâches, Mon punch, Scanner
  un bon, Écran atelier. Jamais Administration, Positions, Marketing, Marketplace, Checklists, Activités.
- **Aucun montant d'argent, aucun coût** sur tout l'écran.

### Autour
- L'écran **se redessine tout seul** quand les données changent (bons, communications, demandes).
- Le bouton du haut s'appelle **« 🛎️ Mon poste »** pour la réception (toujours « 🏠 Mon écran » pour un technicien) ;
  il ramène à Mon poste depuis le tableau de bord.
- Le rappel « 🕐 Pense à puncher ton arrivée » reste ; la ligne de punch est maintenant tout en haut de Mon poste.
- Un **technicien** garde exactement son écran (tuiles, machines à l'atelier) ; toi, le tableau de bord.
- Sur un téléphone, les cartes se mettent sur une colonne.

## Tests
- `test-v177.js` : **48/48**. Employés : Jason (admin), Gwendal (technicien), Marie (réception) ; machines dans
  tous les statuts ; une pièce en retard et une à temps ; communications (appel manqué, texto, rappel dû) et demandes
  (nouvelle, confirmée sans soumission) servies par un faux serveur.
  - Marie atterrit sur Mon poste (classe `poste`), rappel de punch, pas de tuiles, en-tête, ligne de punch en haut
    (ordre CSS mesuré), bouton « 🛎️ Mon poste ».
  - Actions rapides ; recherche par BT, téléphone sans tirets, carton (archives), « roy » (actives d'abord), rien
    tapé / rien trouvé ; marque 🗂️ Archivée ; garde le texte au redessin ; ouvre la fiche ; HTML dans un nom = texte.
  - Chaque carte : contenu, compteurs et boutons ; données pures (`posteDonneesPieces`, `posteDonneesComm`,
    `posteDonneesDemandes`).
  - Aucun montant ni coûtant ; le reste des sections (avec et sans) ; « Mon punch » ouvre son punch.
  - Redessin sur changement de données ; « 📋 Tableau de bord » et retour ; Gwendal garde ses tuiles ; Jason le
    tableau ; le code dit ce qu'il doit dire.
- Sabotages : **12 sur 12 attrapés** (tuiles pour la réception, atterrissage sur le tableau, recherche sans n° de BT,
  « À remettre » avec les « Prêt à facturer », rappels dus oubliés, un montant sur l'écran, nom non échappé, texte de
  recherche perdu, bouton « Mon écran », Administration dans le reste, « Demain » = aujourd'hui, toutes les pièces
  « en retard »).
- Non-régression (banc navigateur, Node absent) : `test-v176.js` **82/82** (son test d'atterrissage est mis à jour :
  Mon poste au lieu du tableau), `test-v164.js` **63/63**. Les 17 autres suites restent à rejouer là où Node existe.

## À faire au déploiement
1. Netlify : glisser `deploy-atelier-v177.zip` (contient la v176). Retour arrière : `deploy-atelier-v176.zip` ou v175.
2. Les appareils affichent « 🔄 Nouvelle version » : **Recharger**.
3. Se connecter avec le compte de la réception : Mon poste s'affiche ; « 📋 Tableau de bord » pour la vue complète.
