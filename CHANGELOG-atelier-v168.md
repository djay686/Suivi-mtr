# Suivi-Garage-Partage — v168 (29 sept. 2026)

Bâtie sur la v167. Aucun changement côté serveur.

## 📅 Rendez-vous confirmé disparu du calendrier (Dave Thibault) — corrigé à la source
> Rendez-vous de Dave Thibault confirmé, qui n'était pas dans le calendrier. Vérifie que ça n'arrive plus.

**Ce qui s'est passé**
1. Le 17 sept. à 8 h 26, Dave a répondu « 1 » au texto.
2. Le serveur a créé son bon de travail (lundi 29 sept., 9 h) : il l'a ajouté à la liste des machines (ligne 1).
3. Peu après, un poste qui avait une **liste en retard** a enregistré sa propre liste, qui n'avait pas ce bon. Toute la ligne 1
   a été réécrite et le bon a disparu. Ce poste pouvait être une tablette sortie de veille, un réseau coupé, ou un changement
   arrivé pendant qu'il écrivait.
4. Sans bon, pas de place au calendrier, et pas de rappel la veille (le rappel lit aussi cette liste).
   Le même risque existait pour tout ce qu'un autre poste avait ajouté entre-temps.

**Maintenant**
- **Avant d'écrire**, l'app relit la liste du serveur et garde les bons qu'elle ne connaissait pas : ceux créés par une
  confirmation, ou par un autre poste. Un bon **supprimé exprès** sur ce poste n'est pas ramené. Toutes les suppressions
  passent par le même chemin.
- **Pendant qu'elle écrit**, un bon ajouté ailleurs n'est plus ignoré : il est pris tout de suite et réécrit juste après,
  si notre écriture l'a effacé.
- Quand ce poste écrit **une autre ligne** (soumission, pointage…), un changement de la liste des machines venu d'ailleurs
  n'est plus ignoré.
