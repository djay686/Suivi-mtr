# Suivi-Garage-Partage — v178 (7 oct. 2026)

Bâtie sur la v177 (« Mon poste » pour la réception), qui est comprise dans ce zip. **Il y a des étapes au serveur**
(voir « À faire au déploiement », tout en bas) : un SQL de contrôle, trois fonctions Edge à redéployer, et — en
dernier, quand tous les appareils sont en v178 — le SQL de purge du cadeau.

Douze demandes, réalisées en parallèle par onze agents dans des zones de code séparées, fusionnées et re-testées une
à une par le maître d'œuvre. Chaque changement a son fichier de test (`test-v178-<lot>.js`, lancés d'un coup par
`test-v178.js`) qui échoue sur la v177 et passe sur la v178, et des fautes volontaires qu'il attrape (« sabotages »).

## 📲 Confirmation par texto : tracée, verrouillée, avec l'adresse
> Quand le client confirme le rendez-vous par SMS, envoyer directement un SMS de confirmation au lieu qu'on le fasse
> directement.

- Le serveur **envoyait déjà** la confirmation quand le client répond « 1 » à des créneaux, mais ne l'enregistrait pas :
  la fiche de la demande affichait « pas envoyée » et proposait de l'envoyer à la main. Maintenant la confirmation est
  **tracée** : la fiche affiche « ✅ Confirmation envoyée le … », 🔔 RDV à venir montre le badge vert, et la fenêtre
  « Envoyer une confirmation ? » ne s'ouvre plus quand elle est déjà partie. Après un échec : « 📲 Renvoyer ».
- Un texto en double (nouvel essai de Twilio, deux « 1 » rapprochés) **ne crée plus un deuxième bon de travail**
  (verrou atomique). Si le serveur plante avant d'écrire le bon, la demande revient à « créneaux envoyés » : le client
  peut répondre de nouveau, rien n'est perdu en silence.
- Le texto de confirmation contient l'**adresse de l'atelier** (1856 rue Jérôme-Hamel, Trois-Rivières). Le gabarit réglé
  dans 🔔 Réglages n'est pas modifié : ajoute `{adresse}` au texte pour l'y inclure ; les rappels offrent aussi `{adresse}`.
- Hors de cette version (à ta demande si tu le veux) : un « OUI » en réponse au rappel et la réservation par le lien
  du courriel ne déclenchent pas de texto de confirmation.

## 🔩 Recherche de pièce BRP depuis « Pièces à commander » et le bon de travail
> Dans pièce à commander, un bouton recherche de pièce qui va nous apporter dans le catalogue de pièce BRP associé à
> la machine pour pouvoir rechercher la pièce à commander pour ajouter la pièce au BT automatique. Aussi à mettre dans
> la section pièce à commander dans le BT live et quand on fait ajouter sur le site, ça ajoute la pièce dans l'endroit
> pour la pièce.

