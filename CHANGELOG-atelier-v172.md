# Suivi-Garage-Partage — v172 (30 sept. 2026)

Bâtie sur la v171. **Rien à faire au serveur** pour cette version : les délais vivent avec l'inventaire.

Aussi fait aujourd'hui dans Supabase (connecteur branché par Jason) : l'espace privé **procedures** de la v171 (photos
des procédures importées) et ses 4 règles d'accès. Vérifié.

## 📦 Pièces commandées : à part, et une alarme seulement quand le délai est dépassé
> Dans les prévisions d'inventaire, je n'aime pas que les pièces en commande soient en retard et créent une
> notification. J'aimerais que ce soit à part. Notification après 72 h, tout dépendant du fournisseur. Un choix de nos
> fournisseurs quand on commande la pièce, et dans les réglages un temps normal de commande pour que tout fonctionne
> ensemble ; une alarme quand ça dépasse, ou un rappel.

**Avant** : une pièce déjà commandée dans « 📦 Pièces à commander » comptait encore comme un manque. La date du bon
était souvent passée : l'article sortait « ❌ déjà en retard », et le bouton 🔮 Prévisions clignotait en rouge.

### Dans les prévisions
- Une pièce **commandée et pas encore reçue** est « en route » : elle ne compte plus dans les manques.
  - Plus de « déjà en retard » pour elle.
  - Elle ne fait plus clignoter 🔮 Prévisions.
- Nouvelle section **📦 Pièces commandées — en route**, sous le tableau :
  - pièce, bon, fournisseur, date de commande, arrivée prévue ;
  - « ✅ à temps » ou « ⚠️ en retard de 2 j » ;
  - 📞 Relancé.
- Les bons de commande envoyés de l'inventaire y sont aussi.

### Commander : nos fournisseurs
- Cocher « commandée » ouvre une fenêtre. Avant, il fallait taper le nom du fournisseur dans une petite question.
  - **Nos fournisseurs en boutons**, avec le délai de chacun, et « Autre… ».
  - Choisi d'office : le fournisseur de l'article au catalogue, sinon le dernier utilisé.
