// v161 — Calendrier : le CLIENT bien en vue, le technicien assigné en dessous (vues Jour, Semaine, Mois).
//        Bouton « 📨 Demandes rendez-vous » : reste rouge tant qu'une demande est à traiter, avec le nombre.
// NODE_PATH=… node test-v161.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

// Supabase simulé : chaque table renvoie ce qu'on a mis dans DONNEES ; les update() sont notés
const DONNEES = { demandes_service: [], sms_recus: [], creneaux_actifs: [] };
const majs = [];
const table = (name) => {
  const ch = new Proxy({}, { get(t, k) {
    if (k === "then") return (ok) => ok({ data: JSON.parse(JSON.stringify(DONNEES[name] || [])), error: null });
    return (...a) => { if (k === "update") majs.push({ table: name, val: a[0] }); if (k === "maybeSingle" || k === "single") return Promise.resolve({ data: null, error: null }); return ch; };
  } });
  return ch;
};
const sbStub = { from: table, channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; },
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  functions: { invoke: async () => ({ data: null, error: null }) } };
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) {
    w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const $$ = (s) => [...w.document.querySelectorAll(s)];
const bloc = (id) => $$("#cal-corps .cal-jbloc").find(b => (b.getAttribute("onclick") || "").includes(`'${id}'`));
const puce = (sel, id) => $$(sel).find(b => (b.getAttribute("onclick") || "").includes(`'${id}'`));
const lignes = (el) => [...el.querySelectorAll(".jb-l")].map(x => x.textContent.trim());

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true }, { nom: "Gwendal", role: "technicien", actif: true }, { nom: "Jérémie", role: "technicien", actif: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.__set("clients", [{ id: "cl9", nom: "Carnet Seulement", tel: "819-555-0199", machines: [] }]);
  const J = "2026-09-28";   // un lundi
  const soum = (id, mid) => ({ id, numero: "SO-" + id, statut: "envoyee", machineId: mid, lignes: [{ type: "mo", desc: "Entretien", qte: 1, prix: 105 }] });
  w.__set("soumissions", ["a", "b", "c", "d", "e", "f", "g", "h"].map(x => soum("s" + x, "m" + x)));
  w.__set("machines", [
    { id: "ma", numeroBT: "BT-201", nom: "Sea-Doo RXP-X 300", annee: "2022", client: "Marilyn Dubois", technicien: "Gwendal", statut: "avenir", echeance: J, heure: "09:00", dureeEstimee: 120, soumissionId: "sa" },
    { id: "mb", numeroBT: "BT-202", nom: "Outlander 650", annee: "2020", client: "Matthew Thibeault", technicien: "Jérémie", statut: "avenir", echeance: J, heure: "13:00", dureeEstimee: 60, soumissionId: "sb" },
    { id: "mc", numeroBT: "BT-203", nom: "Spark", client: "Pierre Fiset", technicien: "", statut: "avenir", echeance: J, heure: "11:00", dureeEstimee: 60, soumissionId: "sc" },
    { id: "md", numeroBT: "BT-204", nom: "Renegade 900", client: "Court Rendezvous", technicien: "Gwendal", statut: "avenir", echeance: J, heure: "15:00", dureeEstimee: 30, soumissionId: "sd" },
    { id: "me", numeroBT: "BT-205", nom: "Maverick X3", client: "", clientId: "cl9", technicien: "Gwendal", statut: "avenir", echeance: J, heure: "16:00", dureeEstimee: 60, soumissionId: "se" },
    { id: "mf", numeroBT: "BT-206", nom: "Commander 1000", client: "", technicien: "", statut: "avenir", echeance: J, heure: "08:00", dureeEstimee: 60, soumissionId: "sf" },
    { id: "mg", numeroBT: "BT-207", nom: "GTI 130", client: "Sans Heure", technicien: "Jérémie", statut: "avenir", echeance: J, heure: "", soumissionId: "sg" },
    { id: "mh", numeroBT: "BT-208", nom: "Ski-Doo Summit", client: "<b>Pas du HTML</b>", technicien: "Absent Total", statut: "avenir", echeance: J, heure: "10:00", dureeEstimee: 60, soumissionId: "sh" },
    { id: "mz", numeroBT: "BT-209", nom: "Wake Pro 230", client: "Sans Soumission", technicien: "Gwendal", statut: "avenir", echeance: J, heure: "14:00", dureeEstimee: 60 },
  ]);
  w.afficher();

  // ════════════ Vue Semaine (le bogue : un technicien assigné cachait le client) ════════════
  w.ouvrirCalendrier(); w.__set("calAncre", new Date(2026, 8, 28, 12)); w.calVue("travail");
  const bA = bloc("ma"), bB = bloc("mb"), bC = bloc("mc"), bD = bloc("md"), bE = bloc("me"), bF = bloc("mf"), bH = bloc("mh"), bZ = bloc("mz");
  ok(bA && /Marilyn Dubois/.test(bA.querySelector(".jb-cli").textContent) && /👷 Gwendal/.test(bA.querySelector(".jb-tech").textContent),
     "Semaine : technicien assigné → le client est affiché (en gras) ET le technicien (« " + (bA ? lignes(bA).join(" | ") : "?") + " »)");
  ok(bA && bA.querySelector(".jb-cli").compareDocumentPosition(bA.querySelector(".jb-tech")) & w.Node.DOCUMENT_POSITION_FOLLOWING, "Semaine : le technicien est EN DESSOUS du client");
  ok(bA && lignes(bA)[0].startsWith("09:00 – 11:00") && lignes(bA)[1] === "Marilyn Dubois" && lignes(bA)[2] === "👷 Gwendal" && lignes(bA)[3] === "2022 Sea-Doo RXP-X 300",
     "Semaine, bloc de 2 h : heure / CLIENT / 👷 technicien / machine, une info par ligne");
  ok(bB && lignes(bB).length === 3 && /13:00 – 14:00 · 2020 Outlander 650/.test(lignes(bB)[0]) && lignes(bB)[1] === "Matthew Thibeault" && lignes(bB)[2] === "👷 Jérémie",
     "Semaine, bloc de 1 h : la machine monte à côté de l'heure pour garder CLIENT + technicien (« " + (bB ? lignes(bB).join(" | ") : "?") + " »)");
  ok(bC && lignes(bC).some(x => x === "Pierre Fiset") && !bC.querySelector(".jb-tech"), "Semaine : sans technicien → client affiché, aucune ligne 👷");
  ok(bD && bD.classList.contains("compact") && lignes(bD)[0] === "Court Rendezvous" && lignes(bD)[1] === "15:00 · 👷 Gwendal",
     "Semaine, bloc de 30 min : 2 lignes serrées — le CLIENT, puis l'heure + le technicien (« " + (bD ? lignes(bD).join(" | ") : "?") + " »)");
  ok(bA && bA.querySelector(".jb-cli.jb-cli2") && !(bB && bB.querySelector(".jb-cli2")), "bloc de 2 h : un long nom de client peut aller sur 2 lignes ; bloc de 1 h : 1 ligne");
  ok(bE && bE.querySelector(".jb-cli").textContent === "Carnet Seulement", "client absent du bon mais lié au carnet (clientId) → nom pris dans le carnet");
  ok(bF && bF.querySelector(".jb-cli").textContent === "Commander 1000" && !bF.querySelector(".jb-tech"), "aucun client → la machine prend la place du client");
  ok(bH && bH.querySelector(".jb-cli").textContent === "<b>Pas du HTML</b>" && !bH.querySelector(".jb-cli b"), "nom de client échappé (aucun HTML injecté)");
  ok(bA && /👤 Marilyn Dubois/.test(bA.title) && /🚜 2022 Sea-Doo RXP-X 300 · BT-201/.test(bA.title) && /👷 Gwendal/.test(bA.title) && /🕐 09:00 – 11:00/.test(bA.title),
     "info-bulle : heure, client, machine + n° de BT, technicien");
  ok(bC && /👷 Aucun technicien assigné/.test(bC.title), "info-bulle sans technicien : « Aucun technicien assigné »");
  ok(bZ && bZ.classList.contains("sans-soum") && /sans soumission/i.test(bZ.textContent) && /Sans Soumission/.test(bZ.querySelector(".jb-cli").textContent)
     && /👷 Gwendal/.test(bZ.textContent) && /Aucune soumission/.test(bZ.title), "règle v146 gardée : rendez-vous sans soumission en rouge, avec client + technicien + avertissement");
  const pG = puce("#cal-corps .cal-sh-puce", "mg");
  ok(pG && pG.querySelector(".cp-cli").textContent === "Sans Heure" && /👷 Jérémie/.test(pG.querySelector(".cp-tech").textContent), "Semaine, rendez-vous sans heure : client + technicien en dessous");

  // ════════════ Vue Jour (colonnes par technicien) ════════════
  w.calVue("jour");
  const jA = bloc("ma"), jC = bloc("mc"), jH = bloc("mh");
  ok(jA && jA.querySelector(".jb-cli").textContent === "Marilyn Dubois" && !jA.querySelector(".jb-tech"), "Jour : client en gras ; pas de ligne 👷 (la colonne dit déjà le technicien)");
  ok(jA && jA.closest(".cal-jour-col-tech").querySelector(".cal-jour-tech-entete").textContent.includes("Gwendal"), "Jour : le bloc est dans la colonne de Gwendal");
  ok(jH && /👷 Absent Total \(pas dispo\)/.test(jH.textContent) && /Non assigné/.test(jH.closest(".cal-jour-col-tech").textContent), "Jour : technicien pas disponible → bloc dans « Non assigné » avec 👷 nom (pas dispo)");
  ok(jC && jC.querySelector(".jb-cli").textContent === "Pierre Fiset", "Jour : sans technicien → client affiché dans « Non assigné »");

  // ════════════ Vue Mois ════════════
  w.calVue("mois");
  const mA = puce("#cal-corps .cal-mevt", "mf"), m1 = $$("#cal-corps .cal-mevt");
  const mMarilyn = m1.find(x => /Marilyn/.test(x.textContent));
  ok(m1.length >= 3, "Mois : aperçus affichés (" + m1.length + ")");
  const premier = m1[0];
  ok(premier && premier.querySelector(".cp-cli") && premier.querySelector(".cp-h"), "Mois : chaque aperçu = heure + CLIENT en gras");
  const mAvecTech = m1.find(x => x.querySelector(".cp-tech"));
  ok(mAvecTech && mAvecTech.querySelector(".cp-cli").compareDocumentPosition(mAvecTech.querySelector(".cp-tech")) & w.Node.DOCUMENT_POSITION_FOLLOWING, "Mois : technicien en dessous du client");
  ok(m1.every(x => /🚜/.test(x.title)), "Mois : la machine est dans l'info-bulle");
  ok(!mMarilyn || /👷 Gwendal/.test(mMarilyn.textContent), "Mois : Marilyn Dubois → 👷 Gwendal (si visible dans les 3 premiers)");

  // ════════════ Bandeau « travail repris » (vue Jour) ════════════
  const hier = new Date(); hier.setDate(hier.getDate() - 1);
  const isoH = w.__get("isoLocal")(hier);
  w.__get("machines").push({ id: "mr", numeroBT: "BT-210", nom: "Spark Trixx", client: "Repris Hier", technicien: "Gwendal", statut: "reparation", echeance: isoH, heure: "09:00", dureeEstimee: 60, soumissionId: "sa" });
  w.__set("calAncre", new Date()); w.calVue("jour");
  const rep = $$("#cal-corps .cal-report").find(x => /Spark Trixx/.test(x.textContent));
  ok(!rep || /↻\s*Repris Hier/.test(rep.textContent), "travail repris d'un jour précédent : le client d'abord" + (rep ? "" : " (non affiché aujourd'hui : jour férié / fin de semaine)"));
  w.fermerCalendrier();

  // ════════════ Bouton « 📨 Demandes rendez-vous » ════════════
  const btn = $("#btn-dem-tb");
  const pastille = () => { const p = btn.querySelector(".dem-pastille"); return p ? p.textContent : ""; };
  const recharger = async () => { await w.ouvrirDemandes(); await dodo(80); };
  const iso = (j) => new Date(Date.now() - j * 3600e3).toISOString();

  DONNEES.demandes_service = [{ id: "d1", nom: "Samuel Trottier", tel: "8195550111", statut: "nouvelle", lu: false, cree_le: iso(1), services: ["Hivernisation"] }];
  await recharger();
  ok(btn.classList.contains("dem-alerte") && pastille() === "1", "nouvelle demande pas encore regardée : bouton rouge qui clignote, pastille 1");

  // Le bogue : on ouvre la demande (→ « lue ») mais elle est encore à traiter
  const bOuvrir = $("#dem-contenu [data-ouvrir='d1']");
  ok(!!bOuvrir, "la demande est dans l'onglet « À traiter »");
  if (bOuvrir) bOuvrir.click();
  await dodo(150);
  ok(majs.some(m => m.table === "demandes_service" && m.val && m.val.lu === true), "ouvrir la demande la marque « lue » (comme avant)");
  ok(pastille() === "1", "après l'avoir regardée : la pastille RESTE (1) — elle est encore à traiter (était le bogue)");
  ok(btn.classList.contains("dem-atraiter") && !btn.classList.contains("dem-alerte"), "après l'avoir regardée : bouton rouge fixe (ne clignote plus, puisqu'il n'y a rien de nouveau)");
  const cssTout = $$("style").map(x => x.textContent).join("\n");
  ok(/\.btn-dem-tb\.dem-atraiter\{background:#dc2626[^}]*\}/.test(cssTout) && !/\.btn-dem-tb\.dem-atraiter\{[^}]*animation/.test(cssTout), "style « rouge fixe » : fond #dc2626, sans clignotement");
  const menuDem = $('.menu-item[data-section="demandes"]');
  ok(!menuDem || (menuDem.querySelector(".dem-pastille") || {}).textContent === "1", "le menu « Demandes » montre le même nombre");

  // Plusieurs demandes : lues, non lues, confirmée sans soumission, en attente du client, refusée + 1 texto
  DONNEES.demandes_service = [
    { id: "d1", nom: "Samuel Trottier", statut: "nouvelle", lu: true, cree_le: iso(5) },
    { id: "d2", nom: "Luc Lu", statut: "autres_choix", lu: true, cree_le: iso(4) },
    { id: "d3", nom: "Nadia Neuve", statut: "nouvelle", lu: false, cree_le: iso(1) },
    { id: "d4", nom: "Conf Sans Soum", statut: "confirmee", lu: true, soum_id: null, cree_le: iso(6) },
    { id: "d5", nom: "Attente Client", statut: "creneaux_envoyes", lu: true, cree_le: iso(7) },
    { id: "d6", nom: "Refus", statut: "refusee", lu: true, cree_le: iso(8) },
    { id: "d7", nom: "Conf Avec Soum", statut: "confirmee", lu: true, soum_id: "sx", cree_le: iso(9) },
  ];
  DONNEES.sms_recus = [{ id: "t1", de: "8195550122", corps: "oui", traite: false, recu_le: iso(1) }];
  await recharger();
  ok(pastille() === "5", "4 demandes à traiter (dont 3 déjà lues) + 1 texto → pastille 5 (« " + pastille() + " »)");
  ok(btn.classList.contains("dem-alerte"), "une des demandes est nouvelle → clignote");
  ok(/4 demandes à traiter \+ 1 message reçu à traiter/.test(btn.title), "info-bulle du bouton : « 4 demandes à traiter + 1 message reçu à traiter » (« " + btn.title + " »)");
  const ongletAT = $$("#dem-boite .rap-onglets button").find(b => b.dataset.o === "nouvelles");
  ok(ongletAT && /\(4\)/.test(ongletAT.textContent), "même compte que l'onglet « 🔴 À traiter (4) »");
  ok(/^\(5\) /.test(w.document.title), "titre de l'onglet du navigateur : (5)");

  // Tout est traité → plus rien
  DONNEES.demandes_service = [
    { id: "d5", nom: "Attente Client", statut: "creneaux_envoyes", lu: true, cree_le: iso(7) },
    { id: "d6", nom: "Refus", statut: "refusee", lu: true, cree_le: iso(8) },
    { id: "d7", nom: "Conf Avec Soum", statut: "confirmee", lu: true, soum_id: "sx", cree_le: iso(9) },
  ];
  DONNEES.sms_recus = [{ id: "t1", de: "8195550122", corps: "oui", traite: true, resultat: "confirme", recu_le: iso(1) }];
  await recharger();
  ok(pastille() === "" && !btn.classList.contains("dem-alerte") && !btn.classList.contains("dem-atraiter"), "tout est traité → plus de pastille, bouton normal");
  ok(btn.title === "Demandes de rendez-vous reçues du site web", "info-bulle d'origine remise");
  const menuD = $('.menu-item[data-section="demandes"]');
  ok(menuD && !/à traiter/.test(menuD.getAttribute("title") || ""), "menu « Demandes » : l'info-bulle « … à traiter » disparaît aussi (« " + (menuD && menuD.getAttribute("title")) + " »)");
  ok(!/^\(\d+\)/.test(w.document.title), "titre du navigateur sans compteur");

  // Une demande en attente du client jamais ouverte (cas limite d'avant) compte encore
  DONNEES.demandes_service = [{ id: "d8", nom: "Jamais Ouverte", statut: "creneaux_envoyes", lu: false, cree_le: iso(2) }];
  DONNEES.sms_recus = [];
  await recharger();
  ok(pastille() === "1" && btn.classList.contains("dem-alerte"), "non-régression : une demande non lue compte toujours (comme avant la v161)");
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