- Nouveau bouton **« 🔩 Recherche de pièce BRP »** en haut de « Pièces à commander » (visible aussi à la réception) :
  on choisit le bon (bons en cours d'abord, recherche par BT, client ou machine), le catalogue BRP s'ouvre directement
  sur la machine, et chaque **« + Ajouter »** du site va dans les pièces à commander **de ce bon**.
- Même chose depuis chaque carte de l'onglet « À commander » (« 🔩 Chercher une pièce BRP ») et depuis le bon en live
  (« 🔩 Chercher dans BRP », surtout depuis l'ordinateur).
- La pièce s'ajoute à la commande **et** à la liste de pièces du bon (non cochée, sans prix) : la même pièce deux fois
  fait « qté 2 » ; une pièce déjà reçue crée une nouvelle ligne et le bon repasse en « pièces non complètes ». La TV du
  lift les affiche ; Facturer les voit à 0 $.
- Machine non BRP : refus. Fenêtre bloquée : message. Pas de signal du script après 15 s (iPad) : « note le n° de
  pièce et ajoute-le à la main ».
- Script Tampermonkey passé à **2.4** : sa pastille et son message disent « BT-xxx · pièces à commander » au lieu de
  « soumission ». À mettre à jour sur chaque PC (Tampermonkey › Vérifier les mises à jour) ; avec l'ancien script la
  pièce va quand même au bon, et l'app le signale.

## 📞 Note d'appel → bon de travail / note d'atelier
> Note d'appel, quand le client appelle et que la machine est en atelier, bouton rapide pour le BT directement et/ou
> note d'atelier.

- Dans la note d'appel, dans le fil du client et dans la fenêtre d'appel Linkus, chaque bon du client (sur place
  d'abord, 5 lignes puis « … et N autre(s) ») a deux boutons : **« 📋 Ouvrir le BT »** et **« 📝 Note d'atelier »**.
- « Ouvrir le BT » garde la note puis ouvre l'écran du bon **sans punch** ni changement de statut (« ▶ Ajouter mon
  temps » reste disponible).
- « Note d'atelier » met le texte de la note sur le bon (« 📞 Appel : … », sans le nom du client). Elle apparaît à
  l'écran live, sur la TV du lift, sur le bon imprimé et dans l'assistant. Le même texte n'est pas ajouté deux fois.
- Fenêtre d'appel Linkus : s'il y a exactement un bon sur place, « 📋 Ouvrir le BT-xxx » enregistre l'appel répondu au
  dossier du client puis ouvre le bon.

## 🧾 Facturer : les notes d'atelier
> Facturer, j'aimerais avoir un espace avec les notes d'atelier.

- Facturer affiche un bloc **« 📝 Notes d'atelier (N) · 🔒 Interne »** : les notes du technicien, la plus récente en
  premier, et un champ pour en ajouter une. Une note tapée puis Fermer, Enregistrer ou Facturer est ajoutée.
- Les notes ne partent **jamais** dans la facture, le message au client, le CSV ni QuickBooks. Sur téléphone, le bloc
  est replié au-dessus de 3 notes.
- À savoir : ajouter une note ici réécrit les notes du bon à partir des notes en direct ; les remarques tapées à la main
  sur un bon imprimé resté ouvert sont remplacées (défaut déjà présent dans la v177).

## 🎁 Le cadeau « payé comptant » disparaît
> Le petit cadeau en haut du rendez-vous, effacer la note de la définition du p'tit cadeau. Enlever aussi dans facturer
> et effacer et laisse aucune trace de payé comptant. Efface complet, même pas archiver, disparaître mais laisse
> l'historique de travaux, aucune trace de paiement.

- Le bouton 🎁 des cartes « Prêt à facturer » et de la fenêtre Facturer, le badge « 🎁 Cadeau · payé comptant » et la
  fenêtre « Fermer le bon en cadeau » n'existent plus. Un bon payé comptant se ferme comme les autres : **« → Facturé »
  puis « ✓ Livrée »**. Les pièces sortent du stock une seule fois, rien n'est envoyé à QuickBooks.
- Au premier chargement de la v178, l'application **retire elle-même les traces** du cadeau dans les bons et le journal
  d'inventaire (une écriture de chaque ligne, puis plus rien). Statuts, dates, pièces, chronos et historique de travaux
  ne bougent pas. `edge/purge-cadeau-v178.sql` fait le reste côté serveur (copies de sécurité) : **irréversible**, voir
  l'ordre dans le fichier et en bas de ce changelog.
- La Rentabilité garde sa bascule 🎁 « offert » (bon offert, revenu à 0 : aucune notion de paiement). Dis-le si tu
  veux aussi la retirer.

## 📅 Un bon déjà créé se place (ou se déplace) au calendrier
> Quand le bon de travail est déjà créé je veux être capable de l'ajouter au calendrier, en ce moment je suis bloqué
> (photo de l'erreur).

- Le message photographié (« Un bon de travail existe déjà pour cette soumission. Déplace son rendez-vous directement
  dans le calendrier. ») est remplacé : dans une soumission dont le bon existe déjà, le bouton du bas devient
  **« 📅 Placer BT-… au calendrier »** (bon sans date) ou **« 📅 Déplacer le rendez-vous »** (bon déjà daté, avec
  confirmation). **Aucun nouveau bon n'est créé** ; « → Bon de travail seulement » est grisé tant qu'un bon à planifier
  existe.
- La fenêtre de créneaux propose 5 journées et 4 créneaux par technicien, un champ « À partir du » et un lien
  « ✏️ Choisir la date et l'heure moi-même ». Le bon garde son statut (« Sans rendez-vous » passe à « À venir ») ; les
  autres machines du même rendez-vous le suivent ; la date se met aussi sur la soumission ; le calendrier s'ouvre sur
  la semaine choisie.
- Bon « Prêt à facturer », « Facturé », « Assurance », « Commande de pièce » ou archivé : message clair avec son n°,
  rien n'est déplacé, aucun texto n'est envoyé au client.
- Les créneaux proposés (aussi pour « Pièces arrivées ») ne sont jamais déjà passés aujourd'hui, et un rendez-vous non
  assigné occupe une place. « Pièces arrivées » propose le temps restant estimé par le technicien (15 min si
  l'estimation est épuisée) ; la durée d'origine est gardée pour la main-d'œuvre de la soumission.

## 🚜 Tableau : depuis combien de jours la machine est là, et le temps restant
> Compte à rebours dans les rendez-vous, je veux le nombre de jours que la machine est arrivée, plus vieux en haut de
> la liste, mais les rendez-vous qui se travaillent en live je les veux en haut de la colonne réparation en cours avec
> note temps restant.

- Chaque carte d'atelier (Sans rendez-vous, En attente de pièce, Réparation, et « À venir » une fois la machine
  arrivée) affiche **« 🚜 Arrivée depuis N jours »**, en rouge à 7 jours et plus. Pour un ancien bon sans date
  d'arrivée notée : **« 🚜 ≈ N jours »** en gris (d'après le rendez-vous prévu, sinon la création du bon). Le compteur
  avance à minuit.
- **Sans rendez-vous** et **En attente de pièce** : le plus ancien en haut (avant : le plus récent créé).
  **Réparation en cours** : les bons **en direct d'abord**, puis le plus ancien en haut. « À venir » garde son ordre
  par rendez-vous.
- La carte montre **« ⏳ Reste ~1 h 30 (noté 16:40) : texte »** quand le technicien a noté un temps restant ; sans
  estimation, les cartes en direct montrent « ⏱ ~X (estimé) » en gris (durée de la fiche moins le temps punché).

## ⏳ Fermer une session non terminée : le temps restant
> BT : quand on ferme la session BT non terminée, demander temps approximatif restant.

- « ⏹ Terminer ma session → ❌ Non, pas encore » demande maintenant le **temps approximatif restant pour tout le bon**
  (15 min, 30 min, 1 h, 2 h, 4 h, Journée ou Autre…) : obligatoire, aucune durée présélectionnée, avant le texte.
- L'estimation diminue toute seule avec le temps punché depuis la saisie (pauses exclues) et disparaît quand elle est
  épuisée ou que les travaux sont terminés. Elle sert à la carte, à l'Ordre de travail (durée proposée), à la page
  live, à « Mon écran », à la TV du lift et aux créneaux de « Pièces arrivées ».
- « ✕ Quitter » et « 👤 Changer de technicien » ne demandent rien.

## 🗓️ Demande de rendez-vous : le calendrier à côté des créneaux proposés
> Dans demande rendez-vous, dans proposé créneaux, j'aimerais un raccourci pour voir en même temps le calendrier en même
> temps que les choix proposés pour voir la charge d'ouvrage.

- Dans la fiche d'une demande, « 📅 Proposer des créneaux » montre maintenant, à côté des heures, un **mini-calendrier
  de la semaine** : rendez-vous existants (survol = détails), plages retenues pour d'autres clients (hachurées), dîner,
  jours fériés, et en vert chaque heure encore libre pour la durée choisie.
- Un clic sur une plage verte la propose au client (①②③, trois au maximum) ; un clic sur un choix le retire ; une plage
  occupée, hors horaire ou sur le dîner dit pourquoi elle ne peut pas être prise.
- Chaque journée affiche sa **charge d'ouvrage** (heures déjà réservées sur les heures des techniciens, dîner exclu) :
  vert sous 60 %, orange jusqu'à 85 %, rouge au-delà, « aucun technicien » quand personne ne travaille. Les bons sans
  heure comptent 60 min et sont signalés. Le pourcentage apparaît aussi sur les tuiles de l'étape 2.
- Sur iPad en paysage et sur PC, le calendrier s'affiche à droite par défaut ; sur cellulaire il se déplie avec
  « 🗓️ Voir le calendrier » (le choix est mémorisé sur l'appareil).
- Une nouvelle demande, un bon ou une plage retenue qui change pendant que le sélecteur est ouvert ne le referme plus
  et ne fait plus perdre les choix, la position de défilement ni un message en cours de rédaction ; si la demande est
  confirmée ou refusée entre-temps, l'app l'indique (« Cette demande vient de changer »).

## 👷 Calendrier : autant de rendez-vous que de techniciens
> Calendrier, si j'ai 2 techs disponibles mardi 9:00, si j'ai un client déjà à 9:00, un 2e rendez-vous est impossible.
> J'aimerais 2 blocs de rendez-vous pour la journée au lieu d'un seul gros. Donc le nombre de blocs disponibles selon
> le nombre de techniciens disponibles par journée.

- **Capacité d'une plage = nombre de techniciens capables** (rôles Admin et Technicien, présents ce jour-là, compétents
  pour la machine, qui couvrent toute la plage) **moins les rendez-vous qui la chevauchent** (battement compris). Avec
  2 techniciens et un rendez-vous à 9 h, il reste 1 place à 9 h ; un rendez-vous épinglé à Jason ne ferme pas la plage
  pour Gwendal. La réception et l'homme à tout faire ne comptent pas ; un employé sans rôle compte comme technicien.
- **Appel rendez-vous** propose 9 h même s'il y a déjà un rendez-vous à 9 h (« 2 places · Jason, Gwendal ») ; plusieurs
  machines au même rendez-vous = une place par machine et des techniciens différents ; place prise entre-temps :
  « ⚠️ … Réserver quand même ? » (on peut toujours forcer). L'auto-assignation ne choisit plus un technicien déjà pris
  à cette heure.
- **Demandes de service** : les créneaux envoyés au client gardent la liste des techniciens capables ; le serveur s'en
  sert quand le client répond (par texto ou par le lien du courriel). Les créneaux proposés avant la v178 gardent la
  règle d'un seul rendez-vous par plage.
- **Calendrier** : deux rendez-vous à la même heure s'affichent **côte à côte** (plus de bloc caché sous un autre, y
  compris les créneaux proposés aux clients). Avec 2 techniciens ou plus et une place qui reste, un rendez-vous seul
  n'occupe que la moitié de la piste : **double-clique la moitié libre à 9:00 pour créer le 2e rendez-vous**. L'entête
  d'un jour passe au rouge ⚠️ seulement s'il y a plus de rendez-vous simultanés que de techniciens. Vue Jour : les
  non-assignés simultanés se placent côte à côte dans « — » ; une double réservation d'un même technicien a un liseré
  rouge. Déposer un rendez-vous tombe à l'heure visée (le vendredi ouvert à 8 h ne décale plus le lundi d'une heure) ;
  une heure déjà pleine demande « Placer quand même ? ».
