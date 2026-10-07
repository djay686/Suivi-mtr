// v178-CALA — A10 côté poste : créneaux proposés selon le nombre de techniciens (Appel rendez-vous et fiche d'une demande),
//   assignation sans doublon (machines d'un même rendez-vous), avertissement non bloquant à la réservation, et instantané de
//   capacité envoyé au serveur (demandes_service.creneaux[].techs = TOUS les techniciens capables, pas les libres).
// node outils-v178/run-in-chromium.js test-v178-cal-a.js ./index.html     (ou, avec jsdom : node test-v178-cal-a.js ./index.html)
const L = require("./outils-v178/test-lib-v178.js");
const fs = require("fs");
const { ok, cp, dodo } = L;
const MARDI = "2026-10-13";      // mardi ouvert (le lundi 12 est l'Action de grâce)
const MERCREDI = "2026-10-14";
const LUNDI = "2026-10-19";      // lundi ouvert, vide
const RDV = { horaire: { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null }, tampon: 15, diner: { actif: true, debut: 12, duree: 60 } };
const J = { nom: "Jason", role: "admin", actif: true }, G = { nom: "Gwendal", role: "technicien", actif: true };
const avec = (e, o) => Object.assign({}, e, o);
const bon = (id, heure, o) => Object.assign({ id, numeroBT: "BT-" + id, nom: "Spark", client: "Client " + id, statut: "avenir", echeance: MARDI, heure, dureeEstimee: 60, pieces: [] }, o || {});
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const EXTRA1 = [{ nom: "2019 BRP Outlander", type: "VTT", marque: "BRP", modele: "Outlander", modeleId: "", annee: "2019", serie: "", description: "", numModele: "" }];
const smartApi = async (u) => (/smart-api/.test(u) ? { status: 200, data: { ok: true } } : null);

