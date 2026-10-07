// test-lib-v178.js — socle commun des tests v178 (remplace les ~15 copies du faux Supabase / du chargement de l'app).
// Fonctionne tel quel avec jsdom (node) ET dans Chromium. NODE_PATH=…/jsdom/node_modules node test-v178-xxx.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const cp = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
const attendre = async (f, ms = 5000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await dodo(20); return !!f(); };
const jourIso = (d = 0) => { const x = new Date(); x.setDate(x.getDate() + d); const p = (n) => String(n).padStart(2, "0"); return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate()); };
// n-ième jour OUVRABLE à partir d'aujourd'hui (n=0 : aujourd'hui s'il est ouvrable, sinon lundi) -> le test ne dépend plus du jour où on le lance (v168b échoue un samedi / dimanche)
const jourOuvrableIso = (n = 0) => { const x = new Date(); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); for (let i = 0; i < n; i++) { x.setDate(x.getDate() + 1); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); } const p = (k) => String(k).padStart(2, "0"); return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate()); };
let _echecs = 0;
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) { _echecs++; process.exitCode = 1; } };

// ── Supabase en mémoire : select / insert / upsert / update / delete ; eq neq in is not gt gte lt lte ; order limit single maybeSingle ──
// db = { table: [lignes] } ; cle(nom, ligne) = clé primaire (défaut : id ; procedure_etat = procedure_id|cle)
function creerSupabase(db = {}, { cle, invoke, user = "g.brossault@mtrperformance.local" } = {}) {
  const appels = [], canaux = [], pannes = {};        // pannes["table:op"] = "message" -> { error }
  const clef = cle || ((nom, r) => (nom === "procedure_etat" ? r.procedure_id + "|" + r.cle : r.id));
  let prochainId = 1000;
  const table = (nom) => {
    const q = { op: "select", vals: null, f: [], un: false, ord: null, lim: null };
    const exec = () => {
      appels.push({ table: nom, op: q.op, vals: cp(q.vals) });
      if (pannes[nom + ":" + q.op]) return { data: null, error: { message: pannes[nom + ":" + q.op] } };
      const rows = (db[nom] = db[nom] || []);
      const garde = (r) => q.f.every((fn) => fn(r));
      let data;
      if (q.op === "select") { data = rows.filter(garde); if (q.ord) data = [...data].sort((a, b) => (a[q.ord.c] > b[q.ord.c] ? 1 : a[q.ord.c] < b[q.ord.c] ? -1 : 0) * (q.ord.asc ? 1 : -1)); if (q.lim != null) data = data.slice(0, q.lim); data = cp(data); }
      else if (q.op === "update") { data = rows.filter(garde); data.forEach((r) => Object.assign(r, cp(q.vals))); data = cp(data); }
      else if (q.op === "insert" || q.op === "upsert") {
        data = [].concat(q.vals).map((v) => Object.assign(q.op === "insert" && v.id === undefined ? { id: prochainId++ } : {}, cp(v)));
        data.forEach((d) => { const i = rows.findIndex((r) => clef(nom, r) === clef(nom, d)); if (q.op === "upsert" && i >= 0) rows[i] = Object.assign(rows[i], d); else rows.push(d); });
      }
      else if (q.op === "delete") { data = rows.filter(garde); db[nom] = rows.filter((r) => !garde(r)); data = cp(data); }
      if (q.un) data = Array.isArray(data) ? data[0] || null : data;
      return { data, error: null };
    };
    const ch = new Proxy({}, { get(t, k) {
      if (k === "then") return (res, rej) => Promise.resolve(exec()).then(res, rej);
      if (["update", "insert", "upsert", "delete"].includes(k)) return (v) => { q.op = k; q.vals = v; return ch; };
      const cmp = { eq: (a, b) => a === b, neq: (a, b) => a !== b, gt: (a, b) => a > b, gte: (a, b) => a >= b, lt: (a, b) => a < b, lte: (a, b) => a <= b };
      if (cmp[k]) return (c, v) => { q.f.push((r) => cmp[k](r[c], v)); return ch; };
      if (k === "in") return (c, l) => { q.f.push((r) => (l || []).includes(r[c])); return ch; };
      if (k === "is") return (c, v) => { q.f.push((r) => (r[c] == null ? null : r[c]) === v); return ch; };
      if (k === "not") return (c, op, v) => { q.f.push((r) => !(op === "is" ? (r[c] == null ? null : r[c]) === v : r[c] === v)); return ch; };
      if (k === "order") return (c, o) => { q.ord = { c, asc: !(o && o.ascending === false) }; return ch; };
      if (k === "limit") return (n) => { q.lim = n; return ch; };
      if (k === "single" || k === "maybeSingle") return () => { q.un = true; return ch; };
      return () => ch;                                    // select(), range()…
    } });
    return ch;
  };
  const sb = {
    from: table,
    channel: (nom) => { const o = { nom, h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe(cb) { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return o; } }; canaux.push(o); return o; },
    removeChannel: () => {},
    auth: { getSession: async () => ({ data: { session: { access_token: "ok", user: { email: user } } } }), getUser: async () => ({ data: { user: { email: user } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }) },
    functions: { invoke: invoke || (async () => ({ data: null, error: { message: "non" } })) },
    storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: null, error: { message: "absent" } }) }) },
  };
  // « un autre poste » écrit : modifier db PUIS pousser(table, ligne, "INSERT" | "UPDATE" | "DELETE")
  const pousser = (t, ligne, ev) => canaux.forEach((c) => c.h.filter((h) => h.f.table === t && (h.f.event === "*" || h.f.event === ev)).forEach((h) => h.cb({ eventType: ev, new: cp(ligne), old: ev === "DELETE" ? cp(ligne) : null })));
  return { sb, db, appels, pannes, pousser, canaux, ecrits: (t, op) => appels.filter((a) => a.table === t && (!op || a.op === op)) };
}

