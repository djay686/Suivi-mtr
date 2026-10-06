// v173 — 📞 Communications : la conversation au complet. Les textos envoyés par le système (menu d'appel manqué,
//   question après « 2 », « bien reçu », confirmations…) sont dans le fil, marqués « 🤖 SMS automatique », à leur place.
//   (La fonction serveur sms-entrant les note maintenant : voir edge/test-sms-entrant-v172.html.)
// NODE_PATH=… node test-v173.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

// Supabase bouchonné, avec une vraie table communications en mémoire (tri par order() comme la vraie base)
const donnees = { communications: [], telephonie_config: [], tableau: [] };
const direct = [];   // les fonctions de rappel du temps réel
const table = (nom) => {
  const q = { op: "select", vals: null, filtres: [], un: false, tri: null };
  const exec = () => {
    const rows = (donnees[nom] = donnees[nom] || []);
    const garde = r => q.filtres.every(f => f(r));
    let data = null;
    if (q.op === "select") {
      data = rows.filter(garde).map(r => JSON.parse(JSON.stringify(r)));
      if (q.tri) { const [c, o] = q.tri, s = o && o.ascending === false ? -1 : 1; data.sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * s); }
    }
    else if (q.op === "update") { data = rows.filter(garde); data.forEach(r => Object.assign(r, JSON.parse(JSON.stringify(q.vals)))); }
    else if (q.op === "insert" || q.op === "upsert") { data = [].concat(q.vals); if (nom !== "tableau") rows.push(...data); }
    else if (q.op === "delete") { data = rows.filter(garde); donnees[nom] = rows.filter(r => !garde(r)); }
    if (q.un) data = Array.isArray(data) ? (data[0] || null) : data;
    return { data, error: null };
  };
  const ch = new Proxy({}, { get(t, k) {
    if (k === "then") return (ok, ko) => Promise.resolve(exec()).then(ok, ko);
    if (["update", "insert", "upsert", "delete"].includes(k)) return (v) => { q.op = k; q.vals = v; return ch; };
    if (k === "eq") return (c, v) => { q.filtres.push(r => r[c] === v); return ch; };
    if (k === "in") return (c, l) => { q.filtres.push(r => (l || []).includes(r[c])); return ch; };
    if (k === "order") return (c, o) => { q.tri = [c, o]; return ch; };
    if (k === "single" || k === "maybeSingle") return () => { q.un = true; return ch; };
    return () => ch;
  } });
  return ch;
};
const sbStub = {
  from: table,
  channel: (nom) => { const o = { on(ev, filtre, fn) { if (nom === "comm-live") direct.push(fn); return o; }, subscribe() { return o; } }; return o; },
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: { access_token: "ok" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) { w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => ""; w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" }); } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const T0 = Date.parse("2026-09-30T14:02:01Z"), aSec = (s) => new Date(T0 + s * 1000).toISOString();
const ev = () => $$("#comm-fil .comm-ev").map(e => ({ cls: e.className, titre: (e.querySelector(".bulle b") || {}).textContent || "", texte: (e.querySelector(".bulle") || {}).textContent || "", meta: (e.querySelector(".meta") || {}).textContent || "", boutons: [...e.querySelectorAll(".meta button")].map(b => b.textContent) }));

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true, compteAuth: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  $("#ecran-connexion") && $("#ecran-connexion").classList.remove("ouvert");
  w.__set("clients", []); w.__set("machines", []);
  const T = "8199139743";
  // Le vrai fil du 30 sept. (819-913-9743), plus les deux réponses automatiques que sms-entrant note maintenant
  donnees.communications.push(
    { id: 254, cree_le: aSec(0), tel: T, canal: "appel_manque", direction: "in", statut: "traite", raison: "performance", contenu: "Appel manqué", meta: { sms: "envoyé" } },
    { id: 255, cree_le: aSec(0.4), tel: T, canal: "sms_out", direction: "out", statut: "traite", contenu: "MTR Performance : on a manque votre appel. Repondez :\n1 - Prendre rendez-vous\n2 - Performance\n3 - Question", meta: { origine: "appel_manque", comm_appel: 254 } },
    { id: 256, cree_le: aSec(30), tel: T, canal: "sms_in", direction: "in", statut: "traite", raison: "performance", contenu: "2", source_table: "sms_recus", source_id: "83", meta: { resultat: "menu_2" } },
    { id: 257, cree_le: aSec(31), tel: T, canal: "sms_out", direction: "out", statut: "traite", par: "automatique", contenu: "MTR Performance : pour bien vous conseiller, indiquez-nous la marque, le modele, l'annee et ce que vous recherchez.", meta: { origine: "auto", declencheur: "menu:menu:2", en_reponse_a: 83 } },
    { id: 258, cree_le: aSec(96), tel: T, canal: "sms_in", direction: "in", statut: "traite", raison: "performance", contenu: "tune pour un wolverine 850 X4 2018", source_table: "sms_recus", source_id: "84", meta: { resultat: "menu_performance" } },
    { id: 259, cree_le: aSec(97), tel: T, canal: "sms_out", direction: "out", statut: "traite", par: "automatique", contenu: "MTR Performance : bien recu, merci! Un technicien vous rappelle d'ici la fin de la prochaine journee ouvrable.", meta: { origine: "auto", declencheur: "menu:perf_attente", en_reponse_a: 84 } },
    { id: 260, cree_le: aSec(910), tel: T, canal: "sms_out", direction: "out", statut: "traite", par: "Jason", contenu: "Salut !\nJ'ai rien en ce moment pour yamaha", meta: { origine: "communications" } },
    { id: 261, cree_le: aSec(951), tel: T, canal: "sms_in", direction: "in", statut: "traite", contenu: "ok mais c est tu possible de l avoir ?", source_table: "sms_recus", source_id: "85", meta: { resultat: "autre" } });

  await dodo(800);
  await w.ouvrirCommunications(T); await dodo(30);
  const e1 = ev();
  ok(e1.length === 8, "le fil de 819-913-9743 montre les 8 échanges, réponses automatiques comprises (" + e1.length + ")");
  const ordre = e1.map(e => e.titre.replace(/^\S+\s/, "")).join(" › ");
  ok(ordre === "Appel manqué › SMS automatique › SMS reçu › SMS automatique › SMS reçu › SMS automatique › SMS envoyé › SMS reçu",
    "dans l'ordre : appel manqué › menu › « 2 » › question › réponse › « bien reçu » › Jason › client");
  ok(/indiquez-nous la marque/.test(e1[3].texte) && /^🤖 SMS automatique/.test(e1[3].titre), "après le « 2 » : la question envoyée directement, marquée « 🤖 SMS automatique »");
  ok(/^🤖/.test(e1[1].titre) && /on a manque votre appel/.test(e1[1].texte), "le menu d'appel manqué est aussi marqué 🤖 (avant : « 📤 SMS envoyé » comme un texto de Jason)");
  ok(/^📤 SMS envoyé/.test(e1[6].titre) && /· Jason/.test(e1[6].meta) && !/🤖/.test(e1[6].titre), "les textos de Jason restent « 📤 SMS envoyé · Jason »");
  ok(/· automatique/.test(e1[3].meta), "la réponse automatique dit « · automatique » sous la bulle");
  ok([1, 3, 5].every(i => /\bout\b/.test(e1[i].cls)), "les réponses automatiques sont du côté « envoyé » (à droite), comme les autres textos sortants");
  ok([1, 3, 5].every(i => !e1[i].boutons.includes("✓ Traité") && !e1[i].boutons.includes("✎ Note")), "pas de « ✓ Traité » ni de « ✎ Note » sur une réponse automatique (déjà traitée)");

  // Une réponse automatique qui arrive en direct (temps réel) : elle s'ajoute au fil, sans notification
  const avantToasts = toasts().length;
  const neuve = { id: 262, cree_le: aSec(1000), tel: T, canal: "sms_out", direction: "out", statut: "traite", par: "automatique", contenu: "MTR Performance : bien recu, merci!", meta: { origine: "auto", declencheur: "menu:question_attente" } };
  donnees.communications.push(neuve);
  ok(direct.length > 0, "(le module écoute bien les changements de Communications en direct)");
  for (const fn of direct) await fn({ eventType: "INSERT", new: neuve });
  await dodo(30);
  const e2 = ev();
  ok(e2.length === 9 && /^🤖/.test(e2[8].titre) && /bien recu, merci!/.test(e2[8].texte), "en direct : la nouvelle réponse automatique apparaît au bout du fil");
  ok(toasts().length === avantToasts, "… sans notification (c'est nous qui l'avons envoyée)");

  // Texte échappé
  donnees.communications.push({ id: 263, cree_le: aSec(1100), tel: T, canal: "sms_out", direction: "out", statut: "traite", par: "automatique", contenu: "<img src=x onerror=alert(1)> & co", meta: { origine: "auto" } });
  await w.__comm.charger(); await w.ouvrirCommunications(T); await dodo(30);
  ok(!$("#comm-fil .bulle img") && ev().some(e => /<img src=x/.test(e.texte)), "le texte d'une réponse automatique est affiché tel quel (aucun HTML injecté)");

  // Une vieille ligne sms_out sans meta (ou un canal inconnu) : pas d'erreur, étiquette habituelle
  donnees.communications.push({ id: 264, cree_le: aSec(1200), tel: T, canal: "sms_out", direction: "out", statut: "traite", contenu: "ancien texto", meta: null },
                              { id: 265, cree_le: aSec(1300), tel: T, canal: "inconnu", direction: "in", statut: "traite", contenu: "?", meta: { origine: "auto" } });
  await w.__comm.charger(); await w.ouvrirCommunications(T); await dodo(30);
  const e3 = ev();
  ok(/^📤 SMS envoyé/.test(e3[e3.length - 2].titre) && /^• inconnu/.test(e3[e3.length - 1].titre), "sans meta : « 📤 SMS envoyé » ; « origine auto » ne touche que les textos envoyés");
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