- **Repli de sécurité** : remettre `CAPACITE_MULTI_TECHS = false` dans index.html redonne « un seul rendez-vous à la
  fois » comme en v177, partout.

## 🔊 Sons d'alerte plus forts, distincts et réglables
> Son de notification plus fort pour chaque alerte.

- Chaque alerte a son propre son, plus fort qu'avant (mesuré : la demande est environ 15 dB plus forte) : nouvelle
  demande, texto à traiter, appel manqué, appel entrant, message du chat, rappel, pièce en retard, soumission acceptée,
  fin de session prochaine.
- Menu Compte → **« 🔊 Alertes et sons »** : curseur de volume (20 à 100 %), « Couper les sons de cet appareil » et un
  « ▶ Tester » par son. Propre à chaque appareil ; ne dépasse jamais le volume de l'appareil.
- Un texto qui reçoit une réponse automatique (OUI, STOP, choix de créneau) ne fait plus sonner : seul un texto resté
  « à traiter » sonne, environ 2 s après son arrivée.
- iPad : le son se débloque au premier toucher et après un retour d'arrière-plan ; un iPad jamais touché ne sonne pas
  et ne rattrape pas les sons en retard au premier toucher. Commutateur sur sonnerie. Notifications push (app fermée) :
  le son reste celui du système ; seule la vibration varie.
