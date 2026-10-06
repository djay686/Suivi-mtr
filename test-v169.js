// v169 — TV du lift : tv.html (branchée avec le compte d'un technicien, elle suit son punch), « 📺 TV » dans le bon live et dans la procédure.
// NODE_PATH=… node test-v169.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");
let htmlProc = fs.readFileSync(FICHIER.replace(/index\.html$/, "procedure.html"), "utf8");
let htmlTv = fs.readFileSync(FICHIER.replace(/index\.html$/, "tv.html"), "utf8");
const CDN = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]*><\/script>/;

// ── Supabase en mémoire, partagé par l'app, la visionneuse et la TV (comme le vrai serveur) ──
const iso = (min) => new Date(Date.now() - min * 60000).toISOString();
const db = { ecrans: [{ id: "lift", nom: "Lift 2 colonnes", mode: "rien", etape: 0 }], tableau: [], procedures: [], procedure_etat: [] };
let pannes = {};
const cle = (nom, r) => nom === "procedure_etat" ? r.procedure_id + "|" + r.cle : r.id;
const table = (nom) => {
  const q = { op: "select", vals: null, filtres: [], un: false };
  const exec = () => {
    if (pannes[nom + ":" + q.op]) return { data: null, error: { message: pannes[nom + ":" + q.op] } };
    const rows = (db[nom] = db[nom] || []);
    const garde = r => q.filtres.every(f => f(r));
    let data = null;
    if (q.op === "select") data = JSON.parse(JSON.stringify(rows.filter(garde)));
    else if (q.op === "update") { data = rows.filter(garde); data.forEach(r => Object.assign(r, JSON.parse(JSON.stringify(q.vals)))); }
    else if (q.op === "insert" || q.op === "upsert") {
      data = [].concat(q.vals).map(v => JSON.parse(JSON.stringify(v)));
      data.forEach(d => { const i = rows.findIndex(r => cle(nom, r) === cle(nom, d)); if (q.op === "upsert" && i >= 0) rows[i] = Object.assign(rows[i], d); else rows.push(d); });
    }
    else if (q.op === "delete") { data = rows.filter(garde); db[nom] = rows.filter(r => !garde(r)); }
    if (q.un) data = Array.isArray(data) ? (data[0] || null) : data;
    return { data, error: null };
  };
  const ch = new Proxy({}, { get(t, k) {
    if (k === "then") return (ok, ko) => Promise.resolve(exec()).then(ok, ko);
    if (["update", "insert", "upsert", "delete"].includes(k)) return (v) => { q.op = k; q.vals = v; return ch; };
    if (k === "eq") return (c, v) => { q.filtres.push(r => r[c] === v); return ch; };
    if (k === "in") return (c, l) => { q.filtres.push(r => (l || []).includes(r[c])); return ch; };
    if (k === "single" || k === "maybeSingle") return () => { q.un = true; return ch; };
    return () => ch;
  } });
  return ch;
};
const faireStub = (canaux, auth) => ({
  from: table,
  channel: (nom) => { const o = { nom, h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe(cb) { o.sub = cb; if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return o; } }; canaux.push(o); return o; },
  removeChannel: () => {},
  auth: auth || { getSession: async () => ({ data: { session: { access_token: "ok" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }) },
  functions: { invoke: async () => ({ data: null, error: { message: "non" } }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: "test" } }) }) },
});
const pousser = (canaux, tableNom, ligne, ev = "UPDATE") => canaux.forEach(c => c.h.filter(h => h.f.table === tableNom && (h.f.event === "*" || h.f.event === ev)).forEach(h => h.cb({ eventType: ev, new: JSON.parse(JSON.stringify(ligne)) })));

const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const attendre = async (f, ms = 4000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await dodo(20); return f(); };
const ecran = (id = "lift") => db.ecrans.find(e => e.id === id);

