# Table de correspondance v177 (base de la v178)

HEAD de base = commit `a838643` (tag `v177-base`), index.html **30 435 lignes**. Le commit « socle v178 » ajoute
ensuite les ancres `//@@v178-…` et les blocs vides avant `</body>` (voir la table ci-dessous : les lignes données ici
sont celles de la v177 **avant** le socle ; après le socle, chaque ancre décale d'une ligne ce qui la suit — **repère
toujours par nom de fonction / chaîne, jamais par numéro**).

Entre v175-base et v177 : seuls `index.html`, `version.txt`, les deux changelogs, `test-v176.js`, `test-v177.js`
changent ; **`edge/`, `tv.html`, `sw.js`, `procedure.html`, `mtr-ajouter-brp.user.js` sont inchangés octet pour
octet** (les 8 fonctions Edge ajoutées au dépôt viennent du zip v177). Script principal = lignes **5017 → 25731**
(`garderSections` 24143 y est) ; scripts suivants : 25881-26306 (BRP), 26307-27857 (Demandes), 27858-28774
(Communications), 28775-28838, 28839-28878, 28879-28905, 28906-30433 (ordre de travail).

Décalages indicatifs v175→v177 : +44/45 (CSS/HTML), +46 vers 7600, +50 vers 8680-11100, +53/54 à 12500-17600, +55 à
17700-22590, +74 à 22600-22640, +82 à 22650-22715, +258 à 22720-23940, +259/264 à 24120-24240, +290 à 24630,
+292/293 à 26300-27860, +296 au-delà.

## (a) Ancres du socle (lignes v177, avant insertion)

