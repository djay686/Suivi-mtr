// v165 — Demandes de rendez-vous : ✏️ Corriger le cellulaire (ou le courriel) du client.
//   Un client s'est trompé dans son numéro au formulaire : on corrige, les prochains textos partent au bon numéro,
//   et le numéro est aussi corrigé là où il avait été recopié (carnet rattaché, bon de travail, soumission).
// NODE_PATH=… node test-v165.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

// Supabase bouchonné, avec de vraies tables en mémoire (select / update / insert filtrés par eq / in)
const donnees = { demandes_service: [], sms_recus: [], creneaux_actifs: [], demandes_journal: [], tableau: [] };
const appels = [];
const table = (nom) => {
  const q = { op: "select", vals: null, filtres: [], un: false };
  const exec = () => {
    const rows = (donnees[nom] = donnees[nom] || []);
    const garde = r => q.filtres.every(f => f(r));
    let data = null;
    // Les lignes lues sont les objets mêmes de la table : une mise à jour change aussi la demande ouverte à l'écran,
    // comme le ferait le temps réel pendant l'écriture. L'ancien numéro doit donc être lu AVANT d'écrire.
    if (q.op === "select") data = rows.filter(garde);
    else if (q.op === "update") { data = rows.filter(garde); data.forEach(r => Object.assign(r, JSON.parse(JSON.stringify(q.vals)))); }
    else if (q.op === "insert" || q.op === "upsert") { data = [].concat(q.vals).map(v => Object.assign({ id: "x" + Math.random().toString(36).slice(2, 8), quand: new Date().toISOString() }, v)); if (nom !== "tableau") rows.push(...data); }
    else if (q.op === "delete") { data = rows.filter(garde); donnees[nom] = rows.filter(r => !garde(r)); }
    appels.push({ table: nom, op: q.op, vals: q.vals ? JSON.parse(JSON.stringify(q.vals)) : null });
    if (q.un) data = Array.isArray(data) ? (data[0] || null) : data;
    return { data, error: null };
  };
  const ch = new Proxy({}, { get(t, k) {
    if (k === "then") return (ok, ko) => Promise.resolve(exec()).then(ok, ko);
    if (["update", "insert", "upsert", "delete"].includes(k)) return (v) => { q.op = k; q.vals = v; return ch; };
    if (k === "eq") return (c, v) => { q.filtres.push(r => r[c] === v); return ch; };
    if (k === "in") return (c, l) => { q.filtres.push(r => (l || []).includes(r[c])); return ch; };
    if (k === "single" || k === "maybeSingle") return () => { q.un = true; return ch; };
    return () => ch;   // select, order, limit…
  } });
  return ch;
};
const sbStub = {
  from: table,
  channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; },
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: { access_token: "ok" } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: {}, error: { message: "x" } }),
  },
  functions: { invoke: async () => ({ data: null, error: null }) },
};
const envois = [], alertes = [];
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) {
    w.__sbStub = sbStub; w.alert = (m) => { alertes.push(String(m)); }; w.confirm = () => true; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async (url, o) => { envois.push({ url: String(url), body: o && o.body }); return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => "" }; };
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const fiche = () => ($("#dem-contenu") || { textContent: "" }).textContent;
const majDem = () => appels.filter(a => a.table === "demandes_service" && a.op === "update" && a.vals && ("tel" in a.vals || "courriel" in a.vals));
const corriger = async (tel, courriel, partout) => {
  $("#dem-coord").click(); await dodo(10);
  if (tel != null) $("#dem-c-tel").value = tel;
  if (courriel != null) $("#dem-c-courriel").value = courriel;
  if (partout === false && $("#dem-c-partout")) $("#dem-c-partout").checked = false;
  $("#dem-c-ok").click(); await dodo(120);
};

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true, compteAuth: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  $("#ecran-connexion") && $("#ecran-connexion").classList.remove("ouvert");
  w.__set("clients", [
    { id: "cl-1", nom: "Marie Tremblay", tel: "819-555-123", courriel: "marie@exemple.ca", machines: [] },   // créée depuis la demande, avec l'erreur
    { id: "cl-2", nom: "Paul Roy", tel: "418-222-3333", courriel: "", machines: [] },                       // homonyme : autre personne
  ]);
  w.__set("machines", [{ id: "bt-9", numeroBT: "BT-201", nom: "Spark", client: "Paul Roy", tel: "(819) 444-0000", courriel: "paul@x.ca", statut: "avenir", echeance: "2026-10-03", heure: "10:00" }]);
  w.__set("soumissions", [{ id: "so-7", numero: "S-0077", clientNom: "Paul Roy", tel: "8194440000", courriel: "paul@x.ca", lignes: [] }]);
  const il = new Date(Date.now() - 3600000).toISOString();
  donnees.demandes_service.push(
    { id: "D1", nom: "Marie Tremblay", tel: "819-555-123", courriel: "marie@exemple.ca", canal_prefere: "sms", statut: "creneaux_envoyes", lu: true, client_id: "cl-1",
      cree_le: il, source: "wix", marque: "BRP", modele: "Spark", annee: "2022", type_machine: "Motomarine", creneaux: [{ no: 1, iso: "2026-10-02", heure: "09:00" }] },
    { id: "D2", nom: "Paul Roy", tel: "819-444-0000", courriel: "paul@x.ca", canal_prefere: "sms", statut: "confirmee", lu: true, bt_id: "bt-9", soum_id: "so-7", soum_numero: "S-0077",
      cree_le: il, source: "wix", choix: 1, creneaux: [{ no: 1, iso: "2026-10-03", heure: "10:00" }] });
  donnees.sms_recus.push({ id: "sm1", de: "+18195551234", corps: "1", recu_le: il, traite: true, resultat: "aucune_correspondance", vu: false });   // elle a répondu de son vrai numéro

  // ── 1. La fiche : numéro incomplet signalé, bouton ✏️ Corriger ──
  await w.ouvrirDemandes("archives"); await dodo(80);
  await w.__dem.ouvrirFiche("D1"); await dodo(40);
  ok(/numéro incomplet/.test(fiche()) && !!$("#dem-coord"), "fiche : « 📱 numéro incomplet » (9 chiffres) et bouton « ✏️ Corriger »");
  $("#dem-coord").click(); await dodo(10);
  ok($("#dem-c-tel").value === "819-555-123" && $("#dem-c-courriel").value === "marie@exemple.ca", "✏️ : formulaire prérempli (cellulaire et courriel actuels)");
  ok(!!$("#dem-c-partout") && $("#dem-c-partout").checked && /Corriger aussi au carnet \(Marie Tremblay\)/.test($("#dem-zone").textContent), "case cochée : « Corriger aussi au carnet (Marie Tremblay) »");
  $("#dem-c-annuler").click(); await dodo(5);
  ok($("#dem-zone").innerHTML === "", "Annuler referme le formulaire");

  // ── 2. Numéro invalide : refusé, rien n'est écrit ──
  let n0 = majDem().length; alertes.length = 0;
  await corriger("819-555", null);
  ok(alertes.some(a => /10 chiffres/.test(a)) && majDem().length === n0 && donnees.demandes_service[0].tel === "819-555-123", "numéro de moins de 10 chiffres : refusé, rien n'est enregistré");

  // ── 3. Correction ──
  $("#dem-c-tel").value = "(819) 555-1234"; $("#dem-c-ok").click(); await dodo(150);
  const d1 = donnees.demandes_service.find(d => d.id === "D1");
  ok(d1.tel === "819-555-1234", "demande corrigée sur le serveur, numéro remis en forme (819-555-1234)");
  const u1 = majDem().pop();
  ok(u1 && Object.keys(u1.vals).join() === "tel", "seul le cellulaire est envoyé (le courriel n'a pas changé)");
  ok(w.__get("clients").find(c => c.id === "cl-1").tel === "819-555-1234", "carnet : la fiche de Marie Tremblay est corrigée aussi");
  const j1 = donnees.demandes_journal.find(j => j.demande_id === "D1" && j.detail && j.detail.action === "coordonnées corrigées");
  ok(j1 && j1.detail.cellulaire === "819-555-123 → 819-555-1234" && /carnet/.test(j1.detail.aussi || "") && j1.par === "Jason", "historique : « cellulaire : 819-555-123 → 819-555-1234 », par Jason");
  ok(!/numéro incomplet/.test(fiche()) && /819-555-1234/.test(fiche()), "la fiche montre le nouveau numéro, le badge « incomplet » est parti");
  ok(toasts().some(t => /Cellulaire corrigé : 819-555-1234/.test(t)), "toast « 📱 Cellulaire corrigé : 819-555-1234 »");
  const z1 = $("#dem-zone").textContent;
  ok(/à l'ancien numéro : renvoie-les avec « 📅 Proposer des créneaux »/.test(z1), "créneaux déjà envoyés : l'app dit de les renvoyer");
  ok(/Ce numéro t'a déjà écrit \(1 message non rattaché\)/.test(z1), "sa réponse venue du bon numéro (non rattachée) est signalée");

  // ── 4. Le prochain texto part au bon numéro ──
  envois.length = 0;
  $("#dem-infos").click(); await dodo(10); $("#dem-inf-sms").click(); await dodo(120);
  const e1 = envois.find(x => /smart-api/.test(x.url));
  ok(e1 && JSON.parse(e1.body).tel === "+18195551234", "« Demander des renseignements » par SMS : envoyé au +18195551234");

  // ── 5. Rendez-vous confirmé : bon de travail et soumission corrigés, l'homonyme du carnet jamais touché ──
  await w.__dem.ouvrirFiche("D2"); await dodo(40);
  $("#dem-coord").click(); await dodo(10);
  const lib2 = $("#dem-zone").textContent;
  ok(/sur le bon de travail BT-201/.test(lib2) && /sur la soumission S-0077/.test(lib2) && !/carnet/.test(lib2), "copies proposées : bon de travail BT-201 et soumission S-0077 — pas l'homonyme « Paul Roy » du carnet");
  $("#dem-c-annuler").click();
  await corriger("819 444 0001", null);
  const bt = w.__get("machines").find(m => m.id === "bt-9"), so = w.__get("soumissions").find(x => x.id === "so-7");
  ok(donnees.demandes_service.find(d => d.id === "D2").tel === "819-444-0001" && bt.tel === "819-444-0001" && so.tel === "819-444-0001", "demande, bon de travail et soumission corrigés");
  ok(w.__get("clients").find(c => c.id === "cl-2").tel === "418-222-3333", "l'homonyme du carnet garde son numéro");
  ok(appels.some(a => a.table === "tableau" && a.op === "upsert" && a.vals && a.vals.id === 1), "bon de travail enregistré (ligne 1)");
  ok(/« 📲 Renvoyer la confirmation »/.test($("#dem-zone").textContent), "rendez-vous confirmé : l'app dit de renvoyer la confirmation");

  // ── 6. Décocher « Corriger aussi » : seule la demande change ──
  await corriger("819-444-0002", null, false);
  ok(donnees.demandes_service.find(d => d.id === "D2").tel === "819-444-0002" && bt.tel === "819-444-0001", "case décochée : la demande seulement, le bon de travail garde son numéro");

  // ── 7. Rien n'a changé ; courriel ; garde-fous ──
  n0 = majDem().length;
  await corriger(null, null);
  ok(majDem().length === n0 && toasts().some(t => /Rien n'a changé/.test(t)), "rien de changé : aucune écriture, « Rien n'a changé. »");
  alertes.length = 0;
  await corriger(null, "paul@");
  ok(alertes.some(a => /courriel n'a pas l'air valide/.test(a)) && majDem().length === n0, "courriel invalide : refusé");
  $("#dem-c-annuler").click();
  alertes.length = 0;
  await corriger("", null);
  ok(alertes.some(a => /préfère les textos : il faut un cellulaire/.test(a)) && majDem().length === n0, "il préfère les textos : impossible d'effacer le cellulaire");
  $("#dem-c-annuler").click();
  await corriger(null, "Paul@Nouveau.ca");
  const u2 = majDem().pop();
  ok(u2 && Object.keys(u2.vals).join() === "courriel" && u2.vals.courriel === "Paul@Nouveau.ca" && bt.courriel === "Paul@Nouveau.ca", "courriel seul : corrigé sur la demande et sur le bon (qui avait l'ancien)");

  // ── 8. Nom échappé ──
  w.__get("clients").find(c => c.id === "cl-1").nom = "<img src=x onerror=alert(1)>";
  await w.__dem.ouvrirFiche("D1"); await dodo(40);
  $("#dem-coord").click(); await dodo(10);
  ok(!$("#dem-zone img") && /<img src=x/.test($("#dem-zone").textContent), "nom du client affiché comme texte (aucun HTML injecté)");
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