// Le bon de travail : Gwendal y travaille (session ouverte), checklist 1/3, pièces
const m1 = { id: "bt-1", numeroBT: "BT-089", nom: "2021 Can-Am Maverick X3 Turbo", client: "Alexandre Alarie", tel: "819-555-1234", statut: "reparation", machineArrivee: true,
  travaux: "Entretien 50 h, bougies, CVT, freins 4 roues", numeroMachine: "42",
  chrono: [{ tech: "Gwendal", debut: iso(75), pauses: [] }],
  checklists: [{ id: "cl1", nom: "Préparation côte à côte", lignes: [{ texte: "Huile vérifiée", fait: true }, { texte: "Courroie inspectée", fait: false }, { texte: "Freins testés", fait: false }] }],
  pieces: [{ qte: "1", nom: "Filtre à huile", num: "420956744", coche: true, utilise: true }, { qte: "3", nom: "Bougies NGK", num: "LMAR9AI-8D", coche: true }, { qte: "1", nom: "Courroie", num: "422280652" }],
  notesLive: [{ texte: "Volant croche vers la gauche", tech: "Gwendal", quand: iso(30) }] };
const m2 = { id: "bt-2", numeroBT: "BT-090", nom: "<img src=x onerror=alert(1)>", client: "Marc", statut: "reparation", travaux: "Courroie", chrono: [{ tech: "Arno", debut: iso(20), pauses: [] }] };
db.tableau.push({ id: 1, donnees: [m1, m2] });
// Les employés (ligne 4) : la TV se branche avec le compte d'un technicien, comme dans l'app
db.tableau.push({ id: 4, donnees: [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true },
  { nom: "Arno", identifiant: "arno", role: "technicien", actif: true }, { nom: "Ex", nomFamille: "Employé", role: "technicien", actif: false }] });
const CONTENU = {
  version: 1, titre: "Entretien 50 h", bt: { numero: "BT-089", client: "Alexandre Alarie", machine: "2021 Maverick X3 Turbo" }, manuel: null,
  etapes: [
    { id: "s0", court: "Préparation", titre: "Avant de commencer", pourquoi: "", alertes: [{ niveau: "danger", texte: "Jamais de clé à chocs sur le couvercle CVT." }], specs: [], items: [{ t: "AMSOIL 5W-40 : **3,5 L**", cotes: [], pages: [] }], champs: [], figures: [] },
    { id: "s1", court: "Bougies", titre: "Changement des bougies", pourquoi: "Moteur froid.", alertes: [], specs: [{ nom: "Couple", valeur: "11 N·m", detail: "± 1" }],
      items: [{ t: "Retirer les bobines", cotes: [], pages: [] }, { t: "Poser les bougies à **11 N·m**", cotes: ["1", "2", "3"], pages: [] }],
      champs: [{ id: "s1_couleur", type: "choix", label: "Couleur des électrodes", options: [{ valeur: "Beige", verdict: "ok", message: "Normal" }, { valeur: "Blanche", verdict: "bad", message: "Mélange pauvre : aviser Jason" }] }], figures: [] },
    { id: "s2", court: "CVT", titre: "Inspection de la CVT", pourquoi: "", alertes: [], specs: [], items: [{ t: "Mesurer la courroie", cotes: [], pages: [] }],
      champs: [{ id: "s2_belt", type: "nombre", label: "Largeur de courroie", unite: "mm", min: 34.7, max: null, hors_niveau: "bad", hors_message: "Sous la limite : appeler le client", ok_message: "Dans la limite" }], figures: [] },
  ] };
db.procedures.push({ id: "PX", bt_id: "bt-1", statut: "prete", titre: "Entretien 50 h", contenu: CONTENU });

