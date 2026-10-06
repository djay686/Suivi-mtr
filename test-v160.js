// v160 — Facture QuickBooks : 1re ligne = machine + heures / km, rien sur le BT ni la soumission, service « Hivernisation ».
// NODE_PATH=… node test-v158.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");
const ecrits = [];
const table = (name) => { const ch = new Proxy({}, { get(t, k) { if (k === "then") return (ok) => ok({ data: [], error: null }); return (...a) => { if (k === "upsert" && name === "tableau") ecrits.push(JSON.parse(JSON.stringify(a[0]))); return ch; }; } }); return ch; };
const sbStub = { from: table, channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const alertes = [], confirmations = [], ouvertures = [], appelsQbo = [];
let reponseQbo = null;   // (corps) => { status, data }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) {
    w.__sbStub = sbStub; w.alert = (m) => alertes.push(String(m)); w.confirm = (m) => { confirmations.push(String(m)); return true; }; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.open = (u) => { const f = { url: u, document: { write() {}, close() {} }, close() { f.ferme = true; }, location: {} }; Object.defineProperty(f.location, "href", { set(v) { f.url = v; }, get() { return f.url; } }); ouvertures.push(f); return f; };
    w.fetch = async (url, init) => {
      if (/functions\/v1\/quickbooks/.test(url)) {
        const corps = JSON.parse(init.body); appelsQbo.push(corps);
        const r = reponseQbo ? reponseQbo(corps) : { status: 200, data: { ok: true } };
        return { ok: r.status < 300, status: r.status, json: async () => r.data };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    };
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const $$ = (s) => [...w.document.querySelectorAll(s)];
const proche = (a, b) => Math.abs(a - b) < 0.005;
const sousTotal = () => { const t = $("#fact-totaux").textContent; const m = t.match(/Sous-total\s*([\d\s ,]+)\s*\$/); return m ? parseFloat(m[1].replace(/[\s ]/g, "").replace(",", ".")) : NaN; };
const lignePar = (txt) => w.__get("factRangs").find(r => (r.desc || "").includes(txt) || (r.num || "") === txt);
const iso = (h, mn) => new Date(Date.UTC(2026, 8, 21, h, mn)).toISOString();

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.__set("catalPieces", [{ num: "295100522", desc: "Filtre à huile BRP", prix: 24.99, cout: 12 }]);
  w.__set("clients", [{ id: "cl1", nom: "Alex Paquin", tel: "819-555-0101", courriel: "alex@x.ca", adresse: "12 rue Test", ville: "Trois-Rivières", cp: "G8V 1A1", machines: [] }]);
  w.__set("soumissions", [
    { id: "s60", numero: "SO-0060", statut: "convertie", clientId: "cl1", clientNom: "Alex Paquin", machineId: "bt1",
      lignes: [{ type: "mo", desc: "Hivernisation / remisage", qte: 1.5, prix: 105 },
               { type: "mo", desc: "Remplacement bague d'usure", qte: 1, prix: 105 },
               { type: "art", num: "295100522", desc: "Filtre à huile", qte: 1, prix: 24.99 }] },
  ]);
  w.__set("machines", [
    { id: "bt1", numeroBT: "BT-160", nom: "Sea-Doo RXP-X 300", annee: "2022", serie: "YDV12345K122", heuresMachine: "123.4", client: "Alex Paquin", tel: "819-555-0101", clientId: "cl1",
      statut: "afacturer", soumissionId: "s60", travauxTermines: true, pieces: [{ num: "295100522", nom: "Filtre à huile", qte: "1", utilise: true, prixVente: 24.99 }] },
    { id: "bt2", numeroBT: "BT-161", nom: "Outlander 650", annee: "2020", kilometrage: "8 450km", heuresMachine: "212 heures", client: "Sans Soum", statut: "afacturer",
      chrono: [{ tech: "Gwendal", debut: iso(12, 0), fin: iso(13, 0), pauses: [] }], travaux: "Hivernisation\nVérifier freins", pieces: [] },
    { id: "bt3", numeroBT: "BT-162", nom: "Spark", client: "Sans Compteur", statut: "afacturer", pieces: [{ num: "", nom: "Anode", qte: "1", utilise: true, prixVente: 15 }] },
  ]);
  w.afficher();

  // ── Texte de la 1re ligne ──
  const bt1 = w.__get("machines").find(m => m.id === "bt1"), bt2 = w.__get("machines").find(m => m.id === "bt2"), bt3 = w.__get("machines").find(m => m.id === "bt3");
  ok(w.factLigneMachine(bt1) === "2022 Sea-Doo RXP-X 300 · n° de série YDV12345K122 · 123.4 h", "ligne machine : année + modèle · n° de série · heures (« " + w.factLigneMachine(bt1) + " »)");
  ok(w.factLigneMachine(bt2) === "2020 Outlander 650 · 8 450 km · 212 h", "km et heures (« 8 450km », « 212 heures ») → « 8 450 km · 212 h » (« " + w.factLigneMachine(bt2) + " »)");
  ok(w.factLigneMachine(bt3) === "Spark", "sans compteur ni n° de série : le nom seul");
  ok(w.factCompteurTexte({ heuresMachine: "55h" }) === "55 h" && w.factCompteurTexte({ kilometrage: "1200 KM." }) === "1200 km" && w.factCompteurTexte({}) === "", "unités tapées par le technicien (55h, 1200 KM.) normalisées ; rien si vide");

  // ── Fenêtre : la machine est annoncée comme 1re ligne ; pastille ❄️ sur la main-d'œuvre d'hivernisation ──
  w.__set("qboEtat", { connecte: true, realm: "R1", env: "production", company: "Groupe MTR Performance inc.", config: {} });
  reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, realm: "R1", env: "production", company: "Groupe MTR Performance inc.", config: {} } }
    : { status: 200, data: { ok: true, id: "4800", doc: "1890", url: "https://app.qbo.intuit.com/app/invoice?txnId=4800", total: 450, action: "cree", clientId: "50", clientNom: "Alex Paquin",
        nbTrouves: 1, nbPiece: 0, services: ["Hivernisation"], realm: "R1", env: "production" } };
  w.factOuvrir("bt1");
  await dodo(50);
  ok(/2022 Sea-Doo RXP-X 300 · n° de série YDV12345K122 · 123\.4 h/.test($("#fact-entete").textContent) && /1re ligne de la facture/.test($("#fact-entete").textContent), "en-tête de la fenêtre : la machine avec ses heures, « 1re ligne de la facture »");
  const trHiv = $$("#fact-lignes tr").find(tr => /Hivernisation \/ remisage/.test(tr.innerHTML));
  const trBague = $$("#fact-lignes tr").find(tr => /Remplacement bague/.test(tr.innerHTML));
  ok(trHiv && /❄️ QuickBooks : service « Hivernisation »/.test(trHiv.textContent), "pastille « ❄️ QuickBooks : service « Hivernisation » et sa description » sur la main-d'œuvre d'hivernisation");
  ok(trBague && !/❄️/.test(trBague.textContent), "pas de pastille sur une autre main-d'œuvre");
  ok(/Hivernisation/.test($("#fact-qbo").textContent) && /aucun n° de bon ni de soumission/.test($("#fact-qbo").textContent), "encadré QuickBooks : règle Hivernisation + « aucun n° de bon ni de soumission »");

  // ── Envoi : la ligne machine part, le message au client reste celui de l'admin ──
  w.factMemoMaj("Bonne saison !");
  appelsQbo.length = 0;
  await w.factQuickBooks($("#fact-btn-qbo"));
  const envoi = appelsQbo.find(c => c.action === "facturer");
  ok(envoi && envoi.facture.ligneMachine === "2022 Sea-Doo RXP-X 300 · n° de série YDV12345K122 · 123.4 h", "envoi à QuickBooks : ligneMachine = machine + n° de série + heures");
  ok(envoi && envoi.facture.memo === "Bonne saison !", "message au client = seulement ce que l'admin écrit");
  ok(envoi && !envoi.facture.lignes.some(l => /BT-160|SO-0060/.test(JSON.stringify(l))), "aucune ligne de la facture ne porte le n° du bon ni de la soumission");
  ok(/main-d'œuvre sur « Hivernisation »/.test($("#fact-resultat").textContent), "résultat : « main-d'œuvre sur « Hivernisation » »");
  w.factFermer();

  // ── Bon sans soumission dont les travaux sont une hivernisation : la ligne des heures punchées ──
  w.factOuvrir("bt2");
  await dodo(50);
  const reel = w.__get("factRangs").find(r => r.groupe === "reel");
  ok(reel && /Hivernisation/.test(reel.desc) && reel.inclus, "heures punchées d'un bon « Hivernisation » : « " + (reel && reel.desc) + " » (partira sur le service Hivernisation)");
  // CSV (sans connexion API) : même règle d'article, machine + compteur au mémo
  let csv = null;
  w.qboTelechargerCSV = (lignes, nom) => { csv = { lignes, nom }; };
  w.factCSV();
  ok(csv && csv.lignes.length === 1 && csv.lignes[0][4] === "Hivernisation" && /8 450 km · 212 h/.test(csv.lignes[0][11]), "📄 CSV : main-d'œuvre d'hivernisation sur « Hivernisation », machine + km / heures au mémo");
  w.factFermer();
  w.factOuvrir("bt3");
  csv = null; w.factCSV();
  ok(csv && csv.lignes.some(l => l[4] === "Pièce" && /Anode/.test(l[5])), "📄 CSV : pièce toujours sur « Pièce »");
  w.factFermer();
  ok(!erreurs.length, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 } catch (e) { console.log("ÉCHEC :", e.stack); process.exitCode = 1; }
 process.exit(process.exitCode || 0);
})();