- Un nom tapé dans « Autre… » peut être **ajouté à nos fournisseurs** (coché d'office).
- On voit le **délai normal** et l'**arrivée prévue** (ex. « 48 h (Amsoil) → arrivée prévue jeu. 2 oct. 15:00 »).
- **Date promise par le fournisseur** (facultatif) : elle remplace le délai normal pour cette pièce.
- « Les autres pièces à commander de ce bon aussi, chez le même fournisseur » : coché d'office.
- Les pièces déjà commandées avant la v172 (fournisseur tapé à la main : « napa », « NAPA ») sont reconnues par leur
  nom. Un nom inconnu (« nc ») prend le délai par défaut.

### ⏱️ Délais de commande (les réglages)
- Bouton dans « 📦 Pièces à commander », dans Inventaire › 🏭 Fournisseurs, et dans les prévisions.
- **Délai par défaut : 72 h**, puis **un délai par fournisseur** (vide = celui par défaut).
- Comptés en **jours ouvrables** : les fins de semaine et les jours fériés ne comptent pas. Vendredi 15 h + 72 h =
  mercredi 15 h.
- La fiche du fournisseur dit maintenant « Délai normal de livraison (heures) ». Les vieilles fiches en jours sont
  converties (Amsoil : 2 jours → 48 h).

### ⏰ Délai dépassé : l'alarme
- **Rappel au tableau de bord** (« ⏰ Rappels · 📦 Pièces commandées ») :
  - ex. « Relancer Amsoil · 1× Bougie NGK (X9) — BT-120 · commandée …, attendue hier 15:00 · en retard de 2 j » ;
  - **📞 Relancé** : nouvelle arrivée prévue = maintenant + délai du fournisseur, et le rappel s'en va jusque-là ;
  - **✓ Reçue** : la pièce passe reçue, et elle est cochée au bon. Pour un bon de commande, la réception de
    l'inventaire s'ouvre dessus.
- Bouton **« 📦 Pièces à commander · ⚠️ 2 en retard »** en rouge. Dans la liste, « ⚠️ En retard de … » avec 📞 Relancé ;
  en Réception, les retards passent en premier.
- **Notification**, une seule fois par pièce, et encore après une relance si le nouveau délai dépasse aussi.
- Le rappel se cache dans ☰ Menu → Réglages de mon tableau, comme les autres bandeaux.
- Pas un rappel « appeler le fournisseur » dans 📞 Communications : ces rappels ont besoin d'un numéro de téléphone, et
  les fiches fournisseurs n'en ont pas encore. Le rappel des pièces est au même endroit au tableau de bord, juste en
  dessous.

## 📝 Les travaux de la prise de rendez-vous suivent jusqu'au bon de travail
> Les informations des travaux dans la prise de rendez-vous ne se transfèrent pas dans le bon de travail.

Trouvé dans tes données :
- **BT-125** : travaux vides. Tout était dans sa soumission SO-0090 : « Hivernisation / remisage » et la note « A déjà
  les bougies fournies par NC… ».
- **BT-101, BT-117, BT-120** (demandes web) : travaux vides. Le client avait coché des services (« Entretien fin de
  saison », « Changement d'huile ») sans écrire de description, et seule la description était copiée.
- Dans « 📞 Prise de rendez-vous », choisir une soumission **remplaçait** ce qu'on avait précisé par « … — soumission
  SO-… ».

Corrigé :
- **📞 Prise de rendez-vous** : nouveau champ **« Détails des travaux »** (ce que le client a dit). Le bon reçoit le
  type (ou « Préciser les travaux ») **et** les détails.
- **Soumission rattachée** : on n'écrase plus rien. Ce qui manque de la soumission **s'ajoute** au bon :
  - « 🧾 SO-0090 : Hivernisation / remisage » (sa main-d'œuvre) ;
  - « 📝 … » (ses notes) ;
  - sans répéter ce qui y est déjà.
- **La soumission change ensuite** : le bon suit, le bloc 🧾 est remplacé, jamais doublé. Ça dure tant que la machine
  n'est pas en réparation ; après, on ne touche plus au texte du technicien.
- **« 🔗 Joindre une soumission »** (formulaire du bon) : ajoute au lieu de remplacer, et plus de question « les travaux
  seront remplacés ».
- **« 🧾 Faire une soumission »** depuis la prise de rendez-vous : la soumission reçoit les travaux demandés.
- **Note d'appel → 📅 Prendre un rendez-vous** : la note (machine + ce qu'on a écrit) remplit « Détails des travaux ».
- **Demandes web** : le bon reçoit les **services cochés** + la description.
- **Bons déjà vides** : remplis tout seuls à l'ouverture de l'app, d'après leur soumission et leur demande web
  (BT-125, BT-101, BT-117, BT-120). Seulement les bons **vides** : rien d'autre n'est touché.
- **Fonction serveur `sms-entrant`** (le bon créé quand le client confirme par texto) : la source est corrigée
  (services + description), et déployée le 30 sept. avec la v173. L'app remplit aussi ces bons dans les secondes où
  ils arrivent.

## Tes données, lues avant de bâtir
- 9 pièces commandées pas encore reçues.
- Fournisseurs tapés : « nc » (8), « napa » / « NAPA », « lapointe joliette », « lapointe louise », « mic part ».
- 6 fiches (Napa, Amsoil, BRP, Kimpex, N2, GAP) : aucune n'a de téléphone ; seule Amsoil a un délai.
- À la mise en ligne, les pièces commandées depuis plus de 72 h ouvrables vont sortir « en retard » d'un coup : une
  notification groupée, puis 📞 Relancé ou ✓ Reçue.

## Tests
- `test-v172.js` : **52/52**.
  - Délais : défaut, vieilles fiches en jours, fin de semaine, jour férié, nom reconnu.
  - Avant / après la commande dans les prévisions et 🔮.
  - Fenêtre de commande : boutons, choix d'office, délai, autres pièces du bon, Autre + ajout, date promise,
    échappement.
  - Section « Pièces commandées ».
  - Retard : rappel, bouton, notification une seule fois, 📞 Relancé, nouvelle notification, ✓ Reçue.
  - Bons de commande de l'inventaire.
  - Réglages : défaut et par fournisseur, enregistrés et gardés au rechargement en temps réel ; fiche en heures ;
    bandeau caché par les réglages du tableau.
- `test-v172b.js` (travaux) : **24/24**.
  - Prise de rendez-vous : précisions + détails ; soumission choisie, qui ajoute sans écraser.
  - Soumission modifiée : bloc remplacé, jamais doublé ; rien après le début de la réparation.
  - Bons vides : BT-125, BT-120, BT-117 (services en liste ou en texte), sans répéter « Services demandés ».
  - Bons avec travaux et bons archivés : pas touchés ; une seule écriture, rien au 2e passage.
  - Note d'appel → rendez-vous ; « Faire une soumission » ; « Joindre ».
- Sabotages : **2 sur 25** lancés (délais : défaut, vieilles fiches), tous les deux attrapés. **La série a été arrêtée**
  (Jason avait une correction plus urgente) et n'a pas été refaite.
- Non-régression :

  | Test | Résultat |
  |---|---|
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
1. Netlify : glisser `deploy-atelier-v172.zip`.
2. Les appareils affichent « 🔄 Nouvelle version » : **Recharger**.
3. **⏱️ Délais de commande** : vérifier le délai par défaut (72 h) et donner le leur aux fournisseurs plus lents ou plus
   rapides (BRP, Kimpex…).
4. À l'ouverture, BT-125, BT-101, BT-117 et BT-120 reçoivent leurs travaux : jette un œil.
5. ~~Facultatif : déployer `edge/sms-entrant/index.ts`~~ **Fait le 30 sept.** par le connecteur Supabase, avec la
   correction de la v173 (réponses automatiques notées dans Communications).
