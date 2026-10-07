// v178-CAL6 (A6) — Un bon de travail déjà créé depuis une soumission se place ou se déplace au calendrier.
//   Avant : « Un bon de travail existe déjà pour cette soumission. Déplace son rendez-vous directement dans le calendrier. »
//   (cul-de-sac). Maintenant : fenêtre de créneaux #voile-repro en mode « rdv », aucun nouveau bon, statut inchangé.
//   + plan 12.3 point 2 (la fenêtre respecte la capacité des techniciens) + plan 12.2 (estimation épuisée → 15 min).
// node outils-v178/run-in-chromium.js test-v178-a6.js ./index.html     (ou, avec jsdom : node test-v178-a6.js ./index.html)
// L'horloge de la page est fixée au mercredi 7 octobre 2026, 10 h (heure locale) : le test ne dépend pas du jour où on le lance.
const L = require("./outils-v178/test-lib-v178.js");
const fs = require("fs");
const { ok, cp, dodo } = L;
const RDV = { horaire: { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null }, tampon: 15, diner: { actif: true, debut: 12, duree: 60 } };
const J = { nom: "Jason", role: "admin", actif: true }, G = { nom: "Gwendal", role: "technicien", actif: true };
const AUJ = "2026-10-07", JEU = "2026-10-08", MAR = "2026-10-13";   // le lundi 12 est l'Action de grâce (férié)
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const horloge = (w) => {   // horloge de la page : mercredi 7 octobre 2026, 10 h ; w.__off se règle plus tard
  const D = w.Date; w.__D0 = D; w.__off = new D(2026, 9, 7, 10, 0, 0).getTime() - D.now();
  function F(...a) { if (!(this instanceof F)) return new D(D.now() + w.__off).toString(); if (a.length === 0) return new D(D.now() + w.__off); return new D(...a); }
  F.prototype = D.prototype; F.now = () => D.now() + w.__off; F.UTC = D.UTC; F.parse = D.parse; Object.setPrototypeOf(F, D); w.Date = F;
};
const bon = (id, o) => Object.assign({ id, numeroBT: "BT-" + id, nom: "Spark " + id, client: "Marc Roy", type: "Motomarine", statut: "avenir", echeance: "", heure: "", dureeEstimee: 90, pieces: [] }, o || {});
const SO = (id, o) => Object.assign({ id, numero: "SO-" + id, statut: "brouillon", clientNom: "Marc Roy", tel: "8195551234", type: "motomarine", marque: "BRP", date: AUJ,
  lignes: [{ type: "mo", desc: "Entretien", qte: 1.5, prix: 95 }], notes: "" }, o || {});
const libelle = (m) => m.numeroBT + " " + m.statut;

