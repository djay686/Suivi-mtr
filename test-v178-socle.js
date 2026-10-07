// v178-S0a — Moteur de capacité des techniciens : techsCapacite, rdvIntervalles, rdvCtx, rdvPlaces, nbTechniciensDispo.
//   Une place = un technicien capable (admin ou technicien, présent, compétent) qui couvre toute la plage, moins les
//   rendez-vous qui chevauchent (tampon compris, règle stricte du picker). CAPACITE_MULTI_TECHS = false → capacité 1 (v177).
// node outils-v178/run-in-chromium.js test-v178-socle.js ./index.html     (ou, avec jsdom : node test-v178-socle.js ./index.html)
const L = require("./outils-v178/test-lib-v178.js");
const fs = require("fs");
const { ok, cp } = L;
const MARDI = "2026-10-13";      // mardi ouvert (le lundi 12 est l'Action de grâce)
const MERCREDI = "2026-10-14";
const NOEL = "2026-12-25";       // vendredi (ouvert 8-12 d'habitude), férié
const RDV = { horaire: { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null }, tampon: 15, diner: { actif: true, debut: 12, duree: 60 } };
const J = { nom: "Jason", role: "admin", actif: true }, G = { nom: "Gwendal", role: "technicien", actif: true };
const avec = (e, o) => Object.assign({}, e, o);
const bon = (id, heure, o) => Object.assign({ id, numeroBT: "BT-" + id, nom: "Spark", client: "Client " + id, statut: "avenir", echeance: MARDI, heure, dureeEstimee: 60, pieces: [] }, o || {});
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isoPlus = (iso, n) => { const d = new Date(iso + "T12:00"); d.setDate(d.getDate() + n); const p = (k) => String(k).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
// Texte exact de la v177 (commit socle) : ces fonctions sont appelées par le calendrier, l'ordre de travail, la
// reprogrammation et l'écran atelier ; S0a ne doit pas y toucher (test-v176 vérifie aussi la ligne « reception »).
const SOURCES = {
  lireDispoCell: "function lireDispoCell(e, iso) {\n  if (estFerie(iso)) return { present: false, h: null, verrou: true, source: \"ferie\" };\n  if (enVacances(e, iso)) return { present: false, h: null, verrou: true, source: \"vacances\" };\n  const jourSem = new Date(iso + \"T12:00\").getDay();\n  const horaireBase = e.horaire || rdvConfig.horaire || HORAIRE_DEFAUT;\n  const hBase = horaireBase[jourSem] || null;\n  const ov = dispoOverride[iso];\n  if (ov && Object.prototype.hasOwnProperty.call(ov, e.nom)) {\n    const v = ov[e.nom];\n    if (v === false) return { present: false, h: null, verrou: false, source: \"override\" };\n    if (Array.isArray(v)) return { present: true, h: v, verrou: false, source: \"override\" };\n    // v === true → présent aux heures de base (ou horaire atelier)\n    return { present: true, h: hBase || (rdvConfig.horaire||HORAIRE_DEFAUT)[jourSem] || [8,17], verrou: false, source: \"override\" };\n  }\n  // Pas d'override : suit l'horaire hebdomadaire\n  return { present: !!hBase, h: hBase, verrou: false, source: \"horaire\" };\n}",
  empDisponible: "function empDisponible(e, iso) { return lireDispoCell(e, iso).present; }",
  empHeuresJour: "function empHeuresJour(e, iso) { const c = lireDispoCell(e, iso); return c.present ? c.h : null; }",
  techniciensDisponibles: "function techniciensDisponibles(iso, typeMachine) {\n  if (estFerie(iso)) return [];\n  return EMPLOYES.filter(e => {\n    if (e.actif === false) return false;   // départ ou congé prolongé\n    if (roleDe(e) === \"reception\") return false;   // v176 : la réception ne compte pas dans la capacité de l'atelier (on peut quand même lui assigner un bon à la main)\n    if (!empDisponible(e, iso)) return false;\n    if (typeMachine && (e.competences||[]).length && !e.competences.includes(typeMachine)) return false;\n    return true;\n  });\n}",
  enVacances: "function enVacances(emp, iso) {\n  return (emp.vacances || []).some(v => v.debut && iso >= v.debut && (!v.fin || iso <= v.fin));\n}",
};

(async () => {
  const S = L.creerSupabase({});
  const A = await L.chargerApp({ sb: S.sb });
  // 2e instance : même fichier, interrupteur de repli à false (c'est un const : on le change dans le texte chargé)
  const lire = fs.readFileSync;
  fs.readFileSync = function (p) { const h = lire.apply(this, arguments); return /index\.html$/.test(String(p)) ? String(h).replace("const CAPACITE_MULTI_TECHS = true;", "const CAPACITE_MULTI_TECHS = false;") : h; };
  let B; try { B = await L.chargerApp({ sb: L.creerSupabase({}).sb }); } finally { fs.readFileSync = lire; }
  const w = A.w;
  const prep = (X, { employes = [J, G], machines = [], dispo = {}, rdv = RDV } = {}) => {
    X.set("rdvConfig", cp(rdv)); X.set("EMPLOYES", cp(employes)); X.set("dispoOverride", cp(dispo)); X.set("machines", cp(machines));
  };
  const P = (iso, t, d, o) => w.rdvPlaces(iso, t, d, o);
  let r;
  try {
    // ══════ 0. Les fonctions existent ══════
    ok(["techsCapacite", "rdvIntervalles", "rdvCtx", "rdvPlaces"].every(n => typeof w[n] === "function") && A.get("CAPACITE_MULTI_TECHS") === true
       && eq(A.get("ROLES_CAPACITE_RDV"), ["admin", "technicien"]), "moteur présent : techsCapacite, rdvIntervalles, rdvCtx, rdvPlaces ; CAPACITE_MULTI_TECHS = true ; rôles admin + technicien");

    // ══════ 1. Deux techniciens, un ou deux bons à 9:00 ══════
    prep(A, { machines: [bon("a", "09:00")] });
    r = P(MARDI, 9, 1);
    ok(r.places === 1 && r.capNoms.length === 2 && r.cap === 2 && r.charge === 1, "2 techniciens un mardi, 1 bon à 9:00 de 60 min : 1 place à 9:00 et capNoms = 2 (avant : 9:00 refusé)");
    ok(eq(Object.keys(r).sort(), ["cap", "capNoms", "charge", "libres", "places"]) && eq(r.capNoms, ["Jason", "Gwendal"]) && eq(r.libres, ["Jason", "Gwendal"]),
       "retour { places, libres, capNoms, cap, charge } ; un bon non assigné n'épingle personne");
    ok(eq(w.techsCapacite(MARDI), [{ nom: "Jason", debut: 9, fin: 17 }, { nom: "Gwendal", debut: 9, fin: 17 }]), "techsCapacite → [{ nom, debut, fin }] (heures de la journée de chacun)");
    prep(A, { machines: [bon("a", "09:00"), bon("b", "09:00")] });
    r = P(MARDI, 9, 1);
    ok(r.places === 0 && r.charge === 2 && r.cap === 2, "2 bons à 9:00 : places === 0");
    ok(P(MARDI, 10.25, 1).places === 2 && P(MARDI, 10, 1).places === 0, "… 10:00 encore pris (tampon 15), 10:15 : les 2 techniciens sont libres");
    ok(P(MARDI, 16.5, 1).cap === 0 && P(MARDI, 16, 1).cap === 2, "une plage qui dépasse la journée des techniciens (16:30-17:30) : cap 0 ; 16:00-17:00 : 2");
    ok(eq(P(MARDI, "10:15", 1), P(MARDI, 10.25, 1)), "départ accepté en « HH:MM » comme en heures décimales");

    // ══════ 2. Interrupteur de repli CAPACITE_MULTI_TECHS = false ══════
    prep(B, { machines: [bon("a", "09:00")] });
    r = B.w.rdvPlaces(MARDI, 9, 1);
    ok(B.get("CAPACITE_MULTI_TECHS") === false && r.places === 0 && r.cap === 1 && r.capNoms.length === 2, "CAPACITE_MULTI_TECHS = false : 1 bon à 9:00 → places === 0 (comportement v177), cap borné à 1");
    prep(B, {});
    r = B.w.rdvPlaces(MARDI, 9, 1);
    ok(r.places === 1 && r.cap === 1, "CAPACITE_MULTI_TECHS = false, journée vide avec 2 techniciens : 1 place (jamais 2)");
    prep(B, { employes: [] });
    ok(B.w.rdvPlaces(MARDI, 9, 1).cap === 0, "CAPACITE_MULTI_TECHS = false, aucun technicien : cap 0 (min(1, 0))");

    // ══════ 3. Qui compte : rôles, actif, vacances, férié, dispo du jour ══════
    prep(A, { employes: [{ nom: "Jason", actif: true }, { nom: "Arno", actif: true }, { nom: "Tâche", role: "tache", actif: true },
                         { nom: "Marie", role: "reception", actif: true }, { nom: "Parti", role: "technicien", actif: false }] });
    const noms = w.techsCapacite(MARDI).map(t => t.nom);
    ok(noms.includes("Arno") && noms.includes("Jason"), "employé sans champ role : compté (Arno → technicien ; Jason → admin, comme roleDe)");
    ok(!noms.includes("Tâche") && w.techniciensDisponibles(MARDI).some(e => e.nom === "Tâche"), "role « tache » : présent à l'atelier mais hors capacité");
    ok(!noms.includes("Marie") && !P(MARDI, 9, 1).capNoms.includes("Marie") && !w.techsCapacite(MARDI, "Motomarine").some(t => t.nom === "Marie"), "role « reception » : jamais dans techsCapacite ni capNoms");
    ok(!noms.includes("Parti"), "actif: false : exclu");
    ok(noms.length === 2 && w.nbTechniciensDispo(MARDI) === 2 && w.techniciensDisponibles(MARDI).length === 3,
       "nbTechniciensDispo = techsCapacite.length : la pastille 👷 vaut 2 (une tâche présente n'augmente pas N ; avant : 3)");
    prep(A, { employes: [avec(J, { vacances: [{ debut: MARDI, fin: MARDI }] }), avec(G, { vacances: [{ debut: "2026-10-01", fin: "2026-10-20" }] })] });
    r = P(MARDI, 9, 1);
    ok(r.cap === 0 && r.places === 0 && w.techsCapacite(MARDI).length === 0 && w.nbTechniciensDispo(MARDI) === 0, "vacances des deux techniciens : cap 0, aucune place, 👷 0");
    ok(eq(P(MERCREDI, 9, 1).capNoms, ["Jason"]), "le lendemain, Jason est revenu : capNoms = [Jason]");
    prep(A, {});
    r = P(NOEL, 8, 1);
    ok(w.techsCapacite(NOEL).length === 0 && r.cap === 0 && r.places === 0 && w.nbTechniciensDispo(NOEL) === 0, "férié (Noël 2026, un vendredi d'habitude ouvert) : cap 0");
    prep(A, { dispo: { [MARDI]: { Gwendal: [13, 17] } } });
    ok(eq(P(MARDI, 9, 1).capNoms, ["Jason"]) && P(MARDI, 13, 1).cap === 2 && P(MARDI, 12.5, 1).cap === 1, "Gwendal présent 13-17 ce jour-là : il faut couvrir TOUTE la plage (9:00 → Jason seul, 12:30 → 1, 13:00 → 2)");
    prep(A, { dispo: { [MARDI]: { Gwendal: false } } });
    ok(P(MARDI, 9, 1).cap === 1 && w.nbTechniciensDispo(MARDI) === 1, "Gwendal marqué absent ce jour-là : cap 1");

    // ══════ 4. Compétences et repli ══════
    prep(A, { employes: [J, avec(G, { competences: ["VTT"] })] });
    ok(eq(w.techsCapacite(MARDI, "Motomarine").map(t => t.nom), ["Jason"]) && P(MARDI, 9, 1, { typeMachine: "Motomarine" }).cap === 1 && P(MARDI, 9, 1, { typeMachine: "VTT" }).cap === 2,
       "compétences : Motomarine → Jason seul (Gwendal fait les VTT) ; VTT → 2");
    prep(A, { employes: [avec(J, { competences: ["VTT"] }), avec(G, { competences: ["VTT"] })] });
    ok(w.techsCapacite(MARDI, "Bateau").length === 2 && w.nbTechniciensDispo(MARDI, "Bateau") === 2 && P(MARDI, 9, 1, { typeMachine: "Bateau" }).cap === 2,
       "personne de compétent pour le type : repli sur tous les techniciens présents (comme choisirTechnicien)");

    // ══════ 5. Tampon : règle stricte (un départ à fin + tampon est libre) ══════
    const premier = (o) => { for (let t = 9; t + 1 <= 17 + 1e-9; t += 0.25) if (P(MARDI, t, 1, o).places >= 1) return t; return null; };
    prep(A, { employes: [J], machines: [bon("a", "09:00")] });
    ok(premier() === 10.25, "1 technicien, bon 9:00-10:00, tampon 15 : premier départ = 10:15");
    A.get("rdvConfig").tampon = 30;
    ok(premier() === 10.5, "tampon 30 (production) : premier départ = 10:30");
    A.get("rdvConfig").tampon = 15;
    ok(premier({ tampon: 0.5 }) === 10.5 && premier({ tampon: 0 }) === 10, "opt.tampon (en heures) remplace le réglage : 0,5 → 10:30 ; 0 → 10:00");
    prep(A, { employes: [J], machines: [bon("a", "11:00")] });
    ok(P(MARDI, 9.75, 1).places === 1 && P(MARDI, 10, 1).places === 0, "avant un bon à 11:00 : 9:45-10:45 (+ 15 = 11:00) libre, 10:00-11:00 pris");

    // ══════ 6. Bons ignorés, saufId, extra ══════
    prep(A, { employes: [J], machines: [bon("sh", ""), bon("sh2", undefined), bon("ar", "09:00", { statut: "archive" }), bon("me", "09:00", { echeance: MERCREDI })] });
    ok(P(MARDI, 9, 1).places === 1 && w.rdvIntervalles(MARDI).length === 0, "bon sans heure, bon archivé, bon d'un autre jour : ignorés");
    prep(A, { employes: [J], machines: [bon("dep", "09:00")] });
    ok(P(MARDI, 9, 1).places === 0 && P(MARDI, 9, 1, { saufId: "dep" }).places === 1 && w.rdvIntervalles(MARDI, { saufId: "dep" }).length === 0,
       "opt.saufId : le bon qu'on déplace ne bloque pas sa propre place");
    prep(A, {});
    const RET = [{ demande_id: "d1", iso: MARDI, heure: "09:00", duree_min: 60 }, { demande_id: "d2", iso: MARDI + "T00:00:00+00:00", heure: "09:30", duree_min: 30 },
                 { demande_id: "d3", iso: MERCREDI, heure: "09:00", duree_min: 60 }];
    r = P(MARDI, 9, 1, { extra: RET });
    ok(r.charge === 2 && r.places === 0 && P(MARDI, 9, 1).places === 2, "opt.extra : les créneaux retenus des autres demandes comptent (9:00 et 9:30 → 0 place ; celui du mercredi ignoré)");
    ok(P(MARDI, 9, 1, { extra: [{ debut: 9, fin: 10 }] }).places === 1, "opt.extra en heures décimales ({ debut, fin }) : compte aussi");

    // ══════ 7. Épinglés ══════
    prep(A, { machines: [bon("p", "09:00", { technicien: "Jason" })] });
    r = P(MARDI, 9, 1);
    ok(r.capNoms.includes("Jason") && !r.libres.includes("Jason") && eq(r.libres, ["Gwendal"]) && r.places === 1,
       "bon épinglé à Jason qui chevauche : Jason absent de libres mais présent dans capNoms ; 1 place (Gwendal)");
    ok(eq(P(MARDI, 10.25, 1).libres, ["Jason", "Gwendal"]), "à 10:15 (fin + tampon), Jason est de nouveau libre");

    // ══════ 8. Bon créé par le serveur (sms-entrant : sans technicien ni rdvGroupe) ══════
    const SRV = { id: "srv-1", creeLe: "2026-10-07T14:00:00.000Z", nom: "2020 Sea-Doo Spark", client: "Client Web", tel: "8195550000", courriel: "",
                  type: "Motomarine", marque: "Sea-Doo", modele: "Spark", annee: "2020", reference: "", travaux: "Hivernisation", statut: "avenir",
                  echeance: MARDI, heure: "09:00", dureeEstimee: 60, clientId: "", origine: "demande-web", demandeId: "dem-1" };
    prep(A, { machines: [SRV, Object.assign(cp(SRV), { id: "srv-2", heure: "14:00", dureeEstimee: undefined })] });
    r = P(MARDI, 9, 1);
    const iv = w.rdvIntervalles(MARDI);
    ok(r.places === 1 && r.charge === 1 && eq(r.libres, ["Jason", "Gwendal"]) && iv[0].tech === "" && iv[0].id === "srv-1" && iv[0].debut === 9 && iv[0].fin === 10,
       "bon type serveur sans technicien : prend 1 place, n'épingle personne");
    ok(iv[1].debut === 14 && iv[1].fin === 15 && P(MARDI, 14, 1).charge === 1, "bon serveur sans dureeEstimee : 60 min par défaut");

    // ══════ 9. dinerDur (picker des demandes) ══════
    prep(A, {});
    ok(P(MARDI, 11.5, 1, { dinerDur: true }).places === 0 && P(MARDI, 11.5, 1).places === 2 && P(MARDI, 11, 1, { dinerDur: true }).places === 2
       && P(MARDI, 13, 1, { dinerDur: true }).places === 2, "dinerDur : 11:30-12:30 croise le dîner → 0 ; 11:00-12:00 et 13:00 → 2 ; sans dinerDur : 2");
    A.get("rdvConfig").diner.actif = false;
    ok(P(MARDI, 11.5, 1, { dinerDur: true }).places === 2, "dîner désactivé dans les options : rien de bloqué");
    A.get("rdvConfig").diner.actif = true;

    // ══════ 10. ctx : pré-calcul par jour ══════
    const EXTRA = [{ iso: MARDI, heure: "11:00", duree_min: 60 }];
    prep(A, { machines: [bon("a", "09:00", { technicien: "Jason" }), bon("b", "13:00"), bon("c", "15:30", { dureeEstimee: 90 })] });
    const ctx = w.rdvCtx(MARDI, { extra: EXTRA });
    let pareil = true;
    for (let t = 9; t < 17; t += 0.25) for (const d of [0.5, 1, 2]) if (!eq(P(MARDI, t, d, { ctx }), P(MARDI, t, d, { extra: EXTRA }))) pareil = false;
    ok(pareil && ctx.iso === MARDI && ctx.techs.length === 2 && ctx.intervalles.length === 4, "rdvCtx : mêmes résultats qu'un calcul direct (32 départs × 3 durées)");
    ok(P(MERCREDI, 9, 1, { ctx }).charge === 0 && P(MARDI, 9, 1, { ctx, saufId: "a" }).charge === 0 && P(MARDI, 9, 1, { ctx }).charge === 1,
       "un ctx d'un autre jour est ignoré ; saufId est réappliqué au ctx");

    // ══════ 11. Fonctions pures : aucune écriture, aucun réseau ══════
    const etat = () => JSON.stringify([A.get("machines"), A.get("EMPLOYES"), A.get("dispoOverride"), A.get("rdvConfig")]);
    const ls = () => { try { return JSON.stringify(Object.assign({}, w.localStorage)); } catch (_) { return ""; } };
    const e0 = etat(), l0 = ls(), n0 = S.appels.length, f0 = A.appelsFetch.length;
    for (let t = 9; t < 17; t += 0.5) { P(MARDI, t, 1, { extra: EXTRA, dinerDur: true, typeMachine: "Motomarine", saufId: "b" }); w.techsCapacite(MARDI, "VTT"); w.rdvIntervalles(MARDI, { extra: EXTRA }); w.nbTechniciensDispo(MARDI); }
    ok(etat() === e0 && ls() === l0 && S.appels.length === n0 && A.appelsFetch.length === f0, "fonctions pures : machines, EMPLOYES, dispoOverride, rdvConfig, localStorage inchangés ; aucun appel Supabase ni fetch");

    // ══════ 12. Performance : 30 jours × 32 départs avec ctx ══════
    const EMP8 = [J, G, { nom: "Arno", role: "technicien", actif: true }, { nom: "Sam", role: "technicien", actif: true, competences: ["VTT"] },
                  { nom: "Luc", role: "technicien", actif: true, vacances: [{ debut: isoPlus(MARDI, 5), fin: isoPlus(MARDI, 9) }] },
                  { nom: "Tâche", role: "tache", actif: true }, { nom: "Marie", role: "reception", actif: true }, { nom: "Parti", role: "technicien", actif: false }];
    const gros = [];
    for (let j = 0; j < 45; j++) for (let k = 0; k < 12; k++) gros.push(bon("g" + j + "-" + k, String(9 + (k % 8)).padStart(2, "0") + (k % 2 ? ":30" : ":00"), { echeance: isoPlus(MARDI, j), technicien: k % 3 ? "" : "Arno" }));
    for (let k = 0; k < 600; k++) gros.push(bon("x" + k, "10:00", { statut: "archive", echeance: isoPlus(MARDI, k % 60 - 30) }));
    prep(A, { employes: EMP8, machines: gros });
    let total = 0;
    const t0 = w.performance.now();
    for (let j = 0; j < 30; j++) { const iso = isoPlus(MARDI, j), c = w.rdvCtx(iso, { typeMachine: "Motomarine" }); for (let k = 0; k < 32; k++) total += P(iso, 9 + k * 0.25, 1, { ctx: c }).places; }
    const ms = w.performance.now() - t0;
    ok(ms < 200 && total > 0, "performance : 30 jours × 32 départs avec ctx (" + gros.length + " bons, 8 employés) en " + ms.toFixed(1) + " ms (< 200 ms)");

    // ══════ 13. Ce qui ne doit pas bouger ══════
    ok(SOURCES && ["lireDispoCell", "empDisponible", "empHeuresJour", "techniciensDisponibles", "enVacances"].every(n => String(w[n]) === SOURCES[n]),
       "techniciensDisponibles, lireDispoCell, empDisponible, empHeuresJour, enVacances : inchangés octet pour octet (v177)");
  } catch (err) { ok(false, "exception : " + (err && err.stack || err)); }
  ok(!B || B.erreurs.length === 0, "2e instance (interrupteur à false) : aucune erreur JavaScript");
  L.fin(A);
})();
