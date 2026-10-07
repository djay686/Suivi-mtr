# Suivi-Garage-Partage — v176 (6 oct. 2026)

Bâtie sur la v175 (TV : cocher à la télécommande), qui est comprise dans ce zip. **Rien à faire au serveur.**

## 🛎️ Nouveau rôle « Réception / Service à la clientèle »
> Créé-moi la nouvelle interface comme admin et technicien, mais sous le nom de réception. Il va faire service et pièces,
> mais va quand même faire des travaux sur des machines, donc laisse une place pour entrer les BT. Je ne veux pas qu'il
> ait accès à ce qui est administration et dossiers employés.

### Ce qu'il a (comme toi)
Il arrive sur le **tableau de bord**, avec le menu et les boutons du haut : Nouvelle machine, Scanner un bon, Pièces à
commander, Calendrier, Ordre de travail (lecture), Soumissions, Clients, Inventaire, Archives, Historique SMS, Rappels
SMS, Demandes de rendez-vous, **Communications**, Messages d'équipe, Tâches (les siennes), Écran atelier.

### Ce qu'il a (comme un technicien)
- **Scanner un bon** et **Travail live** : il punche son temps sur un BT, relevé km / heures compris, exactement comme
  un technicien. Son temps alimente la rentabilité du bon.
- **Mon punch** (arrivée, pause, départ). **Pas de verrou** « puncher avant de commencer » : le téléphone n'attend
  pas. À la place, un rappel « 🕐 Pense à puncher ton arrivée » quand il ouvre l'app sans avoir punché.
- On peut lui **assigner un bon à la main** (liste « Technicien assigné »). Mais il **ne compte pas dans la capacité**
  de l'atelier (suggestions de créneaux, colonnes du calendrier, horaire de l'ordre de travail) : il est au téléphone.

### Ce qu'il n'a pas
- **Administration** (dossiers employés, rentabilité, feuille de temps), **Positions GPS**, **Marketing SMS**,
  Marketplace, Activités hors bon, Checklists.