// ── Charger l'app (index.html) dans un faux navigateur ; renvoie tout ce qu'il faut pour piloter et observer ──
async function chargerApp({ sb, fetch, url = "https://atelier.mtrperformance.ca/", fichier = process.argv[2] || "./index.html", attente = 1500, avant } = {}) {
  let html = fs.readFileSync(fichier, "utf8");
  html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
  { const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
  const alertes = [], confirmations = [], prompts = [], ouvertures = [], appelsFetch = [], vibrations = [], sons = { contextes: 0, notes: [], pics: [] };
  const o = { alertes, confirmations, prompts, ouvertures, appelsFetch, vibrations, sons, reponseConfirm: true, reponsePrompt: "" };
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url, beforeParse(w) {
    w.__sbStub = sb; w.alert = (m) => alertes.push(String(m)); w.confirm = (m) => { confirmations.push(String(m)); return o.reponseConfirm; }; w.prompt = (m) => { prompts.push(String(m)); return o.reponsePrompt; };
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.open = (u) => { const f = { url: u, html: "", document: { write(h) { f.html += h; }, close() {} }, close() { f.ferme = true; }, location: {} }; ouvertures.push(f); return f; };
    // sons : jamais de vrai son ; on note les notes (fréquences) et les « pics » de volume demandés (gain.exponentialRampToValueAtTime(v>0.001))
    w.AudioContext = w.webkitAudioContext = class { constructor() { sons.contextes++; this.state = "running"; this.currentTime = 0; this.destination = {}; }
      resume() {} close() {}
      createOscillator() { return { type: "", frequency: { set value(v) { sons.notes.push(v); } }, connect(x) { return x; }, start() {}, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime(v) { if (v > 0.001) sons.pics.push(v); } }, connect(x) { return x; } }; } };
    Object.defineProperty(w.navigator, "vibrate", { configurable: true, value: (p) => { vibrations.push(p); return true; } });
    w.fetch = async (u, init) => { appelsFetch.push({ url: String(u), body: init && init.body ? (() => { try { return JSON.parse(init.body); } catch (e) { return init.body; } })() : null });
      const r = fetch ? await fetch(String(u), init) : null; if (!r) return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
      return { ok: (r.status || 200) < 300, status: r.status || 200, json: async () => r.data || {}, text: async () => JSON.stringify(r.data || {}) }; };
    if (avant) avant(w);
  } });
  const w = dom.window, erreurs = []; w.addEventListener("error", (e) => erreurs.push(e.message));
  const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
  const toasts = () => [...w.document.body.children].filter((x) => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map((x) => x.textContent);
  const set = (n, v) => w.__set(n, v), get = (n) => w.__get(n);
  await dodo(attente);
  set("sb", sb); set("chargementOK", true);
  return Object.assign(o, { dom, w, $, $$, toasts, erreurs, set, get, txt: (s) => ((typeof s === "string" ? $(s) : s) || { textContent: "" }).textContent.replace(/\s+/g, " ").trim() });
}
// Séance d'ouverture habituelle : employés + qui est connecté
const EMP = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }];
const connecter = (A, nom = "Jason", employes = EMP) => { A.set("EMPLOYES", cp(employes)); A.set("sessionCourante", { nom, quand: new Date().toISOString() }); };
const fin = (A) => { ok(A.erreurs.length === 0, "aucune erreur JavaScript (" + A.erreurs.length + ")" + (A.erreurs.length ? " : " + A.erreurs.slice(0, 3).join(" | ") : "")); process.exit(); };
module.exports = { JSDOM, fs, cp, dodo, attendre, jourIso, jourOuvrableIso, ok, creerSupabase, chargerApp, connecter, fin, EMP, echecs: () => _echecs };