- Non livré (à demander) : l'alarme répétée toutes les 15 s avec bandeau « ✓ J'ai vu ».

## 📑 Nouvelle section « Bons de travail actifs »
> J'aimerais avoir une section bons de travail actifs sauf archivés, section pour voir tous les bons de travail sans
> les ouvrir en live.

- Dans le menu après « Ordre de travail », sur la tuile de « Mon écran » et dans « Mon poste » pour la réception : la
  liste de **tous les bons sauf les archivés**. Toucher une ligne la déplie (client avec numéro cliquable, machine,
  rendez-vous, travaux, pièces, notes d'atelier, temps punché et temps restant) et **ne démarre jamais de punch**.
- Pastilles de filtre avec compteurs (En live, En réparation, Attente pièce, Sans RDV, À venir, Prêt à facturer,
  Facturé, Assurance, Commande), recherche par BT, client, machine, téléphone, série, carton ou travaux (sans accent),
  tri par statut (le plus ancien arrivé d'abord) ou par n° BT. **Aucun montant.**
- « 🔴 Ouvrir en live » demande confirmation pour un bon prêt à facturer, facturé ou à venir non arrivé. La liste suit
  les autres postes en direct. Technicien : ouvert par défaut (puncher d'abord) ; homme à tout faire : non ; réception :
  oui ; l'administration coche ou décoche dans le dossier employé.

## Ce qui change dans les habitudes
- Les colonnes **Sans rendez-vous** et **En attente** se lisent du plus ancien (en haut) au plus récent.
- À « Terminer ma session → Non, pas encore », un **temps restant est obligatoire**.
- Un bon payé comptant se ferme par **« → Facturé » puis « ✓ Livrée »**.
- Déposer un rendez-vous un jour où personne ne travaille demande maintenant confirmation.
- Script BRP : « Vérifier les mises à jour » dans Tampermonkey sur chaque PC.

## Tests
- Chaque lot a son fichier `test-v178-<lot>.js` (`test-v178.js` les lance tous ; `node test-v178-srv.js` pour le
  serveur). Chacun **échoue sur la v177** et passe sur la v178 ; chacun a été attaqué par des fautes volontaires
  (« sabotages ») : **243 sur 243 attrapées** (socle 10 + 15, serveur 23, note d'appel 17, pièces BRP 16, cadeau et
  Facturer 22, sons 21, créneaux 13, calendrier 17, mini-calendrier 20, bon → calendrier 20, tableau 25, bons actifs 24).
- Comment ils ont tourné : Node sans jsdom dans l'environnement de travail (registre npm bloqué) → **Chromium**
  (Playwright) avec un faux jsdom (`outils-v178/run-in-chromium.js`), les tests existants inchangés. Les mêmes
  fichiers se lancent comme d'habitude avec jsdom : `NODE_PATH=… node test-v178.js ./index.html`.
- Les 15 ancres-commentaires `//@@v178-…` posées pour la fusion en parallèle restent dans index.html (des commentaires :
  les tests des lots les vérifient).

  | Test | Résultat |
  |---|---|
  | `test-v178-a6.js` (bon → calendrier) | 107/107 |
  | `test-v178-a9.js` (mini-calendrier) | 107/107 |
  | `test-v178-bta.js` (bons actifs) | 150/150 |
  | `test-v178-cal-a.js` (créneaux par technicien) | 47/47 |
  | `test-v178-cal-b.js` (calendrier côte à côte) | 100/100 |
  | `test-v178-com.js` (note d'appel, confirmation) | 125/125 |
  | `test-v178-fac.js` (cadeau, notes Facturer) | 83/83 |
  | `test-v178-helpers.js` (arrivée, temps restant) | 92/92 |
  | `test-v178-pieces.js` (pièce BRP) | 95/95 |
  | `test-v178-socle.js` (capacité) | 44/44 |
  | `test-v178-son.js` (sons) | 112/112 |
  | `test-v178-tab.js` (tableau, fin de session, TV) | 166/166 |
  | `test-v178-srv.js` (serveur, Node) | 55/55 |
  | `edge/test-sms-entrant-v178.html` | 107/107 |
  | `edge/test-sms-entrant-v172.html` | 33/33 |
  | `edge/test-quickbooks-v160.mjs` | 57/57 (avec un transpileur TypeScript à la place d'esbuild) |
  | `test-v177.js` | 48/48 |
  | `test-v176.js` | 82/82 |
  | `test-v175.js` | 47/47 |
  | `test-v174.js` | 36/36 |
  | `test-v173.js` | 14/14 |
  | `test-v172.js` | 52/52 |
  | `test-v172b.js` | 24/24 |
  | `test-v170.js` | 77/77 |
  | `test-v169.js` | 54/54 |
  | `test-v168.js` (réécrit sans le cadeau, mêmes fixtures) | 56/56 |
  | `test-v168b.js` | 35/35 (34/35 un samedi : défaut déjà présent, la carte du rendez-vous du jour) |
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
  | `test-v171.js` | non lancé : exige `bt089/` et `bt089.zip`, absents du dépôt |

- Ce qui n'a pas pu être vérifié ici et reste à regarder à l'atelier : l'iPad et le cellulaire réels (son au premier
  toucher, commutateur silencieux, musique Bluetooth, clavier, glisser-déposer, Tampermonkey absent sur iPad), la TV
  Fire TV réelle, les vrais rôles et horaires des employés (nombre de blocs par jour), le SQL sur le vrai Supabase
  (essayé sur un PostgreSQL local jetable), le script BRP contre le vrai site.

## À faire au déploiement
1. **Supabase › SQL Editor** : exécuter `edge/confirmation-auto-v178.sql` (la colonne existe déjà : l'ALTER ne fait
   rien ; le reste est de la lecture ; le rattrapage des anciennes confirmations est optionnel et commenté).
2. **Fonctions Edge**, avec *Verify JWT* **désactivé** pour les deux premières :
   `supabase functions deploy sms-entrant --project-ref riwamsdpynpbjfadajlz --no-verify-jwt`,
   `supabase functions deploy rdv-confirmer --project-ref riwamsdpynpbjfadajlz --no-verify-jwt`,
   `supabase functions deploy envoyer-rappels --project-ref riwamsdpynpbjfadajlz` (variable `{adresse}` seulement).
   Vérifier `…/functions/v1/sms-entrant?diag` (doit contenir « v172 » et « v178 »), puis un essai réel : une demande de
   test sur ton cellulaire, répondre « 1 », un seul texto reçu, « ✓ envoyé » sur la fiche, une seule ligne 🤖 dans
   📞 Communications. Sans risque pour la v177 en ligne (sans `techs` dans les créneaux, la capacité reste 1).
3. **Netlify** : glisser `deploy-atelier-v178.zip` (il contient la v177). La TV du lift se recharge d'elle-même
   (tv.html change). Pour revenir en arrière : re-glisser `deploy-atelier-v177.zip`.
4. **Chaque iPad, cellulaire et poste** : fermer puis rouvrir l'app (le bandeau « 🔄 Nouvelle version » n'est qu'un
   rappel ; un appareil resté en v177 peut le rester des jours — et ressusciterait le cadeau). Sur chaque PC :
   Tampermonkey › Tableau de bord › **Vérifier les mises à jour** (la pastille du site BRP doit dire « MTR v2.4 »),
   et autoriser les pop-ups pour atelier.mtrperformance.ca.
5. **Vérifier qui compte comme technicien** : Administration › Dossiers employés : rôle et horaire de chacun. Le
   nombre de blocs un mardi doit égaler la pastille « 👷 N » du calendrier et le nombre réel de personnes qui
   travaillent sur machines. Un employé sans rôle compte comme technicien ; un horaire vide le compte absent.
6. **Sons** : sur l'iPad et le cellulaire, menu Compte › 🔊 Alertes et sons › ▶ Tester ; commutateur sur sonnerie ;
   vérifier qu'une musique Bluetooth n'est pas coupée au premier son (signale-le si c'est le cas).
7. **Purge du cadeau — en dernier, quand TOUS les appareils affichent v178** : ouvrir `edge/purge-cadeau-v178.sql`,
   exécuter l'étape A (lecture seule) et lire la liste des bons concernés, confirmer par écrit que c'est irréversible,
   puis exécuter B et C ; relancer B et C dans une semaine ; supprimer à la main les anciens
   `sauvegarde-garage-*.json`.
8. **Hors v178, à faire vite** (sécurité, signalé pendant l'analyse) : protéger `smart-api` (aucune authentification),
   faire tourner `CRON_SECRET`, activer la RLS sur `mkt_import_qb`, créer un vrai compte TV (`mtr_role = 'tv'`).