- **Au réveil**, la liste est relue : onglet revenu après 15 s, réseau revenu, temps réel rebranché après une coupure
  (avant, seuls la présence et le clavardage l'étaient).
  - Si ce poste avait une écriture en échec (réseau), il renvoie d'abord ses changements au lieu de les perdre.
  - Après une déconnexion, rien ne se recharge.
- L'**import d'une sauvegarde** reste un vrai remplacement (pas de fusion).

**Alerte si ça arrivait quand même**
- Un rendez-vous confirmé (aujourd'hui ou plus tard) dont le bon n'est plus au calendrier fait apparaître un **bandeau rouge**
  au tableau de bord : « ⚠️ Un rendez-vous confirmé n'est plus au calendrier ». Il est aussi compté dans « À traiter »
  du bouton Demandes, et la fiche de la demande l'indique.
- **↩️ Remettre au calendrier** refait le bon avec le **même id**, donc sans doublon d'un poste à l'autre. On y retrouve le
  créneau choisi par le client, la durée, la machine, les travaux et la soumission liée. Si le serveur l'avait encore
  (appareil en retard), il est simplement repris tel quel.
- **Annulé ou replacé à la main** fait disparaître l'alerte. Il n'y a pas d'alerte pour un rendez-vous passé, ni si le même
  client a déjà un bon ce jour-là.
- Supprimer un bon venu d'une demande détache la demande : pas de fausse alerte.
- Historique de la demande : « Bon remis au calendrier », « Bon disparu : rendez-vous annulé ou replacé ».

## 📦 L'inventaire suit la facturation finale (demande de Jason)
> L'inventaire ne se calcule pas : que tout se suive au final avec la facturation finale, avant QuickBooks, pour les items.

**Avant** : une pièce sortait du stock seulement au clic « ✓ Livrée ». La sortie se basait sur la liste de pièces du BT,
et les pièces pas cochées « vérifiées » étaient sautées. Les corrections faites à la facturation ne comptaient pas :
quantité changée, ligne décochée, pièce ajoutée à la facture.

**Maintenant** : les pièces sortent quand le bon est **facturé**, d'après les **lignes finales** de la facturation (🧾 Facturer).
- **📗 Facturer avec QuickBooks** : le stock suit exactement les lignes envoyées à QuickBooks. Une facture de TEST ne touche pas au stock.
- **→ Facturé** sans QuickBooks : d'après la facturation enregistrée (💾), sinon la suggestion
  (soumission + pièces utilisées au BT).
- **🎁 Cadeau** : même règle (voir plus bas).
- **Facture corrigée** (mise à jour) : seule la différence bouge. Une quantité en plus sort ; une ligne retirée revient
  en stock (« ↩️ Facture corrigée »), au prix d'origine. Aucune double sortie.
- **✓ Livrée** : ne sort plus rien si le bon a été facturé. Un bon déjà dans « Facturé » avant la v168 sort à la livraison,
  d'après sa facturation. Un bon déjà sorti avant la v168 : on n'y touche plus.
- Une vente est comptée au **prix de la facture**. Une correction vient en moins dans Inventaire › Ventes.
- **Réservé** : un bon facturé ne réserve plus rien. Un bon revenu en atelier après la facture réserve seulement ce qui
  dépasse ce qu'il a déjà sorti.

### Dans la fenêtre 🧾 Facturer : encadré « 📦 Inventaire »
Il montre, avant d'envoyer, ce que la facture fera au stock. Il suit chaque case cochée et chaque quantité.
- « 420956744 Filtre à huile · 1 facturé — sort 1 · en main 5 → 4 » ; « déjà sorti » ; « remet 2 en stock » ;
  stock négatif signalé.
- Article pas suivi : « quantité non tenue ». Ligne sans n° connu du catalogue : « hors inventaire — ne touche pas au stock ».
- ⚠️ **Utilisée au BT mais pas facturée** : la pièce reste en stock. Coche la ligne si elle est vraiment sortie.

## 🎁 Bon fermé en cadeau (payé comptant, pas de facture QuickBooks)
- **🎁 discret en haut à droite** des cartes « Prêt à facturer » et « Commande de pièce », et du titre de la fenêtre
  🧾 Facturer. Réservé à l'administration.
- La fenêtre montre :
  - « Payé comptant : aucune facture QuickBooks » ;
  - la valeur avant taxes (facturation enregistrée ou suggestion) ;
  - ce qui sort de l'inventaire ;
  - un avertissement si le bon a déjà une facture QuickBooks, que le cadeau n'annule pas.
- **🎁 Fermer le bon** : le bon va dans « Facturé » avec le badge « 🎁 Cadeau · payé comptant · 190,00 $ ». Rien ne part à QuickBooks.
  **🎁 Fermer et livrer** : le bon va directement aux archives.
- Les pièces sortent du stock (réf. « BT-107 · 🎁 cadeau »).
- Ramené de « Facturé » vers « Prêt à facturer » : le bon n'est plus un cadeau. S'il est refacturé, le stock suit la différence.
- **Rentabilité** : le bon s'ouvre avec le 🎁 déjà actif. Il paraît dans le récap « 🎁 Cadeaux offerts » avec sa valeur,
  même avant que sa rentabilité soit remplie.

## Tests
- `test-v168b.js` 35/35 (rendez-vous) :
  - alerte (bandeau, compte « À traiter », fiche ; pas pour un rendez-vous passé, un bon présent ou un client déjà replacé ;
    technicien ; échappement) ;
  - bon encore au serveur repris sans doublon ; « Remettre au calendrier » (même id, créneau, soumission, historique) ;
    « Annulé ou replacé » ;
  - **écriture d'un poste en retard : le bon du serveur reste** ; suppression respectée et demande détachée ;
  - bon arrivé pendant l'écriture ; écriture d'une autre ligne ;
  - réveil, temps réel rebranché ; écriture en échec renvoyée au retour du réseau ; déconnexion ; import.
- `test-v168.js` 56/56 (inventaire et cadeau) :
  - 🎁 sur les cartes (en haut à droite, admin, « Prêt à facturer » seulement) ;
  - encadré 📦 : suggestion, pièce décochée, quantité, hors catalogue, pas suivi, utilisée mais pas facturée ;
  - facture QuickBooks → stock, mouvements, prix, coûtant, réservations ;
  - facture mise à jour → différence seulement ; Ventes et filtre « Facture corrigée » ;
  - facture de test → rien ;
  - « → Facturé » avec facturation enregistrée ou suggestion ;
  - Livrée sans double sortie, anciens bons ;
  - 🎁 depuis la carte et depuis la fenêtre, « Fermer et livrer » ;
  - retour en arrière, réservation de l'excédent ;
  - bon déjà facturé ; Rentabilité et récap des cadeaux ; échappement ; 0 erreur JavaScript.
  - bon sorti avant la v168 : pas de 2e sortie.
- Sabotages : 60 fautes volontaires (35 inventaire et cadeau, 25 rendez-vous), toutes attrapées.
- `test-v159.js` : une vérification attend maintenant 30 ms. L'enregistrement relit le serveur avant d'écrire, donc
  l'écriture part un instant plus tard.
- Non-régression :

  | Test | Résultat |
  |---|---|
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

## À savoir
- Le stock d'un article bouge seulement s'il est **suivi en inventaire** (fiche de l'article). Pour les autres, la vente
  est notée, mais la quantité n'est pas tenue.
- Les bons déjà livrés avant la v168 ne sont pas recalculés.
- Rendez-vous de Dave Thibault (29 sept., 9 h) : dès que la v168 est en ligne, le bandeau rouge le propose
  (« ↩️ Remettre au calendrier »). Comme son bon n'existait plus, il n'a pas reçu de rappel la veille.
- Rien à changer côté serveur. La fonction `sms-entrant` crée toujours le bon ; c'est l'app qui ne l'efface plus.