(async () => {
 // ══════════════ 1. L'app : « 📺 TV » dans le bon live ══════════════
 const canaux1 = [], sb1 = faireStub(canaux1);
 let h1 = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
 { const i = h1.lastIndexOf("</body>"); h1 = h1.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + h1.slice(i); }
 const confirmations = [];
 const dom = new JSDOM(h1, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
   beforeParse(w) { w.__sbStub = sb1; w.alert = () => {}; w.confirm = (m) => { confirmations.push(m); return true; }; w.prompt = () => ""; w.scrollTo = () => {};
     w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
     w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" }); } });
 const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
 const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
 const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
 await dodo(1500);
 try {
  w.__set("sb", sb1); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true }, { nom: "Gwendal", role: "technicien", actif: true }]);
  w.__set("sessionCourante", { nom: "Gwendal", quand: new Date().toISOString() });
  $("#ecran-connexion") && $("#ecran-connexion").classList.remove("ouvert");
  w.__set("machines", JSON.parse(JSON.stringify([m1, m2])));
  ok(w.tvRedirection("?tv=lift") === "tv.html?ecran=lift" && w.tvRedirection("?tv=Atelier2&x=1") === "tv.html?ecran=atelier2" && w.tvRedirection("?appel=819") === "", "« index.html?tv=lift » (le lien du brief) mène à la page TV légère");
  w.__set("liveId", "bt-1");
  w.document.getElementById("live-page").classList.add("ouvert"); w.liveRendre(); await dodo(60);
  ok($("#live-btn-tv") && $("#live-btn-tv").textContent === "📺 TV", "bon live : bouton « 📺 TV »");
  // Table pas installée
  pannes["ecrans:select"] = 'relation "public.ecrans" does not exist';
  await w.tvEnvoyerBT();
  ok(toasts().some(t => /exécute edge\/ecrans\.sql/.test(t) && /GUIDE-TV\.md/.test(t)), "table « ecrans » absente : on dit quoi installer (ecrans.sql, GUIDE-TV.md)");
  delete pannes["ecrans:select"];
  // Une seule TV : directement
  await w.tvEnvoyerBT();
  const e = ecran();
  ok(e.mode === "bt" && e.tech === "Gwendal" && e.bt_id === "bt-1" && e.procedure_id === null && e.maj_par === "Gwendal" && e.maj_le, "une TV : elle suit le BT en cours de Gwendal (repli : BT-089), sans demander laquelle");
  ok(toasts().some(t => /Lift 2 colonnes affiche ton BT en cours \(BT-089\) — elle suivra si tu changes de bon/.test(t)), "toast « Lift 2 colonnes affiche ton BT en cours — elle suivra si tu changes de bon »");
  ok(toasts().some(t => /ne s'est pas signalée depuis un moment/.test(t)), "TV jamais vue allumée : on le signale");
  ok($("#live-btn-tv").textContent === "📺 Sur la TV ✓" && $("#live-btn-tv").classList.contains("actif"), "bouton : « 📺 Sur la TV ✓ »");
  // Déjà sur la TV : on l'arrête
  await w.tvEnvoyerBT();
  ok(/suit déjà ton BT en cours/.test(confirmations.at(-1)) && ecran().mode === "rien" && $("#live-btn-tv").textContent === "📺 TV", "2e toucher : « Arrêter l'affichage sur la TV ? » → la TV se vide");
  // Un autre poste fait suivre Gwendal (temps réel)
  const autre = Object.assign({}, ecran(), { mode: "bt", tech: "Gwendal", vu_le: new Date().toISOString() });
  pousser(canaux1, "ecrans", autre);
  ok($("#live-btn-tv").textContent === "📺 Sur la TV ✓", "changé ailleurs (temps réel) : le bouton suit");
  pousser(canaux1, "ecrans", Object.assign({}, autre, { mode: "rien" }));
  // Deux TV : on choisit
  db.ecrans.push({ id: "atelier2", nom: "Poste 2 <b>", mode: "rien", etape: 0, vu_le: new Date().toISOString() });
  const envoi = w.tvEnvoyerBT();
  await attendre(() => $("#voile-tv") && $("#voile-tv").classList.contains("ouvert"));
  const choix = $$("#voile-tv [data-i]");
  ok(choix.length === 2 && /Poste 2 <b>/.test(choix[1].textContent) && !$("#voile-tv b") && /🟢 allumée/.test(choix[1].textContent) && /⚪/.test(choix[0].textContent), "deux TV : on choisit (nom affiché comme texte, 🟢 allumée / ⚪ pas vue)");
  choix[1].click(); await envoi;
  ok(ecran("atelier2").mode === "bt" && ecran("atelier2").tech === "Gwendal" && ecran("lift").mode === "rien" && !$("#voile-tv").classList.contains("ouvert"), "la TV choisie suit Gwendal, l'autre ne bouge pas");
  db.ecrans = db.ecrans.filter(x => x.id !== "atelier2"); await w.tvCharger();
  // Personne dans le bon
  w.__set("sessionCourante", null);
  w.__set("machines", [Object.assign(JSON.parse(JSON.stringify(m1)), { chrono: [] })]);
  await w.tvEnvoyerBT();
  ok(toasts().some(t => /Entre d'abord dans le bon/.test(t)) && ecran().mode === "rien", "personne dans le bon : « entre d'abord dans le bon » (la TV suit un technicien)");
 } catch (err) { ok(false, "exception (app) : " + (err && err.stack || err)); }
 ok(erreurs.length === 0, "app : aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));

 // ══════════════ 2. La visionneuse de procédure : « 📺 TV » ══════════════
 const canaux2 = [], sb2 = faireStub(canaux2);
 db.ecrans = [{ id: "lift", nom: "Lift 2 colonnes", mode: "bt", tech: "Gwendal", bt_id: "bt-1", etape: 0 }];
 const dom2 = new JSDOM(htmlProc.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/procedure.html?id=PX",
   beforeParse(v) { v.__PROC_ID = "PX"; v.supabase = { createClient: () => sb2 }; v.scrollTo = () => {};
     try { v.localStorage.setItem("mtr-session-v1", JSON.stringify({ nom: "Gwendal", quand: new Date().toISOString() })); } catch (_) {} } });
 const v = dom2.window; const erreurs2 = []; v.addEventListener("error", e => erreurs2.push(e.message));
 const V = (s) => v.document.querySelector(s), VV = (s) => [...v.document.querySelectorAll(s)];
 try {
  await attendre(() => V("#tvbtn") && !V("#tvbtn").hidden);
  ok(!V("#tvbtn").hidden && V("#tvbtn").textContent === "📺 TV", "procédure : bouton « 📺 TV » (les écrans sont installés)");
  V("#next").click(); await dodo(20);
  V("#tvbtn").click(); await dodo(30);
  ok(ecran().mode === "procedure" && ecran().procedure_id === "PX" && ecran().etape === 1 && ecran().tech === "Gwendal" && ecran().bt_id === "bt-1" && ecran().maj_par === "Gwendal", "« 📺 TV » : la TV affiche cette procédure, à l'étape en cours (1)");
  ok(V("#tvbtn").classList.contains("lie") && V("#tvbtn").textContent === "📺 Sur la TV", "bouton : « 📺 Sur la TV »");
  V("#next").click(); await attendre(() => ecran().etape === 2, 1500);
  ok(ecran().etape === 2, "Suivant sur le cell : la TV passe à l'étape 2");
  // La télécommande de la TV revient à l'étape 1 : le cell suit, sans renvoyer d'écriture
  ecran().etape = 1; ecran().maj_par = "télécommande";
  pousser(canaux2, "ecrans", ecran());
  await dodo(250);
  ok(/Changement des bougies/.test(V("#stepview h1").textContent) && ecran().maj_par === "télécommande", "télécommande de la TV → le cell revient à l'étape 1 (sans réécrire)");
  V("#tvbtn").click(); await dodo(20);
  ok(ecran().mode === "bt" && ecran().tech === "Gwendal" && V("#tvbtn").textContent === "📺 TV", "retirer : la TV revient au BT en cours de Gwendal");
  // Deux TV : petit menu
  db.ecrans.push({ id: "atelier2", nom: "Poste 2", mode: "rien", etape: 0 });
  pousser(canaux2, "ecrans", db.ecrans[1], "INSERT");
  V("#tvbtn").click(); await dodo(20);
  ok(!V("#tvmenu").hidden && VV("#tvmenu [data-tv]").length === 2, "deux TV : un petit menu pour choisir");
  VV("#tvmenu [data-tv]")[1].click(); await dodo(20);
  ok(ecran("atelier2").mode === "procedure" && ecran("atelier2").etape === 1 && V("#tvmenu").hidden, "la procédure part sur la TV choisie");
  db.ecrans = db.ecrans.filter(x => x.id !== "atelier2");
 } catch (err) { ok(false, "exception (visionneuse) : " + (err && err.stack || err)); }
 ok(erreurs2.length === 0, "visionneuse : aucune erreur JavaScript (" + erreurs2.length + ")" + (erreurs2.length ? " : " + erreurs2.slice(0, 3).join(" | ") : ""));

 // ══════════════ 3. La TV (tv.html) ══════════════
 const canaux3 = [], connexions = [];
 let deconnexions = 0, rappelAuth = null, compte = null;
 const auth3 = {
   getSession: async () => ({ data: { session: null } }),
   onAuthStateChange: (cb) => { rappelAuth = cb; return { data: { subscription: { unsubscribe() {} } } }; },
   signInWithPassword: async (o) => { connexions.push(o); return compte ? { data: { user: compte, session: { access_token: "t" } }, error: null } : { data: {}, error: { message: "Invalid login credentials" } }; },
   signOut: async () => { deconnexions++; if (rappelAuth) rappelAuth("SIGNED_OUT", null); return { error: null }; },
 };
 const sb3 = faireStub(canaux3, auth3);
 db.ecrans = [{ id: "lift", nom: "Lift 2 colonnes", mode: "rien", etape: 0 }];
 const dom3 = new JSDOM(htmlTv.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/tv.html?ecran=lift",
   beforeParse(t) { t.supabase = { createClient: () => sb3 }; t.__TV_ECRAN = "lift"; } });
 const t = dom3.window; const erreurs3 = []; t.addEventListener("error", e => erreurs3.push(e.message));
 const T = (s) => t.document.querySelector(s), TT = (s) => [...t.document.querySelectorAll(s)];
 const texte = () => T("#ecran").textContent.replace(/\s+/g, " ");
 const touche = (key, keyCode) => { const ev = new t.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }); Object.defineProperty(ev, "keyCode", { get: () => keyCode }); t.document.dispatchEvent(ev); };
 try {
  await attendre(() => T("#cx") && !T("#cx").hidden);
  ok(!T("#cx").hidden && T("#cx-id").value === "" && T("#cx-id").placeholder === "p.nom", "TV pas encore branchée : on se connecte avec son compte de technicien (p.nom) — pas de compte à part");
  const brancher = async (id, mdp) => { T("#cx-id").value = id; T("#cx-mdp").value = mdp; T("#cx-form").dispatchEvent(new t.Event("submit", { cancelable: true })); await dodo(40); };
  // Administration : refusée (règle du brief : jamais sur un écran visible de tous)
  compte = { id: "u-j", email: "j.blouin@mtrperformance.local" };
  await brancher("j.blouin", "secret");
  await attendre(() => /administration/.test(T("#cx-err").textContent));
  ok(/Pas de compte d'administration/.test(T("#cx-err").textContent) && deconnexions === 1 && T("#ecran").hidden, "compte d'administration refusé et déconnecté aussitôt");
  compte = { id: "u-x", email: "e.employe@mtrperformance.local" };
  await brancher("e.employe", "secret");
  await attendre(() => /employé actif/.test(T("#cx-err").textContent));
  ok(/pas un employé actif/.test(T("#cx-err").textContent) && deconnexions === 2, "employé inactif (ou inconnu) refusé");
  compte = null;
  await brancher("g.brossault", "mauvais");
  await attendre(() => /Refusé/.test(T("#cx-err").textContent));
  ok(/Refusé : nom d'utilisateur ou mot de passe/.test(T("#cx-err").textContent) && T("#ecran").hidden, "mauvais mot de passe : refusé");
  // Gwendal branche la TV avec SON compte
  compte = { id: "u-g", email: "g.brossault@mtrperformance.local" };
  await brancher("G.Brossault", "motdepasse");
  await attendre(() => !T("#ecran").hidden && /BT-089/.test(texte()));
  ok(connexions.at(-1).email === "g.brossault@mtrperformance.local" && connexions.at(-1).password === "motdepasse" && T("#cx").hidden, "« G.Brossault » → g.brossault@mtrperformance.local (comme dans l'app) : la TV se branche");
  await attendre(() => ecran().tech === "Gwendal");
  ok(ecran().mode === "bt" && ecran().tech === "Gwendal" && ecran().maj_par === "Gwendal", "branchée avec le compte de Gwendal : la TV suit son punch tout de suite, sans rien envoyer du cell");
  ok(/compte de Gwendal/.test(T("#pied").textContent), "en bas de l'écran : « compte de Gwendal »");
  await attendre(() => ecran().bt_id === "bt-1");
  ok(ecran().bt_id === "bt-1", "le bon de son punch est retenu (BT-089)");
  // Le BT en cours de Gwendal
  ok(/BT-089/.test(texte()) && /2021 Can-Am Maverick X3 Turbo/.test(texte()) && /Alexandre Alarie/.test(texte()) && /Gwendal/.test(texte()), "BT en cours de Gwendal : BT-089, machine, client, technicien");
  ok(!/819-555-1234/.test(texte()), "aucun numéro de téléphone sur la TV");
  ok(/Entretien 50 h, bougies/.test(texte()) && /Préparation côte à côte\s*1 \/ 3/.test(texte()) && /☐\s*Courroie inspectée/.test(texte()) && /✔\s*Huile vérifiée/.test(texte()), "travaux + checklist (1 / 3, ✔ fait, ☐ à faire)");
  ok(/Filtre à huile.*✔ utilisée/.test(texte()) && /Bougies NGK.*📦 reçue/.test(texte()) && /Courroie.*⏳ à recevoir/.test(texte()) && /Volant croche/.test(texte()), "pièces (utilisée / reçue / à recevoir) et dernières notes");
  ok(/^01:1[45]:\d\d$/.test(T("[data-chrono]").textContent), "chrono de Gwendal en marche (" + T("[data-chrono]").textContent + ")");
  // Le technicien coche sur son cell → la TV suit (temps réel)
  const m1b = JSON.parse(JSON.stringify(m1)); m1b.checklists[0].lignes[1].fait = true;
  pousser(canaux3, "tableau", { id: 1, donnees: [m1b, m2] });
  ok(/Préparation côte à côte\s*2 \/ 3/.test(texte()) && /✔\s*Courroie inspectée/.test(texte()), "case cochée sur le cell → la TV se met à jour (2 / 3)");
  // Gwendal change de bon : la TV suit
  const m3 = { id: "bt-3", numeroBT: "BT-091", nom: "Ski-Doo Summit", client: "Luc", statut: "reparation", travaux: "Suspension", chrono: [{ tech: "Gwendal", debut: iso(2), pauses: [] }] };
  m1b.chrono[0].fin = iso(3);
  pousser(canaux3, "tableau", { id: 1, donnees: [m1b, m2, m3] });
  ok(/BT-091/.test(texte()) && /Ski-Doo Summit/.test(texte()) && !/BT-089/.test(texte()), "Gwendal ouvre un autre bon : la TV le suit toute seule (BT-091)");
  await attendre(() => ecran().bt_id === "bt-3");
  // Punch fermé : la TV garde le dernier bon, marqué « pas de punch en cours »
  m3.chrono[0].fin = iso(1);
  pousser(canaux3, "tableau", { id: 1, donnees: [m1b, m2, m3] });
  ok(/BT-091/.test(texte()) && /pas de punch en cours/.test(texte()) && ecran().bt_id === "bt-3", "punch fermé : la TV garde son dernier bon (BT-091), « pas de punch en cours »");
  // Rien à l'écran
  db.ecrans[0].mode = "rien"; pousser(canaux3, "ecrans", db.ecrans[0]);
  await attendre(() => /Rien à l'écran/.test(texte()));
  ok(/Rien à l'écran/.test(texte()) && T("[data-horloge]") && /Lift 2 colonnes/.test(texte()), "mode « rien » : horloge et nom de l'écran");
  // ── Procédure ──
  db.procedure_etat.push({ procedure_id: "PX", cle: "c:s1-0", valeur: { done: true, par: "Gwendal" } }, { procedure_id: "PX", cle: "c:s1-1-1", valeur: { done: true } }, { procedure_id: "PX", cle: "f:s1_couleur", valeur: { v: "Blanche" } });
  Object.assign(db.ecrans[0], { mode: "procedure", procedure_id: "PX", etape: 1 });
  pousser(canaux3, "ecrans", db.ecrans[0]);
  await attendre(() => /Changement des bougies/.test(texte()));
  ok(/Étape 1 \/ 2/.test(texte()) && /Changement des bougies/.test(texte()) && /11 N·m/.test(texte()) && /Entretien 50 h/.test(texte()), "procédure : « Étape 1 / 2 », titre, spec en gros (11 N·m)");
  ok(/✔\s*Retirer les bobines/.test(texte()) && TT(".cotes i.ok").length === 1 && TT(".cotes i").length === 3, "coches partagées : action faite ✔, cylindre 1 sur 3 (cases par côté)");
  ok(/Couleur des électrodes : Blanche — Mélange pauvre : aviser Jason/.test(texte()) && T(".alerte.danger"), "mesure hors spec : alerte rouge en haut de l'étape");
  pousser(canaux3, "procedure_etat", { procedure_id: "PX", cle: "c:s1-1-2", valeur: { done: true } }, "INSERT");
  ok(TT(".cotes i.ok").length === 2, "coche faite sur le cell → cylindre 2 ✔ sur la TV");
  // Télécommande : ▶
  touche("ArrowRight", 39); await dodo(20);
  ok(db.ecrans[0].etape === 2 && /Inspection de la CVT/.test(texte()) && db.ecrans[0].maj_par === "télécommande", "télécommande ▶ : étape 2 (et le cell est prévenu par la ligne d'écran)");
  touche("", 228); await dodo(20);
  ok(db.ecrans[0].etape === 2 && /Dernière étape/.test(T("#bulle").textContent), "avance rapide à la dernière étape : « Dernière étape »");
  touche("ArrowLeft", 37); await dodo(20);
  ok(db.ecrans[0].etape === 1, "télécommande ◀ : retour à l'étape 1");
  ok(TT(".pied .pts i").length === 3 && T(".pied .pts i.ici"), "barre des étapes en bas (3, l'étape en cours marquée)");
  // Toujours allumée
  t.__tv.battement(); await dodo(20);
  ok(db.ecrans[0].vu_le && Date.now() - new Date(db.ecrans[0].vu_le) < 5000, "la TV signale qu'elle est allumée (vu_le)");
  // Échappement
  Object.assign(db.ecrans[0], { mode: "bt", tech: "Arno", procedure_id: null }); pousser(canaux3, "ecrans", db.ecrans[0]);
  await attendre(() => /BT-090/.test(texte()));
  ok(/BT-090/.test(texte()) && !T("#ecran img[src='x']") && /<img src=x/.test(texte()), "nom de machine affiché comme texte (aucun HTML injecté)");
  // Beaucoup de contenu : tout tient à l'écran
  const long = { id: "bt-9", numeroBT: "BT-099", nom: "Gros bon", client: "X", statut: "reparation", travaux: Array.from({ length: 14 }, (_, i) => "Travail numéro " + (i + 1) + " à faire soigneusement").join("\n"),
    chrono: [{ tech: "Zoé", debut: iso(5), pauses: [] }], checklists: [{ nom: "Longue", lignes: Array.from({ length: 16 }, (_, i) => ({ texte: "Point de contrôle " + i, fait: i % 2 === 0 })) }],
    pieces: Array.from({ length: 10 }, (_, i) => ({ qte: "1", nom: "Pièce " + i, num: "N" + i })) };
  pousser(canaux3, "tableau", { id: 1, donnees: [m1b, m2, m3, long] });
  Object.assign(db.ecrans[0], { tech: "Zoé" }); pousser(canaux3, "ecrans", db.ecrans[0]);
  await attendre(() => /BT-099/.test(texte()));
  const k = parseFloat(t.getComputedStyle(t.document.documentElement).getPropertyValue("--k")) || 1, c = T("#corps");
  ok(c.scrollHeight <= c.clientHeight + 2 || k <= 0.56, "beaucoup de contenu : la taille se réduit pour que tout tienne (k = " + k + ")");
 } catch (err) { ok(false, "exception (TV) : " + (err && err.stack || err)); }
 ok(erreurs3.length === 0, "TV : aucune erreur JavaScript (" + erreurs3.length + ")" + (erreurs3.length ? " : " + erreurs3.slice(0, 3).join(" | ") : ""));

 // ══════════════ 4. Nouvel écran et table absente ══════════════
 try {
  const canaux4 = [];
  const session = (email) => Object.assign({}, auth3, { getSession: async () => ({ data: { session: { user: { email } } } }) });
  const sb4 = faireStub(canaux4, session("g.brossault@mtrperformance.local"));
  const dom4 = new JSDOM(htmlTv.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/tv.html?ecran=poste2",
    beforeParse(x) { x.supabase = { createClient: () => sb4 }; x.__TV_ECRAN = "poste2"; } });
  await attendre(() => ecran("poste2"));
  ok(ecran("poste2") && ecran("poste2").mode === "rien", "nouvel écran (tv.html?ecran=poste2) : il s'inscrit tout seul, vide (rallumée : elle ne s'impose pas)");
  // Rallumée avec un compte devenu administrateur : débranchée
  const avant = deconnexions;
  const sb6 = faireStub([], session("j.blouin@mtrperformance.local"));
  const dom6 = new JSDOM(htmlTv.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/tv.html",
    beforeParse(x) { x.supabase = { createClient: () => sb6 }; } });
  const err6 = () => { const e = dom6.window.document.getElementById("cx-err"); return e ? e.textContent : ""; };
  await attendre(() => /administration/.test(err6()));
  ok(/Pas de compte d'administration/.test(err6()) && deconnexions === avant + 1, "rallumée avec un compte d'administration : débranchée, écran de connexion");
  pannes["ecrans:select"] = 'relation "public.ecrans" does not exist';
  const sb5 = faireStub([], session("g.brossault@mtrperformance.local"));
  const dom5 = new JSDOM(htmlTv.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/tv.html",
    beforeParse(x) { x.supabase = { createClient: () => sb5 }; } });
  const corps5 = () => { const c = dom5.window.document.getElementById("corps"); return c ? c.textContent : ""; };
  await attendre(() => /ecrans\.sql/.test(corps5()));
  ok(/exécute edge\/ecrans\.sql/.test(corps5()), "table absente : la TV dit quoi installer");
  delete pannes["ecrans:select"];
 } catch (err) { ok(false, "exception (écrans) : " + (err && err.stack || err)); }
 process.exit();
})();