(async () => {
  const S = L.creerSupabase({});
  const A = await L.chargerApp({ sb: S.sb, fetch: smartApi });
  L.connecter(A, "Jason", [J, G]);
  // 2e instance : même fichier, interrupteur de repli à false (c'est un const : on le change dans le texte chargé)
  const lire = fs.readFileSync;
  fs.readFileSync = function (p) { const h = lire.apply(this, arguments); return /index\.html$/.test(String(p)) ? String(h).replace("const CAPACITE_MULTI_TECHS = true;", "const CAPACITE_MULTI_TECHS = false;") : h; };
  const SB = L.creerSupabase({});
  let B; try { B = await L.chargerApp({ sb: SB.sb, fetch: smartApi }); } finally { fs.readFileSync = lire; }
  L.connecter(B, "Jason", [J, G]);
  const w = A.w;
  const prep = (X, SX, { employes = [J, G], machines = [], dispo = {}, rdv = RDV } = {}) => {
    X.set("rdvConfig", cp(rdv)); X.set("EMPLOYES", cp(employes)); X.set("dispoOverride", cp(dispo)); X.set("machines", cp(machines));
    SX.db.tableau = [];   // la ligne 1 « serveur » repart vide : sauvegarder() n'y repêche pas les bons d'un scénario précédent
  };
  // Appel rendez-vous : formulaire rempli, puis « 🔎 Proposer des créneaux »
  const ouvrirRdv = (X, { type = "Motomarine", duree = 60, depart = MARDI, extra = [], nom = "Client Test" } = {}) => {
    X.w.ouvrirAppelRdv();
    X.set("rdvConfig", cp(RDV));
    X.$("#rdv-client-nom").value = nom; X.$("#rdv-tel").value = "";
    X.w.genererGrilleMachineRdv({ type, marque: "BRP", modele: "Spark", annee: "2020", serie: "" });
    X.$("#rdv-duree").value = String(duree);
    X.$("#rdv-depart").value = depart;
    X.$("#rdv-auto-assign").checked = true;
    X.set("rdvMachinesExtra", cp(extra));
  };
  const sugg = (X) => {
    X.w.genererSuggestionsRdv();
    return X.$$("#rdv-suggestions .rdv-creneau").map(el => {
      const m = /confirmerRdv\('([\d-]+)', ([\d.]+)\)/.exec(el.querySelector("button").getAttribute("onclick") || "") || [];
      return { iso: m[1], debut: Number(m[2]), heure: X.txt(el.querySelector(".cr-heure")), sous: X.txt(el.querySelector(".cr-sous")) };
    });
  };
  const vide = (X) => X.txt("#rdv-suggestions .rdv-sugg-vide");
  const nouveaux = (X, client) => X.get("machines").filter(m => m.client === client);
  let s, r;
  try {
    // ══════ 1. Appel rendez-vous : le nombre de techniciens compte ══════
    prep(A, S, { machines: [bon("a", "09:00")] });
    ouvrirRdv(A);
    s = sugg(A);
    ok(s.length === 6 && s[0].iso === MARDI && s[0].debut === 9 && /9h\s*–\s*10h/.test(s[0].heure),
       "2 techniciens, 1 bon à 9:00 : Appel rendez-vous propose 9h – 10h le jour même (avant : 10h15) — " + (s[0] && s[0].iso + " " + s[0].heure));
    ok(s.every((x, i) => i === 0 || x.iso > s[i - 1].iso), "toujours un seul créneau par jour, 6 propositions");
    prep(A, S, { employes: [J], machines: [bon("a", "09:00")] });
    ouvrirRdv(A);
    s = sugg(A);
    ok(s[0] && s[0].iso === MARDI && s[0].debut === 10.25 && /10h15/.test(s[0].heure), "1 seul technicien : 1re proposition 10h15 (tampon 15 ; non-régression)");
    prep(A, S, { machines: [bon("a", "09:00"), bon("b", "09:00")] });
    ouvrirRdv(A);
    s = sugg(A);
    ok(s[0] && s[0].iso === MARDI && s[0].debut === 10.25, "2 techniciens, 2 bons à 9:00 : 9h refusé, 1re proposition 10h15");
    prep(A, S, { machines: [] });
    ouvrirRdv(A);
    s = sugg(A);
    ok(s[0] && s[0].debut === 9 && /2 places · Jason, Gwendal/.test(s[0].sous), "journée vide, 2 techniciens : « 2 places · Jason, Gwendal » sous le créneau — " + (s[0] && s[0].sous));
    prep(A, S, { machines: [bon("a", "09:00", { technicien: "Jason" })] });
    ouvrirRdv(A);
    s = sugg(A);
    ok(s[0] && s[0].debut === 9 && !/places/.test(s[0].sous), "une seule place restante : pas de « N places » (affiché seulement quand places > 1)");
    // compétences : le type de machine du formulaire est lu
    prep(A, S, { employes: [avec(J, { competences: ["VTT"] }), G], machines: [bon("a", "09:00")] });
    ouvrirRdv(A, { type: "Motomarine" });
    const sMoto = sugg(A);
    ouvrirRdv(A, { type: "VTT" });
    const sVtt = sugg(A);
    ok(sMoto[0] && sMoto[0].debut === 10.25 && sVtt[0] && sVtt[0].debut === 9,
       "type de machine lu : Motomarine (Gwendal seul compétent) → 10h15 ; VTT (Jason et Gwendal) → 9h");

    // ══════ 2. Jour sans technicien ══════
    prep(A, S, { employes: [] });
    ouvrirRdv(A);
    s = sugg(A);
    ok(s.length === 0 && /Aucun technicien disponible/.test(vide(A)), "aucun technicien : « Aucun technicien disponible… » (avant : des créneaux quand même) — " + vide(A).slice(0, 70));
    prep(A, S, { employes: [{ nom: "Arvi", role: "tache", actif: true }, { nom: "Marie", role: "reception", actif: true }] });
    ouvrirRdv(A);
    ok(sugg(A).length === 0 && /Aucun technicien disponible/.test(vide(A)), "employés « tache » et « reception » seulement : aucun technicien, aucun créneau");
    prep(A, S, { employes: [avec(J, { vacances: [{ debut: MARDI, fin: MARDI }] })] });
    ouvrirRdv(A);
    s = sugg(A);
    ok(s[0] && s[0].iso === MERCREDI && s[0].debut === 9, "le seul technicien est en vacances mardi : 1re proposition mercredi 9h (mardi sauté)");

    // ══════ 3. « Journée complète » (480 min) reste proposable (pas de dîner bloquant ici) ══════
    prep(A, S, {});
    ouvrirRdv(A, { duree: 480, depart: LUNDI });
    s = sugg(A);
    ok([...A.$("#rdv-duree").options].some(o => o.value === "480") && s[0] && s[0].iso === LUNDI && s[0].debut === 9 && /9h\s*–\s*17h/.test(s[0].heure),
       "« Journée complète » 480 min : 9h – 17h proposé un lundi vide");
    ouvrirRdv(A, { duree: 240, depart: LUNDI });
    s = sugg(A);
    ok(s[0] && s[0].iso === LUNDI && s[0].debut === 9, "« 4 heures » : 9h proposé (traverse le dîner, comme avant)");

    // ══════ 4. Plusieurs machines au même rendez-vous ══════
    prep(A, S, { machines: [] });
    ouvrirRdv(A, { extra: EXTRA1 });
    s = sugg(A);
    ok(s[0] && s[0].iso === MARDI && s[0].debut === 9, "2 machines, 2 techniciens, journée vide : 9h proposé (2 places)");
    prep(A, S, { machines: [bon("a", "09:00")] });
    ouvrirRdv(A, { extra: EXTRA1 });
    s = sugg(A);
    ok(s[0] && s[0].iso === MARDI && s[0].debut === 10.25, "2 machines, 2 techniciens, 1 bon à 9:00 : 9h refusé (1 place pour 2 machines) → 10h15");
    prep(A, S, { employes: [J] });
    ouvrirRdv(A, { extra: EXTRA1 });
    s = sugg(A);
    ok(s.length === 0 && /2 techniciens libres/.test(vide(A)), "2 machines, 1 seul technicien : aucune proposition (« Il faut 2 techniciens libres… »)");
    // confirmation : 2 bons, 2 techniciens DISTINCTS
    prep(A, S, { machines: [] });
    ouvrirRdv(A, { extra: EXTRA1, nom: "Groupe Deux" });
    A.confirmations.length = 0;
    w.confirmerRdv(MARDI, 9); await dodo(60);
    let g = nouveaux(A, "Groupe Deux");
    ok(g.length === 2 && g[0].rdvGroupe && g[0].rdvGroupe === g[1].rdvGroupe && eq(g.map(m => m.technicien).sort(), ["Gwendal", "Jason"]),
       "2 machines, 2 techniciens : 2 bons du même groupe, techniciens DISTINCTS — " + g.map(m => m.nom + "→" + m.technicien).join(", "));
    ok(A.get("machines")[0] === g[0] && g[0].nom !== "2019 BRP Outlander" && g[1].nom === "2019 BRP Outlander" && A.confirmations.length === 0,
       "ordre de la liste inchangé (1re machine en tête, puis ses sœurs) ; aucune question (il restait 2 places)");
    ok(A.alertes.some(a => /Assigné à : Jason/.test(a) && /Outlander : Gwendal/.test(a)), "message de confirmation : le technicien de chaque machine");
    // 1 seul technicien : jamais le même nom deux fois
    prep(A, S, { employes: [J], machines: [] });
    ouvrirRdv(A, { extra: EXTRA1, nom: "Groupe Un" });
    w.confirmerRdv(MARDI, 9); await dodo(60);
    g = nouveaux(A, "Groupe Un");
    ok(g.length === 2 && g.filter(m => m.technicien === "Jason").length === 1 && g.some(m => m.technicien === ""),
       "2 machines, 1 technicien : Jason sur une, technicien vide sur l'autre (jamais le même nom deux fois) — " + g.map(m => m.nom + "→" + (m.technicien || "∅")).join(", "));
    ok(A.alertes.some(a => /Outlander : aucun autre technicien libre/.test(a)), "… et le message dit qu'il faut assigner la 2e machine à la main");
    // 3 machines, 2 techniciens : 2 noms distincts, la 3e vide
    prep(A, S, { machines: [] });
    ouvrirRdv(A, { extra: EXTRA1.concat([Object.assign({}, EXTRA1[0], { nom: "2018 BRP Renegade" })]), nom: "Groupe Trois" });
    w.confirmerRdv(MARDI, 9); await dodo(60);
    g = nouveaux(A, "Groupe Trois");
    const tg = g.map(m => m.technicien).filter(Boolean);
    ok(g.length === 3 && tg.length === 2 && new Set(tg).size === 2, "3 machines, 2 techniciens : 2 noms distincts, la 3e sans technicien");

    // ══════ 5. confirmerRdv sur une place devenue prise : confirm() non bloquant ══════
    prep(A, S, { employes: [J], machines: [bon("a", "09:00")] });
    ouvrirRdv(A, { nom: "Tard Venu" });
    A.confirmations.length = 0; A.reponseConfirm = false;
    const n0 = A.get("machines").length;
    w.confirmerRdv(MARDI, 9); await dodo(60);
    ok(A.confirmations.length === 1 && /⚠️ À 09:00 il n'y a plus de technicien libre\. Réserver quand même \?/.test(A.confirmations[0]) && A.get("machines").length === n0 && nouveaux(A, "Tard Venu").length === 0,
       "place prise entre-temps : « ⚠️ À 09:00 il n'y a plus de technicien libre. Réserver quand même ? » ; Annuler → rien de créé");
    A.reponseConfirm = true; A.confirmations.length = 0; A.alertes.length = 0;
    w.confirmerRdv(MARDI, 9); await dodo(60);
    g = nouveaux(A, "Tard Venu");
    ok(A.confirmations.length === 1 && g.length === 1 && g[0].heure === "09:00" && g[0].echeance === MARDI && g[0].statut === "avenir" && A.alertes.some(a => /Rendez-vous confirmé/.test(a)),
       "… OK → le bon est créé comme avant (jamais un blocage dur)");
    prep(A, S, { machines: [bon("a", "09:00")] });
    ouvrirRdv(A, { nom: "A Temps" });
    A.confirmations.length = 0;
    w.confirmerRdv(MARDI, 9); await dodo(60);
    ok(A.confirmations.length === 0 && nouveaux(A, "A Temps").length === 1, "il reste une place (2 techniciens, 1 bon) : aucune question");

    // ══════ 6. choisirTechnicien ══════
    prep(A, S, { machines: [bon("p", "09:00", { technicien: "Jason" }), bon("q", "14:00", { technicien: "Gwendal" }), bon("r", "15:30", { technicien: "Gwendal" })] });
    ok(w.choisirTechnicien(MARDI, "Motomarine", 9, 60) === "Gwendal" && w.choisirTechnicien(MARDI, "Motomarine", "09:00", 60) === "Gwendal",
       "à 9:00 Jason est épinglé : Gwendal (avant : le moins chargé de la journée, Jason)");
    ok(w.choisirTechnicien(MARDI, "Motomarine", 11, 60) === "Jason", "à 11:00 les deux sont libres : le moins chargé de la journée (Jason : 1 bon, Gwendal : 2)");
    ok(["Jason", "Gwendal"].includes(w.choisirTechnicien(MARDI, "Motomarine")) && w.choisirTechnicien(MARDI) === "Jason", "sans heure (ancien appel) : comportement d'avant, aucune exception");
    prep(A, S, { employes: [J], machines: [bon("p", "09:00", { technicien: "Jason" })] });
    ok(w.choisirTechnicien(MARDI, "Motomarine", 9, 60) === "", "seul technicien déjà pris à cette heure : vide (pas de doublon)");
    prep(A, S, { employes: [avec(J, { competences: ["VTT"] }), G], machines: [bon("p", "09:00", { technicien: "Gwendal" })] });
    ok(w.choisirTechnicien(MARDI, "Motomarine", 9, 60) === "Jason", "compétent déjà pris : repli sur les autres techniciens LIBRES (Jason)");

    // ══════ 7. Fiche d'une demande : demTechs, demHeures, demJours ══════
    prep(A, S, { employes: [{ nom: "Arno", actif: true }, J, { nom: "Arvi", role: "tache", actif: true }, { nom: "Marie", role: "reception", actif: true }] });
    let noms = w.__dem.techs(MARDI, "Motomarine").map(t => t.nom);
    ok(noms.includes("Arno") && noms.includes("Jason") && !noms.includes("Arvi") && !noms.includes("Marie"),
       "demTechs : un employé sans role compte comme technicien ; « tache » et « reception » jamais — " + noms.join(", "));
    const jrs = w.__dem.jours(60, "Motomarine", null, 5, 0);
    ok(jrs.length === 5 && jrs.every(j => j.ferie || eq(j.techs, w.techsCapacite(j.iso, "Motomarine").map(t => t.nom))) && jrs.some(j => j.techs.includes("Arno")),
       "demJours : techs = noms de techsCapacite (Arno compté)");
    prep(A, S, { machines: [bon("p", "09:00", { technicien: "Jason" })] });
    let hs = w.__dem.heures(MARDI, 60, "Motomarine", "dem-cal");
    let h9 = hs.find(x => x.heure === "09:00");
    ok(h9 && h9.places === 1 && eq(h9.techs, ["Jason", "Gwendal"]), "demHeures : 9:00 offert avec 1 place, techs = ['Jason','Gwendal'] (capacité, pas les libres) — " + JSON.stringify(h9));
    ok(hs.length && hs.every(x => Array.isArray(x.techs) && x.techs.length >= x.places) && !hs.some(x => x.heure === "11:30"), "chaque heure porte techs ; dîner toujours bloquant dans le picker (11:30 de 60 min absent)");
    prep(A, S, { employes: [J], machines: [bon("a", "09:00")] });
    hs = w.__dem.heures(MARDI, 60, "Motomarine", "dem-cal");
    ok(hs[0] && hs[0].heure === "10:15" && hs[0].places === 1 && eq(hs[0].techs, ["Jason"]), "1 technicien, bon 9:00-10:00, tampon 15 : 1re heure 10:15");
    // créneaux retenus : ceux des AUTRES demandes comptent, pas les siens
    prep(A, S, {});
    S.db.creneaux_actifs = [{ demande_id: "dem-autre", iso: MARDI, heure: "09:00", duree_min: 60 }, { demande_id: "dem-cal", iso: MARDI, heure: "09:00", duree_min: 60 }];
    await w.__dem.charger(); await dodo(20);
    h9 = w.__dem.heures(MARDI, 60, "Motomarine", "dem-cal").find(x => x.heure === "09:00");
    const h9b = w.__dem.heures(MARDI, 60, "Motomarine", "dem-autre2").find(x => x.heure === "09:00");
    ok(h9 && h9.places === 1 && !h9b, "retenus : celui d'une autre demande prend une place, le sien non (9:00 : 1 place ; pour une 3e demande : 0)");
    S.db.creneaux_actifs = []; await w.__dem.charger(); await dodo(20);

    // ══════ 8. Instantané de capacité envoyé au serveur (espion sur l'update demandes_service) ══════
    prep(A, S, { machines: [bon("p", "09:00", { technicien: "Jason" })], dispo: { [MERCREDI]: { Gwendal: false } } });
    S.db.demandes_service = [{ id: "dem-cal", nom: "Paul Test", tel: "8195550000", courriel: "", canal_prefere: "sms", statut: "nouvelle", lu: true,
                               type_machine: "Motomarine", duree_min: 60, cree_le: new Date().toISOString(), source: "wix" }];
    await w.ouvrirDemandes("nouvelles"); await dodo(60);
    await w.__dem.ouvrirFiche("dem-cal"); await dodo(40);
    const pk = w.__dem.picker();
    pk.duree = 60; pk.choix = [{ iso: MARDI, heure: "09:00" }, { iso: MERCREDI, heure: "09:00" }];
    A.reponseConfirm = true;
    const nUp = S.ecrits("demandes_service", "update").length;
    await w.__dem.envoyer("sms"); await dodo(60);
    const up = S.ecrits("demandes_service", "update").slice(nUp).map(a => a.vals).find(v => v && v.creneaux);
    const cr = up ? up.creneaux : [];
    console.log("CONTRAT creneaux envoyé : " + JSON.stringify(cr));
    ok(cr.length === 2 && eq(cr[0], { no: 1, iso: MARDI, heure: "09:00", duree: 60, techs: ["Jason", "Gwendal"] }),
       "l'objet creneaux envoyé contient techs ['Jason','Gwendal'] (capacité) et pas ['Gwendal'] (libres) — " + JSON.stringify(cr[0]));
    ok(cr[1] && eq(cr[1].techs, ["Jason"]) && up.statut === "creneaux_envoyes", "mercredi, Gwendal absent : techs ['Jason'] ; statut creneaux_envoyes");
    ok(S.ecrits("creneaux_reserves", "insert").slice(-1).every(a => [].concat(a.vals).every(l => !("techs" in l))), "creneaux_reserves inchangé (pas de colonne techs)");

    // ══════ 9. La pastille 👷 N (Semaine et Mois) = la capacité ══════
    prep(A, S, { employes: [J, G, { nom: "Arvi", role: "tache", actif: true }, { nom: "Marie", role: "reception", actif: true }] });
    A.set("calAncre", new w.Date(MARDI + "T12:00")); A.set("calVueActuelle", "semaine"); w.calRendre();
    const ent = A.$$(".cal-sem-entete").find(e => A.txt(e.querySelector(".jnum")) === "13");
    A.set("calVueActuelle", "mois"); w.calRendre();
    const cas = A.$$(".cal-mois-case:not(.hors-mois)").find(e => A.txt(e.querySelector(".mc-num")) === "13");
    ok(ent && A.txt(ent.querySelector(".cal-dispo-tag")) === "👷 2" && cas && A.txt(cas.querySelector(".mc-dispo")) === "👷 2" && w.techsCapacite(MARDI).length === 2,
       "pastille 👷 2 en Semaine et en Mois (une tâche et une réception présentes n'augmentent pas N)");
    A.set("calVueActuelle", "travail");

    // ══════ 10. Interrupteur CAPACITE_MULTI_TECHS = false : comportement de la v177 ══════
    prep(B, SB, { machines: [bon("a", "09:00")] });
    ouvrirRdv(B);
    s = sugg(B);
    ok(B.get("CAPACITE_MULTI_TECHS") === false && s[0] && s[0].debut === 10.25 && !/places/.test(s[0].sous), "interrupteur à false : 2 techniciens, 1 bon à 9:00 → 10h15 (v177)");
    prep(B, SB, { employes: [] });
    ouvrirRdv(B);
    ok(sugg(B).length === 6 && !/Aucun technicien/.test(vide(B)), "interrupteur à false : aucun technicien → créneaux quand même (v177)");
    prep(B, SB, { employes: [J], machines: [bon("a", "09:00")] });
    ouvrirRdv(B, { nom: "B Tard" });
    B.confirmations.length = 0;
    B.w.confirmerRdv(MARDI, 9); await dodo(60);
    ok(B.confirmations.length === 0 && nouveaux(B, "B Tard").length === 1, "interrupteur à false : aucune question à la réservation (v177)");
    prep(B, SB, { machines: [] });
    ouvrirRdv(B, { extra: EXTRA1, nom: "B Groupe" });
    B.w.confirmerRdv(MARDI, 9); await dodo(60);
    g = nouveaux(B, "B Groupe");
    ok(g.length === 2 && g[0].technicien && g[0].technicien === g[1].technicien && B.get("machines")[0] === g[0], "interrupteur à false : les sœurs héritent du technicien (v177)");
    prep(B, SB, { machines: [bon("a", "09:00")] });
    r = B.w.__dem.heures(MARDI, 60, "Motomarine", "dem-b");
    ok(!r.some(x => x.heure === "09:00") && r[0] && r[0].heure === "10:15", "interrupteur à false : picker en capacité 1 (9:00 pris → 10:15)");
    SB.db.demandes_service = [{ id: "dem-b", nom: "Paul B", tel: "8195550001", courriel: "", canal_prefere: "sms", statut: "nouvelle", lu: true, type_machine: "Motomarine", duree_min: 60, cree_le: new Date().toISOString() }];
    await B.w.ouvrirDemandes("nouvelles"); await dodo(60);
    await B.w.__dem.ouvrirFiche("dem-b"); await dodo(40);
    const pkb = B.w.__dem.picker(); pkb.duree = 60; pkb.choix = [{ iso: MARDI, heure: "10:15" }];
    await B.w.__dem.envoyer("sms"); await dodo(60);
    const upb = SB.ecrits("demandes_service", "update").map(a => a.vals).find(v => v && v.creneaux);
    ok(upb && upb.creneaux.length === 1 && !("techs" in upb.creneaux[0]), "interrupteur à false : pas de clé techs envoyée (le serveur garde la capacité 1)");
  } catch (err) { ok(false, "exception : " + (err && err.stack || err)); }
  ok(!B || B.erreurs.length === 0, "2e instance (interrupteur à false) : aucune erreur JavaScript");
  L.fin(A);
})();
