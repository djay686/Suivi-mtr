// v159 — remise en ordre au chargement : bons facturés en TEST par la v158 → « Prêt à facturer »
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");
const ecrits = [];
const table = (name) => { const ch = new Proxy({}, { get(t, k) { if (k === "then") return (ok) => ok({ data: [], error: null }); return (...a) => { if (k === "upsert" && name === "tableau") ecrits.push(JSON.parse(JSON.stringify(a[0]))); return ch; }; } }); return ch; };
const sbStub = { from: table, channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) { w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => ""; w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null; } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
 await dodo(1500);
 try {
  // Données comme sur le serveur après les essais de Jason (BT-090 facturé dans l'entreprise de test par la v158)
  w.__set("machines", [
    { id: "mu2qfahte6h9e", numeroBT: "BT-090", nom: "Spark", client: "pierre fiset", statut: "prete", factureLe: "2026-09-22T19:23:45.569Z", travauxTerminesLe: "2026-09-22T15:00:00Z",
      facturation: { sousTotal: 317.86, qbo: { id: "182", doc: "1017", url: "https://app.sandbox.qbo.intuit.com/app/invoice?txnId=182", total: 365.46, clientId: "67" } } },
    { id: "vrai", numeroBT: "BT-200", nom: "GTX", client: "Vrai Client", statut: "prete", factureLe: "2026-10-01T12:00:00Z",
      facturation: { qbo: { id: "900", doc: "2001", realm: "R1", env: "production" } } },
    { id: "ancien", numeroBT: "BT-057", nom: "Old", client: "stephane Jutras", statut: "prete" },
  ]);
  w.__set("soumissions", [{ id: "s46", numero: "SO-0046", statut: "brouillon", lignes: [{ type: "mo", desc: "x", qte: 1, prix: 95 }], total: 109.23, sousTotal: 95,
    facture: { bt: "BT-090", doc: "1017", qboId: "182", url: "https://app.sandbox.qbo.intuit.com/app/invoice?txnId=182" } }]);
  w.__set("clients", [{ id: "c1", nom: "pierre fiset", qboId: "67", machines: [] }, { id: "c2", nom: "Vrai Client", qboId: "300", qboRealm: "R1", machines: [] }]);
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  await dodo(5500);
  const M = w.__get("machines");
  const b90 = M.find(m => m.id === "mu2qfahte6h9e"), vrai = M.find(m => m.id === "vrai"), ancien = M.find(m => m.id === "ancien");
  ok(w.__factTestRemis === 1 && b90.statut === "afacturer" && !b90.factureLe && b90.pretAFacturerLe === "2026-09-22T15:00:00Z", "BT-090 (facturé en TEST par la v158) revient dans « Prêt à facturer »");
  ok(b90.facturation.qbo.env === "sandbox" && b90.facturation.sousTotal === 317.86, "la facturation de BT-090 est gardée, marquée « test »");
  ok(vrai.statut === "prete" && vrai.factureLe, "un bon facturé dans la vraie entreprise n'est pas touché");
  ok(ancien.statut === "prete", "un bon « Facturé » à la main (sans facture QuickBooks) n'est pas touché");
  const env1 = [...ecrits].reverse().find(e => e.id === 1);
  ok(env1 && env1.donnees.find(m => m.id === "mu2qfahte6h9e").statut === "afacturer", "le changement part au serveur (ligne 1)");
  ok(w.__soumTestNettoyees === 1 && !w.__get("soumissions")[0].facture, "SO-0046 : la marque « facturée » (test) est retirée");
  ok(w.__clientsTestNettoyes === 1 && !w.__get("clients")[0].qboId && w.__get("clients")[1].qboId === "300", "pierre fiset : l'id client du test est oublié ; un vrai id client reste");
  ok(!erreurs.length, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 } catch (e) { console.log("ÉCHEC :", e.stack); process.exitCode = 1; }
 process.exit(process.exitCode || 0);
})();