| Ancre | Insérée | Contexte (v177) |
|---|---|---|
| `//@@v178-A4 rafraichir` / `//@@v178-A9 rafraichir` / `//@@v178-A12 rafraichir` | après 5411 | 5400 `function rafraichirVues() {` · 5406 `try { if (ecran-tech ouvert) rendreEcranTech(); }` (c'est ce qui redessine « Mon poste ») · 5411 `try { … ordreRafraichir(); } catch (_) {}   // v164` · 5412 `}` |
| `//@@v178-FAC purge` | après 5434 | 5434 `}` (fin `fusionnerAjoutsServeur` 5428) · 5435 `// Supprimer un bon…` · 5436 `function retirerMachine(id) {` |
| `//@@v178-S0a capacite` | après 7191 | 7181-7190 `rdvOccupationJour` · 7192 `function genererSuggestionsRdv() {` |
| `//@@v178-S0b helpers` | après 11002 | 10997-11002 `joursDepuis` · 11003 `// Toutes les pièces requises…` (script principal) |
| `//@@v178-A3 liveVoir` | après 20345 | 20345 `}` (fin ouvrirLive / liveAfficherPage) · 20346 `function fermerLive() {` |
| `//@@v178-A3 notes` | après 20595 | 20587 `function liveSupprimerNote(i) {` … 20595 `}` · 20597 `// ── Commande de pièces au bureau` |
| `//@@v178-A12 bloc` | après 21976 | 21976 `}` (fin `enregistrerEtatArrivee`) · 21978 `// ═══ v74 — COMPTES ET DROITS` · 21985 `const CLE_SESSION` · 21987 `const SECTIONS = [` (script principal) |
| `//@@v178-SON deconnecter` | après 22569 | 22569 `async function deconnecter() {` · 22570 `await presenceEffacer();` |
| `//@@v178-A12 deconnecter` | après 22586 | 22586 `if (techTimer) {…}` · 22587 `appliquerDroits();` · 22588 `ouvrirConnexion();` |
| `//@@v178-FAC demarrerDonnees` | après 24233 | 24230 `async function demarrerDonnees() {` · 24233 `await charger();` · 24234 `afficher();` |
| `//@@v178-TAB demarrerDonnees` | après 24244 | 24244 `invMajDatalist();` · 24245 `}` |
| `//@@v178-A9 apres-demJours` | après 26835 | 26821 `function demJours(…) {` · 26835 `}` · 26837 `window.__demCreneauxJour = …` |
| `//@@v178-A11 proposerNote` | après 28271 | 28251 `function proposerNote(tel, debut, id) {` · 28260-28262 boutons oui/non (zone COM) · 28266-28271 `try { … Notification … } catch (_) {}` · 28272 `}` |
| Blocs `<style id="v178-LOT">` / `<script id="v178-LOT">` | après 30433 | 30433 `</script>` · 30434 `</body>` — lots COM, PCS, FAC, TAB, CALA, CALB, CAL9, CAL6, SON, BTA |

Autres repères : fin du CSS principal `</style>` **2007** ; gabarit CSS injecté de l'IIFE Demandes `css.textContent = \`` **26841-26842** (template literal : ne jamais y écrire) ; `.badge` générique 1063.

## (b) Symboles des lots (v175 → v177)

Légende : = inchangé ; **M** modifié par v176 / v177.

| Symbole | v175 | v177 | État / note |
|---|---|---|---|
| rdvOccupationJour | 7135 | **7181** (fin 7190) | = — S0a s'insère sous l'ancre, avant `genererSuggestionsRdv` |
| nbTechniciensDispo | 8635 | **8685-8687** | = (appelée 6663 Semaine → pastille 6668 ; 6780 Mois → 6787) |
| techniciensDisponibles | 8626 | **8675-8684** | **M v176** : 8679 `if (roleDe(e) === "reception") return false;   // v176` ; test-v176 l.277 vérifie ce texte par regex, sabotage #9 le cible → **intouchable** |
| lireDispoCell / empDisponible / empHeuresJour | 8606 / – / 8624 | **8655** / 8672 / **8673** | = |
| roleDe | 21968 | **22039-22043** | **M v176** : valeurs admin, technicien, tache, reception ; rôle absent / inconnu → technicien |
| joursDepuis | 10946 | **10997-11002** | = |
| isoLocal | 6232 | **6278** | = |
| liveDuree | 20163 | **20218** | = |
| nettoyerPunchsOublies | 21036 | **21091** | = |
| genererSuggestionsRdv | 7146 | **7192** (chevauchement 7215-7216) | = |
| confirmerRdv | 7216 | **7262** (sœurs 7331-7344 : `{ ...nouvelle }` 7335, `machines.unshift(soeur)` 7340, `machines.unshift(nouvelle)` 7345) | = |
| choisirTechnicien | 7340 | **7386** | = |
| calRendreSemaine | 6566 | **6612** (👷 6663/6668 ; `ondblclick="calCliquerVide(…)"` 6708 ; texte d'aide 6717) | = |
| calRendreJour | 6753 | **6799** | = |
| calDeposerSemaine / calDeposerJour | 6682 / 6879 | **6728** / **6925** | = |
| calCliquerVide | 6705 | **6751** | = (propriété CALB) |
| calBlocContenu / calEvenementsDuJour / calDeposer (mort) | 6518 / 6462 / 6917 | **6564** / **6508** / **6963** | = ; calEvenementsDuJour est aussi appelée par « Mon poste » (22843) |
| soumVersRdv | 16731 | **16785** (alerte A6 **16790**) | = |
| soumVersBonTravail | 16687 | **16741** (alerte 16745) | = |
| soumRendreTout | 13167 | **13221** | = |
| reprogrammerOuvrir / reproChercher / reproOccupe / reproChoisir | 16088 / 16110 / 16176 / 16189 | **16142** / **16164** (boucle 16177-16188) / **16230** / **16243** | = |
| piecesArrivees | 16070 | **16124** | = |
| rdvHeuresMO / rdvSyncSoumission | 19836 / 20102 | **19891** / **20157** | = |
| afficher | 6047 | **6093** (filtre colonne **6111** `let liste = filtrees.filter(m => m.statut === s.id);`) | **M v176** : 6195 bouton « Remettre en Facturé » porte `gestion-seul` |
| carteHTML | 10801 | **10851** (badges 🚜/📦 **10889-10892**, badge-live 10929, lignes `.badges` 10928-10936, poubelle 10950) | **M v176** : 10866 montant facture, 10870 montant cadeau, 10873 « Facturation prête » enveloppés de `<span class="cout-seul">` ; 10950 🗑️ `gestion-seul` (sabotage test-v176 #11 cible 10866) |
| deplacer | 10907 | **10958** (`m.statut = statut;` 10981 ; `delete m.cadeau` 10992) | = |
| liveFinOuvrir / liveFinOui / liveFinValider | 21815 / 21837 / 21864 | **21870** / **21892** / **21919** (note ⏳ 21926) | = ; HTML `#live-fin` 3343, `#live-fin-reste` 3351 |
| liveFermerSession / liveChangerTech | 20182 / 20340 | **20237** / **20395** | = |
| ordreResteAuto / ordreResteMin / ordrePlanifOuvrir | 28659 / 28666 / 29179 | **28955** / **28962** / **29464** | = (script d'ordre 28906-30433) |
| rendreEcranTech | 22558 | **22638** (tuiles 22652-22655, tuile TV 22657-22658, machines 22680-22711) | **M v177** : 22645 `if (roleDe(e) === "reception") { posteRendre(e); return; }` (regex test-v177 l.209 + sabotage #1) ; 22646 retire `.poste` |
| factOuvrir / factFermer / factRendre / factPeutFacturer | 15426 / 15457 / 15524 / 15247 | **15480** / **15511** / **15578** / **15301** | = ; `#fact-pop` 4786, titre + 🎁 4788, `#fact-avis` 4791 |
| factCadeau / cadeauFermer / cadeauConfirmer | 15842 / – / 15864 | **15896** / 15917 / **15918** (bloc 15894-15933, `cadeauBtId` 15895) | = ; `#cadeau-pop` 4828-4840 ; CSS 3045-3062 |
| estCadeauRent / dateCadeau / valeurCadeau / aggCadeau | 9566 / 9568 / 9569 / 9570 | **9616** / **9618** / **9619** / 9620 | = |
| invReserve / invBonsACorriger / invSynchroBT | 17466 / 19050 / 15790 | **17520** (`\|\| m.cadeau` 17527) / **19105** (19111, 19115, 19133) / **15844** (ref 15848) | = |
| sauvegarder (global) | 5430 | **5475** (tête 5476 `localStorage.setItem(CLE…)`, 5477 rafraichirVues) | = ; attention : 24602 est un `sauvegarder = function` LOCAL de l'IIFE Rappels |
| fusionnerAjoutsServeur / relireMachines / appliquerLigne1 | 5383 / 5406 / 5400 | **5428** / **5451** (jsonStable 5460) / **5445** | = |
| demarrerDonnees | 23940 | **24230-24245** | = |
| invSauverMouv / invFusionnerMouv | 17070 / 12481 | **17124** / **12534** | = |
| brpOuvrirCatalogue / brpRecevoirPiece / brpEnvoyerPanier / écouteur `message` | 25722 / 25745 / 25763 / 25769 | **26014** / **26037** / **26055** / **26061** | = ; bloc BRP = script **25881-26306** (`LIGNE_BRP` 25886) |
| afficherCommandes / enregistrerCommandePiece / cmdCommanderRendre | 9086 / 9231 / 8961 | **9136** / **9281** / **9004** | = ; `#voile-commandes` 2733 (h2 2735 : le bouton ⏱️ Délais porte `gestion-seul` v176) |
| liveRendre / fermerLive | 20561 / 20291 | **20616** (liste `conserver` 20645-20647 ; champ `live-note-champ-haut` 20701-20703 ; section « Commander une pièce » 20771 ; reste à faire 20733) / **20346** | = |
| machinesEnAtelier / proposerNote / commNoteAppel / rendreNote / sauverNote | 27623 / 27955 / 27985 / 28046 / 28138 | **27916** / **28251-28272** / **28281** / **28342** / **28434** | = ; commRendre 28067 **M v176** : 28079 bouton `#comm-messenger`, 28080 ⚙️ conditionnel `peut("gestion")` (sabotage test-v176 #13), 28102-28103 branchements ; rendreFil 28114 (chip BT 28129), brancherFil 28156, ouvrirCommunications 28056, commCharger 27902 |
| rapVars / rapProposerConfirmation / rapRendreAvenir / rfRendreHistorique | 24180 / 24260 / 24416 / 25371 | **24470-24478** / **24550** / **24708** (find confirmation 24718, bouton 📲 Confirmer 24728) / **25663** (find 25685) | = ; aide variables ≈ 24649, aperçu ≈ 24682 ; ENTREPRISE 7501 ; rapRendre **M v176** 24634-24639 (onglet Réglages caché sans gestion ; sabotage #15) |
| demConfirmerSms | 27305 | **27598** (écrit déjà `confirmation_envoyee_le` 27615-27616) | = |
| demRendrePicker / clic `.dem-h` / demOuvrirFiche / demRendre | 26938 / 26993 / 26710 / 26637 | **27231** / **27286** / **27003** / **26930** | demOuvrirFiche **M v176** (27117 🗑️ Supprimer conditionnel, 27130) ; carte 27112-27117 (Renvoyer / Envoyer 27115, lit `confirmation_envoyee_le`) |
| demTechs / demOccupe / demHeures / demJours / demEnvoyerCreneaux | 26475 / 26488 / 26502 / 26528 / 27023 | **26768** (ROLES_CAPACITE **26577**, `e.role` brut 26772) / **26781** / **26795** (places 26805-26812, règle stricte 26809) / **26821** / **27316** (ligne `creneaux:` **27338**) | = ; demMajBadge 26674 **M v177** (26675 `rendreEcranTechSiOuvert()` si réception) |
| sonCtx / sonDebloquer / écouteurs once / sonNotification | 21162 / 21163 / 21166 / 21167 | **21217** / **21218** / **21221** / **21222** | = ; chat 21351 ; repli 26742 |
| sonAcceptation / demSonnerie / demTempsReel | 14258 / 26430 / 26412 | **14312** / **26723** / **26696** (ligne à modifier par SON = **26705** ; 26706-26709 intouchables ; CAL9 : 26710 et 26716) | = |
| commTempsReel / verifierRappels / cmdAlarmesRendre / sessionAvertOuvrir | 27664 / 28355 / 8897 / 22030 | **27958** / **28651** / **8947** (⚠ `const peut` LOCAL 8949 = droit("commandes")) / **22104** | = (la fonction de badge juste avant commTempsReel porte 27955 `rendreEcranTechSiOuvert()` v177) |
| deconnecter | 22495 | **22569-22589** | = (suivi de ouvrirAccueil **M v177** 22592-22601) |
| pushOuvrirReglages / pushRendre | 24058 / 24070 | **24348** (`#push-boite` 24352) / **24360** (texte limites 24394) | = ; `<!-- Nouveau message… -->` **3778** (bandeau SON avant) ; menu Compte **3879-3881** |
| SECTIONS | 21932 | **21987-22013** (`ordre` 21995) | = (25 entrées) ; suivi de ROLES 22014, SOUS_DROITS **22019-22022** (voirCouts, gestion) |
| DROITS_DEFAUT | 21960 | **22023-22038** (admin 22024, technicien 22025-22027, tache 22029-22031, reception 22035-22037) | **M v176** : clés `communications`, `voirCouts`, `gestion` ; rôle `reception` |
| droitDe / peut / estReception / utilisateurCourant / estAdmin / droit | 21973 / – / – / 21979 / 21983 / 21984 | 22044 / **22050** `peut(option)` / **22051** / **22053** / **22057** / **22058** | peut = `estAdmin() \|\| droit(option)` ; options = **"voirCouts"** et **"gestion"** ; `const peut` locaux à 8949, 22815 (posteRendre), 23133, 29263 |
| garderSections / appliquerDroits / refusSection | 23879 / 23862 / – | **24143** (garde 24144-24146) / **24121-24137** / 24138 | appliquerDroits **M v176/v177** : 24128-24130 classes `role-reception` / `sans-couts` / `sans-gestion` sur body ; 24132 texte « 🛎️ Mon poste » ; nouveau `garderGestion` **24162-24180** (enveloppe 30 fonctions + 3 adminSeul) |
| APP_VERSION | 5011 | **5056** = `"v177"` | M |
| toastAviser / surTelephone / echap | 6031 / 6258 / 5568 | **6077** / **6304** / **5613** | = |
| posteDonneesPieces / posteDonneesComm / posteDonneesDemandes | – | **22769** / **22752** / **22761** | nouveaux v177 ; bloc Mon poste **22716-22890** (posteRecherche 22725, POSTE_ACTIONS 22726-22734, posteRendre **22810-22890**, section J 22880-22885) |
| rendreEcranTechSiOuvert | 22700 | **22959** | = (appels : 5299 temps réel, 7703 punch, 26675, 27955, tâches / market) |
| liveVoir, techsCapacite, rdvPlaces, arriveeDe, resteMinutesDe, purgerCadeaux, jouerSon, btaActifs, ouvrirBonsActifs, calVoies, demChargeJour, soumBonsLies, brpCibleBT… | – | **0 occurrence** | aucune collision de nom |

## (c) Adaptations par lot dues à la v176 (rôle Réception) et à la v177 (Mon poste)

**S0a (capacité)**
1. Insertion sous l'ancre `//@@v178-S0a capacite`. Seule modification permise ailleurs : `nbTechniciensDispo`. `techniciensDisponibles` (8675-8684) est intouchable, y compris la ligne v176 8679 (regex de test-v176 l.277 + sabotage #9).
2. Règle v176 à réutiliser : exclusion par `roleDe(e) === "reception"` dans `techniciensDisponibles` (8679) et dans `ordreTechsJour` 29017-29020 (`roleDe(e) !== "tache" && roleDe(e) !== "reception"`). `techsCapacite` = `techniciensDisponibles` filtré par `ROLES_CAPACITE_RDV.includes(roleDe(e))` ; `['admin','technicien']` est cohérent avec `roleDe` v176 (exclut tache et, redondamment, reception ; rôle absent → technicien). Critère à ajouter : un employé `role:'reception'` est absent de `techsCapacite`.
3. Le critère « Marie hors capacité » de test-v176 reste vrai avec `nbTechniciensDispo = techsCapacite.length`.

**S0b (helpers)** : sous l'ancre `//@@v178-S0b helpers` (script principal 5017-25731) ; premier `afficher()` 24234 ; `liveDuree` 20218 ; `ordreDureeTxt` / `ordreTravailleMin` dans 28906+ (interdits). `posteResultatHTML` 22799 et tv.html:433 lisent `m.resteAFaire.texte` → `resteAFaire` reste un objet, `minutes / quand / tech` s'y ajoutent.

**SRV** : `edge/` identique à la v175 ; `edge/rdv-confirmer/index.ts` et `edge/smart-api/Index.ts` existent dans le dépôt (export fait). Le poste écrit déjà `demandes_service.confirmation_envoyee_le` (27615) et la carte le lit (27115).

**COM**
1. Ancres A3 ; IIFE Communications 27858-28774 ; **ne pas toucher** 28079-28080, 28102-28103 (Messenger + ⚙️ conditionnel v176 ; sabotage #13 cible la ligne 28080 exacte).
2. Rappels : rapVars 24470, aide ≈ 24649, aperçu ≈ 24682, rapProposerConfirmation 24550, rapRendreAvenir 24708 (24718 find, 24728 bouton), rfRendreHistorique 25663 (25685), ENTREPRISE 7501.
3. Demandes : carte 27112-27117 (bouton Supprimer conditionnel v176 à conserver), LIB 27216-27220, demConfirmerSms 27598.
4. Contrats avec « Mon poste » (v177) à préserver : `window.commNoteAppel(tel, {manuel:true})` (22736), `window.__comm.comms()` (22753) renvoyant des lignes avec `statut` a_traiter / rappel, `canal` appel_manque / sms_in, `rappel_le`, `client_nom`, `contenu`, `cree_le`, `tel`, `id` ; `window.__comm.rappelAction(id,"fait")` (22746) ; `window.ouvrirCommunications(tel)` (22735). Le compteur Communications (27955) appelle `rendreEcranTechSiOuvert()` pour la réception : ne pas le retirer.
5. Redessin de Mon poste : aucun canal nouveau — rafraichirVues 5406, temps réel 5299, 7703, demMajBadge 26675, compteur comm 27955 → tous via `rendreEcranTechSiOuvert` (22959). Une ancre rafraichirVues suffit.
6. `liveVoir` ouvre le live ; Mon poste n'ouvre jamais le live (posteOuvrirBon 22802 → ouvrirEdition / bonDeTravail) : pas de conflit.

**PCS** : bloc BRP 25881-26306 et userscript inchangés. Le bouton « 🔩 Recherche de pièce BRP » dans l'en-tête de `#voile-commandes` (2735) ne doit PAS porter `gestion-seul` (sinon invisible pour la réception) ; `cmdDelaisOuvrir` est enveloppé par garderGestion (24166) — ne pas l'appeler depuis le flux BRP. Mon poste appelle `cmdEnRoute()` 8887, `nbPiecesACommander()` 8823, `cmdRelancer(cle)`, `cmdRecue(cle)` : signatures à conserver.

**FAC**
1. Occurrences `cadeau|comptant` v177 : **107 lignes**, identique à la v175 sauf **10870** (montant du badge cadeau dans `<span class="cout-seul">`). Liste : CSS 1554-1557 (garder), 3045-3051, 3060-3062 ; HTML Rentabilité 2575, 2592-2596, 2663 (garder, Q23) ; texte 4643 ; 4788 (🎁 du titre Facturer) ; 4827-4840 (`#cadeau-pop`) ; Rentabilité JS 9479, 9525, 9558-9564, 9613-9666, 9691, 9773, 9882-9884, 9931-9933, 10018-10020, 10055 ; carteHTML 10869-10871, 10875-10877, 10923 ; deplacer 10989, 10992 ; 15773, 15848 ; bloc 15894-15933 ; 17518, 17527 ; 19097, 19111, 19115, 19133 ; 19233.
2. Dans carteHTML ne retirer que 10869-10871 (branche cadeau) et 10875-10877 + `${btnCadeau}` 10923 ; **garder 10866 et 10873 tels quels** (spans cout-seul ; sabotage test-v176 #11 cible 10866 ; assertion « Facturation prête sans montant »). Garder 10950 (`gestion-seul`).
3. Points d'entrée : 5475/5476, 5428, 5451 (purger `data.donnees` avant 5460), 5445, ancre demarrerDonnees, 17124, 12534.
4. A4 : `#fact-avis` 4791 ; notes admin seulement via factPeutFacturer 15301. `surTelephone` 6304.
5. test-v177 sabotage #6 cible `<span class="sous">Facturé${m.echeance…}</span>` dans posteRendre (22859) → ne pas y toucher.

**TAB** : afficher 6093/6111 ; carteHTML 10889-10892 (remplacer 10890 « 🚜 Machine sur place »), 10928-10936 ; deplacer 10981 ; formulaire `Object.assign(m, donnees)` 11402 ; `#live-fin` 3343 / `#live-fin-reste` 3351 ; liveFin* 21870/21892/21919 ; ordreResteAuto 28955, ordreResteMin 28962, ordrePlanifOuvrir 29464 ; page live 20733 ; écran technicien 22699 ; tv.html:433 ; liveConnecterFinal 20314. Préserver 10866/10870/10873/10950 (v176). Le tri de « Mon écran » (22684-22692) et de « Mon poste » sont hors zone. Minuterie sous l'ancre demarrerDonnees (ne pas confondre avec le setInterval 60 s du script d'ordre 30425). `majOptionsStatut` 11141-11145 (v176) : afacturer / prete cachés dans le formulaire sans option gestion — sans effet sur le crochet de sauvegarde.

**CALA** : demTechs 26772 filtre encore `ROLES_CAPACITE.includes(e.role)` (26577, brut) → remplacer par techsCapacite ; demHeures règle stricte 26809 (`!(fin + tampon <= o.debut + 1e-9 || t >= o.fin + tampon - 1e-9)`), capacité 26810. Pastille 👷 : 6663/6668 et 6780/6787. La réception est déjà exclue en amont (8679) ; test-v176 « Marie hors capacité et hors horaire » doit rester vert.

**CALB** : CSS `.cal-sem-grille` 1389 et `min-width: 700px` 1754 (média-query). Mon poste appelle calEvenementsDuJour (intouchable) et `calOuvrirEvt(id)`.

**CAL9** : demRendrePicker 27231 ; clic 27286 ; demOuvrirFiche 27003 (garder 27117/27130 v176) ; demRendre 26930 ; callbacks 26710 et 26716 (→ demRafraichir) ; ouvrirDemandes 26918 ; setInterval 120 s 26759 (t0 26752) ; `demCharge` booléen 26586 ; `#dem-boite` 26913 (`width:min(1000px,100%)`) ; gabarit CSS 26841 (interdit). v177 : garder 26675 dans demMajBadge ; conserver `window.__dem.ouvrirFiche`, `.demandes()`, `.smsNonTraites()`, `.bonManquant(d)`, `.remettreBon(id)` et `window.ouvrirDemandes` (appelés 22745, 22762-22765, 22877).

**CAL6** : soumVersRdv 16785, alerte A6 **16790** ; soumVersBonTravail 16741 (alerte 16745) ; soumRendreTout 13221 ; boutons **4076-4077** (`#so-vue-edit` 3935 ; les boutons voisins 4069, 4073-4074 portent `gestion-seul` v176 : ne pas retirer) ; `#voile-repro` 4439 ; repro* 16142/16164/16230/16243 ; piecesArrivees 16124 ; rdvHeuresMO 19891 ; rdvSyncSoumission 20157.

**SON** : sonCtx 21217-21235 (écouteurs `{once:true}` 21221) ; chat 21351 ; sonAcceptation 14312 ; **26705** seule ligne à modifier dans demTempsReel ; demSonnerie 26723 ; ouvrirDemandes 26918 ; commTempsReel 27958 ; ancre A11 ; verifierRappels 28651 ; cmdAlarmesRendre 8947 (⚠ `const peut` local 8949) ; sessionAvertOuvrir 22104 ; ancre deconnecter ; bandeau avant **3778** ; pushOuvrirReglages 24348 (`#push-boite` 24352), pushRendre 24360 (texte 24394) ; menu Compte 3879-3881 ; sw.js inchangé. La réception a droit('demandes') et droit('communications'). Ne pas mettre de son dans demMajBadge / compteur comm (ils tournent à chaque redessin de Mon poste).

**BTA**
1. Registre : SECTIONS 21987-22013, entrée après `ordre` 21995. DROITS_DEFAUT : ajouter `bonsActifs` aux trois rôles non admin — technicien 22025 (true), tache 22029 (false), **reception 22035 (true ; sinon la page `data-section=bonsActifs` est masquée pour la réception et test-v176 l.78 « DROITS_DEFAUT.reception a une valeur pour chacune des clés » échoue)**. Placer la clé **en tête de chaque objet** (juste après `{`), pas en queue : le sabotage test-v176 #2 cherche la chaîne exacte `rappels: true, marketing: false, demandes: true, communications: true,\n                voirCouts: false, gestion: false },\n};`.
2. Garde 24144-24146 (+ `ouvrirBonsActifs: "bonsActifs"`) ; pas dans garderGestion 24162-24180. Menu : après **3854** (`data-section="ordre"`). HTML : `#ordre-page` 2143-2161 → insérer avant **2162** (`<!-- v167 : procédure…`). Tuile Mon écran : 22652-22655 (sous-titre 22655). Bloc JS sous l'ancre `//@@v178-A12 bloc` (script principal : techOuvrir 22636 et garderSections 24148 lisent `window[nom]`).
3. « Mon poste » : section J 22880-22885 affiche **automatiquement** toute section de SECTIONS ouverte à l'employé et absente de POSTE_ACTIONS (via `techOuvrir(id)` 22627 → `window[s.ouvrir]()` 22636) → « 📑 Bons de travail actifs » apparaîtra pour la réception dès que `droitDe(e,"bonsActifs")` est vrai ; ne pas modifier 22883 (sabotage test-v177 #10). Réception sans verrou de punch (techPunchRequis 22951). « 📋 Tableau de bord » = fermerEcranTech 22616, « 🛎️ Mon poste » = ouvrirEcranTech 22603 : ne pas y toucher.
4. Dossier employé : empRendreDroits 24201-24213 / empLireDroits 24222 génèrent la case automatiquement (test-v176 l.256 : `SECTIONS.length + 2`).
5. Coûts : la page n'affiche aucun montant → pas de `cout-seul` nécessaire.

## (d) Tests sous Chromium (après le correctif `__NAVIGATEUR` du socle)
test-v176.js **82/82**, test-v177.js **48/48** (sans le correctif : 78/82 et 47/47, car `cache()` retombait sur un test de classe au lieu du style calculé). Base complète attendue = 804 + 82 + 48 = **934**.

## (e) Non vérifié
Sabotages (`--sabotages`) des deux tests non rejoués ; code Edge déployé vs `edge/` non recomparé à la production ; schéma Supabase non relu ; lignes du formulaire d'édition (v175 11261-11265 → ≈ 11313-11317) et aide / aperçu des rappels (≈ 24649 / ≈ 24682) estimées par décalage.
