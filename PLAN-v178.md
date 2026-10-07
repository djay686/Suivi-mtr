# Plan d'exécution — Suivi-Garage-Partage **v178** (12 demandes, agents en parallèle)

Préparé le 7 octobre 2026 par Fable (maître d'œuvre), lancé le même jour sur le GO du patron. Le code de base est
celui de `deploy-atelier-v177.zip` (v176 « rôle Réception » + v177 « Mon poste »), importé dans le dépôt comme commit
`a838643` (tag `v177-base`) sur la branche `claude/v175-modifications-plan-tyk4kb`. **La prochaine version est la
v178.**

## 0. À lire en premier

### Base v177 → cible v178
Le plan a été rédigé et vérifié contre la v175 ; les numéros de ligne d'index.html cités ci-dessous sont donc ceux
de la **v175** (30 138 lignes) et sont **indicatifs** : la v177 en compte 30 435 (décalage de +44 à +60 lignes selon la
zone). Les agents repèrent le code par nom de fonction et chaîne de texte, jamais par numéro de ligne. Une table de
correspondance v177 (ancres du socle, symboles des lots, adaptations dues au rôle Réception et à « Mon poste ») est
établie en vague 0 avant de lancer les lots ; elle est consignée dans `outils-v178/CORRESPONDANCE-v177.md`.

### En une page
- **12 demandes → 14 lots** : 2 lots de socle (vague 0), 11 lots en parallèle (vague 1, un agent et un worktree
  chacun), 1 lot d'intégration (vague 2, Fable).
- **Durée murale réaliste : 4 h 30 à 5 h 30** (3 h 30 est la borne optimiste, revue à la hausse par le critique de
  complétude pour inclure sabotages, régression et intégration) contre ≈ 14 h en séquentiel. Pas deux jours.
- **Le lot à risque est A10** (créneaux selon le nombre de techniciens) : moteur de capacité isolé et testé seul
  en vague 0, interrupteur de repli `CAPACITE_MULTI_TECHS`, serveur rétrocompatible, et possibilité de livrer en deux
  temps (section 11).
- **Côté serveur, tout est additif et rétrocompatible** avec des appareils restés en v175 — sauf la purge du
  « cadeau » (A5), qui se fait en SQL **après** que tous les appareils aient rechargé (section 8).
- **Agents** : `opus` pour la logique à risque (moteur de capacité, câblage des réservations), `sonnet` pour les
  fonctionnalités standard, `fable` pour l'intégration. Aucun lot ne justifie moins que `sonnet` : chaque lot touche un
  monolithe de 2,2 Mo et doit prouver ses tests par sabotage. L'effort est `high` partout sauf les helpers du socle
  (`medium`) et la section de consultation (`medium`).
- **24 questions ouvertes** (sections 9 et 12), chacune avec un défaut recommandé : **rien ne bloque** si tu ne
  réponds pas. Les quatre qui comptent le plus : Q1 (le texto de confirmation part-il déjà ?), Q3 (purge
  irréversible du cadeau), Q9 (qui compte comme technicien ?), Q18 (sons plus forts seulement, ou aussi une alarme
  répétée avec bandeau « J'ai vu » ?).

### Comment ce plan a été fait
15 agents d'exploration (un par demande + architecture / tests / serveur) ont lu le vrai code, puis 2 sceptiques par
demande ont tenté de réfuter chaque spécification (références de lignes, oublis d'appels, régressions, interactions).
Un maître d'œuvre a assemblé les lots en tranchant les désaccords dans le code, et un critique de complétude a relu
le résultat phrase par phrase contre ta demande (section 12). L'outillage de test a été validé sur la v175 :
**804/804** assertions sur 19 fichiers de tests existants, dans Chromium (jsdom ne s'installe pas dans
l'environnement de travail : registre npm bloqué), puis rejoué sur la v177. Cet outillage est livré dans `outils-v178/` (hors zip).

### Décisions déjà tranchées dans le code (tu peux les contester)
| Sujet | Décision | Pourquoi |
|---|---|---|
| A6 (photo de l'erreur) | Confirmé : c'est l'alerte de `soumVersRdv` (index.html:16736) « Un bon de travail existe déjà pour cette soumission. Déplace son rendez-vous directement dans le calendrier. » — ta photo la montre par-dessus l'éditeur de détail d'une soumission. | Le bon créé par « → Bon de travail seulement » n'a pas de date : il n'est pas au calendrier, donc rien à « déplacer ». On remplace l'alerte par « Placer BT-… au calendrier » (sans créer un 2e bon). |
| A1 | Le serveur **envoie déjà** la confirmation (réponse TwiML dans `sms-entrant`) mais ne l'enregistre pas : la fiche affiche « pas envoyée ». Livraison minimale = trace + verrou anti-doublon + adresse dans le texte ; pas d'appel API Twilio supplémentaire (phase 2 si Q1 dit que rien n'arrive). | 8 confirmations automatiques sont tracées en production dans Communications. |
| A10 | Capacité d'un créneau = nombre de techniciens **capables** (rôles admin + technicien, présents, compétents pour le type de machine) moins les rendez-vous qui chevauchent (tampon compris). Le serveur reçoit la liste des techniciens capables avec chaque créneau proposé ; sans cette liste (créneaux d'avant la v178) il garde la capacité 1. | Rétrocompatible ; un rendez-vous épinglé à un technicien ne ferme pas le créneau pour l'autre. |
| A10 affichage | Les rendez-vous simultanés se placent **côte à côte quand ils se chevauchent** ; un bloc seul se réduit à une demi-piste dès qu'il reste une place (2 techniciens ou plus), pour qu'on puisse **double-cliquer 9:00 et créer le 2e rendez-vous** — ton scénario exact. Pas de colonne fixe par technicien en vue Semaine (illisible sur iPad). Placement manuel jamais bloqué : un `confirm()` en surcharge. | Lisibilité iPad / cellulaire ; section 12.3. |
| A5 | Retrait complet du 🎁 « payé comptant » (v168) : interface, calculs, données (migration idempotente au chargement + SQL de purge des copies serveur). Le 🔄 comeback et la bascule « offert gratuit » de la Rentabilité (antérieure, sans paiement) restent. | « Aucune trace de paiement, mais l'historique de travaux reste ». |
| A7 / A8 | Un seul champ `resteAFaire.minutes` et un seul helper `resteMinutesDe()` ; jours civils depuis `arriveeLe` (sinon premier punch, sinon date de création du bon, affichée « ≈ » en gris). | Évite deux définitions du même concept entre lots. |
| A11 | L'item de menu « Alertes et sons » n'a **pas** d'attribut `data-section` (sinon `appliquerDroits` le cache aux techniciens). Les alertes critiques (demande, texto à traiter, appel manqué) se répètent toutes les 15 s pendant 3 min max jusqu'au bouton « ✓ J'ai vu » ; réglables (volume, muet, répétition). Le son d'une notification push (app fermée) reste celui du système : impossible à changer. | Limite iOS / Android documentée. |
| Tests | jsdom indisponible ici → exécuteur Chromium livré dans `outils-v178/` ; `test-v171.js` sauté (fichiers `bt089/` absents du dépôt). | Référence 804/804 reproduite sur la v175, rejouée sur la v177 (+ test-v176.js et test-v177.js). |

### Exécution
GO reçu le 7 octobre 2026 avec le zip v177. Fable fait la vague 0 lui-même (≈ 60 min), lance les 11 agents de la
vague 1 en parallèle, fusionne dans l'ordre de la section 6, fait tourner toute la non-régression, monte la version à
v178, écrit `CHANGELOG-atelier-v178.md` et construit `deploy-atelier-v178.zip`. Les étapes serveur (section 8) restent
au patron : aucun agent n'exécute de SQL ni ne redéploie une fonction Edge en production. Sans réponse aux questions
des sections 9 et 12, ce sont les défauts recommandés qui s'appliquent.


## 1. Les 12 demandes et leur lot

| Demande | Quoi | Lot(s) | Agent · effort | Vague |
|---|---|---|---|---|
| **A1** | SMS de confirmation automatique quand le client confirme par texto | SRV, COM | SRV : sonnet · high<br>COM : sonnet · high | 1 |
| **A2** | Recherche de pièce BRP depuis « Pièces à commander » et le BT live | PCS | PCS : sonnet · high | 1 |
| **A3** | Note d'appel : bouton rapide vers le BT / note d'atelier | COM | COM : sonnet · high | 1 |
| **A4** | Facturer : espace avec les notes d'atelier | FAC | FAC : sonnet · high | 1 |
| **A5** | Cadeau / « payé comptant » : retrait complet, aucune trace | FAC | FAC : sonnet · high | 1 |
| **A6** | BT déjà créé : l'ajouter au calendrier (erreur de la photo) | S0a, S0b, CAL6 | S0a : opus · high<br>S0b : sonnet · medium<br>CAL6 : sonnet · high | 0, 1 |
| **A7** | Compte à rebours des jours depuis l'arrivée, tri, bons en direct en haut | S0b, TAB | S0b : sonnet · medium<br>TAB : sonnet · high | 0, 1 |
| **A8** | Fermeture d'une session BT non terminée : temps approximatif restant | S0b, TAB | S0b : sonnet · medium<br>TAB : sonnet · high | 0, 1 |
| **A9** | Demande de rendez-vous : voir le calendrier à côté des créneaux proposés | S0a, CAL9 | S0a : opus · high<br>CAL9 : sonnet · high | 0, 1 |
| **A10** | Calendrier : nombre de blocs selon le nombre de techniciens disponibles | S0a, SRV, CALA, CALB | S0a : opus · high<br>SRV : sonnet · high<br>CALA : opus · high<br>CALB : sonnet · high | 0, 1 |
| **A11** | Sons de notification plus forts pour chaque alerte | SON | SON : sonnet · high | 1 |
| **A12** | Section « Bons de travail actifs » (sauf archivés), sans ouvrir le live | S0b, BTA | S0b : sonnet · medium<br>BTA : sonnet · medium | 0, 1 |

Lots de socle (vague 0, avant tout le monde) : **S0a** moteur de capacité des techniciens (sert A10, A9, A6) et **S0b** helpers date d'arrivée + temps restant (sert A7, A8, A12, A6). Lot d'intégration (vague 2) : **INT**, tenu par Fable.

## 2. Les vagues

### Vague 0 — Préparation et socle (branche, outillage Chromium, baseline, ancres de fusion, moteurs partagés) (≈ 60 min)
Lots : S0a, S0b

Condition de sortie : Baseline reproduite (804/804 sur 19 fichiers, hors test-v171.js ; edge 33/33 et 57/57) ; commit socle (ancres + blocs vides) puis S0a et S0b fusionnés, leurs tests verts, syntaxe et fumée à 0 erreur ; rdv-confirmer exporté dans edge/ et résultats des lectures Supabase consignés (P4) ; 11 worktrees créés depuis l'intégration.

### Vague 1 — Onze lots en parallèle, un agent chacun, chacun dans son worktree et ses zones (≈ 120 min)
Lots : SRV, COM, PCS, FAC, TAB, CALA, CALB, CAL9, CAL6, SON, BTA

Condition de sortie : Pour chaque lot : son test-v178-<lot>.js rouge sur la v175 intacte, vert sur la version modifiée ; N fautes volontaires attrapées sur N ; suites de régression de sa zone vertes ; syntaxe et fumée à 0 erreur ; diff stat conforme (zones et ancres seulement) ; rapport avec ce qui n'a pas pu être vérifié. Les plus longs : TAB (85 min + sabotages et régression) et COM / FAC (75 min) ; SON réduit à 50 min (section 12.1) ; la chaîne A10 (S0a 45 min en vague 0, puis CALA 60 min) finit en même temps que les autres.

### Vague 2 — Intégration par Fable : fusion ordonnée, non-régression complète, v178, changelog, zip (≈ 100 min)
Lots : INT

Condition de sortie : Suite complète verte sur l'intégration, APP_VERSION et version.txt à v178, CHANGELOG-atelier-v178.md avec les citations du patron et la section « À faire au déploiement » (étapes serveur ci-dessous), deploy-atelier-v178.zip construit et inspecté (sans outils-v178/ ni ancres).


## 3. Préparation (vague 0, Fable)

1. P1 (Fable, 5 min) : créer la branche d'intégration claude/v178-integration depuis claude/v175-modifications-plan-tyk4kb (identique au zip), taguer v175-base. Vérifier qu'aucun .gitattributes ne met merge=union (X1 : duplique les lignes modifiées des deux côtés). Les noms de branches de lots sont claude/v178-<lot> (préfixe claude/ pour rester pushables).
2. P2 (Fable, 5 min) : copier l'outillage validé par X2 dans /home/user/Suivi-mtr/outils-v178/ (hors zip) : run-in-chromium.js (variables MTR_FAKE_NOW et MTR_TZ), run-edge-html.js, sabotage.sh, test-lib-v178.js (faux Supabase, faux AudioContext, jourOuvrableIso, connecter), run-all.sh, syntaxe.py (node --check par bloc script puis sur la concaténation), smoke.js (Playwright, 0 erreur exigée). Sources actuelles : le dossier scratchpad de la session (chromium-runner/, proposal/, smoke.js, syntaxe.py). run-all.sh fixe MTR_FAKE_NOW à un mercredi 10 h, sinon test-v168b.js échoue samedi et dimanche (ligne 141). Le zip final doit exclure outils-v178/.
3. P3 (Fable, 5 min, en parallèle) : baseline. Lancer toute la suite via Chromium : attendu 804/804 sur 19 fichiers (v159 63, v159b 8, v160 16, v161 42, v162 36, v163 34, v164 63, v165 26, v166 49, v167 72, v168 56, v168b 35, v169 54, v170 77, v172 52, v172b 24, v173 14, v174 36, v175 47), plus edge/test-sms-entrant-v172.html 33/33 et test-quickbooks 57/57. test-v171.js est exclu du garde-fou : il exige bt089/ et bt089.zip, absents du dépôt et du zip. Sauvegarder la sortie comme référence.
4. P4 (Fable, 10 min) : lectures seules via le connecteur Supabase (aucune écriture, aucun déploiement par un agent) : (a) exporter dans edge/ le code déployé de rdv-confirmer (nécessaire à SRV) et de smart-api ; (b) lire les contraintes de rappels_envoyes (CHECK sur canal et statut, rappel_id nullable, unicité) ; (c) confirmer que demandes_service.confirmation_envoyee_le existe et que demandes_service.creneaux est de type jsonb ; (d) lire la ligne 4 de tableau : rôles et horaires de chaque employé, et compter combien de techniciens techsCapacite donnerait pour le prochain mardi (X3 signale 8 employés, dont 2 admins, et des horaires vides pour Arno, Jason Tech et Samantha ; si e.horaire est un objet vide au lieu de null, lireDispoCell les compte absents). Le résultat alimente la question ouverte Q9.
5. P5 (Fable, 15 min) : commit « socle v178 » sur l'intégration. (i) Ancres-commentaires, une par ligne, chacune sur sa ligne : //@@v178-FAC purge (près de retirerMachine ~5391) ; //@@v178-A4 rafraichir, //@@v178-A9 rafraichir, //@@v178-A12 rafraichir (trois lignes distinctes à la fin de rafraichirVues 5355-5367) ; //@@v178-A3 liveVoir (juste avant function fermerLive 20291) et //@@v178-A3 notes (après liveSupprimerNote ~20540) ; //@@v178-A12 bloc (ligne 21922, dans le script principal : garderSections 23879 lit window[nom] au chargement, un bloc placé dans un script ultérieur ne serait pas protégé) ; //@@v178-A11 proposerNote (fin du corps de proposerNote ~27976, à distance de 3 lignes des boutons modifiés par A3) ; //@@v178-A9 apres-demJours (après demJours 26542). (ii) Un bloc <script id=v178-LOT></script> et un <style id=v178-LOT></style> vides par lot, avant le </body> final (30137) : le CSS neuf va dans ces blocs, jamais dans le CSS principal (1963) ni dans le gabarit CSS injecté de l'IIFE Demandes. (iii) Rien d'autre : pas de bump de version, pas de changelog. (iv) Ancres ajoutées après la vérification finale (section 12.3, point 9) : //@@v178-SON deconnecter (en tête de deconnecter, après l'accolade) ; //@@v178-A12 deconnecter (juste avant appliquerDroits(), ~22515) ; //@@v178-FAC demarrerDonnees (juste après await charger(), ~23943) ; //@@v178-TAB demarrerDonnees (dernière ligne de demarrerDonnees, après invMajDatalist(), ~23954).
6. P6 (Fable) : lancer S0a et S0b en parallèle, chacun dans son worktree, depuis le commit socle. Les fusionner dans l'intégration dès que leurs tests et la syntaxe sont verts (condition de sortie de la vague 0).
7. P7 (Fable, 3 min) : créer les worktrees des 11 lots de la vague 1 depuis l'intégration APRÈS fusion du socle : git worktree add ../wt-<lot> -b claude/v178-<lot> claude/v178-integration (0,04 s chacun). Un seul agent par worktree. Consigne commune : ne jamais reformater, réindenter, trier ni déplacer du code ; pas de replace_all ; pas de prettier ou eslint --fix ; repérer le code par nom de fonction et chaîne unique, pas par numéro de ligne (les lignes dérivent) ; ne jamais lire en entier les lignes 43, 96, 98-99, 1973 et 2037 d'index.html (utiliser cut -c1-200) ; commentaires « v178-<LOT> » sur chaque ajout ; tout texte saisi par un utilisateur passe par echap() ; chaînes JS en guillemets doubles quand elles contiennent une apostrophe ; ne jamais toucher APP_VERSION, version.txt, CHANGELOG (Fable seul) ; aucun agent n'exécute execute_sql ni deploy_edge_function sur la production.
8. P8 (consigne commune de test) : chaque lot écrit son test-v178-<lot>.js sur outils-v178/test-lib-v178.js ; ce test doit échouer contre l'index.html v175 intact, passer sur la version modifiée, puis échouer pour chacune de 5 à 10 fautes volontaires lancées avec sabotage.sh (une seule occurrence exacte du texte à remplacer ; ne pas saboter par une erreur de syntaxe, qui prouve seulement que node râle). Rapport final du lot : git diff --stat, nombre de fautes attrapées sur lancées, suites relancées avec leurs chiffres, ce qui n'a pas pu être vérifié.

## 4. Lots détaillés

### S0a — Socle : moteur de capacité des techniciens (techsCapacite, rdvPlaces)

| | |
|---|---|
| **Demandes** | A10, A9, A6 |
| **Vague** | 0 |
| **Agent** | **opus** · effort **high** — Règle de disponibilité (chevauchements avec tampon, épinglés, rôles, interrupteur de repli) dont une erreur ouvre des surréservations ou ferme des journées. Isolée et testée seule avant que quatre lots la consomment ; c'est la sécurisation d'A10. |
| **Dépend de** | rien |
| **Durée murale** | ≈ 45 min |

**Zones de code (propriété du lot)**
- index.html : insertion après rdvOccupationJour (~7144)
- index.html : nbTechniciensDispo (8635-8637) seulement
- NE PAS modifier techniciensDisponibles, lireDispoCell, empHeuresJour (8599-8637 : appelés par le calendrier, l'ordre de travail, la reprogrammation, l'écran atelier)

**Étapes**
1. Ajouter, sous commentaire v178-S0a : const CAPACITE_MULTI_TECHS = true (interrupteur de repli : false redonne la capacité 1 de la v175 partout) et const ROLES_CAPACITE_RDV = ['admin','technicien'].
2. techsCapacite(iso, typeMachine) : techniciensDisponibles(iso, typeMachine) filtré par roleDe(e) (jamais e.role brut : le champ peut manquer sur de vieux dossiers) appartenant à ROLES_CAPACITE_RDV ; si vide et typeMachine fourni, repli sur techsCapacite(iso) sans type ; retourne [{nom, debut, fin}] avec empHeuresJour.
3. rdvIntervalles(iso, opt) : bons non archivés dont echeance===iso et heure présente, plus opt.extra (créneaux retenus des autres demandes) → [{id, debut, fin, tech (m.technicien || ''), groupe: m.rdvGroupe}] ; opt.saufId exclut un bon (déplacement).
4. rdvPlaces(iso, debutDec, dureeH, opt) avec opt = {typeMachine, saufId, extra, tampon (défaut rdvConfig.tampon/60, 30 en prod), dinerDur (défaut false), ctx (techs et intervalles pré-calculés par jour, pour les boucles de 30 jours)} : capNoms = techs de techsCapacite qui couvrent toute la plage [debut, debut+duree] ; chevauchants = intervalles avec la règle stricte !(fin+tampon <= d || t >= f+tampon) (identique à 7170 et 26516, sinon un départ à 10h15 devient faux) ; places = max(0, capNoms.length − chevauchants.length) ; libres = capNoms moins les techs épinglés sur un chevauchant ; retour {places, libres, capNoms, cap, charge}. Si dinerDur est vrai, la plage qui croise rdvConfig.diner donne 0 place (comportement actuel du picker des demandes). Si CAPACITE_MULTI_TECHS est faux, cap = min(1, cap). Pas de raffinement par profondeur des rendez-vous non assignés : la formule du picker en production (26512-26519) suffit et ne perd qu'un créneau dans les cas rares.
5. nbTechniciensDispo(iso, typeMachine) retourne techsCapacite(iso, typeMachine).length, pour que la pastille 👷 N (6617, 6734) soit égale au nombre de voies et de places.
6. Aucun accès réseau, aucune écriture de données : fonctions pures sur machines, EMPLOYES, dispoOverride, rdvConfig.

**Critères d'acceptation (vérifiables)**
- 2 techniciens présents un mardi ouvert, 1 bon à 9:00 de 60 min : rdvPlaces(iso, 9, 1).places === 1 et capNoms.length === 2 ; 2 bons à 9:00 : places === 0.
- Avec CAPACITE_MULTI_TECHS=false, 1 bon à 9:00 donne places === 0 (comportement v175).
- Employé sans champ role compté comme technicien ; role 'tache' exclu ; actif:false exclu ; vacances et férié (ex. 2026-12-25) donnent cap 0.
- Tampon 15 : premier départ après un bon 9:00-10:00 = 10:15 ; tampon 30 (production) : 10:30. Bon sans heure ignoré ; opt.saufId ignore le bon déplacé ; les retenus d'opt.extra comptent.
- Technicien épinglé sur un bon qui chevauche : absent de libres mais présent dans capNoms.
- techniciensDisponibles et lireDispoCell sont inchangés octet pour octet (git diff vide sur 8599-8634).
- test-v178-socle.js vert ; régression : test-v161.js, test-v164.js, test-v170.js, test-v172b.js verts.

**Tests**
- test-v178-socle.js (Chromium, faux Supabase de test-lib) : les 9 critères ci-dessus, plus performance (30 jours × 32 départs avec ctx en moins de 200 ms) et bon type serveur sans technicien.
- Relancer test-v161.js, test-v164.js, test-v170.js, test-v172b.js (techs, dispo, confirmerRdv).

### S0b — Socle : helpers date d'arrivée et temps restant (arriveeDe, resteMinutesDe)

| | |
|---|---|
| **Demandes** | A7, A8, A12, A6 |
| **Vague** | 0 |
| **Agent** | **sonnet** · effort **medium** — Quatre petites fonctions pures déjà spécifiées ligne à ligne ; sert de contrat unique entre A7, A8, A12 et A6, pour que personne ne définisse deux fois la même chose. |
| **Dépend de** | rien |
| **Durée murale** | ≈ 20 min |

**Zones de code (propriété du lot)**
- index.html : après joursDepuis (10946-10951), dans le script PRINCIPAL (le premier afficher() s'exécute à 24113, avant le script d'ordre de travail à 28610 : toute dépendance à ordreDureeTxt ou ordreTravailleMin est interdite ici)

**Étapes**
1. Constantes ARRIVEE_STATUTS = ['avenir','sansrdv','attente','reparation'] et ARRIVEE_JOURS_VIEUX = 7.
2. arriveeDe(m) → {date, source} ou null. null si hors ARRIVEE_STATUTS ; avenir sans machineArrivee → null ; avenir : arriveeLe sinon premier punch (chrono[].debut, tri ISO) sinon null, JAMAIS creeLe (date de prise du RDV) ; sansrdv, attente, reparation : arriveeLe, sinon premier punch, sinon creeLe ; source vaut 'arriveeLe', 'punch' ou 'creeLe'. Date illisible → null sans exception.
3. arriveeJours(m) → jours civils : différence entre isoLocal(maintenant) et isoLocal(date) via Date.parse(iso+'T12:00:00Z'), plancher 0 (ne PAS réutiliser joursDepuis, qui compte des tranches de 24 h).
4. resteMinutesDe(m) → entier > 0 ou null. Lit m.resteAFaire.minutes (nom du champ FIXÉ pour A7, A8, A12 : « minutes », nombre de minutes) ; null si travauxTermines, si pas d'estimation ou si le résultat est ≤ 0. Restant = minutes − travail effectué DEPUIS m.resteAFaire.quand : somme, sur m.chrono, de la durée de chaque session recoupée avec [quand, maintenant], pauses retranchées. Ne PAS stocker de champ travaille : nettoyerPunchsOublies (21036-21047) tronque les sessions à debut+8 h et rendrait un instantané incohérent. Pas de repli « dureeEstimee − temps punché ».
5. dureeTxtLocale(min) : « 45 min » sous 60, sinon « 1 h » ou « 1 h 30 » (même format que ordreDureeTxt 28648, mais autonome).
6. Tout dans try/catch qui retourne null ; aucune écriture de données.

**Critères d'acceptation (vérifiables)**
- arriveeJours : arrivée hier à 23 h 50 → 1 ; arrivée aujourd'hui à 00 h 10 → 0.
- arriveeDe : avenir sans machineArrivee → null ; avenir avec machineArrivee et sans arriveeLe ni punch → null ; sansrdv sans arriveeLe → source 'creeLe' ; reparation avec punch → source 'punch'.
- resteMinutesDe : minutes 90 saisies à T → 90 à T ; 60 après 30 min punchées ; null après 90 min ; session tronquée à debut+8 h ne fait jamais dépasser le total ; travauxTermines → null.
- Aucun appel à ordreDureeTxt ni ordreTravailleMin dans ces fonctions (grep).
- test-v178-helpers.js vert.

**Tests**
- test-v178-helpers.js : les 5 critères ci-dessus + dates invalides + chrono absent + bon type serveur (sans chrono ni machineArrivee) + premier rendu avant le chargement du script d'ordre.
- Relancer test-v164.js (ordre) et test-v170.js.

### SRV — Serveur : SMS de confirmation tracé (A1) et capacité par technicien (A10 côté Edge)

| | |
|---|---|
| **Demandes** | A1, A10 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Un seul fichier Edge touché par deux demandes, donc un seul agent. La version minimale d'A1 (sans appel REST Twilio) et la règle de capacité simplifiée restent de difficulté moyenne ; le soin porte sur le verrou atomique, la restauration d'état en cas d'exception et les bouchons de test. Fable relit le diff d'edge/sms-entrant avant fusion. |
| **Dépend de** | S0a |
| **Durée murale** | ≈ 60 min |

**Zones de code (propriété du lot)**
- edge/sms-entrant/index.ts : plageLibre (104-124), confirmer (126-198), ?diag (~263)
- edge/rdv-confirmer/index.ts (exporté en vague 0)
- edge/envoyer-rappels/index.ts : vars (127-133)
- edge/confirmation-auto-v178.sql (nouveau)
- edge/test-sms-entrant-v178.html (nouveau, copie de la v172)

**Étapes**
1. ⚠️ Voir section 12.3, point 6 : test-v178-srv.js teste plageLibre avec une fixture figée {no, iso, heure, duree, techs} ; le test de contrat avec demEnvoyerCreneaux (CALA) est exécuté en INT.
2. Contrat avec le client (CAL-A) : demandes_service.creneaux[] = {no, iso, heure, duree, techs: string[]} où techs = noms de TOUS les techniciens capables (capacité) à la proposition, jamais les libres. Contrat avec COM : le serveur pose demandes_service.confirmation_envoyee_le et une ligne rappels_envoyes {bt_id: String(bt.id), rappel_id: null, type: 'confirmation', statut: 'envoye'}.
3. A1-a verrou atomique, juste après le test plageLibre (138-148) et avant l'écriture du bon : update demandes_service set statut='confirmee', choix, confirme_le, lu=false where id=dem.id and statut='creneaux_envoyes' avec .select('id') ; si 0 ligne, marquerSms 'aucune_correspondance' et retour sans message (webhook en double ou nouvel essai Twilio). Envelopper tout le reste de confirmer() dans try/catch : en cas d'exception, update statut='creneaux_envoyes' where id=dem.id and statut='confirmee' and bt_id is null, journal 'erreur', puis remonter l'erreur.
4. A1-b fusionner l'update de la ligne 180 en UN seul update final (bt_id + confirmation_envoyee_le = maintenant), pas quatre updates successifs (chacun déclenche un événement temps réel côté poste).
5. A1-c texte : variable {adresse} (une constante, surchargeable par la variable d'environnement SHOP_ADRESSE, valeur 1856 rue Jerome-Hamel, Trois-Rivieres) ajoutée au texte PAR DÉFAUT « … Adresse : … Au plaisir! » et à vars ; sansAccent uniquement sur le texte par défaut ; le gabarit de rappels_config n'est PAS passé par sansAccent (comportement actuel conservé, accents gardés).
6. A1-d trace : après le calcul du message, insérer dans rappels_envoyes avec try/catch silencieux. Par défaut canal 'twiml' : le trigger comm_depuis_rappels (communications.sql:134) ignore tout canal différent de 'sms', donc pas de doublon avec noterReponse, qui écrit déjà la ligne du fil (🤖 SMS automatique). Si P4 a montré un CHECK sur canal : repli = canal 'sms' et ne pas appeler noterReponse pour le déclencheur confirmation (le trigger crée alors la ligne du fil sans l'étiquette 🤖 ; ajouter un update meta.origine='auto' ensuite). Ne JAMAIS mettre dans rappel_id l'id d'une ligne de rappels_config : envoyer-rappels (121-123) l'utilise comme « déjà fait ».
7. A1-e ne PAS ajouter d'appel REST Twilio ni de repli (phase 2 conditionnelle à la question Q1) ; aucun appel réseau entre la lecture de la ligne 1 (150) et son upsert (167).
8. A1-f envoyer-rappels : ajouter adresse aux vars (127-133), avec accents. ?diag : le texte garde la sous-chaîne « v172 » (une assertion du test existant la vérifie) et ajoute « v178 ».
9. A10-a plageLibre(iso, heure, dureeMin, saufDemande, techs: string[] | null) : techs null ou vide → comportement ACTUEL inchangé (capacité 1, pour tout créneau proposé avant la v178) ; sinon refuser seulement si chevauchants.length >= techs.length, où chevauchants = bons de la ligne 1 non archivés du jour avec heure + créneaux retenus (creneaux_actifs) des AUTRES demandes qui chevauchent avec le tampon (la fonction chevauche existante). Aucune lecture d'EMPLOYES, de dispo ou de fériés côté serveur : le poste a figé la capacité à la proposition.
10. A10-b dans confirmer(), lire techs dans dem.creneaux.find(c => Number(c.no) === choix).techs (la ligne creneaux_reserves n'a pas cette colonne) et le passer à plageLibre. Le message « plage tout juste prise » et le statut 'conflit' restent identiques quand il n'y a plus de place. Le bon créé reste sans technicien.
11. A10-c rdv-confirmer (lien courriel) : même règle si le code a été exporté ; sinon le canal courriel reste en capacité 1 et le noter au changelog.
12. SQL edge/confirmation-auto-v178.sql : alter table public.demandes_service add column if not exists confirmation_envoyee_le timestamptz ; un SELECT de contrôle puis un rattrapage OPTIONNEL des confirmations passées (qui pose aussi demandes_service.confirmation_envoyee_le, sans quoi l'ancienne carte reste « pas envoyée ») ; PAS d'index unique sur rappels_envoyes (il casserait le renvoi manuel). La fonction atomique ajouter_bt(bt jsonb) est une phase 2 facultative (voir Q1 et risques).
13. Test edge/test-sms-entrant-v178.html (outils-v178/run-edge-html.js) : étendre le Supabase en mémoire (update(...).eq(...).eq(...).select(), insert(...).select().single()), ajouter To au corps simulé, bouchonner fetch globalement pour tout le fichier.

**Critères d'acceptation (vérifiables)**
- Un « 1 » sur des créneaux : exactement 1 bon dans la ligne 1 ; 1 ligne rappels_envoyes (type confirmation, statut envoye, rappel_id null, bt_id = id du bon) ; confirmation_envoyee_le posé dans l'update final unique ; UNE seule ligne dans le fil avec par 'automatique' et meta.origine 'auto' ; la réponse TwiML contient « c'est confirme ».
- Deux webhooks « 1 » traités en parallèle (Promise.all) sur la même demande : 1 seul bon, 1 seule ligne rappels_envoyes ; le second sms_recus reçoit 'aucune_correspondance'.
- Exception simulée à l'upsert de la ligne 1 : la demande revient à 'creneaux_envoyes' (pas de rendez-vous perdu en silence).
- Plage prise : réponse « plage prise » inchangée, aucune ligne rappels_envoyes.
- Capacité : creneau.techs ['Jason','Gwendal'] avec 1 bon à 9h (même épinglé Jason) → 'confirmee' ; avec 2 bons → 'conflit' ; creneau sans techs avec 1 bon → 'conflit' (capacité 1 historique) ; un retenu d'une autre demande compte comme occupant.
- Texte par défaut contient l'adresse et aucun accent ; gabarit de la base conservé avec ses accents ; client sans prénom ne casse pas.
- Les blocs STOP, AIDE, menu, « 4 », demandes multiples, robustesse du test v172 passent inchangés ; ?diag répond encore avec « v172 ».

**Tests**
- edge/test-sms-entrant-v178.html (copie de v172 + cas ci-dessus) via outils-v178/run-edge-html.js ; l'ancien edge/test-sms-entrant-v172.html relancé contre la nouvelle source avec fetch bouchonné et To dans le corps (le bloc 4 et la ligne ?diag doivent passer).
- Relancer edge/test-quickbooks-v160.mjs (non touché, garde-fou).
- test-v178-srv.js : test Node du contrat creneaux.techs entre le poste et le serveur (lecture seule), qui vérifie qu'un créneau écrit par demEnvoyerCreneaux (CAL-A) est accepté par plageLibre.

### COM — Note d'appel → BT / note d'atelier (A3) et confirmation SMS côté application (A1)

| | |
|---|---|
| **Demandes** | A3, A1 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Plusieurs points d'insertion bien repérés dans l'IIFE Communications et le module des rappels ; la difficulté réelle est de ne pas écrire par-dessus un autre poste (relire avant d'écrire), de garder les gardes anti-double-clic et de ne pas créer de doublon de trace. |
| **Dépend de** | SRV (contrat de trace ; aucun blocage de code) |
| **Durée murale** | ≈ 75 min |

**Zones de code (propriété du lot)**
- index.html : ancres //@@v178-A3 liveVoir (avant fermerLive) et //@@v178-A3 notes (après liveSupprimerNote)
- index.html : IIFE Communications (machinesEnAtelier 27623, rendreFil, brancherFil, proposerNote 27955-27976, commNoteAppel 27985, rendreNote 28046, sauverNote 28138)
- index.html : rapVars (24180-24189), rapProposerConfirmation (24259-24301), rapRendreAvenir (24419-24436), rfRendreHistorique (25383-25396)
- index.html : IIFE Demandes, carte de la demande (26805-26837), LIB de demChargerHistorique (26923-26927), demConfirmerSms (27305-27330)
- index.html : liveRendre, liste conserver (20591-20593) : ajouter live-note-champ-haut

**Étapes**
1. A3-1 liveVoir(id) à l'ancre : ouvre l'écran du bon SANS punch automatique (liveId = id puis liveAfficherPage ; jamais ouvrirLive ni liveConnecter). Ce n'est PAS une lecture seule : « ▶ Ajouter mon temps » reste actif ; le dire au changelog. Une seule définition dans tout le fichier (test : le motif function liveVoir( apparaît exactement 1 fois).
2. A3-2 btAjouterNoteAtelier(id, texte, opts) à l'ancre : relireMachines() en meilleur effort, machines.find par id AU MOMENT de l'écriture (appliquerLigne1 remplace les objets), texte normalisé (retours à la ligne remplacés par un espace, 300 caractères au plus), push dans liveNotes(m) d'une entrée {texte, tech, quand ISO, src 'appel'}, liveMajNotesTech(m), sauvegarder() ; après l'appel lire ligne1EnAttente : si vrai, toast « note gardée sur cet appareil, réseau injoignable » au lieu du succès. Préfixe de note « 📞 Appel : » sans le nom du client (le BT l'identifie déjà ; la note va sur la TV du lift, le BT imprimé et l'assistant IA).
3. A3-3 helpers du bloc Communications : surPlace(m) (statut ≠ archive et ≠ commande, et statut ≠ avenir ou machineArrivee), btsClient(tel, client) triés sur place d'abord, machinesEnAtelier = btsClient filtré par surPlace ; ligneBT(m) avec libelle(m.statut) (pas STATUT_LIB, qui reste inchangé), icône 🔧 sur place, 📦 commande, 📅 sinon ; boutons « 📋 Ouvrir le BT » (si droit('live') ; liveVoir) et « 📝 Note d'atelier ». Maximum 5 lignes puis « … et N autre(s) ». CSS dans <style id=v178-COM>.
4. A3-4 note d'appel : bloc « Bons de travail du client » avant les raccourcis (remplace le texte vert 28055) ; « Ouvrir le BT » enregistre d'abord la note si elle a du contenu, ferme les voiles Communications (z-index 9500 contre live 202), puis liveVoir ; « Note d'atelier » exige un texte non vide, garde synchrone (disabled puis try/finally), vérifie noteCourante === n après chaque await avant tout rendreNote, pose n.btId et meta.noteAtelier [{id, texte}] APRÈS succès, refuse un doublon exact de texte mais n'interdit pas une 2e remarque différente ; sauverNote repart de l'ancien meta (exMeta) et pose ref_bt quand btId existe.
5. A3-5 fil : par BT, mêmes deux boutons ; « Note d'atelier » via prompt() (déjà utilisé dans le fil, fonctionne sur iPad), sans nouvelle ligne communications et sans variable d'état de saisie (le temps réel reconstruit tout le fil). Le chip BT d'une ligne devient bouton « 📋 BT-xxx » seulement si ref_bt ou meta.machine_id pointe une machine existante non archivée, sinon l'ancien chip texte.
6. A3-6 popup d'appel Linkus : bouton « 📋 Ouvrir le BT-xxx » seulement s'il y a exactement UN BT sur place et droit('live') ; avant liveVoir, insérer la ligne communications appel_repondu avec ref_bt (le serveur ne journalise que les appels MANQUÉS : sans cette ligne l'appel répondu ne laisse aucune trace) ; fermerProposition puis liveVoir. Ne pas toucher à la ligne ancre //@@v178-A11 proposerNote (appartient à SON).
7. A1-c client : rapVars et l'aide des variables (24359) et l'exemple d'aperçu (24392) reçoivent adresse (ENTREPRISE.lignes[0], 7458, pas une chaîne en dur). rapNouveaux est INCHANGÉ (ne pas filtrer l'origine demande-web : le popup manuel doit rester possible quand la confirmation a échoué). rapProposerConfirmation : avant le popup, lire rappels_envoyes (bt_id, type confirmation, statut 'envoye' SEULEMENT, jamais 'en_cours') ; si une ligne existe, toast « une confirmation est déjà partie » et retour ; en cas d'erreur de lecture, popup comme avant.
8. A1-d client : 24436 le bouton « 📲 Confirmer » reste affiché tant que la confirmation n'est pas à l'état 'envoye' (libellé « 📲 Renvoyer » si une ligne existe) ; aux endroits 24426 et 25393 remplacer find(type confirmation) par la ligne 'envoye' en priorité, sinon la première, pour qu'un renvoi réussi efface un ancien échec ; carte de la demande : ligne verte « ✅ Confirmation envoyée le … » seulement quand confirmation_envoyee_le existe (aucun avertissement rouge sur l'historique : toutes les demandes d'avant la v178 n'ont pas cette colonne et le client avait pourtant reçu le message) ; LIB reçoit confirmation_renvoyee ; demConfirmerSms prévient dans son confirm() si une confirmation est déjà partie et insère une ligne rappels_envoyes après un envoi manuel réussi (try/catch).
9. Tests : test-v178-com.js sur le faux Supabase de test-v173.js (vraie table communications en mémoire) ; l'ancien gabarit de test-v172.js ne convient pas.

**Critères d'acceptation (vérifiables)**
- Clic « Ouvrir le BT » : #live-page ouvert, liveId correct, m.chrono inchangé (aucune session), statut et machineArrivee inchangés, voiles Communications fermés ; sans rien de saisi, aucune ligne communications vide n'est créée.
- Note d'atelier avec texte : m.notesLive se termine par {texte '📞 Appel : …', src 'appel', tech, quand} ; m.notesTech contient la note ; deux clics synchrones n'ajoutent qu'une note ; note multi-ligne aplatie et plafonnée.
- Test de synchro : tableau machines remplacé par de nouveaux objets entre l'ouverture du dialogue et le clic : la note se retrouve sur l'objet frais ; si le dialogue est fermé pendant l'await, il ne se rouvre pas.
- Popup Linkus : bouton BT présent avec 1 BT sur place et droit live, absent avec 2 BT, absent sans droit live ; clic = ligne appel_repondu avec ref_bt + liveVoir.
- Un ref_bt pointant une machine supprimée ou archivée garde le chip texte ; une ligne de rappel v166 avec meta.machine_id devient cliquable.
- rapProposerConfirmation avec une ligne 'envoye' : pas de popup ; avec une ligne 'erreur' : popup ; 🔔 RDV à venir affiche « Renvoyer » après un échec et le badge redevient vert après un renvoi réussi ; la fiche du bon (rfRendreHistorique) idem.
- Carte de la demande : ligne verte seulement avec confirmation_envoyee_le ; aucun avertissement rouge sur les anciennes demandes.
- Aucun test existant de la zone ne change de résultat.

**Tests**
- test-v178-com.js : groupes A3 (surPlace/btsClient, bloc note d'appel, clics, synchro, popup, fil, chip) et A1-client (garde du popup, bouton Renvoyer, ordre de find, carte de la demande, demConfirmerSms) ; XSS sur nom de client ; fumée Chromium à 390 px et 820 px (popups empilés sans chevauchement).
- Relancer test-v166.js, test-v172.js, test-v172b.js, test-v173.js, test-v175.js, test-v165.js, test-v168b.js, test-v169.js.

### PCS — Recherche de pièce BRP depuis Pièces à commander et le BT live (A2)

| | |
|---|---|
| **Demandes** | A2 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Aiguillage de cible (BT contre soumission), communication entre fenêtres (postMessage, pop-up) et fusion de lignes de pièces ; plan très détaillé, donc sonnet à effort élevé suffit. Le bloc BRP (25590-25830) est exclusif à ce lot. |
| **Dépend de** | rien |
| **Durée murale** | ≈ 65 min |

**Zones de code (propriété du lot)**
- index.html : script BRP 25589-26014 (brpOuvrirCatalogue, brpRecevoirPiece, brpEnvoyerPanier, écouteur message) : exclusif
- index.html : modale #voile-commandes (2688-2702), afficherCommandes (9086-9140), enregistrerCommandePiece (9231-9262, map de pièces 9240-9249)
- index.html : liveRendre section « Commander une pièce au bureau » (20715-20724), fermerLive (20291-20303)
- index.html : CSS dans <style id=v178-PCS>
- mtr-ajouter-brp.user.js (@version ligne 4, VERSION ligne 37, statut 74, handler MTR_PANIER 600-605, toast du clic 630-631)

**Étapes**
1. Scinder brpOuvrirCatalogue : extraire brpOuvrirUrl(k, site) qui RETOURNE {msg, ok} sans émettre de toast ; l'appelant émet UN seul toast (toastAviser n'a ni file ni pile : deux toasts se recouvrent) ; la soumission garde ses textes actuels ; window.open reste synchrone dans le gestionnaire de clic (aucun await avant).
2. Cible BT : let brpCibleBT (déclaration à côté de brpData, sessionStorage mtr_brp_cible en try/catch) ; brpCibleValide() null si absente, expirée (2 h) ou machine disparue ; brpOuvrirPourMachine(machineId, origine) ne reçoit QUE l'id (echap n'échappe pas l'apostrophe : un technicien D'Amours casserait un onclick) ; le technicien vient de (utilisateurCourant() ? nom : '') || m.technicien (utilisateurCourant peut être null) ; refuser seulement si une marque non BRP est connue (marque vide : tester le modèle ou la soumission liée) ; marque BRP sans chemin appris : ouvrir l'accueil du bon site avec un toast ; si window.open renvoie null, remettre la cible à null et avertir.
3. Sonde du script : brpMsgVu remis à faux avant window.open ; après 15 s sans message MTR_ : toast « aucun signal du script depuis 15 s : note le n° de pièce et ajoute-le à la main » (iPad : Tampermonkey n'y existe peut-être pas, à tester sur l'iPad du patron, hypothèse non vérifiée).
4. Aiguillage brpRecevoirPiece : si cible valide, ajouter au BT visé ; sinon chemin soumission v175 inchangé ; la mémoire brpData.memo suit la machine du bon.
5. cmdAjouterPieceAuBT(machineId, tech, p) : quantités en CHAÎNES (qte: String(...), fusion String((parseFloat(String(q).replace(',', '.')) || 0) + n)) ; chercher la commande ouverte la plus récente du bon qui a une ligne non commandée et fusionner par invNorm(num) dans toutes les commandes du bon avant de créer une ligne ; sinon enregistrerCommandePiece(machineId, numeroBT, tech, [ligne], true) avec un 5e paramètre sansListe, et faire passer source:'brp' et prixBRP par le map de 9240-9249 (UN seul sauverCommandes, pas de second). Liste du BT (m.pieces) : même invNorm(num) ET non cochée ET non utilisée → qte augmentée (sans marqueur ajoutBRP : lirePiecesFormulaire 11134-11145 efface les champs inconnus) ; sinon nouvelle ligne coche:false et m.pieceComplete = false ; ne PAS renseigner prixVente ni coutAchat.
6. Rafraîchissements : sauvegarder() appelle déjà rafraichirVues (afficher et liveRendre) ; ne rappeler à la main que afficherCommandes() si #voile-commandes est ouvert.
7. brpEnvoyerPanier : avec cible valide, panier construit depuis m.pieces et les commandes du bon, cible: '<numeroBT> · pièces à commander' ; pour la soumission ajouter cible: 'soumission …'. Script rétrocompatible.
8. Boutons : en-tête de #voile-commandes « 🔩 Recherche de pièce BRP » qui ouvre cmdBrpChoisir() (modale #voile-cmd-brp sur le modèle de cmdCommanderRendre 8961, liste de 40 bons maximum, filtre explicite avenir, sansrdv, attente, reparation, assurance, commande ; afacturer et prete exclus par défaut ; bons en live d'abord ; recherche par BT, client, machine ; le clic ferme la modale puis appelle window.open dans le même tick) ; bouton « 🔩 Chercher une pièce BRP » sur chaque carte de l'onglet À commander ; bouton 🔩 dans le BT live avec une aide « surtout depuis l'ordinateur » ; pas de bouton dans le bon imprimé (fenêtre document.write séparée, pop-up très probablement bloqué).
9. fermerLive : une ligne de nettoyage de la cible d'origine 'live', protégée par typeof brpCibleBT !== 'undefined' (la variable est déclarée plus loin dans le fichier).
10. Script Tampermonkey 2.4 : @version et VERSION à 2.4 ; le message MTR_AJOUT_PIECE et MTR_PANIER_DEMANDE portent ver ; statut et toast du clic affichent la cible (« → BT-xxx · pièces à commander ») au lieu de « soumission » en dur ; l'app avertit par un toast si une pièce arrive avec une cible BT sans ver (script pas à jour : sa pastille dirait « soumission » à tort, la pièce est bien allée au BT).
11. Rappel pour INT et le patron : les pièces ajoutées à m.pieces apparaissent aussi sur la TV du lift (tv.html:439-441) ; Facturer les verra à 0 $ (ligne sans prix).

**Critères d'acceptation (vérifiables)**
- Machine BRP avec chemin appris : window.open(<site> + '#mtr=' + chemin), cible posée ; marque Yamaha : refus, window.open non appelé.
- Message MTR_AJOUT_PIECE avec cible : une commande pour le BT (source brp, qte '1' en chaîne) ET une ligne dans m.pieces non cochée ; même pièce deux fois : qte '2' dans les deux, une seule ligne ; pièce différente : seconde ligne dans la MÊME carte ; pièce déjà reçue (cochée) : nouvelle ligne et pieceComplete faux.
- Sans cible BT : la soumission ouverte reçoit la pièce exactement comme en v175 ; cible périmée (plus de 2 h) ou machine supprimée : retombe sur la soumission ou un toast, aucune exception.
- Technicien nommé D'Amours : le bouton de la carte fonctionne ; utilisateurCourant() null : le catalogue s'ouvre quand même.
- Un seul toast à l'ouverture ; la sonde n'avertit pas à tort après une première utilisation réussie.
- fermerLive remet la cible à null seulement si elle venait du live ; aucune écriture de prixVente ni de coutAchat sur la ligne BRP ; pièce comptée une seule fois dans invBesoins.
- Le script 2.4 est rétrocompatible avec l'app v175 et l'app v178 fonctionne avec le script 2.3.

**Tests**
- test-v178-pieces.js (Chromium, window.open remplacé par un faux qui enregistre l'URL et renvoie {postMessage, closed:false}) : cas T1-T10 du plan A2 corrigés ci-dessus, plus fumée de la modale de choix de bon.
- Relancer test-v172.js (commandes, délais), test-v174.js (bon imprimé, window.opener.enregistrerCommandePiece : signature rétrocompatible), test-v169.js, test-v167.js, test-v171.js n'est pas utilisable, test-v164.js, test-v170.js, test-v168.js, test-v168b.js, test-v175.js.
- Contrôle manuel du patron : pop-up non bloqué, PC avec Tampermonkey 2.4, iPad (toast d'indice).

### FAC — Retrait complet du cadeau / payé comptant (A5), puis notes d'atelier dans Facturer (A4)

| | |
|---|---|
| **Demandes** | A5, A4 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Même fenêtre #fact-pop et même zone CSS : un seul agent, A5 d'abord. Suppression mécanique mais migration idempotente branchée à plusieurs points d'entrée des données et réécriture de test-v168.js ; difficulté moyenne, pas de logique à haut risque. Fable relit le diff de sauvegarder. |
| **Dépend de** | S0b (aucun blocage de code) |
| **Durée murale** | ≈ 75 min |

**Zones de code (propriété du lot)**
- index.html : carteHTML badge cadeau et btnCadeau (10818-10826, 10872) : retraits seulement
- index.html : #fact-pop (4741-4780, titre 4743, #cadeau-pop 4782-4794), CSS 3000-3017 (garder .fact-inv, .fact-h3, .carte-haut .ref), factOuvrir/factFermer (15426-15460), fonctions cadeau (15840-15879)
- index.html : lecteurs de m.cadeau (invReserve 17473, invBonsACorriger 19056/19060/19078, textes 4598 et 19178, invSynchroBT 15794, deplacer 10941, Rentabilité estCadeauRent 9566-9569 et ouvrirEditRent 9881-9883)
- index.html : points d'entrée des données : sauvegarder 5430 (TÊTE de fonction), fusionnerAjoutsServeur 5383, relireMachines 5406, appliquerLigne1 5400, demarrerDonnees 23940, invSauverMouv ~17072, invFusionnerMouv 12481
- edge/purge-cadeau-v178.sql (nouveau) ; test-v168.js (réécrit) ; edge/test-quickbooks-v160.mjs (fixture, optionnel)

**Étapes**
1. ⚠️ Voir section 12.3, points 3 et 5 : dateCadeau / valeurCadeau / aggCadeau à réécrire ; renommage OBLIGATOIRE de la fixture « Payé comptant — voir Léa » dans edge/test-quickbooks-v160.mjs ; ancre //@@v178-FAC demarrerDonnees ; Q23 pour les 🎁 de la Rentabilité.
2. A5-1 interface : retirer btnCadeau, la branche cadeau de badgeFacture, le bouton 🎁 du titre Facturer (le h3 devient 🧾 Facturer seul), le bloc #cadeau-pop, le CSS .btn-cadeau .badge-cadeau .cadeau-boite .cadeau-val .cadeau-actions. Garder .cadeau-discret et .rl-cadeau (1554-1557 : utilisés par le 🔄 comeback et la Rentabilité) et la bascule 🎁 « offert gratuit » de la Rentabilité (variante A : concept antérieur à la v168, sans paiement ; rentabilite.cadeau reste lu, m.cadeau ne l'est plus).
3. A5-2 JS : supprimer cadeauBtId, factCadeau, cadeauFermer, cadeauConfirmer ; retirer || m.cadeau (17473), !m.cadeau (19056, 19060), le libellé « 🎁 cadeau » (19078), le suffixe de ref dans invSynchroBT, le delete m.cadeau de deplacer, les mentions des textes d'aide ; estCadeauRent = rentabilite.cadeau seulement.
4. A5-3 grep de contrôle APRÈS l'étape 2 et AVANT l'étape 4 : index.html ne contient plus /comptant/i, /m\.cadeau/, factCadeau, cadeauConfirmer, cadeau-pop, badge-cadeau, btn-cadeau.
5. A5-4 migration idempotente, deux fonctions encadrées de marqueurs de commentaire pour que le test les exclue : purgerCadeaux(liste) (supprime la clé cadeau et invSortieSource === 'cadeau' ; ne touche JAMAIS rentabilite, statut, livreLe, chrono, pieces, photos, invSorties) et purgerCadeauxMouv() (retire ' · 🎁 cadeau' des ref d'invMouv, garde les mouvements). Appels : première ligne de sauvegarder() AVANT localStorage.setItem et ecrireAuto, puis après fusionnerAjoutsServeur ; purge de la donnée REÇUE dans fusionnerAjoutsServeur, relireMachines (data.donnees AVANT la comparaison jsonStable, sinon boucle d'appliquerLigne1 à chaque focus tant que le serveur garde cadeau) et appliquerLigne1 ; demarrerDonnees (machines et invMouv, puis sauvegarder ou invSauverMouv si quelque chose a changé et que l'écriture est permise) ; invSauverMouv avant écriture ; invFusionnerMouv après le concat (n'ajoute que des ids absents).
6. A5-5 edge/purge-cadeau-v178.sql, en tête : ordre obligatoire (1 tous les postes en v178, 2 un poste admin « Connecté », 3 ce SQL, 4 le relancer dans une semaine) ; SELECT de contrôle lecture seule listant les bons avec cadeau ET rentabilite.cadeau = true (le patron doit voir cette liste AVANT la purge : après, elle est introuvable) ; update de la ligne 1 (retirer cadeau et invSortieSource 'cadeau', même longueur donc le garde-fou ne bloque pas) et de la ligne 12 (suffixe de ref) ; delete des instantanés tableau_sauvegardes des lignes 1 et 12 qui contiennent « cadeau » (l'UPDATE crée lui-même un instantané de l'ancienne valeur ; seul le SQL peut les supprimer) ; vérifier pg_typeof(donnees) et caster en jsonb au besoin ; dire explicitement que ce SQL n'a pas été exécuté par l'agent.
7. A5-6 tests : test-v168.js réécrit en gardant TOUTES les fixtures bt7, bt8, bt9 (les sections 2 à 7 en dépendent : invReserve C1 = 3, A1 = 4…), seules les actions changent : deplacer(id,'prete') puis archiver, et pour bt8 factEnregistrer(true) puis factFermer() AVANT deplacer (l'ancien cadeauConfirmer enregistrait les lignes éditées et fermait la fenêtre) ; sections 1, 8, 9, 10, 11, 12 réécrites. test-v178-fac.js sur le stub de test-v168b.js (le stub de test-v168.js renvoie toujours data: [] et ne permet pas de tester demarrerDonnees).
8. A4-1 HTML après #fact-avis (4746) : <details id=fact-notes open> avec titre « 📝 Notes d'atelier (N) », mention « 🔒 Interne », <ul id=fact-notes-liste> et un champ de saisie STATIQUE (jamais reconstruit par factRendre, qui est rappelée à chaque case cochée) avec bouton ＋ Ajouter. CSS dans <style id=v178-FAC> : summary en display:block (en display:flex la flèche disparaît, vérifié dans Chromium) avec min-height 44 px, .champ { font-size:16px; min-width:0 }, liste en max-height 240 px sauf sur téléphone.
9. A4-2 factNotesAtelier(m) pure, sans muter le bon : m.notesLive filtré, repli sur m.notesTech (lignes nettoyées de leur puce) seulement si notesLive est absent ; pas de fusion des lignes « écrites sur le bon imprimé » (doublons et fantômes : un Reste à faire multi-ligne ou une note commençant par un tiret ne se comparent pas) ; plus récent en premier, comme le live et la TV, sans tri complexe. factNoteAjouter : machines.find par id, liveNotes(m).push({texte, tech, quand}), liveMajNotesTech(m), sauvegarder() ; liveNotes n'est JAMAIS appelée en lecture (elle mute le bon).
10. A4-3 factOuvrir : vider le champ de saisie et rendre la liste dans un try/catch propre qui ne peut jamais empêcher l'ouverture de la fenêtre ; repli automatique du bloc si plus de 3 notes quand surTelephone() est vrai (helper existant 6258-6262, avec garde matchMedia) ; ligne //@@v178-A4 rafraichir : rafraîchir la liste si factBtId. factFermer et les clics Enregistrer et QuickBooks ajoutent automatiquement un brouillon de note non vide (jamais depuis factEnregistrer(true) appelé en silence par factLignesPour).
11. A4-4 intouchables : factMemo, la charge QuickBooks (15924-15931) et factCSV : les notes ne partent JAMAIS dans la facture. Au changelog : une note ajoutée ici réécrit m.notesTech à partir de notesLive (liveMajNotesTech), ce qui efface les remarques tapées à la main sur un bon imprimé resté ouvert ; défaut préexistant.

**Critères d'acceptation (vérifiables)**
- Aucune carte (afacturer et commande, admin ou non) ne porte 🎁 ni .btn-cadeau ; #fact-pop .fact-h3 n'a pas de bouton ; #cadeau-pop est absent ; factCadeau et cadeauConfirmer sont indéfinis.
- Hors des deux fonctions de purge, index.html ne contient plus /comptant/i ni /m\.cadeau/ ; la seule présence de 🎁 hors purge est dans la Rentabilité (bascule offert gratuit et récap).
- Migration : bons {prete avec cadeau, archive avec cadeau et livreLe, invSortieSource 'cadeau', invSortieSource 'rattrapage', rentabilite.cadeau true sans m.cadeau} + mouvements ref ' · 🎁 cadeau' : après demarrerDonnees, plus de cadeau ni de invSortieSource 'cadeau' ; 'rattrapage' et rentabilite.cadeau conservés ; statuts, livreLe, chrono, pieces, invSorties, numeroBT intacts ; refs sans suffixe ; UN upsert de la ligne 1 et UN de la ligne 12 ; un 2e chargement n'écrit rien (idempotent).
- Poste en retard : machines locales avec cadeau puis sauvegarder() → ni l'upsert ni le localStorage ne contiennent cadeau ; ligne serveur sale reçue en temps réel ou par relireMachines : machines propre, aucun upsert déclenché, aucune boucle de rendu à chaque relecture.
- Chemin de remplacement : bon afacturer (et commande) avec pièces utilisées → deplacer('prete') puis archiver : pièces sorties une seule fois, mouvement vente avec ref sans 🎁, aucun appel QuickBooks, aucun m.cadeau.
- Facturer : #fact-notes-liste liste les notesLive (récent en premier), le titre compte les notes, le champ garde son texte après factRendre(), la liste se met à jour via rafraichirVues ; les notes n'apparaissent ni dans la charge QuickBooks ni dans le CSV ni dans m.facturation ; un bon sans notesLive mais avec notesTech reste sans notesLive après affichage.
- Brouillon tapé puis Fermer : la note est ajoutée ; technicien non admin : factOuvrir refuse comme avant.
- Le SQL de purge est livré avec son ordre, son SELECT de contrôle et le avertissement d'irréversibilité.

**Tests**
- test-v168.js réécrit (mêmes fixtures) ; test-v178-fac.js : migration (chargement, temps réel, poste en retard, import, relireMachines sans boucle), chemin de remplacement depuis afacturer et commande, notes d'atelier (ordre, mutation, échappement <img onerror>, non-fuite QuickBooks sur le gabarit appelsQbo de test-v159.js), sabotage : retirer purgerCadeaux de sauvegarder() puis de relireMachines doit faire échouer le test.
- Relancer test-v159.js, test-v159b.js, test-v160.js, test-v168b.js, test-v170.js (sorties de stock, Stock à corriger, 'rattrapage'), test-v167.js, test-v169.js, test-v171.js n'est pas utilisable, test-v172.js à test-v175.js, edge/test-quickbooks-v160.mjs si la fixture « Payé comptant — voir Léa » (lignes 297 et 300) est renommée (optionnel : c'est une note privée factice de test, pas une donnée).

### TAB — Tableau : jours depuis l'arrivée, tri, bons en direct en tête (A7) et temps restant à la fermeture de session (A8)

| | |
|---|---|
| **Demandes** | A7, A8 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Deux demandes sur le même tableau et le même BT live, avec des cas limites de dates (jours civils, repli creeLe, formulaire d'édition qui contourne deplacer) et un contrat de champ partagé ; touche carteHTML et afficher, chemins chauds. Fable fusionne carteHTML après FAC. |
| **Dépend de** | S0b |
| **Durée murale** | ≈ 85 min |

**Zones de code (propriété du lot)**
- index.html : afficher (6047-6109, insertion du tri juste après le filtre de colonne 6065) ; carteHTML badges (10838-10841, 10878-10879, 10885) ; deplacer (10930) ; valider/sauvegarde du formulaire (11261-11265, 11346-11362) ; demarrerDonnees (minuterie de changement de jour)
- index.html : modale #live-fin (3297-3316), CSS .live-scan-chip (857-858) et CSS neuf dans <style id=v178-TAB> ; liveFinOuvrir/liveFinNon/liveFinOui/liveFinValider (21815-21878)
- index.html : ordreResteAuto (28659) ; page live 20678 ; écran technicien 22617
- tv.html:433 (rendreBT, Reste à faire) : la TV se rechargera seule car tv.html change
- NE PAS toucher reprogrammerOuvrir/reproChoisir (16088-16205 : propriété de CAL6), liveConnecterFinal (20270) ni basculer (10983 : inutile, arriveeDe renvoie null pour un avenir non arrivé)

**Étapes**
1. ⚠️ Voir section 12.2 (tv.html en millisecondes, saisie « Autre… », odp-duree) et 12.3 (A8-2 avant A7-5 ; repli gris « (estimé) » sur les cartes en direct si Q24 = oui ; ancre //@@v178-TAB demarrerDonnees).
2. A7-1 tri : après let liste = filtrees.filter(...) ajouter, pour sansrdv, attente et reparation seulement, arriveeTrier(liste, live d'abord seulement pour reparation) avec clé = arriveeDe(m).date (arriveeLe, sinon punch, sinon creeLe) ; comparer avec < et >, jamais par soustraction (Infinity − Infinity) ; sans date en bas ; tri stable. La colonne « À venir » garde son tri par RDV et ses paquets (v143) ; afacturer, prete, assurance, commande inchangées. Le changement d'ordre (le plus ancien en haut au lieu du plus récent créé) est à annoncer au changelog.
3. A7-2 badge « 🚜 Arrivée depuis N jours » (aujourd'hui si 0, singulier à 1) dans le tableau .badges existant ; si source = 'creeLe' (date approximative) : « 🚜 ≈ N jours » en gris, JAMAIS en rouge ; rouge (classe vieux) seulement à 7 jours et plus avec une date sûre. Remplace « 🚜 Machine sur place » quand une date existe. Reconnaître qu'une carte « À venir » arrivée gagne une ligne .badges de plus. CSS : .badge.badge-arrivee et .badge.badge-arrivee.vieux (spécificité de deux classes : la règle .badge générique de 1063 vient APRÈS .badge-live/.badge-reste et écraserait une règle à une classe).
4. A7-3 poser arriveeLe : (a) deplacer, après m.statut = statut (10930), quand statut vaut sansrdv ou attente, que la machine n'est pas arrivée et que arriveeLe est vide ; (b) dans la sauvegarde du formulaire d'édition (avant Object.assign(m, donnees)), quand un bon passe de avenir à sansrdv, attente ou reparation sans machineArrivee ni arriveeLe. Pas de modification de liveConnecterFinal ni de basculer (le repli sur le premier punch suffit).
5. A7-4 minuterie de 60 s dans demarrerDonnees qui rappelle afficher() seulement quand isoLocal(new Date()) change (jamais un re-rendu chaque minute : il casserait le glisser-déposer et le défilement sur iPad).
6. A7-5 temps restant sur la carte : un seul endroit, le badge « ⏳ Reste ~1 h 30 (noté 16:40) : texte » quand resteMinutesDe(m) existe ; le badge direct reste « 🔴 Tech en direct » (pas de doublon) ; AUCUNE estimation de repli « (estimé) » (ordreResteAuto dépend de l'heure courante et serait figé entre deux rendus) ; l'heure de saisie est écrite dans le texte, pas seulement dans un title (invisible au toucher sur iPad).
7. A8-1 HTML : dans #live-fin-reste, AVANT le textarea (le clavier iPad masquerait des pastilles placées dessous), le libellé « Temps approximatif restant, pour tout le bon * », sept boutons 15 min, 30 min, 1 h, 2 h, 4 h, Journée (480), Autre… (minutes, step 5, min 5), cibles de 44 px ; aucune pastille présélectionnée. Pas de bouton « Je ne sais pas ».
8. A8-2 JS : liveFinMin, liveFinMinChoisir, liveFinMinAutre, liveFinMinSaisie, liveFinMinLire (valide si ≥ 5), liveFinMinReset(prefill) qui pose aussi liveFinMin = prefill. liveFinValider : refuser sans minutes (alert « Indique le temps approximatif… »), puis liveFermerSession(s), puis m.resteAFaire = {texte, tech, quand: ISO, minutes} (champ nommé minutes, pas de champ travaille), m.resteHisto.push({minutes, tech, quand}) plafonné à 30, note « ⏳ Reste à faire : … (≈ 1 h restant) », toast. liveFinOui efface resteAFaire (donc l'estimation) et garde resteHisto. Le garde existant liveMaSession(m) → liveFinAnnuler reste. Pas d'étape « Changer de technicien » (estimation invisible partout sauf dans l'Ordre).
9. A8-3 ordreResteAuto (28659) : si resteMinutesDe(m) > 0, retourner max(15, arrondi au pas) de cette valeur, sinon la formule actuelle inchangée ; appel protégé par try/catch.
10. A8-4 affichages : page live 20678 (suffixe), écran technicien 22617 (optionnel), tv.html:433 avec une copie locale du calcul (la TV n'a pas accès aux fonctions d'index.html ; formule par resteAFaire.quand comme resteMinutesDe).
11. Contrat à l'intégration : le nom du champ est resteAFaire.minutes ; A12 et A6 le lisent via resteMinutesDe, jamais directement.

**Critères d'acceptation (vérifiables)**
- Colonne reparation : bons A (arrivée −10 j), B (−2 j, session ouverte), C (−20 j), D (sans date), E (−30 j, session ouverte) → ordre E, B, C, A, D ; session de E fermée → rentre dans l'ordre d'ancienneté ; compteur de colonne et filtre de recherche justes.
- sansrdv et attente : plus ancien en haut ; avenir, afacturer, prete, assurance, commande : ordre et badges inchangés.
- Badge : 7 jours → classe vieux avec date sûre ; source creeLe → « ≈ » gris, jamais rouge ; avenir sans arrivée : aucun badge.
- Édition d'un bon avenir vers sansrdv via le formulaire : arriveeLe posé ; deplacer avenir vers sansrdv : posé ; un ancien bon déjà arrivé garde son compteur après un punch (aucune remise à zéro).
- Modale : sans pastille, alert et la session reste ouverte ; avec minutes ≥ 5 : session fermée, m.resteAFaire.minutes correct, resteHisto à 1 entrée, note ajoutée ; Annuler et Retour n'écrivent rien ; « Oui, terminés » efface resteAFaire.
- Carte : « Reste ~1 h 30 » une seule fois, jamais deux ; sans minutes la carte est identique à avant ; texte avec HTML reste échappé.
- Premier afficher() avant le chargement du script d'ordre : aucune exception, carte correcte dès le premier rendu.
- Ordre de travail : test-v164.js inchangé et vert ; ordreResteAuto vaut 60 avec estimation 60 et la formule v164 sans estimation.

**Tests**
- test-v178-tab.js : tri et badges (T1-T6 ci-dessus), pose d'arriveeLe (deplacer, formulaire, punch d'ancien bon), minuterie (Date simulée, un seul afficher), modale A8 (T1-T12 du plan A8 corrigés : pastilles, refus, stockage, annulation, oui terminé, ordreResteAuto, reprogrammation non touchée), carte avec estimation, TV : test sur tv.html comme test-v175.js.
- Relancer test-v164.js, test-v166.js, test-v168.js, test-v168b.js, test-v170.js, test-v159.js (textContent des cartes), test-v172.js, test-v174.js, test-v175.js, test-v169.js.

### CALA — A10 côté poste : créneaux proposés selon le nombre de techniciens, assignation sans doublon, instantané de capacité

| | |
|---|---|
| **Demandes** | A10 |
| **Vague** | 1 |
| **Agent** | **opus** · effort **high** — Câblage du moteur de capacité dans quatre chemins de réservation (Appel rendez-vous, picker des demandes, confirmation, machines multiples) avec un contrat serveur ; une régression ouvre des surréservations. Le moteur lui-même est déjà écrit et testé en vague 0. |
| **Dépend de** | S0a ; SRV (contrat creneaux.techs) |
| **Durée murale** | ≈ 60 min |

**Zones de code (propriété du lot)**
- index.html : genererSuggestionsRdv (7146-7201), confirmerRdv (7216-7336, sœurs 7285-7298), choisirTechnicien (7338-7351)
- index.html : IIFE Demandes demTechs/demOccupe/demHeures/demJours (26475-26542) ; demEnvoyerCreneaux (27023-27047, ligne 27045 seulement)
- NE PAS toucher demRendrePicker ni le gestionnaire de clic .dem-h (propriété de CAL9) ; NE PAS toucher reproChercher (CAL6) ni calRendre* (CALB)

**Étapes**
1. genererSuggestionsRdv : lire le type de machine UNE fois avant la boucle ; remplacer le test de chevauchement (7169-7170) par rdvPlaces(iso, t, dureeH, {typeMachine, ctx}).places >= 1 + rdvMachinesExtra.length (une place par machine du même rendez-vous) ; pas de dinerDur (garder le comportement actuel : « Journée complète » 480 min et « 4 heures » doivent rester proposables) ; garder pas de 15 min, un créneau par jour et 6 propositions ; afficher « N places · Jason, Samantha » dans .cr-sous quand places > 1 ; message vide « Aucun technicien disponible… » quand un jour ouvert n'a aucun technicien.
2. choisirTechnicien(iso, typeMachine, heureDec, dureeMin) : candidats = rdvPlaces(...).libres, tri par charge conservé, repli sur tous les disponibles conservé, tolérant aux arguments absents (test-v172b appelle confirmerRdv(jourIso(3), 9)).
3. confirmerRdv : les bons « sœurs » héritent de technicien et d'heure par {...nouvelle} (7289) : mettre technicien '' sur chaque sœur puis assigner SÉQUENTIELLEMENT en poussant chaque bon dans machines avant d'appeler choisirTechnicien pour le suivant (il voit les précédents épinglés) ; s'il n'y a pas assez de techniciens, laisser vide plutôt que dupliquer. Au début de confirmerRdv : si rdvPlaces(...).places < 1, confirm() « ⚠️ À HH:MM il n'y a plus de technicien libre. Réserver quand même ? » (jamais un blocage dur).
4. demTechs : techsCapacite (roleDe) au lieu de ROLES_CAPACITE sur le champ brut e.role (corrige le risque des vieux dossiers sans role) ; demHeures : places(t) via rdvPlaces avec {typeMachine, extra: retenus filtrés par iso et différents de saufDemande, dinerDur: true} ; conserver demOccupe (sert à générer les heures candidates : fin des occupés + tampon, reprise après dîner) ; chaque heure retournée porte techs: capNoms (NOMS de tous les techniciens capables, pas les libres) ; demJours.techs = noms de techsCapacite.
5. demEnvoyerCreneaux (27045) : creneaux: choix.map(...) ajoute techs: obtenu en relisant demHeures(iso, duree, type, id).find(heure).techs AU MOMENT de l'envoi (robuste même si le choix n'en porte pas) ; aucune colonne SQL (demandes_service.creneaux est du JSON) ; ne pas toucher creneaux_reserves.
6. Interrupteur : si CAPACITE_MULTI_TECHS est faux, tous ces chemins redonnent le comportement v175.

**Critères d'acceptation (vérifiables)**
- 2 techniciens, 1 bon à 9:00 : Appel rendez-vous propose 9h-10h le jour même (avant : 10h15) ; 1 seul technicien : 1re proposition 10h15 (non-régression) ; 2 bons à 9:00 : 9h refusé.
- Rendez-vous de 2 machines avec 2 techniciens : 2 places exigées et 2 techniciens DISTINCTS assignés ; 2 machines avec 1 technicien : proposition refusée ou technicien vide sur la 2e, jamais le même nom deux fois.
- La liste « Durée » propose toujours 480 min (journée complète) : le créneau 9h est proposé un lundi vide.
- confirmerRdv sur une place devenue prise : confirm() non bloquant ; avec confirm vrai le bon est créé comme avant ; test-v172b.js inchangé et vert.
- demHeures offre 9:00 avec « 1 place » pour 2 techniciens et un bon épinglé Jason à 9h ; l'objet creneaux envoyé contient techs ['Jason','Gwendal'] (capacité) et pas ['Gwendal'] (libres).
- demTechs compte un employé sans role comme technicien, jamais un role 'tache'.
- La pastille 👷 N (Semaine et Mois) égale la capacité (un employé 'tache' présent n'augmente pas N).

**Tests**
- test-v178-cal-a.js (Chromium, test-lib) : T1-T3, T6, T9, T12 du plan A10 corrigés (utiliser w.__dem.heures, w.__dem.jours, w.__dem.techs et non window.__rdv ; le premier départ après un bon 9:00-10:00 avec tampon 15 est 10:15), multi-machines, Journée complète, jour sans technicien, contrat techs capacité (espion sur update demandes_service).
- Relancer test-v172b.js, test-v165.js, test-v168b.js, test-v161.js, test-v164.js, test-v170.js, test-v172.js, test-v174.js, test-v175.js ; edge : test-v178-srv.js doit accepter ce que CALA écrit.

### CALB — A10 affichage : blocs côte à côte au calendrier, surcharge signalée, dépôt à la bonne heure

| | |
|---|---|
| **Demandes** | A10 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Pur affichage et gestionnaires de dépôt, déterministe et sans écriture de données ; la partie risquée (capacité) est dans le socle. Effort élevé pour la lisibilité sur iPad et téléphone. |
| **Dépend de** | S0a |
| **Durée murale** | ≈ 55 min |

**Zones de code (propriété du lot)**
- index.html : calRendreSemaine (6566-6679), calRendreJour (6753-6876), calDeposerSemaine (6682-6702), calDeposerJour (6879-6901), CSS dans <style id=v178-CALB>
- NE PAS toucher calBlocContenu (6518-6544), calEvenementsDuJour (6462), calCliquerVide (6705), ni calDeposer (6917, code mort sans appelant)

**Étapes**
1. ⚠️ Voir section 12.3, point 1 : calCliquerVide (6705) devient PROPRIÉTÉ de CALB ; un bloc seul n'occupe que la moitié de la piste quand 2 techniciens ou plus sont capables et qu'il reste une place ; double-clic à 9:00 avec une place restante ouvre le formulaire d'un 2e rendez-vous.
2. calVoies(jobs, nbTechs) pure, déterministe, qui n'écrit rien dans machines : placement par grappes de chevauchement (agenda classique) ; chaque grappe est découpée en k voies où k = rendez-vous simultanés maximum de la grappe ; un bloc seul garde la pleine largeur ; les créneaux retenus des demandes (window.__demCreneauxJour, dessinés aujourd'hui avant les blocs donc cachés) entrent dans le même calcul de voies. Pas de voie fixe par technicien (un rendez-vous épinglé n'a pas besoin de voie assignée ; sur iPad une voie fixe par technicien rétrécit tout à 28 px).
3. Semaine : style inline left et width par voie ; classe etroit quand la largeur d'une voie est sous 80 px (masque machine, tech, sans-soumission) ; min-width de .cal-sem-grille calculée en pixels = 48 + somme des jours × max(130, voies_max_du_jour × 72) avec défilement horizontal (l'actuel min-width 700 donne 28 px par voie en Semaine complète). Entête : pastille 👷 N inchangée (déjà alignée sur techsCapacite) ; rouge avec ⚠️ seulement si rendez-vous simultanés > max(N, 1) ; jour sans technicien : « 👷 0 » existant, jamais ⚠️ pour un rendez-vous isolé.
4. Jour : appliquer calVoies dans la colonne « — » et dans toute colonne de technicien en double réservation, avec liseré rouge sur le bloc de la 2e voie d'un même technicien.
5. Dépôt : écrire hDeb dans data-hdeb de la piste (le rendu prend le minimum de la semaine : vendredi 8-12 donne 8 pour tout le monde, alors que calDeposerSemaine recalcule avec l'horaire du jour déposé et enregistre +1 h d'écart) et le lire dans calDeposerSemaine et calDeposerJour ; faire ce correctif AVANT l'avertissement. rdvAvertirSurcharge(iso, heureDec, dureeMin, id, tech) : rdvPlaces avec saufId ; si places < 1, confirm() non bloquant « ⚠️ À HH:MM il y aurait N rendez-vous pour M technicien(s). Placer quand même ? » ; appelé avant l'écriture dans les deux dépôts.
6. Texte d'aide 6671 : les rendez-vous simultanés s'affichent côte à côte (pas « une voie par technicien »).

**Critères d'acceptation (vérifiables)**
- 2 bons à 9:00 un jour à 2 techniciens : deux .cal-jbloc de left différents et de largeur égale à environ la moitié ; 1 seul bon : pleine largeur (rendu identique à v175) ; 1 bon et 1 créneau retenu à 9:00 : deux éléments côte à côte.
- 3 rendez-vous simultanés pour 2 techniciens : entête rouge ⚠️ ; 2 rendez-vous consécutifs ou un seul rendez-vous un jour sans technicien : aucun ⚠️.
- Vue Jour : 2 non assignés simultanés → colonne « — » à 2 voies ; double réservation d'un même technicien → liseré rouge.
- Dépôt d'un bloc le lundi dans la grille d'une semaine dont le vendredi ouvre à 8 h : l'heure enregistrée est celle visée (pas +1 h) ; dépôt en surcharge : confirm, refus = aucun déplacement.
- Aucun défilement horizontal de la PAGE à 390 px et à 768 px ; les blocs restent lisibles (etroit) ; test-v161.js (assertions DOM seulement) reste vert.

**Tests**
- test-v178-cal-b.js : T8, T10, T11 du plan A10 corrigés (grappes, surcharge, voies), dépôt à la bonne heure, calVoies déterministe (même résultat deux fois, machines non muté), fumée Chromium à 390 px, 768 px et 1280 px.
- Relancer test-v161.js, test-v164.js, test-v170.js, test-v172b.js, test-v174.js, test-v175.js.

### CAL9 — A9 : voir le calendrier et la charge d'ouvrage à côté des créneaux proposés (fiche d'une demande)

| | |
|---|---|
| **Demandes** | A9 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Interface responsive (grille à zones, sticky, mini-calendrier de 120 lignes) et correction du rafraîchissement temps réel du sélecteur ; aucun moteur nouveau, le calcul de charge est un ratio d'heures isolé dans une fonction. |
| **Dépend de** | S0a ; CALA (merge-tree prévient un conflit ; en cas de conflit, rebaser CAL9 sur CALA) |
| **Durée murale** | ≈ 70 min |

**Zones de code (propriété du lot)**
- index.html : IIFE Demandes demRendrePicker (26938-27004) et le gestionnaire de clic des heures (26993-26999) : PROPRIÉTÉ de ce lot ; demOuvrirFiche (26721), demRendre (26637), appels demRendre() des rappels temps réel (26417, 26423) et de ouvrirDemandes (26634) ; setInterval du filet à 120 s (26466-26471) ; ancres //@@v178-A9 apres-demJours et //@@v178-A9 rafraichir
- index.html : CSS dans <style id=v178-CAL9> (jamais dans le gabarit css.textContent de l'IIFE, qui est un template literal)
- NE PAS modifier demJours, demHeures, demTechs, demOccupe, demEnvoyerCreneaux (CALA)

**Étapes**
1. Périmètre : seulement « Demandes de service > fiche > 📅 Proposer des créneaux » (3 choix envoyés au client). L'écran Prise de rendez-vous (appel) et la fenêtre de reprogrammation sont hors périmètre.
2. demChargeJour(iso, saufDemande) (nom : demCharge existe déjà comme booléen en 26294) placée à l'ancre : capacité = somme des heures de techsCapacite(iso) moins le dîner par technicien (pauseDiner) ; réservé = bons non archivés dont echeance === iso (même filtre que demOccupe et calEvenementsDuJour : un bon prete ou afacturer daté d'un jour futur compte, sinon charge, blocs et plages vertes se contredisent), bons sans heure comptés 60 min et signalés ; retenu = créneaux retenus des AUTRES demandes ; seuils 60 % et 85 % en constantes ; capacité 0 → niveau 0 et libellé « aucun technicien », jamais « 0 % chargé » en vert ; ne pas modifier demJours : calculer la charge dans le rendu des tuiles.
3. Mini-calendrier de semaine en lecture seule (≈ 120 lignes) : en-têtes par jour avec barre de charge, plages libres vertes pour la durée choisie (demHeures) placées AU-DESSUS des blocs de rendez-vous (z-index supérieur et pointer-events none : sinon le bloc client masque la plage « 1 place » à 9h avec 2 techniciens), blocs existants avec info-bulle (calEvtInfo), plages retenues hachurées, choix numérotés ①②③ ; bande dîner dessinée seulement si elle croise les heures d'ouverture du jour ; clic sur une plage verte = choisir via demBasculerChoix ; clic sur un choix = le retirer ; retrouver l'heure du clic par la dernière heure de demHeures dont le début est ≤ au clic (les départs ne sont PAS tous sur une grille de 30 min : tampon de 15 min) ; jours passés et fériés non cliquables ; toasts en guillemets doubles (une apostrophe non échappée casse tout le script).
4. demBasculerChoix(iso, heure) extraite du gestionnaire de clic ; même règle des 3 choix maximum et même alert ; le choix porte techs retrouvés dans demHeures (CALA relit de toute façon au moment de l'envoi).
5. Mise en page : bouton « 🗓️ Voir le calendrier » dans la carte ; structure .dem-duo (zones a / calendrier / b) côte à côte à partir de 1000 px (inclut un iPad paysage de 1080 px ; le seuil de 1100 laisserait l'iPad standard sous le seuil), empilé sinon avec le mini-calendrier entre l'étape 2 et l'étape 3 ; #dem-boite élargie à 1500 px par la classe .dem-large (retirée au début de demRendre, APRÈS la déclaration de b) ; défaut ouvert si largeur suffisante, préférence mémorisée dans localStorage mtr-dem-cal-v1 en try/catch ; « Cette semaine » et la semaine initiale = demLundiDe(premier jour ouvert à partir de demain), pas le lundi de demain (le samedi donnerait la semaine passée) ; bouton ‹ borné.
6. % de charge sur chaque tuile de l'étape 2 par un petit indicateur interne <i class=dem-pb> (pas border-bottom : il écraserait les bordures de .voulu, .on et .ferie).
7. Rafraîchissement temps réel : demRafraichir() remplace demRendre() aux deux callbacks (26417, 26423) et dans ouvrirDemandes (26634) ; l'état « sélecteur affiché » se lit dans le DOM (document.getElementById('dem-duree')), JAMAIS par un drapeau (#dem-zone est partagé avec Renseignements, Coordonnées et le message Corrigé : un drapeau ferait réapparaître le sélecteur par-dessus ces formulaires) ; relire la demande fraîche (demandes.find par id : demOuverte est l'ancien objet) et ne PAS rouvrir si son statut a changé (confirmee, refusee, expiree) en affichant un toast « Cette demande vient de changer » ; sauver et rétablir b.scrollTop ; ne remplacer le DOM que si le HTML du volet diffère (signature), pour ne pas perdre un tap ni fermer le menu natif de durée sur iPad.
8. window.__demCalRafraichir (même test DOM), appelé par la ligne ancre de rafraichirVues ET par le setInterval de 120 s (qui recharge les retenues expirées et n'appelle aujourd'hui que calRendre).
9. CSS .dem-duo, .dmc-* dans <style id=v178-CAL9> ; sur écran tactile (matchMedia coarse dans un try/catch : absent de jsdom) hauteur d'une demi-heure de 30 px.

**Critères d'acceptation (vérifiables)**
- Bouton #dem-cal-btn présent ; à 1280 px le volet #dem-cal est affiché par défaut et #dem-boite a la classe dem-large ; à 390 px il est masqué par défaut ; la préférence est écrite en localStorage et l'app ne plante pas si localStorage lance une exception.
- Colonnes : 5 jours ouvrés, week-end absent, jour férié fermé et non cliquable, passé non cliquable ; un vendredi, « Cette semaine » montre la semaine à venir.
- Charge : 1 technicien 9-17 avec dîner → capacité 7 h ; bon de 2 h → 29 % niveau n1 ; 86 % → rouge ; 2 techniciens → 14 h ; jour sans technicien → « aucun technicien » ; un bon prete daté d'un jour futur compte comme dans les blocs ; retenue d'une AUTRE demande comptée, celle de la demande ouverte dessinée mais non comptée.
- Clic sur une plage verte ajoute le choix (même liste que la case de l'étape 3), le 4e déclenche l'alert « Trois choix au maximum », re-clic retire ; plage occupée, hors ouverture ou dîner : rien d'ajouté et toast.
- 2 techniciens et un bon à 9h : la plage 9:00 reste visible et cliquable avec « 1 pl. » (au-dessus du bloc).
- Événement temps réel pendant que le sélecteur est ouvert : il reste affiché avec les choix et la position de défilement ; formulaire « Renseignements » ouvert puis événement : le formulaire n'est PAS remplacé ; demande devenue confirmee : sélecteur non rouvert avec toast ; deux appels sans changement de données : aucun nœud DOM remplacé.
- XSS : nom de client <img src=x onerror=alert(1)> dans les blocs et info-bulles reste du texte ; l'envoi SMS/courriel (demEnvoyerCreneaux) est inchangé et ne rouvre pas le sélecteur.

**Tests**
- test-v178-a9.js sur le modèle de test-v165.js (__dem.ouvrirFiche) : tests 1-12 du plan A9 corrigés ci-dessus, plus formulaire infos ouvert pendant un rafraîchissement, demande devenue confirmée, départs hors grille (bon 9:00-10:00 avec tampon 15 : cellules 10:15 et 10:30), jsdom sans matchMedia, vendredi, jour sans technicien ; fumée Chromium 1280, 1180, 820 et 390 px.
- node --check sur le script de l'IIFE avant les tests ; relancer test-v165.js, test-v168b.js, test-v161.js, puis la suite complète.

### CAL6 — A6 : bon de travail déjà créé, l'ajouter ou le déplacer au calendrier

| | |
|---|---|
| **Demandes** | A6 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Une dizaine d'éditions localisées qui réutilisent la fenêtre « pièces arrivées » en mode rdv ; les pièges (pas de doublon de BT, pas de statut reparation, bon retrouvé par id, z-index) sont nommés. Opus inutile. |
| **Dépend de** | S0a ; S0b |
| **Durée murale** | ≈ 45 min |

**Zones de code (propriété du lot)**
- index.html : soumVersRdv (16731-16776), soumVersBonTravail (16687-16728), soumRendreTout (13167-13174, ajout d'un appel final null-sûr), boutons de #so-vue-edit (4031-4032), #voile-repro (4394-4407)
- index.html : reprogrammerOuvrir, reprogrammerFermer, reproChercher, reproChoisir, reproOccupe (16085-16205) : PROPRIÉTÉ de ce lot ; piecesArrivees (16070-16082) doit continuer à fonctionner à l'identique
- index.html : rdvHeuresMO (19837-19841) et rdvSyncSoumission (20106) : une ligne chacun pour dureeInitiale
- NE PAS toucher confirmerRdv ni genererSuggestionsRdv (CALA)

**Étapes**
1. ⚠️ Voir section 12.3, point 2 : reproChercher ne garde un créneau pour un technicien que si rdvPlaces(...).libres contient son nom (sous CAPACITE_MULTI_TECHS) ; et section 12.2 : estimation épuisée → 15 min en mode pièces.
2. Constante partagée de statuts non plaçables : archive, afacturer, prete, assurance, commande ; helper soumBonPlacable(m).
3. soumBonsLies(s) = bons dont m.id === s.machineId ou m.soumissionId === s.id ; PAS de clause par demandeId (la soumission de la 2e machine d'une demande reçoit le même demandeId et lierait le mauvais bon).
4. soumVersRdv : remplacer l'alerte bloquante (16735-16738) par : bons liés trouvés → soumPlacerBonExistant(s, bons) ; sinon flux « nouveau BT » inchangé. soumPlacerBonExistant : aucun bon plaçable → alerte claire avec le n° BT et le libellé de statut ; bon déjà daté → confirm « Le déplacer ? » ; liens soumissionId et machineId posés seulement APRÈS ce confirm ; soumVider() ; reprogrammerOuvrir(m, {mode:'rdv', minutes}) sans ouvrir le calendrier avant (la fenêtre z-index 140 serait sous .cal-page 200).
5. reprogrammerOuvrir : reproMode ('pieces' par défaut) et reproMachineId ; en mode pieces la durée = resteMinutesDe(m) (S0b) || m.dureeRestante || m.dureeEstimee || 60 ; en mode rdv la durée vient de opts.minutes ; titre « Placer au calendrier » ou « Déplacer le rendez-vous », note « aucun nouveau bon ne sera créé », champ « À partir du » (défaut aujourd'hui, jamais avant), 5 jours et 4 créneaux par technicien en mode rdv (2 en mode pieces, inchangé), bouton du bas « Annuler », et un lien « ✏️ Choisir la date et l'heure moi-même » qui ouvre ouvrirEdition(id).
6. reproChercher : pour le jour même, ne proposer que des départs ≥ maintenant arrondi au quart d'heure suivant (aujourd'hui des heures déjà passées sont proposées, ce qui échappe aussi aux rappels).
7. reproChoisir : retrouver le bon par id (machines.find(x => x.id === reproMachineId)) ; en mode rdv, si le bon n'existe plus : fermer, toast « ce bon de travail n'existe plus (modifié sur un autre poste) », AUCUNE écriture (pas de repli silencieux sur un objet orphelin) ; recalculer reproOccupe au clic et refuser avec un message si le créneau vient d'être pris ; sansrdv → avenir ; appliquer echeance et heure aux autres bons ACTIFS du même rdvGroupe qui sont plaçables et pas en reparation ; s.rdvIso et s.rdvHeure sur toutes les soumissions du bon (rdvSoumissionsDuBon) puis soumSauver() ; PAS rdvSyncSoumission ; mémoriser m.dureeInitiale une seule fois avant d'écrire dureeEstimee = c.duree (quand une estimation du technicien réduit la durée, la durée du bloc devient celle du reste et la base de la main-d'œuvre de la soumission serait faussée) et faire lire dureeInitiale || dureeEstimee par rdvHeuresMO et rdvSyncSoumission ; mode pieces : statut reparation comme avant ; mémoriser modeRdv avant reprogrammerFermer (qui remet le mode) ; ouvrir le calendrier (ouvrirCalendrier, calAncre, calRendre ; si le jour tombe un samedi ou un dimanche et que la vue est « travail », passer en « semaine ») ; toast final ; soumMajBoutonsBon() avant l'ouverture.
8. soumMajBoutonsBon (ids so-btn-bt et so-btn-rdv sur les deux boutons 4031-4032) : « 📅 Placer BT-… au calendrier » ou « 📅 Déplacer le rendez-vous » ; « → Bon de travail seulement » grisé quand un bon plaçable existe ; si le seul bon lié n'est pas plaçable, garder les libellés d'origine et laisser le clic produire l'alerte ; null-sûre (soumRendreTout est aussi appelée par la synchro et par 25937 avec soumCourante possiblement null) ; appelée à la fin de soumRendreTout.
9. Alerte de soumVersBonTravail (16691) : version simple en concaténation de chaînes (le snippet à backticks du plan d'origine mélangeait des guillemets dans un template et afficherait du code) : « Un bon de travail existe déjà pour cette soumission (BT-…). Utilise « 📅 Placer au calendrier » … ».
10. Dans le formulaire du bon la date existe déjà (f-echeance, f-heure) : le lien « Choisir moi-même » est la sortie de secours si le lot est coupé.

**Critères d'acceptation (vérifiables)**
- BT sans date lié à une soumission : soumVersRdv n'alerte pas ; #voile-repro ouvert, titre « Placer au calendrier », durée = durée du BT ; reproChoisir : machines.length inchangé, echeance, heure, technicien, dureeEstimee posés, statut toujours avenir, s.rdvIso et s.rdvHeure égaux, s.machineId inchangé, calendrier ouvert sur la semaine du créneau.
- BT déjà daté : confirm contenant la date ; Annuler → fenêtre non ouverte, bon et liens inchangés ; OK → « Déplacer le rendez-vous ».
- Statuts archive, afacturer, prete, assurance, commande : alerte avec le n° BT, aucune écriture ; 2 bons liés (1 archivé, 1 avenir) : le bon actif est choisi.
- Soumission de la 2e machine d'une demande web (même demandeId, aucun lien) : AUCUN bon n'est rattaché ; le flux « nouveau BT » reste disponible.
- Groupe : les bons plaçables du rdvGroupe reçoivent la même date et heure ; un bon prete, archivé ou en reparation du groupe reste inchangé ; sansrdv devient avenir ; avenir et attente gardent leur statut.
- Aujourd'hui à 15 h : aucun créneau avant 15:15 ; piecesArrivees puis reproChoisir : statut reparation, durée = dureeRestante/estimation, zone date et note cachées, mode remis à pieces.
- Tableau remplacé (appliquerLigne1) pendant la fenêtre ouverte : la date part sur le NOUVEL objet par id ; bon retiré : toast, aucune écriture ; double clic sur un créneau : un seul changement.
- Boutons : libellés selon l'état et « → Bon de travail seulement » grisé avec un bon plaçable ; test T11 : soumission sans BT → #voile-rdv comme avant.

**Tests**
- test-v178-a6.js sur le gabarit de test-v172b.js (alert et confirm remplaçables ; les let se lisent par w.__get) : T1-T11 du plan A6 corrigés ci-dessus + T12 heures passées + T13 BT retiré pendant la fenêtre + cas demandeId + créneau pris entre l'ouverture et le clic ; dans les tests fixer EMPLOYES avec une dispo valide.
- Relancer test-v172b.js, test-v170.js, test-v171 non utilisable, test-v172.js, test-v173.js, test-v174.js, test-v175.js, test-v164.js, puis la suite complète ; aucun test existant ne référence soumVersRdv, reprogrammerOuvrir ou #voile-repro (la protection est donc entièrement nouvelle).

### SON — Sons d'alerte plus forts et distincts, répétition jusqu'à l'accusé de réception (A11)

| | |
|---|---|
| **Demandes** | A11 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **high** — Moteur Web Audio, pièges iOS (déblocage, limiteur, minuteries), bandeau d'accusé, panneau de réglages, nombreux rebranchements d'une ligne dans trois IIFE ; plus long des lots de la vague 1. Pas besoin d'opus : aucune donnée ni serveur. |
| **Dépend de** | rien |
| **Durée murale** | ≈ 50 min |

**Zones de code (propriété du lot)**
- index.html : bloc sonCtx/sonDebloquer/sonNotification (21161-21182) à remplacer ; sonAcceptation (14258-14272)
- index.html : demTempsReel (26412) et demSonnerie (26430-26451) dans l'IIFE Demandes ; window.ouvrirDemandes (26625) ; commTempsReel (27663-27678) ; proposerNote (ancre //@@v178-A11 proposerNote) ; verifierRappels (28366) ; cmdAlarmesRendre (8932) ; sessionAvertOuvrir (22054) ; deconnecter (22495)
- index.html : HTML #alerte-bandeau avant <!-- Nouveau message --> (3733) ; pushOuvrirReglages (24058) et pushRendre (24070-24110) ; menu « Compte » ; CSS dans <style id=v178-SON>
- sw.js : gestionnaire push (13-23)

**Étapes**
1. ⚠️ Périmètre et corrections révisés en **section 12.1** (déblocage iPad, pas de planification sur contexte suspendu, répétition + bandeau = option SON+ sur réponse à Q18). La section 12.1 l'emporte sur les étapes ci-dessous. Dans le canal temps réel des Demandes, ne modifier QUE la ligne 26412 (section 12.3, point 9).
2. Moteur : sonPrefs() / sonPrefsSauver() (localStorage mtr-sons-v1 {volume, muet, repeter}, try/catch, défauts 100 / faux / vrai) ; chaîne gain maître → DynamicsCompressor (limiteur) → destination, avec navigator.audioSession.type = 'playback' dans un try (effet sur le commutateur silencieux iOS non confirmé : à tester sur l'iPad) ; table SONS (chat, demande, sms, appel, appelEntrant, rappel, piece, acceptation, session) avec motifs distincts entre 1000 et 2000 Hz, ondes carrée ou dent de scie à gain ≥ 0,4 pour les critiques, triangle ≥ 0,7 pour les autres ; jouerSon(type, opts) retourne vrai/faux selon que le contexte est « running ». Ne PAS promettre « +9 dB » : le compresseur ajoute un gain automatique ; mesurer l'ancien et le nouveau niveau avec OfflineAudioContext dans Chromium (RMS) ou valider à l'oreille sur l'iPad, et régler le seuil du limiteur d'après cette mesure.
3. Déblocage : listeners PERSISTANTS (pointerdown, touchstart, keydown, passifs) qui appellent resume() quand l'état n'est pas running + document visibilitychange (iOS passe le contexte en « interrupted » après un passage en arrière-plan ; l'ancien {once:true} ne réactive jamais). sonNotification() et demSonnerie() restent définies comme enveloppes (window.__dem.sonnerie est exposé à 27557 et sonNotification est appelée en 21296 et 26449) ; sonAcceptation appelle jouerSon('acceptation') (plus de AudioContext jetable).
4. alerteCritique(type, titre, corps, ouvrir) : AUCUN son ni bandeau si !utilisateurCourant() (les canaux temps réel démarrent avant la connexion) ou si l'employé n'a pas le droit de la section (droit('demandes') pour demande, droit('communications') pour sms et appel) ; pas de boucle sur l'Écran atelier (sessionEcranAtelierOuvert() : un seul son) ; minuterie de fin de 180 s POSÉE DANS TOUS LES CAS (sinon, en mode muet ou sans répétition, le bandeau reste jusqu'au clic sur un iPad non touché) ; setInterval de 15 s seulement si repeter et pas muet ; alerteAccuser(type), alerteToutArreter() ; bandeau #alerte-bandeau (z-index 10030 : au-dessus de rap-voile 9500, de la modale comm 9700, du toast 10000 et de .doc-voile 10020), ligne « 🔇 Touche l'écran une fois pour activer le son » quand jouerSon retourne faux, bouton « ✓ J'ai vu » de 44 px, safe-area, échappement echap().
5. Câblages : 21296 → jouerSon('chat') ; 26412 → alerteCritique('demande', …) entouré d'un try/catch (une exception ne doit pas sauter toastAviser ni demClignoter) ; commTempsReel : pour un sms_in, NE PAS sonner sur l'INSERT à l'état a_traiter : le trigger crée la ligne à 'a_traiter' et l'Edge la passe à 'traite' après coup (communications.sql:112-118, sms-entrant:80, 221, 283), donc chaque OUI, STOP ou choix de créneau déclencherait une alarme ; attendre ~2 s après commCharger, relire la ligne et ne sonner que si aTraiter(c) est encore vrai ; sur UPDATE vers 'traite', alerteAccuser('sms') ; appel_manque → alerteCritique('appel', …) sous try/catch ; ligne ancre proposerNote → jouerSon('appelEntrant') sous try ; verifierRappels (28366), cmdAlarmesRendre (8932) et sessionAvertOuvrir (une seule fois à l'ouverture) ajoutent chacun un jouerSon sous try. window.ouvrirDemandes arrête 'demande' seulement (PAS 'sms' : l'onglet « À vérifier » de Demandes liste sms_recus, une autre source, et la dernière demande confirmée sans soumission resterait « neuve ») ; window.ouvrirCommunications arrête 'appel' et 'sms' ; deconnecter appelle alerteToutArreter() en première ligne.
6. Réglages : dans pushOuvrirReglages créer un conteneur #son-boite distinct de #push-boite et le remplir de façon SYNCHRONE avant l'await de pushRendre (pushAbonnementActuel attend serviceWorker.ready, qui ne se résout jamais si /sw.js n'est pas enregistré ; et #push-boite est réécrit à chaque pushRendre, ce qui détruirait le curseur en cours de réglage) : curseur de volume (20-100), case « Couper les sons de cet appareil », case « Répéter jusqu'à ce que je confirme », une ligne ▶ Tester par type (jouerSon(type,{test:true}), qui débloque aussi l'audio). Corriger le texte de 24104 (limites push : son choisi par l'OS, suit sonnerie, silencieux et Concentration ; l'app ouverte est plus forte mais ne dépasse jamais le volume de l'appareil ; iPhone/iPad : commutateur sur sonnerie).
7. Menu : le bouton « 🔊 Alertes et sons » SANS aucun attribut data-section ni data-tb-fixe (appliquerDroits masque tout [data-section] selon droitDe, 23862-23866 : les techniciens ne verraient pas l'item), placé dans le bloc « Compte » du menu latéral, appelant menuAller('pushOuvrirReglages').
8. sw.js : requireInteraction pour les types demande, sms, appel ; vibrate par type (demande [300,150,300,150,300,150,600], sms [200,100,200,100,400], appel [400,150,400,150,400], défaut inchangé) ; silent false ; commentaire sur la limite plateforme. Aucun changement à edge/envoyer-push ; aucun nouveau déclencheur SQL en v178 (push_abonnements est vide : aucun appareil n'a activé les alertes).

**Critères d'acceptation (vérifiables)**
- Volume 100 → gain maître 1 ; 40 → 0,4 ; plancher 0,2 ; un DynamicsCompressor est dans la chaîne ; les 9 types ont des motifs deux à deux différents ; un type inconnu ne lève pas d'exception.
- muet : aucun oscillateur pour jouerSon('sms') mais jouerSon('sms',{test:true}) en crée ; le bandeau s'affiche quand même et disparaît seul après 180 s.
- INSERT demandes_service → bandeau « 📨 Nouvelle demande » + son ; répétition à +15 s, +30 s… arrêtée à 180 s ou par « ✓ J'ai vu » ; repeter décoché : un seul son.
- INSERT communications sms_in a_traiter puis UPDATE traite en moins de 2 s : aucun son, aucun bandeau ; sms_in qui reste à traiter : son 'sms' et bandeau ; appel_manque : son 'appel' ; écran de connexion (pas de session) : rien ; technicien sans droit communications : pas d'alarme sms ni appel.
- contexte suspendu : un pointerdown rappelle resume() à chaque fois (pas une seule), visibilitychange aussi ; jouerSon retourne faux → ligne « touche l'écran ».
- Le bloc Sons du panneau s'affiche même si les push ne sont pas supportés ou si serviceWorker.ready ne se résout pas ; le menu « Alertes et sons » est visible pour un technicien (droits par défaut) et ouvre #push-voile.
- Rappels, pièces en retard et acceptation : un son une seule fois (CLE_AVISES), sans nouveau AudioContext par appel ; sw.js : types demande/sms/appel → requireInteraction vrai, type info → faux.
- La mesure RMS dans Chromium (ou la validation à l'oreille notée au rapport) montre un niveau supérieur à celui de la v175 pour les trois alertes critiques.

**Tests**
- test-v178-son.js (faux AudioContext et navigator.vibrate de test-lib-v178 ; les const/let alertesActives, SONS, sonCtx se lisent avec window.eval) : T1-T11 du plan A11 corrigés ci-dessus ; test Node simple de sw.js ; mesure OfflineAudioContext en Chromium.
- Relancer test-v166.js, test-v172.js, test-v173.js, test-v175.js, test-v161.js, test-v165.js, test-v168b.js, test-v162.js (deconnecter), test-v164.js, test-v170.js.

### BTA — Nouvelle section « Bons de travail actifs » (sauf archivés), consultation sans live (A12)

| | |
|---|---|
| **Demandes** | A12 |
| **Vague** | 1 |
| **Agent** | **sonnet** · effort **medium** — Page de consultation qui copie le patron d'ordre-page et du menu ; sans donnée ni serveur ; la seule logique délicate (ne jamais ouvrir le live au clic, ne pas muter les bons, conserver l'état au re-rendu multi-postes) est décrite pas à pas. |
| **Dépend de** | S0b |
| **Durée murale** | ≈ 55 min |

**Zones de code (propriété du lot)**
- index.html : SECTIONS (21932-21958), DROITS_DEFAUT (21960-21967), objet garde de garderSections (23880-23882), menu latéral (3809), tuile de « Mon écran » (22573), HTML de la page après #ordre-page (2117), deconnecter (22495)
- index.html : bloc JS À L'ANCRE //@@v178-A12 bloc (21922) dans le script PRINCIPAL ; ancre //@@v178-A12 rafraichir ; CSS dans <style id=v178-BTA>

**Étapes**
1. ⚠️ Voir section 12.3, point 9 : dans deconnecter, insérer sous l'ancre //@@v178-A12 deconnecter (juste avant appliquerDroits()), jamais en tête (ancre de SON).
2. Enregistrer la section : { id: 'bonsActifs', label: 'Bons de travail actifs', ico: '📑', ouvrir: 'ouvrirBonsActifs' } après 'ordre' ; DROITS_DEFAUT technicien bonsActifs true, tache false (admin automatique) ; ouvrirBonsActifs dans garde (droit + verrou de punch) ; sous-titre de la tuile « Tous les bons, sans ouvrir le live » ; aucune migration : un e.droits enregistré sans la clé retombe sur le défaut du rôle.
3. Menu : <button class=menu-item data-section=bonsActifs onclick=menuAller('ouvrirBonsActifs')> après 'ordre'. La page : <div class=cal-page bta-page id=bta-page data-section=bonsActifs> (data-section pour qu'appliquerDroits la masque aussi pour qui n'a pas le droit) avec entête (Retour, titre, champ de recherche en 16 px, select de tri en 16 px) HORS de la zone re-rendue (la frappe ne saute pas), puis #bta-resume, #bta-chips, #bta-liste.
4. JS à l'ancre (le script principal, pas un script ultérieur : garderSections lit window[nom] au chargement) : btaActifs() = machines non archivées (donc À venir, Sans RDV, En attente, Réparation, Prêt à facturer, Facturé, Assurance, Commande) ; filtres par pastille avec compteurs, libellés courts (« Sans RDV », « Attente pièce », « En réparation »…), pastille « Autre » si total ≠ somme, « 🔴 En live » ; recherche par mots sans accents sur BT, n° de carton, client, machine, téléphone, série, travaux ; tri « statut » (live d'abord, puis réparation, attente, sansrdv, avenir, afacturer, prete, assurance, commande ; dans chaque groupe le plus ancien arrivé d'abord par arriveeDe(m).date de S0b, y compris le repli creeLe, puis RDV, puis n° BT) et « n° BT » ; NE PAS mémoriser filtre ni recherche (seulement le tri, localStorage mtr_bta_prefs en try/catch) et les remettre à « tous » et vide à chaque ouverture, avec un bouton « ✕ Effacer » quand un filtre est actif ; pagination de 100 ; lignes compactes dépliables par délégation d'événement (UN addEventListener sur #bta-liste lisant closest('[data-id]'), pas de onclick par id), élément role=button et non un <button> contenant des blocs ; le Set d'ids dépliés survit aux re-rendus ; ne jamais focaliser automatiquement le champ de recherche (clavier iPad en paysage : surTelephone() ne couvre que ≤ 820 px).
5. Détail d'un bon (construit seulement quand déplié) : client avec lien tel: (href = chiffres et + seulement), machine (série, modèle, carton, km ou heures, lieu), rendez-vous, travaux complets, pièces (qté, nom, n°, ✓ reçue, 🔧 utilisée ; AUCUN prix, aucune facturation, aucune mention de paiement), notes d'atelier par une fonction pure btaNotes(m) qui ne mute jamais le bon (liveNotes mute m.notesLive à la lecture) et dont les notes commençant par « ⏳ Reste à faire » sont masquées si resteAFaire est affiché à part, temps (ordreDureeTxt ou dureeTxtLocale), reste via resteMinutesDe(m) avec l'heure de saisie ; pas de synthèse des commandes (périmée : le temps réel de la ligne 5 n'appelle pas rafraichirVues).
6. Actions : « 🔴 Ouvrir en live » seulement avec droit('live') et statut hors commande et assurance ; pour afacturer, prete ou avenir non arrivé, passer par un confirm() « ouvrir en live remet le bon en Réparation en cours et démarre ton punch » (liveConnecterFinal fait statut reparation et supprime pretAFacturerLe sans confirmation) ; « 🖨️ Bon imprimable » (bonDeTravail ; ce n'est pas une lecture seule : la fenêtre imprimée peut éditer via window.opener) ; « ✏️ Modifier » (ouvrirEdition) admin seulement ; un point d'extension btaActionsExtra(m) retourne ''. Le clic sur une ligne ne fait QUE déplier : jamais ouvrirLive, jamais sauvegarder.
7. Rafraîchissement : ligne ancre rafraichirVues → btaRafraichir() ; btaRendre sauve et restaure scrollTop ; setInterval de 60 s tant que la page est ouverte (les durées en direct ne bougent sinon qu'au prochain rendu) ; fermerBonsActifs(), recherche et dépliés remis à zéro dans deconnecter (aucune cal-page n'y est fermée aujourd'hui : un technicien suivant verrait la liste précédente).

**Critères d'acceptation (vérifiables)**
- Registre : droitDe true pour admin et technicien, faux pour tache ; e.droits sans la clé suit le rôle ; e.droits.bonsActifs=false refuse avec toast ; bouton de menu visible admin et technicien, masqué pour tache ; la page elle-même est masquée sans droit ; technicien non punché : « Veuillez vous puncher » ; tuile de Mon écran présente.
- Un bon archivé n'apparaît ni dans la liste ni dans les compteurs et reste dans ouvrirArchives ; filtre reparation, « En live » et pastille à 0 grisée corrects.
- Recherche : « bt-042 », « gelinas » trouve « Gélinas », téléphone « 819 » ; tri statut puis plus ancien arrivé ; tri n° BT décroissant numérique (BT-100 avant BT-99).
- Clic sur une ligne : aria-expanded vrai ; JSON.stringify(machines) identique avant et après, y compris un bon avec notesTech seul (notesLive reste undefined) ; aucune session chrono créée, aucun appel à ouvrirLive ni à sauvegarder.
- Détail : aucun montant même pour un bon qui a coutAchat, prixVente, facturation et cadeau ; champs vides → « — » sans exception ; travaux contenant <img src=x onerror=alert(1)> restent du texte ; bon type serveur (id, creeLe, nom, client, tel, travaux, statut avenir, echeance, heure, dureeEstimee seulement) rendu sans erreur.
- Synchro : réaffecter le tableau machines (appliquerLigne1) page ouverte : 2 bons dépliés, le tri et la position de défilement conservés, statut mis à jour ; bon archivé ailleurs disparaît.
- Bouton live : caché sans droit live ; confirm sur afacturer et prete ; 600 bons → 100 lignes + « Afficher les 500 autres » ; aucune erreur JavaScript.

**Tests**
- test-v178-bta.js (Chromium, test-lib) : tous les critères ci-dessus ; fumée visuelle à 390 px (sans défilement horizontal, champ à 16 px) et mode sombre ; un contrôle de mise en page jsdom est impossible (jsdom ne calcule aucune mise en page), le patron valide à l'œil sur iPad et cell.
- Relancer test-v164.js (menu et droits de l'ordre), test-v170.js (Mon écran, pile de fenêtres), test-v161.js (menu demandes), test-v172.js, test-v174.js, test-v175.js.

### INT — Intégration par le maître d'œuvre (Fable) : fusion, non-régression complète, v178, changelog, zip

| | |
|---|---|
| **Demandes** | A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12 |
| **Vague** | 2 |
| **Agent** | **fable** · effort **high** — Seul agent qui fusionne dans les zones partagées, tranche les conflits résiduels, fait relire les diffs sensibles (sauvegarder, sms-entrant, confirmerRdv) et signe la livraison ; la vérification finale ne se délègue pas. |
| **Dépend de** | SRV ; COM ; PCS ; FAC ; TAB ; CALA ; CALB ; CAL9 ; CAL6 ; SON ; BTA |
| **Durée murale** | ≈ 100 min |

**Zones de code (propriété du lot)**
- index.html : APP_VERSION (5011) ; version.txt ; CHANGELOG-atelier-v178.md ; test-v178.js agrégateur ; mtr-ajouter-brp.user.js (version déjà montée par PCS) ; deploy-atelier-v178.zip

**Étapes**
1. ⚠️ Voir section 12.3 : grep « aucune trace » limité aux fichiers servis (point 5), test de contrat SRV ↔ CALA exécuté ici après la fusion de CALA (point 6), estimation révisée (point 10).
2. Pour chaque branche, dans l'ordre de strategie_branches.ordre_de_fusion : git merge-tree --write-tree (code de sortie ≠ 0 = conflit prévu) ; fusionner ; syntaxe.py (node --check par bloc puis sur la concaténation : attrape un const redéclaré entre blocs, ex. CLE_SESSION) ; smoke.js (0 erreur) ; le test du lot + 3 à 5 suites existantes de sa zone.
3. Relire personnellement les diffs de SRV (sms-entrant, rdv-confirmer), FAC (sauvegarder, relireMachines, appliquerLigne1), CALA (confirmerRdv) et SON (alertes critiques) ; un lot dont le diff dépasse ~200 lignes hors de son bloc, de ses ancres et de ses zones est suspect.
4. Si deux lots touchent finalement la même ligne (typiquement CAL9 et CALA dans l'IIFE Demandes), rebaser le second sur le premier ; ne jamais utiliser merge=union.

**Critères d'acceptation (vérifiables)**
- Suite complète verte : 804/804 de la baseline (hors test-v171.js, documenté non utilisable) + tous les test-v178-*.js ; edge/test-sms-entrant-v172.html et le test v178, edge/test-quickbooks-v160.mjs verts.
- smoke.js à 0 erreur ; node --check sur chaque bloc et sur la concaténation à 0 erreur ; function liveVoir( apparaît 1 fois.
- Le zip ne contient ni outils-v178/, ni ancres //@@v178-, ni /comptant/i, ni /m\.cadeau/ hors des deux fonctions de purge et du changelog v178 ; un grep des mots cadeau et comptant sur le contenu du zip est joint au rapport.
- Chaque lot rapporte N fautes volontaires attrapées sur N lancées (sabotage.sh).

**Tests**
- Suite complète via outils-v178/run-all.sh ./index.html avec MTR_FAKE_NOW d'un mercredi, puis une 2e passe un samedi simulé (test-v168b.js attendu rouge à la ligne 141 hors correctif de date ; le noter plutôt que le confondre avec une régression).
- Chromium : fumée visuelle à 390, 768 et 1280 px des écrans nouveaux (liste des bons actifs, Facturer avec notes, calendrier avec voies, fiche de demande avec mini-calendrier, bandeau d'alerte).


## 5. Zones partagées : matrice de conflits

| Zone partagée | Demandes | Résolution |
|---|---|---|
| edge/sms-entrant/index.ts : confirmer() et plageLibre() | A1, A10 | Un seul lot (SRV), un seul agent, en série : A1 d'abord (verrou, update unique, trace), puis A10 (capacité dans plageLibre et lecture de creneaux.techs). Contrat figé en amont : creneaux[].techs = noms de tous les techniciens capables, pas les libres (sinon un créneau offert avec un rendez-vous épinglé serait refusé par SMS). |
| IIFE Demandes : demRendrePicker, gestionnaire de clic, demHeures, demTechs, demJours, demEnvoyerCreneaux, rappels temps réel | A9, A10 | Partage de propriété : CAL9 possède demRendrePicker, le gestionnaire de clic, demBasculerChoix, demRendre, les rappels temps réel et le setInterval ; CALA possède demTechs, demHeures, demJours et la seule ligne creneaux de demEnvoyerCreneaux (qui relit techs dans demHeures au moment de l'envoi, donc sans dépendre du clic). A9 ne modifie pas demJours (la charge se calcule dans le rendu des tuiles). Ordre de fusion CALA puis CAL9 ; si git merge-tree prévoit un conflit, CAL9 rebase sur CALA (+10 min). |
| reprogrammerOuvrir, reproChercher, reproChoisir, dureeEstimee | A6, A8, A10 | CAL6 est propriétaire unique. A8 fournit seulement resteMinutesDe (socle S0b) que CAL6 consomme en mode pièces ; A10 ne touche plus à reproChercher (étape retirée). dureeEstimee : décision tranchée, reproChoisir mémorise dureeInitiale une seule fois et rdvHeuresMO / rdvSyncSoumission lisent dureeInitiale \|\| dureeEstimee, pour qu'un bloc de reprise réduit ne fausse ni la main-d'œuvre de la soumission ni le calendrier. |
| carteHTML (badge cadeau et bouton 🎁, badges d'arrivée et de reste) et deplacer | A5, A7 | Zones disjointes (10818-10826 et 10872 contre 10838-10885 ; 10941 contre 10930, au moins une ligne inchangée entre elles). Ordre de fusion FAC puis TAB ; repérage par symbole, pas par numéro de ligne. |
| #fact-pop et CSS de facturation (2940-3034) | A4, A5 | Même lot FAC, A5 d'abord puis A4. Le CSS neuf d'A4 va dans <style id=v178-FAC>, pas dans le bloc 3000-3034 que A5 purge. |
| rafraichirVues (5355-5367) | A4, A9, A12 | Trois ancres pré-posées par le commit socle, une ligne chacune ; chaque lot ajoute sa ligne try/catch sous SA ancre (expérience X1 : points d'insertion partagés = 6 conflits sur 10 fusions ; ancres pré-posées = 0 sur 10). |
| liveRendre, fermerLive, liveVoir, btAjouterNoteAtelier | A2, A3, A8 | Ancres A3 posées avant fermerLive et après liveSupprimerNote ; A2 modifie le corps de fermerLive (une ligne) et liveRendre (une section) ; A8 ne touche que liveFin* et la modale. liveVoir est définie une seule fois (COM) ; A12 ne l'utilise pas (rendu de détail propre). |
| proposerNote (popup d'appel Linkus) | A3, A11 | Ancre //@@v178-A11 proposerNote à la fin du corps de la fonction, éloignée des boutons modifiés par COM ; SON n'ajoute qu'un appel jouerSon dessous. |
| Contrat resteAFaire.minutes et date d'arrivée | A7, A8, A12, A6 | Nom de champ unique « minutes » (A7 et A12 le supposaient, A8 proposait « min ») ; lecture exclusivement via resteMinutesDe et arriveeDe du socle S0b (script principal, avant le premier afficher()) ; aucune estimation de repli, aucun champ travaille. |
| Moteur de capacité (rdvPlaces, techsCapacite) consommé par quatre lots | A10, A9, A6 | Écrit et testé seul en vague 0 (S0a) ; techniciensDisponibles et lireDispoCell ne sont pas modifiés (appelés par calendrier, ordre, reprogrammation, écran atelier) ; le filtre de rôle vit dans techsCapacite ; interrupteur CAPACITE_MULTI_TECHS pour revenir à la capacité 1. |
| Registre SECTIONS, DROITS_DEFAUT, garde, menu latéral, entête | A12, A11 | A12 est seul propriétaire du registre, du bloc JS dans le script principal et de la ligne de menu après 'ordre' ; A11 place son item « Alertes et sons » dans le bloc Compte, SANS data-section (appliquerDroits masque tout [data-section] selon droitDe). |
| toastAviser (6031-6039) | A2, A11 | Non modifiée par personne ; les sons s'ajoutent à côté. A2 émet un seul toast à l'ouverture (la fonction n'a ni file ni pile) ; le toast de pièce ajoutée reste silencieux pour ne pas faire sonner l'onglet caché. |
| mtr-ajouter-brp.user.js et bloc BRP 25590-25830 | A2 | Exclusifs à PCS ; version 2.4 montée par ce lot ; protocole des messages rétrocompatible (le patron peut garder l'ancien script le temps de la mise à jour). |
| APP_VERSION (5011), version.txt, CHANGELOG-atelier-v178.md, test-v178.js, ligne d'historique 43 | A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12 | Réservés à Fable à l'intégration, une seule fois. Les lots livrent des fragments de changelog dans leur rapport, pas de fichier partagé. Ne rien ajouter à la ligne 43 (1160 caractères, point de conflit inutile). |
| Fichiers de test existants | A5, A7, A10 | Un propriétaire par fichier : FAC possède test-v168.js (réécriture) ; aucun autre lot ne modifie un test existant ; chaque lot écrit son test-v178-<lot>.js. test-v171.js est exclu du garde-fou (fichiers bt089 absents) ; test-v168b.js dépend du jour de la semaine : exécution avec MTR_FAKE_NOW. |

## 6. Branches, ordre de fusion et garde-fous

Une branche d'intégration claude/v178-integration depuis claude/v175-modifications-plan-tyk4kb (tag v175-base). Un commit « socle v178 » unique de Fable pose les ancres-commentaires (une par agent et par site partagé, chacune sur sa ligne), un bloc <script> et un <style> vides par lot avant le </body> final, l'outillage de test et les correctifs de date ; S0a (moteur de capacité) et S0b (helpers) y sont fusionnés. Ensuite un git worktree par lot (../wt-<lot>, branche claude/v178-<lot>, 0,04 s chacun) : chaque agent ne modifie que son bloc, ses ancres et les lignes strictement nécessaires du code existant (1 à 3 lignes de crochet marquées v178-<LOT>). Fusion séquentielle par Fable seul, du moins partagé au plus partagé, prédite par git merge-tree --write-tree. Validé par X1 : régions éloignées, insertions à une ligne d'écart ou plus et modifications séparées par une ligne inchangée fusionnent seules ; conflits garantis sur la même ligne, des lignes voisines, la réindentation ou le déplacement d'un bloc ; simulation de 10 agents : 6 conflits sur 10 sans ancres, 0 sur 10 avec ancres pré-posées.

**Ordre de fusion (Fable seul, un lot à la fois)**
1. Socle (commit Fable) puis S0a et S0b, déjà fusionnés en vague 0
2. SRV (edge/ seulement : aucun conflit possible avec index.html)
3. PCS (bloc BRP exclusif, modale des commandes, une section du live)
4. BTA (registre des sections et bloc à l'ancre 21922)
5. SON (moteur de sons, bandeau, panneau de réglages, sw.js)
6. COM (Communications, rappels, carte de la demande ; ancres A3 et A11 distinctes)
7. FAC (retraits du cadeau dans carteHTML, sauvegarder et Facturer : avant TAB, qui ajoute dans les mêmes fonctions)
8. TAB (afficher, carteHTML, modale de fin de session, tv.html)
9. CALA (confirmerRdv, genererSuggestionsRdv, demHeures : avant les consommateurs)
10. CALB (calendrier Semaine et Jour)
11. CAL6 (soumVersRdv, fenêtre de reprogrammation)
12. CAL9 (fiche de demande : en dernier, car dans la même IIFE que CALA)
13. INT : bump APP_VERSION et version.txt, changelog, zip

**Garde-fous (consigne commune à tous les agents)**
- Ne jamais reformater, réindenter, trier ni déplacer du code ; pas de prettier ni eslint --fix ; pas de replace_all ; interdit .gitattributes merge=union (essai X1 : duplique la ligne modifiée des deux côtés).
- Chaque ajout porte un commentaire v178-<LOT> ; git diff --stat base..branche : un lot dont le diff dépasse environ 200 lignes hors de son bloc et de ses ancres est suspect.
- Avant chaque commit d'agent et après chaque fusion : syntaxe.py (node --check par bloc puis sur la concaténation de tous les blocs : un const redéclaré entre blocs échoue en silence côté navigateur) puis smoke.js (Chromium, 0 erreur) puis les tests ; jsdom étant impossible à installer (npm 403, politique d'égress), tous les test-v1xx.js tournent via outils-v178/run-in-chromium.js.
- Ne pas lire en entier les lignes 43, 96, 98-99, 1973 et 2037 (bibliothèques, logo base64 de 109 Ko, image de 156 Ko) ; le gabarit bonDeTravail (10042-10792) n'accepte aucun backtick dans son JS embarqué ; un </script> non échappé dans une chaîne ferme le bloc ; tout texte client passe par echap().
- Aucun agent n'exécute execute_sql, apply_migration ni deploy_edge_function sur la production : le SQL est livré en fichier et c'est le patron qui l'exécute ; seules des lectures SQL sont permises à Fable en vague 0.
- Chaque lot prouve ses tests par sabotage (sabotage.sh, une seule occurrence, faute de comportement et non de syntaxe) et rapporte N attrapées sur N ; un test qui passe sur la v175 intacte est refusé.
- Le zip final est construit après git add -A : git ls-files | grep -vE '^CHANGELOG-atelier-v1([0-6][0-9]|7[0-4])\.md$' | grep -v '^outils-v178/' | zip -q -@ deploy-atelier-v178.zip, à plat avec index.html à la racine.

## 7. Finalisation (vague 2, INT)

1. F1 fusion dans l'ordre indiqué avec git merge-tree avant chaque fusion ; après chaque fusion : syntaxe.py, smoke.js, test du lot, 3 à 5 suites existantes de sa zone ; relecture par Fable des diffs de sms-entrant et rdv-confirmer, de sauvegarder, relireMachines et appliquerLigne1 (purge), de confirmerRdv et des alertes critiques.
2. F2 non-régression complète : outils-v178/run-all.sh ./index.html avec MTR_FAKE_NOW d'un mercredi (baseline 804/804 hors test-v171.js) + tous les test-v178-*.js + edge/test-sms-entrant-v172.html et v178 + edge/test-quickbooks-v160.mjs ; une 2e passe samedi simulé pour distinguer l'échec connu de test-v168b.js ; vérifier que function liveVoir( apparaît une fois et qu'aucune ancre //@@v178- ne reste dans index.html (les supprimer au dernier commit).
3. F3 passage à v178 par Fable seul : APP_VERSION (index.html:5011) de v175 à v178 et version.txt de v175 à v178 (même commit : les postes affichent le bandeau « Nouvelle version » quand version.txt est supérieur à APP_VERSION ; format imposé ^v\d+$) ; mtr-ajouter-brp.user.js déjà à 2.4 par PCS ; ne rien changer à tv.html hors la ligne de TAB, à sw.js hors SON, ni à la ligne d'historique 43.
4. F4 CHANGELOG-atelier-v178.md sur le modèle de la v175 : une section par demande avec la citation verbatim du patron, la table de non-régression et « Sabotages : N sur N attrapés », puis « À faire au déploiement » reprenant les étapes serveur ci-dessous. Y consigner : limites connues (A6 : message confirmé par la photo (soumVersRdv 16736) ; A11 : push, iOS et accusé non partagé entre postes ; A1 : TwiML tracé, pas d'API REST ; A10 : propositions envoyées avant la v178 et canal courriel restent en capacité 1 tant que rdv-confirmer n'est pas redéployé ; A5 : sauvegardes internes de Supabase et anciens sauvegarde-garage-*.json gardent la trace ; A8 : fin de session sans punch ; ordre des colonnes changé ; ordre de travail suivra arriveeLe).
5. F5 zip : git add -A puis la commande de strategie_branches ; inspecter la liste (51 fichiers de la v175 + nouveaux ; sans outils-v178/) ; grep /cadeau|comptant/i sur le contenu du zip : seules occurrences tolérées dans les deux fonctions de purge d'index.html, edge/purge-cadeau-v178.sql et le changelog v178.
6. F6 rapport final au patron : ce qui est livré, ce qui n'a PAS pu être vérifié (jsdom absent donc tests sous Chromium ; fonctions Edge exportées depuis la production non redéployées par un agent ; son iOS, commutateur silencieux et iPad réels ; calendrier à 2 techniciens sur ses vrais employés ; test-v171.js), et la liste des étapes serveur dans l'ordre.

## 8. Étapes serveur et déploiement — à faire par le patron, dans cet ordre

1. **Vérifier qui compte comme technicien pour la capacité : dans Administration > employés, le rôle et l'horaire de chacun (Danny et Jason admins, Gwendal, Johannie, Arno, Samantha et « Jason Tech » techniciens, Arvi tâche). Un employé sans rôle compte comme technicien ; un horaire vide ({}) le compte absent sauf dispo manuelle. Le nombre de blocs un mardi doit égaler la pastille « 👷 N » et le nombre réel de personnes qui travaillent sur machines.**
   - Où : Application, Administration > employés ; ou lecture seule par Fable (P4) de la ligne 4 de la table tableau
   - Quand : Avant le déploiement (idéalement dès la vague 0 : la réponse décide si le défaut admin + technicien est correct)
2. **Exécuter edge/confirmation-auto-v178.sql : alter table demandes_service add column if not exists confirmation_envoyee_le timestamptz (sans effet si elle existe déjà, ce que X3 a observé) ; le SELECT de contrôle puis le rattrapage OPTIONNEL des anciennes confirmations. Aucun index unique.**
   - Où : Supabase (projet riwamsdpynpbjfadajlz) > SQL Editor
   - Quand : Étape 1, avant les fonctions Edge et avant le site
3. **Redéployer la fonction Edge sms-entrant (nouvelle source : verrou, trace de la confirmation, adresse, capacité) avec Verify JWT DÉSACTIVÉ (Twilio n'envoie pas de JWT ; le dépôt n'a pas de config.toml, donc le réglage actuel n'est pas visible dans l'archive). Idem rdv-confirmer (lien « Réserver » des courriels) si son code exporté a été adapté, et envoyer-rappels seulement pour la variable {adresse}. Commande CLI : supabase functions deploy sms-entrant --project-ref riwamsdpynpbjfadajlz --no-verify-jwt.**
   - Où : Supabase > Edge Functions (éditeur), ou CLI, ou connecteur MCP deploy_edge_function par une personne autorisée
   - Quand : Étape 2 : AVANT le site ; sans risque pour la v175, car la capacité 1 s'applique tant que les créneaux n'ont pas la clé techs
4. **Vérifier la configuration : ouvrir https://<projet>.supabase.co/functions/v1/sms-entrant?diag (il doit répondre et contenir « v172 » et « v178 »), puis un essai réel : une demande de test sur le cellulaire du patron, répondre « 1 », vérifier qu'un seul texto arrive, que la fiche du bon affiche « ✓ envoyé » et que la ligne 🤖 apparaît une fois dans 📞 Communications.**
   - Où : Navigateur, cellulaire du patron, Twilio (Messaging logs) et l'application
   - Quand : Juste après l'étape 2, avant le site
5. **Déployer le zip deploy-atelier-v178.zip (index.html, version.txt, sw.js, tv.html modifié, mtr-ajouter-brp.user.js 2.4, nouveaux tests et changelog) : site Netlify, glisser le zip. La TV du lift se recharge d'elle-même (tv.html change) ; le service worker se met à jour au prochain chargement.**
   - Où : Netlify (atelier.mtrperformance.ca)
   - Quand : Étape 3, après les étapes 1 et 2
6. **Recharger l'application sur CHAQUE iPad, cellulaire et poste d'atelier (fermer puis rouvrir) : le bandeau « Nouvelle version » est seulement indicatif (sondage toutes les 10 min), aucun rechargement n'est forcé et un appareil resté en v175 peut le rester des jours. Sur chaque PC d'atelier : Tampermonkey > Tableau de bord > Vérifier les mises à jour des scripts, la pastille du site BRP doit afficher « MTR v2.4 » ; autoriser les pop-ups pour atelier.mtrperformance.ca. Sur iPad et cellulaire il n'y a pas de bouton « + Ajouter » (à tester).**
   - Où : Tous les appareils ; Tampermonkey sur les PC
   - Quand : Étape 4, le jour du déploiement
7. **Régler à la main le gabarit « Confirmation à la prise de rendez-vous » dans 🔔 Réglages pour y ajouter {adresse} si le patron veut l'adresse dans le texte (la base n'est pas écrasée). Texte suggéré : « Bonjour {prenom}, votre rendez-vous chez {shop} est confirmé pour le {date} à {heure} ({machine}). Adresse : {adresse}. À bientôt! ».**
   - Où : Application, 🔔 Réglages
   - Quand : Quand le patron le décide, après l'étape 4
8. **Purge des traces du cadeau : (1) confirmer par écrit que la purge est IRRÉVERSIBLE (on ne saura plus quels bons étaient payés comptant) ; (2) lancer d'abord le SELECT de lecture seule du fichier qui liste les bons ayant cadeau ET rentabilite.cadeau = true (leur revenu à 0 en Rentabilité est la seule trace visible qui subsiste ; décider de les laisser ou de les remettre « payés » avant la purge) ; (3) vérifier que tous les appareils affichent v178 ; (4) exécuter edge/purge-cadeau-v178.sql (ligne 1, ligne 12, puis delete des instantanés tableau_sauvegardes contenant « cadeau », que le client ne peut pas supprimer) ; (5) le relancer dans une semaine ; (6) supprimer à la main les anciens sauvegarde-garage-*.json téléchargés (les sauvegardes internes de Supabase ne se modifient pas et expirent).**
   - Où : Supabase > SQL Editor ; poste du patron pour les fichiers
   - Quand : Étape 5 : APRÈS que tous les appareils soient en v178 (un poste v175 qui réécrit la ligne 1 ressusciterait cadeau) ; ordre : tous les postes rechargés, un poste admin « Connecté », puis le SQL
9. **Hors v178 mais à traiter : faire tourner CRON_SECRET (sa valeur a été vue dans une sortie d'outil pendant l'analyse, elle est dans la transcription de cette session : secret des fonctions Edge, des 3 jobs pg_cron qui l'envoient en clair et de push_notifier()) ; protéger smart-api (aucune authentification, CORS *, n'importe qui avec l'URL envoie des SMS sur le compte Twilio) ; activer la RLS sur mkt_import_qb (320 contacts) ; créer un compte TV avec mtr_role = 'tv' (aucun des 13 comptes ne l'a : les politiques restrictives tv_lecture_seule_* ne servent à rien). Les triggers SQL de notifications push supplémentaires ne sont à ajouter qu'après qu'au moins un appareil a activé les alertes (push_abonnements est vide).**
   - Où : Supabase (secrets, SQL Editor, comptes) ; Fable prépare les scripts, le patron les exécute
   - Quand : Après la livraison, sans bloquer la v178

## 9. Questions ouvertes (chacune a un défaut : rien ne bloque)

- **Q1. A1 : quand un client répond « 1 » à des créneaux, reçoit-il déjà un texto de confirmation sans que personne ne fasse rien (console Twilio, Messaging logs, ou ligne sms_out « confirmation » dans communications) ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Supposer que oui : le code et le test v172 le disent, et 8 confirmations sont tracées en production. On livre la version minimale (trace rappels_envoyes + confirmation_envoyee_le + « ✓ envoyé »), sans appel REST Twilio. Si le journal Twilio montre que rien n'arrive, une phase 2 d'environ 40 min ajoute l'envoi par l'API avec repli sur la réponse directe, et une fonction SQL atomique ajouter_bt pour éviter l'écrasement concurrent de la ligne 1.
  - Impact : Détermine si le vrai défaut est l'affichage « pas envoyée » (S, environ 35 min) ou l'envoi lui-même (M, environ 75 min).
- **Q2. A1 : veux-tu aussi qu'un client qui répond « OUI » au rappel (« Répondez OUI pour confirmer ») ou qui réserve par le courriel (« Réserver », fonction rdv-confirmer) reçoive un texto de confirmation ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Non, hors lot : « OUI » en texte libre reste dans Messages reçus (aucune réservation par erreur) ; le canal courriel n'est touché que pour la capacité (A10). Y revenir après usage.
  - Impact : Évite d'ajouter un parseur de texte libre (risque de fausses confirmations) et du code sur une fonction que l'on ne maîtrise que par son export.
- **Q3. A5 : confirmer que la purge est irréversible et que les bons restent dans « Facturé » ou les archives sans badge. Les bons fermés en cadeau dont la Rentabilité a été ouverte ensuite (revenu à 0) gardent un 🎁 visible dans Rentabilité : les laisser ou les remettre « payés » ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Les laisser (aucun chiffre comptable ne change) ; lancer le SELECT de lecture seule AVANT la purge pour avoir la liste, car après elle est introuvable. Les anciens sauvegarde-garage-*.json et les sauvegardes internes de Supabase gardent la trace.
  - Impact : Seule trace visible qui subsiste ; le patron décide avant d'exécuter le SQL. Aussi : le chemin sans facture devient « → Facturé » puis « ✓ Livrée » (2 clics, 2 confirmations) ; ajouter « ✓ Livrée » sur « Prêt à facturer » coûte environ 10 min (défaut : non).
- **Q4. A6 : la photo de l'erreur n'est pas dans le zip. Est-ce bien le message « Un bon de travail existe déjà… Déplace son rendez-vous directement dans le calendrier » (soumVersRdv, index.html:16736), sur un bon créé par « → Bon de travail seulement » donc sans date ?**
  - ✅ **RÉSOLU** : la photo fournie montre exactement ce message (alerte de `soumVersRdv`, index.html:16736) par-dessus l'éditeur de détail d'une soumission. Hypothèse confirmée, CAL6 corrige le bon problème.
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Oui, hypothèse retenue (seul message qui correspond à la description). Fournir la photo avant la vague 1 si ce n'est pas le cas : une erreur différente (refus GARDE_FOU côté serveur, par exemple) changerait le lot.
  - Impact : Si le message est autre, CAL6 corrige le mauvais problème.
- **Q5. A6 : si le seul bon lié est « Prêt à facturer », « Facturé », « Assurance » ou « Commande de pièce », que fait « Ajouter au calendrier » ? Et un déplacement doit-il prévenir le client ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Message clair avec le n° du BT, sans ouvrir de créneaux ; pas de SMS au client (relève de A1) ; le rappel automatique déjà envoyé pour l'ancienne date ne repart pas pour la nouvelle.
  - Impact : Évite de ressortir un bon facturé de la facturation ; le client n'est pas averti d'un changement de date.
- **Q6. A7 : acceptes-tu un nombre de jours approximatif (« ≈ 12 jours », jamais en rouge) pour les anciens bons sans date d'arrivée enregistrée (repli sur la date de création du bon pour Sans RDV, En attente et Réparation), et que « Sans rendez-vous » et « En attente de pièce » passent du plus récent en haut au plus ancien en haut ? La colonne « À venir » garde son tri par rendez-vous.**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Oui aux deux, sans migration de données ; le compteur devient exact à mesure que les machines arrivent après la v178.
  - Impact : Sans cela, presque toutes les cartes existantes n'auraient aucun compteur et le tri serait faussé.
- **Q7. A8 : le temps restant est obligatoire à « Non, pas encore » (boutons 15 min, 30 min, 1 h, 2 h, 4 h, Journée, Autre) ? Quand les pièces arrivent, le bloc proposé au calendrier doit-il durer ce temps restant ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Oui, obligatoire, sans présélection. Oui, le bloc de reprise = temps restant estimé, et la durée d'origine est conservée dans dureeInitiale pour que la soumission et la main-d'œuvre ne soient pas faussées.
  - Impact : Détermine la durée des créneaux proposés à la reprise et la base de la soumission.
- **Q8. A9 : le volet calendrier est-il voulu dans la fiche d'une demande de service (3 choix envoyés au client) ? Faut-il aussi l'ajouter à l'écran « 📞 Prise de rendez-vous » (appel) ? Sur l'iPad de l'atelier en paysage, quel modèle (1080 px, 1112 px ou 1180 px) ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Fiche de la demande seulement ; l'écran d'appel et la reprogrammation ne sont pas touchés (phase 2 d'environ 25 min si voulu). Seuil d'affichage à droite : 1000 px, pour inclure les iPad en paysage.
  - Impact : Ajoute un lot si l'écran d'appel est aussi visé.
- **Q9. A10 : qui compte comme technicien (« 2 techniciens disponibles mardi 9 h ») ? Les administrateurs Jason et Danny comptent-ils ? Les 7 comptes (Jason Tech, Samantha, Arno…) sont-ils tous de vrais techniciens ? Sans rôle enregistré, l'app compte un employé comme technicien ; avec un horaire vide, il n'est pas compté.**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Capacité = admin + technicien, actifs, présents et compétents pour le type de machine ; le patron vérifie le nombre de blocs un mardi réel le jour de la mise en ligne (voir étape serveur 1) et ajuste rôles et horaires si besoin, plutôt que le code.
  - Impact : Si les rôles et horaires ne sont pas propres, le nombre de créneaux offerts peut exploser dès le déploiement.
- **Q10. A10 : dans la vue Semaine, les rendez-vous simultanés se placent côte à côte seulement quand ils se chevauchent (un rendez-vous seul garde toute la largeur), ou veux-tu toujours N colonnes fixes par jour ? Deux machines du même client au même rendez-vous : 2 techniciens différents ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Côte à côte seulement quand ça se chevauche (lisible sur iPad et cellulaire ; la vue Jour garde ses colonnes par technicien). Deux machines : 2 places exigées et 2 techniciens distincts assignés. Le placement manuel n'est jamais bloqué, seulement un confirm() en surcharge.
  - Impact : Les voies fixes par technicien rétréciraient les blocs à environ 28 px sur iPad.
- **Q11. A10 : le dîner : Appel rendez-vous doit-il interdire les créneaux qui traversent 12 h (« Journée complète » et « 4 heures » deviendraient impossibles) ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Non, comportement actuel conservé ; le picker des demandes garde son blocage actuel.
  - Impact : Aligner sur le picker supprimerait les rendez-vous de journée complète.
- **Q12. A11 : écran d'atelier (calque dans index.html) et employés sans droit « Demandes » ou « Communications » : doivent-ils entendre l'alarme répétée ? Un texto client traité automatiquement (OUI, STOP, choix de créneau) doit-il sonner ? Peux-tu tester sur l'iPad et le cellulaire (commutateur silencieux, app en arrière-plan, premier toucher après chargement) ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Non à l'écran d'atelier (un seul son, pas de boucle), non aux employés sans le droit, non aux textos auto-traités (seuls ceux qui restent « à traiter » sonnent). Test réel sur les appareils après la livraison : le son d'une notification push (app fermée) est choisi par le système et ne peut pas être changé.
  - Impact : Évite des alarmes sans fin sur des postes où personne ne peut agir ; les limites iOS ne se règlent pas dans le code.
- **Q13. A12 : depuis la liste, « Ouvrir en live » sur un bon Prêt à facturer, Facturé ou À venir non arrivé le remet en Réparation en cours (comportement actuel du 🔴). Garder avec confirmation ? Les cartes de « Mon écran » et la liste du scanner, qui ouvrent le live au premier toucher, sont-elles à corriger aussi ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Garder avec confirm() ; ne corriger que la nouvelle section (les autres écrans sont hors périmètre, à rediscuter après usage). Technicien non punché : pas d'accès, comme les autres sections.
  - Impact : Sans la confirmation, la liste recrée le piège qu'elle devait éviter.
- **Q14. A2 : le script Tampermonkey 2.4 doit-il être installé sur tous les PC d'atelier le jour de la v178 ? Avec l'ancien script la pastille dit « soumission » alors que la pièce va dans le BT. Un clic « + Ajouter » sur une pièce déjà reçue ou utilisée crée-t-il une nouvelle ligne à recevoir ? Les pièces BRP apparaissent aussi sur la TV du lift : OK ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Oui, publier le script avec le site et faire « Vérifier les mises à jour » sur chaque PC ; oui, nouvelle ligne non cochée avec pieceComplete remis à faux ; oui pour la TV (aucun développement).
  - Impact : Sans le script 2.4 la fonction marche quand même, seul l'affichage de la cible côté site BRP est faux.
- **Q15. Notes d'atelier (A3, A4) : une note d'appel apparaît sur la TV du lift, le BT imprimé, l'assistant IA et Facturer. Préfixe « 📞 Appel : » sans nom du client. OK ? Ordre dans Facturer : récent en premier (comme le live) ? Les notes tapées à la main sur le bon imprimé et absentes du live ne sont pas affichées dans Facturer (les afficher créait des doublons)**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Oui, préfixe sans nom ; récent en premier ; notes du bon imprimé non affichées dans Facturer (désynchro à corriger dans un lot à part).
  - Impact : Visibilité de remarques sur le client.
- **Q16. Fichiers d'essai bt089/ et bt089.zip : peux-tu les fournir ? test-v171.js (65 assertions : import de procédures et TV) ne tourne pas sans eux ; veux-tu autoriser l'accès à registry.npmjs.org (npm install jsdom) sur le poste d'exécution ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Continuer sans test-v171.js (documenté) et avec l'exécuteur Chromium comme référence. Sur ton poste, jsdom par npm reste possible pour relancer les tests.
  - Impact : Sans eux, les procédures importées et la TV n'ont pas de garde-fou pendant la v178.
- **Q17. Livrer en deux temps (voir ordre_de_valeur) ou tout en une fois ?**
  - Défaut recommandé (si tu ne réponds pas, c'est ce qui sera fait) : Une seule livraison si tout est vert vers 3 h 30 ; sinon livraison 1 sans A10 ni A2 puis livraison 2.
  - Impact : Protège la livraison si le moteur de capacité ou l'intégration prend du retard.

## 10. Risques globaux

| Risque | Mitigation |
|---|---|
| A10 menace l'objectif de rapidité : moteur de capacité (une erreur ouvre des surréservations ou ferme des journées entières), quatre lots qui le consomment, règle dupliquée au serveur (sms-entrant et rdv-confirmer, dont le code est hors dépôt), et dépendance aux rôles et horaires réels de production (non vérifiés). C'est le seul lot au-dessus de 100 minutes dans les estimations des explorateurs. | Sécurisation en cinq temps : (1) moteur isolé et testé seul en vague 0 (S0a, opus) avec une formule simple (places = techniciens capables − rendez-vous qui chevauchent) ; (2) interrupteur CAPACITE_MULTI_TECHS (faux = capacité 1 de la v175 partout) ; (3) serveur rétrocompatible : sans la clé techs, la capacité 1 s'applique ; (4) placement manuel jamais bloqué, seulement un confirm() ; (5) livraison en deux temps possible : tout sauf CALA, CALB et la partie A10 de SRV peut partir d'abord. Vérifier P4 (rôles et horaires) tôt et poser Q9 immédiatement. |
| Perte ou écrasement de données de la ligne 1 de tableau (tous les bons) : dernier écrivain gagne au niveau du bon entier ; la purge A5 touche sauvegarder, appliquerLigne1, relireMachines ; les nouvelles notes, pièces et dates écrivent aussi la ligne 1 ; sms-entrant lit-modifie-réécrit toute la ligne sans verrou. | Aucun nouveau champ écrasant ; recherche du bon par id au moment de l'écriture et relireMachines avant, comme liveAjouterNote ; purgerCadeaux idempotente qui ne touche que deux clés ; purge de la donnée reçue avant comparaison pour éviter des boucles de rendu ; garde-fous existants (tableau_garde_fou serveur, clientProtege) intacts ; verrou atomique côté serveur pour A1 ; fonction SQL ajouter_bt (phase 2) si la concurrence est constatée. |
| Conflits de fusion dans un index.html de 30 000 lignes avec des points chauds partagés (carteHTML, rafraichirVues, IIFE Demandes, liveRendre, proposerNote). | Stratégie validée par X1 : socle d'ancres pré-posées, blocs vides par lot, worktrees, fusion ordonnée prédite par merge-tree, propriété exclusive des zones, interdiction de reformater. Un lot (CAL9) rebase sur un autre (CALA) si besoin, environ 10 minutes. |
| Infrastructure de test : jsdom est impossible à installer (403) ; les tests existants tournent via un exécuteur Chromium maison (iframe, Playwright) validé sur 804 assertions mais pas sous le vrai jsdom ; test-v171.js (65 assertions) est inutilisable ; test-v168b.js échoue le week-end ; aucun test existant ne couvre les créneaux, les sons, le tri des colonnes, la fermeture d'un BT non terminé ni le userscript. | Outillage copié dans le dépôt en vague 0, baseline reproduite avant toute modification, MTR_FAKE_NOW, un test neuf par lot qui doit échouer sur la v175 et passer ensuite, sabotage obligatoire, fumée Chromium et node --check sur la concaténation des scripts ; ce qui n'est pas vérifiable (iPad réel, son iOS, mise en page) est listé et laissé au patron. |
| Déploiement et appareils en retard : aucun rechargement forcé (bandeau indicatif, sondage de 10 min) ; un iPad ou cellulaire resté en v175 réécrit la ligne 1 (peut ressusciter le cadeau et perdre un champ v178) ; les fonctions Edge se déploient séparément du zip ; verify_jwt doit rester faux pour les webhooks et les crons. | Ordre sûr : SQL, puis Edge additif (rétrocompatible avec la v175), puis site, puis rechargement de tous les appareils, puis seulement la purge SQL de A5 (relancée une semaine plus tard) ; ne jamais redéployer une fonction webhook avec la valeur par défaut verify_jwt true ; test d'essai réel après l'étape 2. |
| Dérive entre le dépôt et la production : 8 fonctions Edge déployées absentes d'edge/ (smart-api, rdv-confirmer, wix-demandes, envoyer-courriel, envoyer-marketing, soumission-accept, gerer-compte, assistant-claude) et une grande partie du SQL (tableau, garde-fou, sms_recus, demandes_service, creneaux_*, rappels_*, push_*, crons) ; hypothèses de schéma non confirmées (CHECK sur rappels_envoyes.canal, rappel_id nullable). | Export en lecture seule en vague 0 (P4) avant de coder SRV ; schémas lus par le connecteur Supabase ; deux repli prévus pour la trace de confirmation (canal 'twiml' sinon canal 'sms' sans noterReponse) ; aucune écriture de production par un agent. |
| Contrats de champs entre lots mal alignés (resteAFaire.minutes contre min, date d'arrivée, creneaux.techs capacité contre libres, dureeEstimee réécrite par reproChoisir) : bogues visibles seulement à l'intégration. | Contrats écrits dans ce plan et portés par le socle (S0a, S0b) avec leurs tests ; chaque lot consomme les helpers, ne redéfinit rien ; Fable relit les consommateurs à l'intégration. |
| Limites plateforme de A11 : le son d'une notification push est choisi par le système et ne se règle pas depuis le service worker ; iOS exige un geste avant l'audio Web et peut le couper avec le commutateur silencieux ; l'app suspendue ne répète rien ; l'accusé de réception ne se propage pas aux autres postes ; aucun appareil n'a activé les push (push_abonnements vide) ; le gain « +9 dB » promis n'est pas démontré (le compresseur change le niveau). | Ne rien promettre au patron au-delà de ce qui est mesuré ; mesure RMS dans Chromium et test réel sur ses appareils ; ligne « touche l'écran une fois pour activer le son » ; boucle bornée à 180 s, désactivable, avec muet et curseur ; alarmes limitées aux employés qui ont le droit et sont connectés. |
| Irréversibilité de A5 : la purge supprime à jamais la trace du paiement comptant (y compris les copies tableau_sauvegardes, que seul le SQL peut effacer ; les sauvegardes internes de Supabase et les .json exportés ne sont pas sous notre contrôle) ; les bons ex-cadeau avec rentabilite.cadeau true gardent un 🎁 visible. | Confirmation écrite du patron (Q3), SELECT de lecture seule avant la purge, SQL livré en fichier et exécuté par le patron seulement après le rechargement de tous les appareils, relancé une semaine plus tard ; les mouvements de stock, heures, pièces et notes sont conservés (historique de travaux). |
| Sécurité découverte hors périmètre : smart-api sans authentification, CRON_SECRET en clair dans cron.job.command et push_notifier() et visible dans la transcription de cette session, mkt_import_qb sans RLS, politiques tv_lecture_seule_* inopérantes (aucun compte avec mtr_role tv), NIP et taux horaires en clair dans la ligne 4 lisible par la TV. | Signalé au patron, hors v178 mais recommandé tout de suite (étape serveur de fin) ; Fable prépare les scripts, le patron exécute ; rotation du CRON_SECRET en priorité. |
| Charge d'agents en parallèle : 11 agents sur un seul fichier de 2,2 Mo, avec risque de lectures coûteuses des lignes énormes (1973, 2037, 96, 98-99) et d'un agent qui sort de sa zone. | Consigne commune P7 (lecture par plage, cut -c1-200), contrôle du diff stat, un seul agent par worktree, fusion séquentielle par Fable ; chaque lot rapporte ce qu'il n'a pas pu vérifier. |

## 11. Estimation et livraison en deux temps

- **Durée murale** (tout en parallèle) : ≈ **4,5 à 5,5 h**
- **Durée séquentielle** (un seul agent) : ≈ 14 h
- Estimation révisée par le critique de complétude (section 12.3, point 10) : 3 h 30 était la borne optimiste (minutes de lots sans sabotage, régression ni rapport ; S0a à 45 min ; intégration à ≈ 100 min). Réaliste : vague 0 ≈ 60 min, vague 1 ≈ 120 min (TAB et SON+ éventuel les plus longs ; chaîne A10 : S0a 45 min puis CALA 60 min), vague 2 ≈ 100 min, plus reprises. Murale : vague 0 environ 30 min, vague 1 environ 90 min (lot le plus long = SON ou TAB à 85 min ; la chaîne A10 fait socle 30 min puis CALA 60 min, soit à peu près la même durée), vague 2 environ 55 min, plus environ 30 min de marge de reprises : environ 3 h 30 réalistes, 2 h 55 si aucune reprise. Séquentielle : somme des estimations révisées des sceptiques (A1 75, A2 65, A3 55, A4 40, A5 45, A6 45, A7 40, A8 40, A9 70, A10 100 à 135, A11 95, A12 55) plus socle, préparation et intégration, soit environ 14 h. Honnêteté : ces minutes sont des minutes d'agent ; aucun test n'a pu être exécuté sous jsdom (Chromium à la place) ; l'iPad réel, le son iOS et les vrais rôles et horaires des employés restent à vérifier par le patron après le déploiement. Le goulot est A10 (moteur de capacité, quatre consommateurs, règle dupliquée au serveur) : s'il déborde, la livraison 1 peut partir sans CALA, CALB et la partie A10 de SRV.

**Ordre de valeur si on coupe :**
1. Livraison 1 (environ 2 h 15 en parallèle si on coupe A10 et A2), dans l'ordre d'importance pour l'atelier : A6 (le patron est bloqué aujourd'hui : bon déjà créé impossible à mettre au calendrier), A1 (la confirmation part déjà mais s'affiche « pas envoyée » : on en voit enfin la trace), A5 (retrait explicite et complet du cadeau : exige la coordination des étapes serveur), A7 + A8 (jours depuis l'arrivée, tri, temps restant), A12 (liste des bons actifs sans ouvrir le live), A3 (note d'appel vers le BT), A4 (notes d'atelier dans Facturer), A11 (sons plus forts).
2. Livraison 2 : A10 (blocs par technicien et capacité au serveur : plus gros gain de chiffre d'affaires mais le plus risqué ; dépend de la vérification des rôles et horaires), avec A9 (calendrier à côté des créneaux, qui bénéficie de la capacité) ; le moteur de capacité (S0a) et son interrupteur restent livrables sans risque dès la livraison 1.
3. A2 (recherche de pièce BRP) n'a de valeur qu'avec le script Tampermonkey 2.4 installé sur les PC d'atelier : à livrer avec la livraison 1 si le patron peut mettre à jour les PC le jour même, sinon avec la livraison 2.

## 12. Compléments de la vérification finale (après l'assemblage)

Trois vérifications ont été relancées après l'assemblage du plan (deux sceptiques dont le premier passage avait été
coupé, et le critique de complétude). Ce qui suit **corrige ou précise** les lots ci-dessus ; en cas de contradiction,
c'est cette section qui a le dernier mot.

### 12.1 Lot SON (A11) — périmètre réduit par défaut, corrections techniques obligatoires

Le second sceptique (angle régressions / iOS / multi-postes) a relu le vrai code et l'emporte sur plusieurs points du
lot SON tel qu'assemblé. **Décision du maître d'œuvre :**

**Périmètre par défaut de la v178 = « sons plus forts et un son distinct pour chaque alerte », réglables.** C'est la
demande verbatim. La répétition toutes les 15 s avec bandeau rouge et bouton « ✓ J'ai vu » (étape 2 du lot) n'était pas
demandée, concentre 9 des 18 corrections cumulées des deux sceptiques et touche les deux IIFE partagées avec A1, A3,
A9 et A10. Elle devient l'option **SON+**, livrée seulement si tu réponds oui à la question Q18 ci-dessous
(≈ 45 min de plus, après la fusion de COM et CAL9). Le lot SON passe de 85 à **≈ 50 min** et son risque de fusion
baisse d'autant.

Le lot SON (version par défaut) livre donc :
1. Le moteur `jouerSon(type)` + table `SONS` (9 types, motifs deux à deux distincts, ondes carrée / triangle, gain
   ≤ 0,9 sans chevauchement de notes : déjà ≥ +10 dB RMS par rapport aux sinus à 0,25 / 0,3 / 0,14 de la v175, sans
   compresseur ni risque d'écrêtage ; compresseur optionnel) + gain maître + préférences `mtr-sons-v1` (volume, muet).
2. Les 8 rebranchements d'une ligne (chat, demande, sms à traiter, appel manqué, appel entrant, rappel, pièce en
   retard, session), **tous en `jouerSon`** ; `sonNotification()`, `demSonnerie()` et `sonAcceptation()` restent
   définies comme enveloppes.
3. Le bloc de réglages `#son-boite` rempli de façon synchrone dans `pushOuvrirReglages` (curseur 20-100, « Couper les
   sons de cet appareil », une ligne ▶ Tester par type) et l'item de menu « 🔊 Alertes et sons » **sans
   `data-section`**.
4. `sw.js` : vibration par type acceptable ; **garder `requireInteraction: d.type === 'demande'`** (l'étendre à sms /
   appel empilerait des notifications collantes sur Android : tag unique par envoi dans `envoyer-push`) ; ne pas
   ajouter `silent:false`.

**Corrections techniques obligatoires (valables aussi pour SON+) :**
- **BLOQUANT — déblocage audio iPad.** Le plan prévoyait des écouteurs `pointerdown` / `touchstart` : sur écran
  tactile, ni l'un ni l'autre n'est un geste d'activation pour WebKit (seuls `click`, `touchend`, `pointerup` et
  `keydown` le sont) → l'audio ne se débloquerait plus jamais sur l'iPad, alors que la v175 (index.html:21166,
  `click` en `{once:true}`) fonctionne au premier tap. **Écouteurs persistants sur `click`, `touchend`, `pointerup`,
  `keydown`** (passifs, dans un try/catch, `sonCtx.resume().catch(() => {})`), plus `visibilitychange` pour relancer
  un contexte passé en « interrupted » après un passage en arrière-plan. Un test souris sur PC ne détecte pas ce
  bogue : test réel sur l'iPad obligatoire.
- **Jamais planifier un son sur un contexte suspendu** : `if (!sonCtx || sonCtx.state !== 'running') return false;`
  en tête de `jouerSon`, avant toute création d'oscillateur. Sinon, sur un iPad au mur jamais touché depuis le
  chargement, les sons de `verifierRappels` (28469) et de `cmdAlarmesRendre` (toutes les 60 s, 8942) s'accumulent à
  `currentTime` gelé et partent **en rafale** au premier toucher.
- **try/catch intégral** dans `sonDebloquer`, `jouerSon` et tout callback de minuterie ; `if (navigator.vibrate)`
  conservé. Dix-huit tests existants accrochent `window 'error'` et exigent zéro erreur (ex. test-v163.js clique
  `#encore-continuer` et `.encore-x`, donc traverse `sessionAvertOuvrir` ; test-v168b.js dispatch `visibilitychange`).
  En jsdom `window.AudioContext` est `undefined`. Ajouter **test-v163.js** à la liste des suites à relancer.
- `navigator.audioSession.type = 'playback'` : à essayer dans un try, mais à **observer sur l'iPad** : s'il
  fonctionne, il peut couper la musique Bluetooth de l'atelier au premier son.

**Si SON+ (répétition + bandeau + accusé) est retenu, en plus :**
- Une demande **saisie à la main** au comptoir (`#df-creer`, 27447-27465, `source: 'manuel'`) revient par le canal
  temps réel sur tous les postes, **y compris celui qui la saisit** : `if (d.source === 'manuel' || fenêtre Demandes
  ouverte) jouerSon('demande') else alerteCritique(...)`.
- **Arrêt croisé entre postes, gratuit** : les canaux `demandes-live` et `comm-live` sont abonnés avec `event: '*'` ;
  ouvrir la fiche (`lu: true`, 26713), envoyer des créneaux (27044) ou refuser (27358) produisent des UPDATE reçus
  partout. Dans le handler, après rechargement : `if (UPDATE && !demandes.some(x => x.statut === 'nouvelle' && !x.lu))
  alerteAccuser('demande')` ; idem pour `appel_manque` dans comm-live. Le plan disait à tort que l'accusé ne se
  propage pas.
- Deux onglets sur le même appareil (cas prévu par l'app) : partager l'accusé via `localStorage 'mtr-alerte-accuse'`
  + écouteur `storage` (4 lignes).
- Pas d'animation `box-shadow` infinie sur le bandeau (repaint continu 3 min sur iPad) : clignotement par `opacity`
  limité à 10 s, ou rien.
- Délais surchargeables pour les tests (`let ALERTE_PAS = 15000, ALERTE_MAX = 180000` lisibles par `window.__set`),
  jsdom n'ayant pas de fausses minuteries.

**Questions ajoutées :**
- **Q18 (A11).** Veux-tu seulement des sons plus forts et distincts (défaut), ou aussi que demandes / textos à traiter
  / appels manqués **re-sonnent toutes les 15 s avec un bandeau rouge** jusqu'à ce que quelqu'un confirme « J'ai vu » ?
  Défaut : non (option SON+, ≈ 45 min de plus).
- **Q19 (A11, si SON+).** Quand quelqu'un prend la demande sur un poste, les autres iPad / cell se taisent tout de
  suite ? Défaut : oui (l'app reçoit déjà la mise à jour).
- **Q20 (A11).** Une demande saisie à la main au comptoir sonne-t-elle sur les autres postes ? Défaut : un son
  simple, jamais sur le poste qui la saisit.

### 12.2 Lots S0b / TAB / CAL6 (A8 temps restant) — précisions du second sceptique

Le sceptique « exactitude » d'A8 a relu toutes les lignes citées (elles correspondent) et a vérifié par grep que les
seules écritures de fin de session sur `m.chrono` sont 20267, 20345, 21043, 21848 et 21874 : **il n'existe aucun autre
chemin de fermeture** (fermeture d'onglet, changement de bon, retour, Échap, clic dehors ne ferment pas le punch). Le
plan est donc complet sur les sorties. La plupart de ses corrections visaient la spécification initiale et sont déjà
absorbées par le socle S0b (helpers dans le script principal, champ unique `resteAFaire.minutes`, pas d'instantané
`travaille`, pas de pastille présélectionnée). Restent à appliquer :

- **S0b — pourquoi le script principal, précisément.** En mode non configuré (`!configOK()`, 5109-5113),
  `charger()` revient sans réseau et `afficher()` (23944, sans try/catch) s'exécute dans la microtâche qui suit la fin
  du bloc principal, **avant** l'analyse des blocs suivants : un helper qui appellerait `ordreTravailleMin` (28658)
  ou `ordreDureeTxt` (28648) ferait avorter l'IIFE de démarrage (pas d'écran de connexion). `liveDuree` (20163) est
  dans le bloc principal : c'est elle que `resteMinutesDe` utilise pour sommer les sessions.
- **TAB — tv.html:433.** `duree()` de la TV (tv.html:405-410) retourne des **millisecondes** : la copie locale du
  calcul doit convertir (`Math.round(ms / 60000)`) avant de soustraire des minutes, et n'afficher le restant que si
  `Number(m.resteAFaire.minutes) > 0` et `!m.travauxTermines` (même règle que `resteMinutesDe`).
- **TAB — saisie « Autre… ».** `Number("7,6")` vaut `NaN` et un `<input type="number">` assainit « 7,6 » en chaîne
  vide : pas de cas de test décimal ; `liveFinMinSaisie = Math.round(Number(String(v).replace(",", "."))) || 0`,
  `inputmode="numeric"`, minutes entières.
- **TAB — un affichage de plus.** L'écran du technicien (`rendreEcranTech`, 22617) et `ordrePlanifOuvrir` (29179,
  champ `odp-duree` prérempli par `ordreResteAuto`) reçoivent l'estimation via A8-3 : ajouter au test de TAB la
  vérification de la valeur du champ `odp-duree`.
- **CAL6 — estimation dépassée.** `resteMinutesDe` renvoie `null` quand l'estimation est épuisée ; en mode pièces,
  `reprogrammerOuvrir` retomberait alors sur la durée **totale** de la fiche (ex. 240 min) pour le prochain créneau.
  Règle : `r = resteMinutesDe(m)` ; si `r` est nul mais qu'une estimation existe (`m.resteAFaire.minutes > 0` et
  `!travauxTermines`), proposer **15 min** ; sinon `m.dureeRestante || m.dureeEstimee || 60` comme aujourd'hui.
  Rappel : `ordreResteMin` (28666) fait primer `m.planif.duree` (horaire posé à la main) sur toute estimation ; c'est
  voulu et inchangé.
- **Note « ⏳ Reste à faire : … »** (21871) : elle n'est relue par aucun code ; elle apparaîtra telle quelle dans les
  listes de notes d'A3 / A4 / A12 (BTA la masque si `resteAFaire` est affiché à part — déjà prévu).

**Question ajoutée :**
- **Q21 (A8).** « Fermer la session » = seulement « ⏹ Terminer ma session → ❌ Non, pas encore » ? Défaut : oui,
  question obligatoire là ; « ✕ Quitter » laisse le punch ouvert et ne demande rien ; « 👤 Changer de technicien »
  (`liveChangerTech`, 20340-20349, qui ferme le punch sans rien demander aujourd'hui) ne demande rien non plus en
  v178 : c'est une passation, le technicien suivant continue le bon et l'estimation précédente reste valable. Si tu
  veux la question aussi là : +15 min dans TAB (pastilles seulement, bouton « Passer », sans texte).

### 12.3 Critique de complétude — manques comblés (décisions du maître d'œuvre)

Le critique a relu la demande phrase par phrase contre le plan assemblé. Verdict : « à compléter ». Chaque point
ci-dessous est **intégré au plan** ; les lots concernés doivent les appliquer.

1. **A10 / CALB — créer le 2e rendez-vous à 9:00 depuis la vue Semaine (le scénario exact du patron).** La création
   en Semaine passe uniquement par le double-clic sur la piste (6662 `ondblclick=calCliquerVide`) et `calCliquerVide`
   (6705) **ignore tout clic sur un `.cal-jbloc`** ; un bloc seul couvre toute la piste : à 2 techniciens on ne
   pourrait toujours pas double-cliquer 9:00. Décision, les deux à la fois :
   - **un bloc seul n'occupe que la moitié de la piste** dès qu'il y a 2 techniciens capables ou plus et qu'il reste au
     moins une place (`k = max(k_grappe, min(2, nbTechs))` quand `rdvPlaces(...).places ≥ 1`) : la moitié libre est
     double-cliquable et **montre** qu'il reste une place ;
   - `calCliquerVide` passe dans la propriété de **CALB** (retiré de la liste « ne pas toucher ») : le retour anticipé
     sur `.cal-jbloc` ne s'applique que si `rdvPlaces(iso, heureDec, 1, {}).places < 1` ; sinon `calNouveauRdv` à
     l'heure visée.
   - Critère ajouté : « 2 techniciens, 1 bon à 9:00 : double-clic à 9:00 en Semaine ouvre le formulaire d'un 2e
     rendez-vous ; 1 seul technicien : le bloc garde toute la largeur et le double-clic sur le bloc ne fait rien ».
   - Q10 est **reformulée** en Q22 ci-dessous.
2. **A10 / CAL6 — la fenêtre de reprogrammation respecte la capacité.** `reproOccupe` (16176-16185) ne compte que les
   bons dont `m.technicien === tech` : un rendez-vous non assigné à 9:00 n'occupe personne, et la fenêtre offrirait
   9:00 à chacun des 2 techniciens (3 rendez-vous pour 2 postes). Dans `reproChercher` (boucle 16124-16131), ne garder
   un créneau que si `rdvPlaces(iso, t, duree / 60, {typeMachine: m.type, saufId: m.id}).libres.includes(e.nom)`
   (sous `CAPACITE_MULTI_TECHS` ; sinon comportement actuel). Critère : « 2 techniciens, 1 bon non assigné 9:00-10:00
   → un seul créneau 9:00 proposé ». La dépendance de CAL6 envers S0a devient réelle.
3. **A5 / FAC — traces 🎁 de la Rentabilité et deux fonctions oubliées.** `dateCadeau` et `valeurCadeau` (9568-9569)
   lisent `m.cadeau.le` et `m.cadeau.montant` : `dateCadeau(m) = dateComptaRent(m)` seulement,
   `valeurCadeau(m) = rentabilite.revenuPotentiel || 0`, `aggCadeau` ne compte que `rentCadeauRemplie(m)`. Le sort
   de la bascule 🎁 « Cadeau (offert) » (2618), du bouton 🎁 « Cadeaux » (2530) et du récap « Cadeaux offerts »
   (9573-9641) — concept **antérieur** à la v168, sans notion de paiement — est posé au patron en **Q23** ; défaut :
   garder (si « zéro 🎁 nulle part » : +25 min dans FAC, lignes 2530, 2547-2551, 2618, 9429-9641, 9723, 9832-9834,
   9881-9883, 9968-10005).
4. **A6** — Q4 est résolue (photo vue, message de `soumVersRdv` 16736 confirmé) ; la limite « photo non vue » de F4
   est remplacée par « message confirmé par la photo ». CAL6 inchangé.
5. **INT F5 / FAC — le grep « aucune trace » et les fichiers de test.** Les fichiers de test contiennent forcément
   des fixtures « cadeau » (migration à tester) et sont dans le zip. Règle corrigée : le **grep bloquant (0
   occurrence de `/cadeau|comptant/i`) ne porte que sur les fichiers servis aux utilisateurs** — `index.html` hors
   des deux fonctions de purge, `tv.html`, `procedure.html`, `sw.js`, `mtr-ajouter-brp.user.js` ; tolérés :
   `edge/purge-cadeau-v178.sql`, `CHANGELOG-atelier-v178.md`, `test-v178-fac.js`, `test-v168.js`. Le renommage de la
   fixture « Payé comptant — voir Léa » dans `edge/test-quickbooks-v160.mjs` (lignes 297 et 300 → « Note interne —
   voir Léa ») devient **obligatoire** dans FAC.
6. **SRV — `test-v178-srv.js`** consommait la sortie de `demEnvoyerCreneaux` (CALA, même vague, autre worktree). En
   vague 1, SRV teste `plageLibre` avec une **fixture figée** `{no, iso, heure, duree, techs: [...]}` documentée dans
   son rapport ; le test de contrat entre les deux est exécuté **en INT, après la fusion de CALA**, avec une fixture
   tirée d'un vrai update intercepté par `test-v178-cal-a.js`.
7. **TAB — ordre interne.** Implémenter A8-2 (écriture de `resteAFaire.minutes`) **avant** de tester A7-5 (badge
   « ⏳ Reste ~ »), ou tester A7-5 avec une fixture `{resteAFaire: {minutes, quand}}`.
8. **A7 — reste « (estimé) » sur les cartes en direct sans estimation.** Le plan refusait tout repli ; le critique
   note que `resteMinutesDe` dépend autant de l'heure courante que `ordreResteAuto`, et que sans repli **aucune carte
   n'aura de « note temps restant » le jour de la mise en ligne**. Décision (Q24, défaut oui) : sur les cartes **en
   direct seulement**, si aucune estimation n'existe, afficher en gris « ⏱ ~X (estimé) » = durée estimée − temps
   punché (`ordreResteAuto`, protégé par `typeof`), jamais en rouge, jamais sur les autres colonnes.
9. **Conflits de fusion non traités → trois paires d'ancres de plus dans le commit socle (P5) :**
   - `deconnecter` (22495-22516) : `//@@v178-SON deconnecter` en tête (après `{`) pour `alerteToutArreter()` ;
     `//@@v178-A12 deconnecter` juste avant `appliquerDroits();` (22515) pour `fermerBonsActifs()` et la remise à
     zéro de BTA.
   - `demarrerDonnees` (23940-23955) : `//@@v178-FAC demarrerDonnees` immédiatement après `await charger();` (23943)
     pour la purge ; `//@@v178-TAB demarrerDonnees` en dernière ligne, après `invMajDatalist();` (23954), pour la
     minuterie de changement de jour.
   - Canal temps réel de l'IIFE Demandes (26408-26426) : SON ne modifie **que la ligne 26412** (un seul énoncé,
     `try { jouerSon("demande") } catch (_) {}` ; avec SON+ : `alerteCritique`) et ne touche pas 26413-26416 ; CAL9
     modifie 26417 et 26423 ; `git merge-tree` avant la fusion de CAL9.
10. **Estimation révisée.** 3 h 30 était la borne optimiste : les minutes des lots n'incluaient ni les 5 à 10
    sabotages, ni les 6 à 10 suites de régression à relancer, ni le rapport ; S0a (9 critères + test de performance)
    vaut 45 min, pas 30 ; l'intégration (11 fusions × merge-tree + syntaxe + fumée + tests ≈ 4-5 min chacune, suite
    complète ×2, relecture des 4 diffs sensibles, changelog de 12 sections, zip) vaut ≈ 100 min, pas 55. **Durée
    murale réaliste : 4 h 30 à 5 h 30** (vague 0 ≈ 60 min, vague 1 ≈ 120 min, vague 2 ≈ 100 min, plus reprises).
    L'objectif « pas deux jours » reste largement tenu. Les durées des lots SON (50 min, périmètre réduit) et des
    vagues ont été mises à jour dans les sections 2 et 4.

**Questions ajoutées :**
- **Q22 (A10, remplace Q10).** En vue Semaine, quand il reste une place à 9:00 (2 techniciens, 1 rendez-vous), le
  bloc existant se réduit à une demi-piste pour laisser la place au double-clic (défaut), ou tu préfères un bouton ➕
  dans l'entête du jour qui demande l'heure ? Deux machines du même client au même rendez-vous = 2 techniciens
  distincts (défaut oui). La vue Jour garde ses colonnes par technicien.
- **Q23 (A5).** La Rentabilité garde-t-elle sa bascule 🎁 « Cadeau (offert) », son bouton 🎁 « Cadeaux » et son récap
  « Cadeaux offerts » (bon offert, revenu à 0, **aucune notion de paiement**) ? Défaut : oui, on les garde ; « zéro 🎁
  nulle part » = +25 min dans FAC.
- **Q24 (A7).** Pour un bon en direct jamais fermé « Non, pas encore » (donc sans estimation), afficher un reste
  approximatif gris « ⏱ ~X (estimé) » (durée estimée − temps punché) ? Défaut : oui, sur les cartes en direct
  seulement.

### 12.4 Résumé des questions ajoutées après vérification
Q18 (A11 répétition), Q19 (A11 arrêt croisé), Q20 (A11 demande manuelle), Q21 (A8 changer de technicien),
Q22 (A10 création du 2e rendez-vous en Semaine, remplace Q10), Q23 (A5 🎁 de la Rentabilité), Q24 (A7 reste estimé).
Toutes ont un défaut : rien ne bloque le GO.