(async () => {
  const S = L.creerSupabase({});
  const A = await L.chargerApp({ sb: S.sb, avant: horloge });
  // 2e instance : même fichier, interrupteur de capacité à false (comportement d'avant la v178)
  const lire = fs.readFileSync;
  fs.readFileSync = function (p) { const h = lire.apply(this, arguments); return /index\.html$/.test(String(p)) ? String(h).replace("const CAPACITE_MULTI_TECHS = true;", "const CAPACITE_MULTI_TECHS = false;") : h; };
  let B; try { B = await L.chargerApp({ sb: L.creerSupabase({}).sb, avant: horloge }); } finally { fs.readFileSync = lire; }
  const w = A.w;
  await dodo(2600);   // l'app répare les totaux des soumissions 0,7 s + 2,5 s après le chargement (v157) : on attend que ce travail de fond soit fini
  const prep = (X, { employes = [J, G], machines = [], soums = [], rdv = RDV, commandes = [] } = {}) => {
    X.set("rdvConfig", cp(rdv)); X.set("EMPLOYES", cp(employes)); X.set("dispoOverride", {}); X.set("clients", []); X.set("commandes", cp(commandes));
    X.set("machines", cp(machines)); X.set("soumissions", cp(soums)); X.set("soumCourante", null);
    X.w.reprogrammerFermer(); if (X === A) S.db.tableau = [];   // le faux serveur oublie les scénarios d'avant (sauvegarder() y relit les « bons venus d'ailleurs » et les rajouterait)
    X.alertes.length = 0; X.confirmations.length = 0; X.reponseConfirm = true;
    X.w.__off = new X.w.__D0(2026, 9, 7, 10, 0, 0).getTime() - X.w.__D0.now();
  };
  const heureLocale = (X, h, min) => { X.w.__off = new X.w.__D0(2026, 9, 7, h, min, 30).getTime() - X.w.__D0.now(); };
  const M = (X, id) => X.get("machines").find(m => m.id === id);
  const SOM = (X, id) => X.get("soumissions").find(s => s.id === id);
  const ouvert = (sel) => A.$(sel).classList.contains("ouvert");
  const ecritsBons = () => S.ecrits("tableau", "upsert").filter(a => a.vals && a.vals.id === 1).length;
  const ecritsSoums = () => S.ecrits("tableau", "upsert").filter(a => a.vals && a.vals.id === 10).length;
  const choisir = (s, id) => { A.set("soumCourante", SOM(A, s)); w.soumVersRdv(); };
  const fermerTout = () => { w.reprogrammerFermer(); ["cal-page"].forEach(i => A.$("#" + i).classList.remove("ouvert")); A.$("#voile-rdv").classList.remove("ouvert", "par-dessus-cal"); };
  const instant = () => new w.Date().getTime();
  const isoL = (d) => A.get("isoLocal")(d);
  try {
    // ══════ 0. Les pièces sont là ══════
    ok(["soumBonPlacable", "soumBonsLies", "soumBonAPlacer", "soumPlacerBonExistant", "soumMajBoutonsBon", "reproChoisirMoiMeme", "reprogrammerOuvrir", "reproChercher", "reproChoisir", "reproOccupe"].every(n => typeof w[n] === "function")
       && eq(A.get("SOUM_STATUTS_NON_PLACABLES"), ["archive", "afacturer", "prete", "assurance", "commande"]) && A.get("reproMode") === "pieces",
       "fonctions présentes ; statuts non plaçables : archive, afacturer, prete, assurance, commande ; mode par défaut « pieces »");
    ok(!!A.$("#so-btn-bt") && !!A.$("#so-btn-rdv") && !!A.$("#repro-h3") && !!A.$("#repro-note") && !!A.$("#repro-depart") && !!A.$("#repro-lien-edition") && !!A.$("#repro-btn-fermer"),
       "ids ajoutés : so-btn-bt, so-btn-rdv (boutons de la soumission) ; repro-h3, repro-note, repro-depart, repro-lien-edition, repro-btn-fermer (fenêtre)");
    ok(/gestion-seul/.test(A.$("#so-vue-edit").innerHTML) && A.$$("#so-vue-edit .so-actions button.gestion-seul").length >= 3, "les boutons voisins gardent gestion-seul (v176)");
    ok(A.$("#v178-CAL6") !== null && A.$$("style#v178-CAL6").length === 1 && A.$$("script#v178-CAL6").length === 1, "blocs <style id=v178-CAL6> et <script id=v178-CAL6> en place");

    // ══════ 1. Critère 1 : bon sans date lié à une soumission → fenêtre « Placer au calendrier », aucun nouveau bon ══════
    prep(A, { machines: [bon("a", { dureeEstimee: 90 })], soums: [SO("s1", { machineId: "a" })] });
    A.get("machines")[0].soumissionId = "s1";
    const nBons = A.get("machines").length;
    choisir("s1");
    ok(A.alertes.length === 0 && A.confirmations.length === 0, "soumVersRdv sur une soumission dont le bon n'a pas de date : AUCUNE alerte (avant : « Déplace son rendez-vous… »)");
    ok(ouvert("#voile-repro") && /Placer au calendrier/.test(A.txt("#repro-h3")) && A.$("#repro-duree").value === "90", "fenêtre #voile-repro ouverte, titre « Placer au calendrier », durée = durée du BT (90)");
    ok(!ouvert("#cal-page") && !ouvert("#voile-rdv"), "le calendrier et la prise de rendez-vous ne sont PAS ouverts avant (la fenêtre, z-index 140, serait sous le calendrier, 200)");
    ok(/aucun nouveau bon ne sera créé/.test(A.txt("#repro-note")) && A.$("#repro-note").style.display !== "none" && A.$("#repro-zone-date").style.display !== "none" && A.$("#repro-lien-edition").style.display !== "none", "note « aucun nouveau bon ne sera créé », champ « À partir du » et lien « Choisir moi-même » visibles");
    ok(A.txt("#repro-btn-fermer") === "Annuler" && /Choisir la date et l'heure moi-même/.test(A.txt("#repro-lien-edition")) && A.$("#repro-depart").value === AUJ && A.$("#repro-depart").min === AUJ, "bouton du bas « Annuler » ; « À partir du » = aujourd'hui, jamais avant");
    ok(A.get("reproMode") === "rdv" && A.get("reproMachineId") === "a", "reproMode = rdv, reproMachineId = id du bon");
    // 5 jours et 4 créneaux par technicien en mode rdv
    let cr = A.get("reproCreneaux");
    const jours = [...new Set(cr.map(c => c.iso))];
    ok(jours.length === 5 && !jours.includes("2026-10-12"), "mode rdv : 5 journées proposées (jamais le férié du 12 octobre) : " + jours.join(" "));
    ok(cr.filter(c => c.iso === JEU && c.tech === "Jason").length === 4 && cr.filter(c => c.iso === JEU && c.tech === "Gwendal").length === 4, "mode rdv : 4 créneaux par technicien un jour libre (jeudi : Jason 4, Gwendal 4)");
    // Le choix : à partir du mardi 13 pour que le calendrier doive changer de semaine
    A.$("#repro-depart").value = MAR; w.reproChercher();
    cr = A.get("reproCreneaux");
    ok(cr.length > 0 && cr.every(c => c.iso >= MAR) && cr[0].iso === MAR, "« À partir du » mardi 13 : les créneaux commencent le 13");
    const c0 = cr[0], idx0 = 0;
    w.reproChoisir(idx0);
    await dodo(300);
    const a = M(A, "a");
    ok(A.get("machines").length === nBons, "reproChoisir : machines.length inchangé (aucun nouveau bon)");
    ok(a.echeance === c0.iso && a.heure === w.decimalEnHHMM(c0.debut) && a.technicien === c0.tech && a.dureeEstimee === 90, "echeance, heure, technicien, dureeEstimee posés sur le bon existant : " + a.echeance + " " + a.heure + " " + a.technicien);
    ok(a.statut === "avenir", "statut toujours « avenir » (jamais « reparation » : le travail n'est pas commencé)");
    ok(SOM(A, "s1").rdvIso === a.echeance && SOM(A, "s1").rdvHeure === a.heure && SOM(A, "s1").machineId === "a", "s.rdvIso et s.rdvHeure égaux à ceux du bon ; s.machineId inchangé");
    ok(ecritsSoums() >= 1 && S.ecrits("tableau", "upsert").filter(x => x.vals && x.vals.id === 10).pop().vals.donnees.liste.find(s => s.id === "s1").rdvIso === MAR, "la soumission est écrite au serveur avec la nouvelle date (soumSauver)");
    ok(a.dureeInitiale === undefined, "durée inchangée : dureeInitiale pas inventée (la main-d'œuvre suit toujours les changements de durée au formulaire)");
    ok(ouvert("#cal-page") && isoL(A.get("calAncre")) === MAR, "calendrier ouvert, sur la semaine du créneau (calAncre = " + isoL(A.get("calAncre")) + ")");
    ok(!ouvert("#voile-repro") && A.get("reproMode") === "pieces" && A.get("reproMachineId") === null, "fenêtre fermée, mode remis à « pieces »");
    ok(A.toasts().some(t => /Placé au calendrier/.test(t) && /BT-a/.test(t)), "toast « Placé au calendrier — BT-a … »");
    ok(A.alertes.length === 0, "aucune alerte pendant tout le parcours");
    fermerTout();

    // ══════ 2. Critère 2 : bon déjà daté → confirm avec la date ; Annuler → rien ; OK → « Déplacer le rendez-vous » ══════
    prep(A, { machines: [bon("d", { echeance: JEU, heure: "09:00", technicien: "Jason" })], soums: [SO("s2", { machineId: "d" })] });
    A.set("soumCourante", SOM(A, "s2"));
    A.reponseConfirm = false;
    const avantJson = JSON.stringify([A.get("machines"), A.get("soumissions")]), ev = ecritsBons() + ecritsSoums();
    w.soumVersRdv(); await dodo(200);
    ok(A.confirmations.length === 1 && /8 octobre/.test(A.confirmations[0]) && /09:00/.test(A.confirmations[0]) && /Le déplacer \?/.test(A.confirmations[0]) && /BT-d/.test(A.confirmations[0]), "bon daté : confirm avec le n° du bon, la date et l'heure, « Le déplacer ? »");
    ok(!ouvert("#voile-repro") && A.alertes.length === 0 && JSON.stringify([A.get("machines"), A.get("soumissions")]) === avantJson && ecritsBons() + ecritsSoums() === ev, "Annuler : fenêtre non ouverte, bon et soumission inchangés, aucune écriture");
    A.reponseConfirm = true; A.confirmations.length = 0;
    w.soumVersRdv();
    ok(A.confirmations.length === 1 && ouvert("#voile-repro") && /Déplacer le rendez-vous/.test(A.txt("#repro-h3")) && /Actuellement/.test(A.txt("#repro-note")), "OK : fenêtre « Déplacer le rendez-vous » (avec la date actuelle dans la note)");
    // déplacement effectif : statut et groupe de l'ancien rendez-vous inchangés, nouvelle date posée
    const cd = A.get("reproCreneaux").find(c => c.iso === JEU && c.debut >= 13);
    w.reproChoisir(A.get("reproCreneaux").indexOf(cd)); await dodo(200);
    ok(M(A, "d").echeance === JEU && M(A, "d").heure === w.decimalEnHHMM(cd.debut) && M(A, "d").statut === "avenir" && /Rendez-vous déplacé/.test(A.toasts().join("|")), "OK puis créneau : le bon est déplacé (même bon), toast « Rendez-vous déplacé »");
    fermerTout();

    // ══════ 3. Critère 3 : statuts non plaçables → alerte avec le n° du bon, aucune écriture ══════
    const LIB = { archive: /Archiv/, afacturer: /Prêt à facturer/, prete: /Facturé/, assurance: /Assurance/, commande: /Commande de pièce/ };
    for (const st of Object.keys(LIB)) {
      prep(A, { machines: [bon("n" + st, { statut: st, echeance: st === "archive" ? "" : JEU, heure: "09:00" })], soums: [SO("sn", { machineId: "n" + st })] });
      A.set("soumCourante", SOM(A, "sn"));
      const j0 = JSON.stringify([A.get("machines"), A.get("soumissions")]), e0 = ecritsBons() + ecritsSoums();
      w.soumVersRdv(); await dodo(120);
      ok(A.alertes.length === 1 && A.alertes[0].includes("BT-n" + st) && LIB[st].test(A.alertes[0]) && !ouvert("#voile-repro") && !ouvert("#cal-page") && A.confirmations.length === 0
         && JSON.stringify([A.get("machines"), A.get("soumissions")]) === j0 && ecritsBons() + ecritsSoums() === e0,
         "statut « " + st + " » : alerte avec le n° BT et le statut, ni fenêtre ni calendrier, aucune écriture");
    }
    // 2 bons liés, 1 archivé et 1 « avenir » : le bon actif est choisi (sans toucher au lien de la soumission vers l'archivé)
    prep(A, { machines: [bon("x1", { statut: "archive" }), bon("x2", { statut: "avenir" })], soums: [SO("s4", { machineId: "x1" })] });
    M(A, "x2").soumissionId = "s4";
    A.set("soumCourante", SOM(A, "s4")); w.soumVersRdv();
    ok(A.alertes.length === 0 && A.get("reproMachineId") === "x2" && ouvert("#voile-repro") && SOM(A, "s4").machineId === "x1", "2 bons liés (1 archivé, 1 avenir) : le bon actif x2 est placé, lien existant intact");
    ok(eq(w.soumBonsLies(SOM(A, "s4")).map(m => m.id).sort(), ["x1", "x2"]) && w.soumBonAPlacer(SOM(A, "s4")).id === "x2", "soumBonsLies : les deux ; soumBonAPlacer : x2");
    fermerTout();

    // ══════ 4. Critère 4 : soumission de la 2e machine d'une demande web (même demandeId, aucun lien) → aucun bon rattaché ══════
    prep(A, { machines: [bon("w1", { demandeId: "dem-1", echeance: JEU, heure: "09:00" })], soums: [SO("sw1", { machineId: "w1", demandeId: "dem-1" }), SO("sw2", { demandeId: "dem-1", lignes: [{ type: "mo", desc: "2e machine", qte: 1, prix: 95 }] })] });
    M(A, "w1").soumissionId = "sw1";
    ok(w.soumBonsLies(SOM(A, "sw2")).length === 0, "soumBonsLies(2e soumission, même demandeId, aucun lien) = aucun bon (pas de clause par demandeId)");
    A.set("soumCourante", SOM(A, "sw2")); w.soumVersRdv();
    ok(A.alertes.length === 0 && !ouvert("#voile-repro") && ouvert("#voile-rdv") && !M(A, "w1").echeance === false && M(A, "w1").echeance === JEU && SOM(A, "sw2").machineId === undefined,
       "soumVersRdv sur la 2e machine : AUCUN bon rattaché, flux « nouveau BT » = prise de rendez-vous (#voile-rdv) comme avant");
    fermerTout();
    // T11 : soumission sans aucun bon → #voile-rdv comme avant
    prep(A, { machines: [], soums: [SO("s0")] });
    A.set("soumCourante", SOM(A, "s0")); w.soumVersRdv();
    ok(A.alertes.length === 0 && ouvert("#voile-rdv") && !ouvert("#voile-repro") && A.$("#rdv-client-nom").value === "Marc Roy" && A.get("soumRdvLiee") === "s0", "soumission sans bon : #voile-rdv ouvert, client reporté, soumRdvLiee posé (flux d'avant inchangé)");
    fermerTout(); A.$("#voile-rdv").classList.remove("ouvert"); A.set("soumRdvLiee", null);
    // soumission sans nom de client mais avec un bon : on place quand même le bon (c'est le bon qui porte le client)
    prep(A, { machines: [bon("sc")], soums: [SO("ssc", { machineId: "sc", clientNom: "" })] });
    A.set("soumCourante", SOM(A, "ssc")); w.soumVersRdv();
    ok(A.alertes.length === 0 && ouvert("#voile-repro"), "soumission sans nom de client mais avec bon : la fenêtre s'ouvre (pas d'alerte « nom de client »)");
    fermerTout();

    // ══════ 5. Liens posés APRÈS le confirm ══════
    prep(A, { machines: [bon("l1", { echeance: JEU, heure: "10:00", soumissionId: "sl" })], soums: [SO("sl")] });   // bon → soumission seulement
    A.set("soumCourante", SOM(A, "sl")); A.reponseConfirm = false; w.soumVersRdv(); await dodo(100);
    ok(SOM(A, "sl").machineId === undefined && !ouvert("#voile-repro"), "bon trouvé par m.soumissionId, daté, Annuler : s.machineId reste vide (aucun lien posé avant le confirm)");
    A.reponseConfirm = true; w.soumVersRdv(); await dodo(100);
    ok(SOM(A, "sl").machineId === "l1" && ouvert("#voile-repro"), "… OK : s.machineId = id du bon (lien réparé)");
    fermerTout();
    prep(A, { machines: [bon("l2")], soums: [SO("sl2", { machineId: "l2" })] });   // soumission → bon seulement
    A.set("soumCourante", SOM(A, "sl2")); w.soumVersRdv(); await dodo(100);
    ok(M(A, "l2").soumissionId === "sl2", "bon trouvé par s.machineId seulement : m.soumissionId = id de la soumission (lien réparé)");
    fermerTout();
    prep(A, { machines: [bon("l3", { soumissionId: "autre" })], soums: [SO("sl3", { machineId: "l3" })] });   // lien existant : jamais remplacé
    A.set("soumCourante", SOM(A, "sl3")); w.soumVersRdv();
    ok(M(A, "l3").soumissionId === "autre", "un lien déjà posé n'est jamais remplacé");
    fermerTout();

    // ══════ 6. Groupe (rdvGroupe) : les bons plaçables suivent, les autres restent ══════
    prep(A, { machines: [
      bon("ga", { rdvGroupe: "g1", technicien: "" }), bon("gb", { rdvGroupe: "g1", statut: "sansrdv" }), bon("gc", { rdvGroupe: "g1", echeance: JEU, heure: "15:00", technicien: "Gwendal" }),
      bon("gd", { rdvGroupe: "g1", statut: "attente" }), bon("ge", { rdvGroupe: "g1", statut: "prete", echeance: AUJ, heure: "11:00" }), bon("gf", { rdvGroupe: "g1", statut: "archive", echeance: AUJ, heure: "11:00" }),
      bon("gg", { rdvGroupe: "g1", statut: "reparation", echeance: AUJ, heure: "11:00" }), bon("gh", { rdvGroupe: "g2", statut: "avenir" }) ], soums: [SO("sg", { machineId: "ga" })] });
    M(A, "ga").soumissionId = "sg";
    A.set("soumCourante", SOM(A, "sg")); w.soumVersRdv();
    ok(/même rendez-vous/.test(A.txt("#repro-note")) && /3 autres machines/.test(A.txt("#repro-note")), "note : « 3 autres machines du même rendez-vous suivent » (gb, gc, gd)");
    A.$("#repro-depart").value = MAR; w.reproChercher();
    const cg = A.get("reproCreneaux")[0];
    const avantG = cp(A.get("machines"));
    w.reproChoisir(0); await dodo(250);
    const h0 = w.decimalEnHHMM(cg.debut);
    ok(["ga", "gb", "gc", "gd"].every(id => M(A, id).echeance === cg.iso && M(A, id).heure === h0), "groupe : le bon et ses 3 bons plaçables (avenir, sansrdv, attente) ont la même date et la même heure");
    ok(M(A, "ga").statut === "avenir" && M(A, "gb").statut === "avenir" && M(A, "gc").statut === "avenir" && M(A, "gd").statut === "attente", "statuts : sansrdv → avenir ; avenir et attente gardent leur statut");
    ok(eq(M(A, "ge"), avantG.find(m => m.id === "ge")) && eq(M(A, "gf"), avantG.find(m => m.id === "gf")) && eq(M(A, "gg"), avantG.find(m => m.id === "gg")) && eq(M(A, "gh"), avantG.find(m => m.id === "gh")),
       "prete, archivé, reparation du groupe et bon d'un autre groupe : strictement inchangés");
    ok(M(A, "gc").technicien === "Gwendal" && M(A, "ga").technicien === cg.tech, "les bons du groupe gardent leur technicien ; seul le bon placé reçoit celui du créneau");
    ok(A.toasts().some(t => /\+ 3 autres machines/.test(t)), "toast : « (+ 3 autres machines du même rendez-vous) »");
    fermerTout();

    // ══════ 7. Statuts du bon placé : sansrdv → avenir ; attente et reparation gardent le leur ══════
    for (const [st, att] of [["sansrdv", "avenir"], ["attente", "attente"], ["reparation", "reparation"], ["avenir", "avenir"]]) {
      prep(A, { machines: [bon("p" + st, { statut: st, echeance: st === "reparation" ? JEU : "", heure: st === "reparation" ? "09:00" : "" })], soums: [SO("sp", { machineId: "p" + st })] });
      A.set("soumCourante", SOM(A, "sp")); w.soumVersRdv();
      w.reproChoisir(0); await dodo(60);
      ok(M(A, "p" + st).statut === att && !!M(A, "p" + st).echeance, "bon « " + st + " » placé : statut « " + att + " », date posée");
      fermerTout();
    }

    // ══════ 8. Critère 6 : aujourd'hui à 15 h → aucun créneau avant 15:15 ══════
    prep(A, { machines: [bon("h1", { dureeEstimee: 60 })], soums: [SO("sh", { machineId: "h1" })] });
    heureLocale(A, 15, 0);
    A.set("soumCourante", SOM(A, "sh")); w.soumVersRdv();
    let auj = A.get("reproCreneaux").filter(c => c.iso === AUJ);
    ok(auj.length > 0 && auj.every(c => c.debut >= 15.25) && Math.min(...auj.map(c => c.debut)) === 15.25, "aujourd'hui à 15:00 : le premier départ proposé est 15:15, aucun avant (" + auj.map(c => w.decimalEnHHMM(c.debut) + " " + c.tech).join(", ") + ")");
    A.$("#repro-duree").value = "120"; w.reproChercher();
    ok(A.get("reproCreneaux").filter(c => c.iso === AUJ).length === 0 && A.get("reproCreneaux").length > 0, "aujourd'hui à 15:00, 2 h demandées : plus rien aujourd'hui (15:15 + 2 h > 17:00), le lendemain est proposé");
    heureLocale(A, 15, 14); A.$("#repro-duree").value = "60"; w.reproChercher();
    ok(Math.min(...A.get("reproCreneaux").filter(c => c.iso === AUJ).map(c => c.debut)) === 15.25, "à 15:14 : prochain quart d'heure = 15:15");
    heureLocale(A, 8, 0); w.reproChercher();
    ok(Math.min(...A.get("reproCreneaux").filter(c => c.iso === AUJ).map(c => c.debut)) === 9, "à 8:00 : le premier départ est l'ouverture (9:00), pas 8:15");
    // « À partir du » : jamais avant aujourd'hui ; une date future décale la recherche
    A.$("#repro-depart").value = "2020-01-01"; w.reproChercher();
    ok(A.get("reproCreneaux").every(c => c.iso >= AUJ), "« À partir du » dans le passé : on part d'aujourd'hui");
    fermerTout(); A.w.__off = new A.w.__D0(2026, 9, 7, 10, 0, 0).getTime() - A.w.__D0.now();

    // ══════ 9. Mode pièces (piecesArrivees) : à l'identique ; durée = reste estimé ; estimation épuisée → 15 min (plan 12.2) ══════
    const il = (minutes) => new w.Date(instant() - minutes * 60000).toISOString();
    const ouvrePieces = async (m) => { prep(A, { machines: [m] }); await w.piecesArrivees(m.id); };
    await ouvrePieces(bon("pa", { statut: "attente", dureeEstimee: 240, dureeRestante: 45 }));
    ok(A.get("reproMode") === "pieces" && ouvert("#voile-repro") && /Pièces arrivées/.test(A.txt("#repro-h3")) && A.$("#repro-duree").value === "45", "piecesArrivees : fenêtre « Pièces arrivées », durée = dureeRestante (45)");
    ok(A.$("#repro-note").style.display === "none" && A.$("#repro-zone-date").style.display === "none" && A.$("#repro-lien-edition").style.display === "none" && /Plus tard/.test(A.txt("#repro-btn-fermer")), "zone date, note et lien cachés ; bouton « Plus tard — je place à la main »");
    ok(M(A, "pa").pieceComplete === true, "piecesArrivees : pieceComplete posé comme avant");
    const jp = [...new Set(A.get("reproCreneaux").map(c => c.iso))].length, parTech = Math.max(...Object.values(A.get("reproCreneaux").filter(c => c.iso === JEU).reduce((o, c) => (o[c.tech] = (o[c.tech] || 0) + 1, o), {})));
    ok(jp === 3 && parTech === 2, "mode pièces : 3 journées et 2 créneaux par technicien (inchangé) : " + jp + " jours, " + parTech + " max par technicien");
    const cp0 = A.get("reproCreneaux")[0];
    w.reproChoisir(0); await dodo(200);
    const pa = M(A, "pa");
    ok(pa.statut === "reparation" && pa.dureeEstimee === 45 && pa.echeance === cp0.iso && pa.technicien === cp0.tech, "reproChoisir : statut « reparation », durée du bloc = 45, date et technicien posés");
    ok(pa.dureeInitiale === 240, "durée d'origine (240) mémorisée dans dureeInitiale avant d'écrire la durée du reste");
    ok(A.get("reproMode") === "pieces" && !ouvert("#voile-repro") && !ouvert("#cal-page") && A.toasts().some(t => /^📅 Spark pa — /.test(t)), "mode remis à pieces ; calendrier non ouvert de force en mode pièces ; toast comme avant");
    // dureeInitiale : une seule fois
    A.get("machines")[0].statut = "attente"; await w.piecesArrivees("pa"); A.$("#repro-duree").value = "30"; w.reproChercher(); w.reproChoisir(0); await dodo(100);
    ok(M(A, "pa").dureeInitiale === 240 && M(A, "pa").dureeEstimee === 30, "2e reprise (30 min) : dureeInitiale reste 240 (mémorisée une seule fois)");
    // temps restant estimé (S0b)
    await ouvrePieces(bon("pb", { statut: "attente", dureeEstimee: 240, resteAFaire: { minutes: 90, quand: il(120) }, chrono: [] }));
    ok(A.$("#repro-duree").value === "90", "estimation du technicien (90 min, rien puncé depuis) : durée proposée = 90 (resteMinutesDe), pas 240");
    await ouvrePieces(bon("pc", { statut: "attente", dureeEstimee: 240, resteAFaire: { minutes: 30, quand: il(120) }, chrono: [{ debut: il(100), fin: il(40), pauses: [] }] }));
    ok(w.resteMinutesDe(M(A, "pc")) === null && A.$("#repro-duree").value === "15", "estimation épuisée (30 min estimées, 60 min puncées depuis) : 15 min, pas la durée totale de la fiche (240)");
    await ouvrePieces(bon("pd", { statut: "attente", dureeEstimee: 240, travauxTermines: true, resteAFaire: { minutes: 30, quand: il(120) } }));
    ok(A.$("#repro-duree").value === "240", "travaux terminés : pas d'estimation à respecter → durée de la fiche (240) comme avant");
    await ouvrePieces(bon("pe", { statut: "attente", dureeEstimee: 180, dureeRestante: 60 }));
    ok(A.$("#repro-duree").value === "60", "sans estimation : dureeRestante (60) comme avant");
    await ouvrePieces(bon("pf", { statut: "attente", dureeEstimee: 180 }));
    ok(A.$("#repro-duree").value === "180", "sans estimation ni dureeRestante : dureeEstimee (180) comme avant");
    await ouvrePieces(bon("pg", { statut: "attente", dureeEstimee: 0 }));
    ok(A.$("#repro-duree").value === "60", "rien du tout : 60 minutes");
    await ouvrePieces(bon("ph", { statut: "attente", dureeEstimee: 240, resteAFaire: { minutes: "1,5", quand: il(10) } }));
    ok(A.$("#repro-duree").value === "2", "estimation saisie avec une virgule (« 1,5 ») : lue comme 1,5 min, arrondie à 2 (resteMinutesDe)");
    await ouvrePieces(bon("pi", { statut: "attente", dureeEstimee: 240, resteAFaire: { minutes: "abc", quand: il(10) } }));
    ok(A.$("#repro-duree").value === "240" && A.erreurs.length === 0, "estimation illisible (« abc ») : durée de la fiche (240), jamais d'exception");
    fermerTout();

    // ══════ 10. rdvHeuresMO et rdvSyncSoumission lisent dureeInitiale || dureeEstimee ══════
    ok(w.rdvHeuresMO({ dureeInitiale: 240, dureeEstimee: 60 }) === 4 && w.rdvHeuresMO({ dureeEstimee: 90 }) === 1.5 && w.rdvHeuresMO({}) === 1, "rdvHeuresMO : dureeInitiale (240 → 4 h) avant dureeEstimee (90 → 1,5 h) ; rien → 1 h");
    prep(A, { machines: [], soums: [SO("sm", { lignes: [{ type: "mo", desc: "MO", qte: 4, prix: 95 }] })] });
    const mm = bon("mm", { soumissionId: "sm", dureeInitiale: 240, dureeEstimee: 60, echeance: JEU, heure: "09:00" });
    A.get("machines").push(mm); SOM(A, "sm").machineId = "mm";
    w.rdvSyncSoumission(mm, 120);   // le bloc est passé de 120 à 60 min : la main-d'œuvre (4 h) ne doit pas suivre
    ok(SOM(A, "sm").lignes[0].qte === 4, "rdvSyncSoumission : un bloc de reprise réduit ne fausse pas la main-d'œuvre de la soumission (4 h gardées)");
    delete mm.dureeInitiale; w.rdvSyncSoumission(mm, 120);
    ok(SOM(A, "sm").lignes[0].qte === 1, "… sans dureeInitiale elle suit la durée du bloc comme avant (1 h)");

    // ══════ 11. Critère 7 : tableau remplacé / bon retiré / double clic / créneau pris ══════
    prep(A, { machines: [bon("t1"), bon("t2", { nom: "Autre" })], soums: [SO("st", { machineId: "t1" })] });
    A.set("soumCourante", SOM(A, "st")); w.soumVersRdv();
    const ancien = M(A, "t1");
    w.appliquerLigne1(cp(A.get("machines")));   // un autre poste a réécrit le tableau : de NOUVEAUX objets
    const nouveau = M(A, "t1");
    ok(nouveau !== ancien && ouvert("#voile-repro"), "tableau remplacé (appliquerLigne1) pendant la fenêtre : nouveaux objets, fenêtre toujours ouverte");
    const ct = A.get("reproCreneaux")[0];
    w.reproChoisir(0); await dodo(250);
    ok(M(A, "t1") === nouveau && nouveau.echeance === ct.iso && nouveau.technicien === ct.tech && !ancien.echeance, "la date part sur le NOUVEL objet (retrouvé par id), pas sur l'ancien");
    fermerTout();
    // bon retiré
    prep(A, { machines: [bon("r1"), bon("r2")], soums: [SO("sr", { machineId: "r1" })] });
    A.set("soumCourante", SOM(A, "sr")); w.soumVersRdv(); await dodo(400);   // (les liens réparés partent au serveur : on attend avant l'instantané)
    A.set("machines", A.get("machines").filter(m => m.id !== "r1"));
    const jr = JSON.stringify([A.get("machines"), A.get("soumissions")]), er = ecritsBons() + ecritsSoums();
    w.reproChoisir(0); await dodo(250);
    ok(!ouvert("#voile-repro") && A.toasts().some(t => /n'existe plus/.test(t)) && JSON.stringify([A.get("machines"), A.get("soumissions")]) === jr && ecritsBons() + ecritsSoums() === er && !ouvert("#cal-page"),
       "bon retiré pendant la fenêtre : fenêtre fermée, toast « n'existe plus », AUCUNE écriture, calendrier non ouvert");
    // double clic
    prep(A, { machines: [bon("q1")], soums: [SO("sq", { machineId: "q1" })] });
    A.set("soumCourante", SOM(A, "sq")); w.soumVersRdv();
    await dodo(400);
    w.reproChoisir(0); await dodo(500);   // 1er clic : le bon est placé, ses écritures partent
    const apres1 = JSON.stringify([A.get("machines"), A.get("soumissions")]), nt = A.toasts().length, ew = ecritsBons() + ecritsSoums();
    w.reproChoisir(0); await dodo(500);   // 2e clic (double clic) : rien
    ok(!!M(A, "q1").echeance && JSON.stringify([A.get("machines"), A.get("soumissions")]) === apres1 && A.toasts().length === nt && ecritsBons() + ecritsSoums() === ew && A.alertes.length === 0,
       "double clic sur un créneau : UN seul changement (le 2e clic ne change rien, ne dit rien, n'écrit rien)");
    fermerTout();
    // créneau pris entre l'ouverture et le clic (un autre poste vient de le prendre)
    prep(A, { machines: [bon("k1"), bon("k2")], soums: [SO("sk", { machineId: "k1" })] });
    A.set("soumCourante", SOM(A, "sk")); w.soumVersRdv(); await dodo(400);
    const ck = A.get("reproCreneaux")[0];
    Object.assign(M(A, "k2"), { echeance: ck.iso, heure: w.decimalEnHHMM(ck.debut), technicien: ck.tech, dureeEstimee: 90 });
    const ek = ecritsBons();
    w.reproChoisir(0); await dodo(200);
    ok(!M(A, "k1").echeance && ouvert("#voile-repro") && ecritsBons() === ek && A.toasts().some(t => /vient d'être pris/.test(t)), "créneau pris entre l'ouverture et le clic : refusé (toast), le bon n'est pas placé, la fenêtre reste ouverte");
    ok(!A.get("reproCreneaux").some(c => c.iso === ck.iso && c.debut === ck.debut && c.tech === ck.tech), "… et la liste est recalculée (le créneau pris n'y est plus)");
    fermerTout();

    // ══════ 12. Boutons de la soumission selon l'état (soumMajBoutonsBon) ══════
    const bt = () => A.$("#so-btn-bt"), rd = () => A.$("#so-btn-rdv");
    prep(A, { machines: [], soums: [SO("sb")] });
    w.soumOuvrir("sb");
    ok(/Ajouter le rendez-vous au calendrier/.test(rd().textContent) && bt().disabled === false && /Bon de travail seulement/.test(bt().textContent), "soumission sans bon : libellés d'origine, « → Bon de travail seulement » actif");
    prep(A, { machines: [bon("u1")], soums: [SO("sb", { machineId: "u1" })] });
    w.soumOuvrir("sb");
    ok(/^📅 Placer BT-u1 au calendrier$/.test(rd().textContent.trim()) && bt().disabled === true, "bon sans date : « 📅 Placer BT-u1 au calendrier » et « → Bon de travail seulement » grisé");
    prep(A, { machines: [bon("u2", { echeance: JEU, heure: "09:00" })], soums: [SO("sb", { machineId: "u2" })] });
    w.soumOuvrir("sb");
    ok(/^📅 Déplacer le rendez-vous$/.test(rd().textContent.trim()) && bt().disabled === true, "bon daté : « 📅 Déplacer le rendez-vous », « → Bon de travail seulement » grisé");
    prep(A, { machines: [bon("u3", { statut: "prete", echeance: JEU, heure: "09:00" })], soums: [SO("sb", { machineId: "u3" })] });
    w.soumOuvrir("sb");
    ok(/Ajouter le rendez-vous au calendrier/.test(rd().textContent) && bt().disabled === false, "seul bon lié « Facturé » : libellés d'origine, le clic produira l'alerte claire");
    prep(A, { machines: [bon("u4", { statut: "archive" }), bon("u5", { soumissionId: "sb" })], soums: [SO("sb", { machineId: "u4" })] });
    w.soumOuvrir("sb");
    ok(/Placer BT-u5 au calendrier/.test(rd().textContent) && bt().disabled === true, "2 bons liés (archivé + avenir) : le bouton parle du bon actif (BT-u5)");
    A.set("soumCourante", null);
    let sansErreur = true; try { w.soumMajBoutonsBon(); } catch (e) { sansErreur = false; }
    ok(sansErreur && /Ajouter le rendez-vous au calendrier/.test(rd().textContent) && bt().disabled === false, "soumMajBoutonsBon avec soumCourante nulle : sans exception, libellés d'origine");
    // après le placement, le bouton passe à « Déplacer »
    prep(A, { machines: [bon("u6")], soums: [SO("sb", { machineId: "u6" })] });
    w.soumOuvrir("sb"); w.soumVersRdv(); w.reproChoisir(0); await dodo(100);
    ok(/Déplacer le rendez-vous/.test(rd().textContent), "après le placement : le bouton devient « 📅 Déplacer le rendez-vous »");
    fermerTout();

    // ══════ 13. soumVersBonTravail : message clair, aucun doublon ══════
    prep(A, { machines: [bon("v1", { numeroBT: "BT-123" })], soums: [SO("sv", { machineId: "v1" })] });
    A.set("soumCourante", SOM(A, "sv")); w.soumVersBonTravail();
    ok(A.alertes.length === 1 && /Un bon de travail existe déjà pour cette soumission \(BT-123\)/.test(A.alertes[0]) && /Placer au calendrier/.test(A.alertes[0]) && A.get("machines").length === 1 && A.confirmations.length === 0,
       "soumVersBonTravail avec un bon plaçable : « … existe déjà pour cette soumission (BT-123). Utilise « 📅 Placer au calendrier »… », aucun doublon");
    prep(A, { machines: [bon("v2", { numeroBT: "BT-124", statut: "prete" })], soums: [SO("sv", { machineId: "v2" })] });
    A.set("soumCourante", SOM(A, "sv")); w.soumVersBonTravail();
    ok(A.alertes.length === 1 && /\(BT-124\)/.test(A.alertes[0]) && !/Placer au calendrier/.test(A.alertes[0]) && A.get("machines").length === 1, "bon Facturé : même message mais sans inviter à le placer au calendrier");
    prep(A, { machines: [], soums: [SO("sv")] });
    A.set("soumCourante", SOM(A, "sv")); A.reponseConfirm = false; w.soumVersBonTravail();
    ok(A.alertes.length === 0 && A.confirmations.length === 1 && /Créer un bon de travail/.test(A.confirmations[0]), "soumission sans bon : le flux « → Bon de travail seulement » demande toujours confirmation (inchangé)");

    // ══════ 14. 12.3 point 2 : la fenêtre respecte la capacité (2 techniciens, 1 bon non assigné 9:00-10:00 → UN seul créneau 9:00) ══════
    const neuf = (X, cible) => X.get("reproCreneaux").filter(c => c.iso === cible && c.debut === 9);
    const fen = (X, mach) => { prep(X, { machines: mach }); X.w.reprogrammerOuvrir(X.get("machines").find(m => m.id === "cap"), { mode: "rdv", minutes: 60 }); X.$("#repro-depart").value = JEU; X.w.reproChercher(); };
    fen(A, [bon("cap", { dureeEstimee: 60 })]);
    ok(neuf(A, JEU).length === 2 && eq(neuf(A, JEU).map(c => c.tech).sort(), ["Gwendal", "Jason"]), "jeudi libre : 9:00 offert aux 2 techniciens (2 places)");
    fen(A, [bon("cap", { dureeEstimee: 60 }), bon("nonass", { echeance: JEU, heure: "09:00", dureeEstimee: 60 })]);
    ok(neuf(A, JEU).length === 1, "2 techniciens, 1 bon NON ASSIGNÉ 9:00-10:00 : un seul créneau 9:00 proposé (avant : 2, donc 3 rendez-vous pour 2 postes) : " + neuf(A, JEU).map(c => c.tech).join());
    fen(A, [bon("cap", { dureeEstimee: 60 }), bon("ass", { echeance: JEU, heure: "09:00", dureeEstimee: 60, technicien: "Jason" })]);
    ok(eq(neuf(A, JEU).map(c => c.tech), ["Gwendal"]), "bon assigné à Jason à 9:00 : 9:00 proposé à Gwendal seulement");
    fen(A, [bon("cap", { dureeEstimee: 60 }), bon("n1", { echeance: JEU, heure: "09:00", dureeEstimee: 60 }), bon("n2", { echeance: JEU, heure: "09:00", dureeEstimee: 60 })]);
    ok(neuf(A, JEU).length === 0, "2 bons non assignés à 9:00 : plus aucune place à 9:00");
    fen(A, [bon("cap", { dureeEstimee: 60, echeance: JEU, heure: "09:00" })]);
    ok(neuf(A, JEU).length === 2, "le bon qu'on déplace n'occupe pas sa propre place (saufId)");
    // pièces arrivées : même règle
    prep(A, { machines: [bon("cap", { statut: "attente", dureeEstimee: 60 }), bon("nonass", { echeance: AUJ, heure: "10:15", dureeEstimee: 60 })] });
    await w.piecesArrivees("cap");
    ok(A.get("reproCreneaux").filter(c => c.iso === AUJ && c.debut === 10.25).length === 1, "mode pièces : même filtre de capacité (un seul 10:15 aujourd'hui avec 1 bon non assigné à 10:15)");
    fermerTout();
    // interrupteur de repli : comportement d'avant
    fen(B, [bon("cap", { dureeEstimee: 60 }), bon("nonass", { echeance: JEU, heure: "09:00", dureeEstimee: 60 })]);
    ok(B.get("CAPACITE_MULTI_TECHS") === false && neuf(B, JEU).length === 2, "CAPACITE_MULTI_TECHS = false : comportement d'avant (le bon non assigné n'occupe personne : 2 créneaux à 9:00)");
    B.w.reprogrammerFermer();

    // ══════ 15. Lien « Choisir moi-même », bouton « Annuler », samedi en vue « travail » ══════
    prep(A, { machines: [bon("e1")], soums: [SO("se", { machineId: "e1" })] });
    A.set("soumCourante", SOM(A, "se")); w.soumVersRdv();
    w.reproChoisirMoiMeme();
    ok(!ouvert("#voile-repro") && A.get("idEdition") === "e1" && ouvert("#voile") && A.$("#voile").classList.contains("par-dessus-cal") && A.get("reproMode") === "pieces", "« ✏️ Choisir la date et l'heure moi-même » : fenêtre fermée, formulaire du bon (ouvrirEdition) ouvert par-dessus la soumission");
    w.fermerFormulaire();
    ok(!A.$("#voile").classList.contains("par-dessus-cal"), "fermerFormulaire retire par-dessus-cal");
    prep(A, { machines: [bon("e2")], soums: [SO("se2", { machineId: "e2" })] });
    A.set("soumCourante", SOM(A, "se2")); w.soumVersRdv();
    const j2 = JSON.stringify(A.get("machines")); A.$("#repro-btn-fermer").click();
    ok(!ouvert("#voile-repro") && JSON.stringify(A.get("machines")) === j2 && A.get("reproMode") === "pieces", "bouton « Annuler » : fenêtre fermée, rien n'a changé");
    A.set("machines", A.get("machines").filter(m => m.id !== "e2")); A.set("soumCourante", SOM(A, "se2")); w.soumVersRdv();
    ok(!ouvert("#voile-repro"), "(bon disparu : soumVersRdv ne rouvre plus la fenêtre de ce bon — soumission sans bon valide → flux « nouveau BT »)");
    fermerTout(); A.$("#voile-rdv").classList.remove("ouvert");
    // samedi : la vue « travail » (lundi-vendredi) ne le montrerait pas → vue « semaine »
    prep(A, { machines: [bon("sa")], soums: [SO("ssa", { machineId: "sa" })], rdv: Object.assign({}, RDV, { horaire: Object.assign({}, RDV.horaire, { 6: [9, 12] }) }) });
    w.calVue("travail");
    A.set("soumCourante", SOM(A, "ssa")); w.soumVersRdv();
    A.$("#repro-depart").value = "2026-10-10"; w.reproChercher();
    const csam = A.get("reproCreneaux")[0];
    w.reproChoisir(0); await dodo(100);
    ok(csam.iso === "2026-10-10" && M(A, "sa").echeance === "2026-10-10" && ouvert("#cal-page") && A.get("calVueActuelle") === "semaine" && A.$("#calv-semaine").classList.contains("actif"), "créneau un samedi en vue « travail » : le calendrier passe en vue « semaine »");
    w.calVue("travail"); fermerTout();
    prep(A, { machines: [bon("sb2")], soums: [SO("ssb2", { machineId: "sb2" })] });
    w.calVue("travail"); A.set("soumCourante", SOM(A, "ssb2")); w.soumVersRdv(); A.$("#repro-depart").value = MAR; w.reproChercher(); w.reproChoisir(0); await dodo(100);
    ok(A.get("calVueActuelle") === "travail" && isoL(A.get("calAncre")) === MAR, "créneau un jour de semaine : la vue « travail » reste");
    fermerTout();

    // ══════ 16. Rôle : une soumission d'un autre client / bon d'un autre ne se mélange pas ══════
    prep(A, { machines: [bon("m1", { client: "Paul" }), bon("m2", { client: "Marc" })], soums: [SO("sm1", { machineId: "m1" }), SO("sm2", { machineId: "m2" })] });
    A.set("soumCourante", SOM(A, "sm2")); w.soumVersRdv();
    ok(A.get("reproMachineId") === "m2" && A.txt("#repro-client") === "Marc", "chaque soumission place SON bon (m2, client Marc)");
    fermerTout();

    L.fin(A);
  } catch (e) { console.log("❌ exception : " + (e && e.stack || e)); process.exitCode = 1; process.exit(); }
})();