- « Punch employés » ne lui ouvre que **son** punch : jamais la borne à NIP (qui pointe n'importe qui) ni la feuille
  de temps de tout le monde (refusée même si on appelle la fonction directement).

### Deux options nouvelles dans le dossier employé (groupe « Options », sous les sections)
Tu les coches ou décoches quand tu veux, par employé, sans redéploiement. L'administration les a toujours.

| Option | Décochée (défaut pour la réception, les techniciens et l'homme à tout faire) |
|---|---|
| **💲 Voir les coûts** | Cachés : « Coût $ » des pièces dans la fiche machine (le champ reste là, caché : rien n'est perdu à l'enregistrement), montants des factures et des cadeaux sur les cartes, colonne « Coûtant » du catalogue, « Prix coûtant » de l'article inexistant, dans l'inventaire : « Valeur au coûtant », coûtant et marge de chaque article, prix coûtant et marge de la fiche, coût unitaire de l'achat, escompte du fournisseur, « Coût u. » et totaux des bons de commande, l'onglet **💰 Ventes** au complet. |
| **🛠️ Gestion** | Cachés **et refusés** (la fonction dit non, même depuis la console) : supprimer un bon, une archive, un client, une soumission, un article, un bon de commande, un fournisseur, une demande ; « Remettre en Facturé » ; Exporter / Importer / Sauvegarde automatique (pied du tableau) ; exports CSV de l'inventaire et du catalogue ; imports QuickBooks ; « Envoyer dans QuickBooks » et « CSV QuickBooks » ; ⚙️ Réglages des Soumissions, des Rappels SMS, des Communications (et 🧪 Tester) ; ⏱️ Délais de commande ; les modèles SMS (il les voit et s'en sert, mais ne les modifie pas) ; « Vider l'historique » SMS ; les statuts « Prêt à facturer » et « Facturé » dans la fiche (ils passent par la facturation, qui reste à toi). |

- **Attention** : pour les **techniciens** aussi, ces deux options sont décochées par défaut. Concrètement, un technicien
  qui avait « Pièces à commander » perd le bouton ⏱️ Délais de commande ; s'il avait l'inventaire ou les soumissions,
  il ne voit plus les coûtants. Si tu veux qu'un technicien les garde : Administration › Dossiers employés › coche
  l'option. Toi, rien ne change.
- Les anciens dossiers n'ont pas ces options : on prend le défaut du rôle. « Défaut du rôle » et « Tout cocher »
  les comprennent.

### 💬 Messenger
Dans 📞 Communications, un bouton **« 💬 Messenger ↗ »** ouvre la boîte Messenger de la page Facebook (Meta Business
Suite) dans un autre onglet. C'est l'étape 0 : les messages ne sont pas encore dans l'app (voir le plan Messenger).

### Au passage
- Les **archives** ont maintenant le bouton ✅ Bon de travail sur chaque carte (la réception y retrouve un ancien
  dossier quand un client rappelle ; avant, la carte d'archive n'avait que « Remettre en Facturé » et la poubelle).

## Ce que ça ne fait PAS (à savoir, franchement)
- Tout ça est du **masquage d'interface** plus un refus dans les fonctions. **Ce n'est pas une barrière côté
  serveur** : un employé qui ouvre la console (F12) peut encore lire les lignes de la base que l'app télécharge pour
  tout le monde (employés avec NIP et taux horaires, pointages, frais). C'est déjà le cas pour tes techniciens
  aujourd'hui. La vraie fermeture est le niveau N1/N2 du plan de sécurité (rôle dans le jeton + règles RLS).
  **D'ici là : ne saisis pas le taux horaire de la réception dans l'app.**
- Le coûtant voyage encore dans les données de la fenêtre du bon imprimé (catalogue envoyé à la fenêtre), sans y être
  affiché. Je l'ai laissé pour ne pas enregistrer un coûtant de 0 sur les pièces que la réception ajoute au bon.
- Le bon de travail imprimé et le bon de commande imprimé n'ont pas été relus pour les coûts dans cette version.
- Aucun bouton « Communications » dans la barre du haut (il reste dans le menu) ; l'écran « Mon poste » viendra plus
  tard.

## Tests
- `test-v176.js` : **82/82**. Employés d'essai : Jason (admin), Gwendal (technicien), Marie (réception).
  - Rôle et droits par défaut : les 25 sections + 2 options, ce qui est ouvert, ce qui est fermé ; un rôle inconnu
    retombe sur technicien ; la liste déroulante du dossier employé.
  - Sans session : rien n'est bloqué. Marie : classes `role-reception`, `sans-couts`, `sans-gestion` sur `<body>` ;
    menu (Administration, Positions, Marketing cachés ; Communications, TV, Inventaire visibles). Jason : rien de
    caché. Gwendal : sans gestion mais pas « réception ».
  - Accueil sur le tableau de bord avec le rappel de punch ; pas de verrou (le technicien, oui) ; Mon punch et jamais
    la borne ; feuille de temps et son export refusés ; Jason garde la borne.
  - Tableau : montant de la facture et « Facturation prête » sans montant (style calculé : `display: none`), poubelle
    cachée, pied caché ; `supprimer()`, `exporter()`, `restaurer()` refusés depuis la console ; Jason voit tout.
  - Fiche : le champ « Coût $ » est caché mais **toujours dans le DOM**, `lirePiecesFormulaire` garde le coûtant (55) ;
    bouton Supprimer caché ; statuts « Prêt à facturer » / « Facturé » retirés, les autres présents.
  - Soumissions (onglet Réglages caché et contourné, colonne Coûtant, QuickBooks, CSV, Supprimer), inventaire (Ventes
    caché et contourné, KPI, carte d'article « coûtant 55 → » caché / « détail 89 » visible, fiche, exports, suppression
    en lot), Délais de commande refusés.
  - Archives, clients, modèles SMS en lecture seule, rappels (2 onglets), communications (pas de Réglages, bouton
    Messenger qui ouvre `business.facebook.com/latest/inbox`) ; les mêmes écrans pour Jason avec tout.
  - Atelier : Marie entre en live sur BT-203 (relevé demandé) ; hors capacité et hors horaire ; assignable à la main ;
    pas de rangée « Activités hors bon ».
  - Dossier employé : 25 + 2 cases, défaut du rôle Réception, `empLireDroits` lit les options, Administration tout
    coché, « Défaut du rôle » ; une option cochée dans le dossier de Marie rouvre les coûts sans rouvrir la gestion.
  - Le code dit ce qu'il doit dire (CSS, `garderGestion`, feuille de temps, capacité).
- Sabotages : **15 sur 15 attrapés** (rôle inconnu de `roleDe`, administration ouverte par défaut, `sans-couts` plus
  posé, CSS de « Coût $ » retiré, borne à NIP pour tous, `supprimer()` plus enveloppé, verrou de punch, atterrissage sur
  « Mon écran », réception comptée dans la capacité, « Prêt à facturer » offert, montant hors de `cout-seul`, dossier
  employé sans Options, Réglages des communications pour tous, `peut()` qui dit toujours oui, onglet Réglages des
  rappels pour tous). Un sabotage qui casse la syntaxe du fichier ne compte pas comme attrapé.
- **Comment ils ont été exécutés** : Node n'est pas installé sur ce poste. Le corps de `test-v176.js` (entre les
  marqueurs) a tourné **dans un vrai navigateur** (Chromium du bureau, page servie par un petit serveur local, faux
  Supabase injecté comme dans les tests), ce qui permet de vérifier le style calculé. Le même fichier se lance comme
  d'habitude : `NODE_PATH=… node test-v176.js ./index.html` (et `--sabotages`).
- Non-régression : `test-v164.js` (ordre de travail, capacité, droits) : **63/63** dans le navigateur.
  **Les 17 autres suites n'ont pas pu être rejouées ici** (scripts jsdom, Node absent) : à relancer dans
  l'environnement de développement avant de déployer, ou accepter le risque — les changements sont additifs (classes
  CSS, gardes sur des fonctions de suppression/export/réglages, nouveau rôle), le chemin « admin » est inchangé.

  | Test | Résultat |
  |---|---|
  | `test-v176.js` | 82/82 (navigateur) |
  | `test-v164.js` | 63/63 (navigateur) |
  | `test-v175.js` … `test-v159.js` | non rejoués ici (Node absent) |

## À faire au déploiement
1. Netlify : glisser `deploy-atelier-v176.zip` (il contient la v175). Pour revenir en arrière : re-glisser
   `deploy-atelier-v175.zip`.
2. Les appareils affichent « 🔄 Nouvelle version » : **Recharger**.
3. Administration › Dossiers employés › **+ Nouvel employé** : prénom, nom, rôle **Réception / Service à la
   clientèle**, cases laissées au défaut (vérifie : Administration décochée, Options décochées), **pas de taux
   horaire**, NIP, mot de passe temporaire avec 🔑. Il se connecte, choisit son mot de passe, arrive sur le tableau.
4. Essai de 10 minutes avec son compte (ou un compte d'essai « Réception ») : tableau sans montants, fiche sans
   « Coût $ », Punch → Mon punch, Communications sans ⚙️ mais avec 💬 Messenger, Inventaire sans Ventes, scanner un
   bon → travail live.
5. Techniciens : s'ils doivent garder ⏱️ Délais de commande ou les coûtants, coche l'option dans leur dossier.
