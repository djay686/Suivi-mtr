// v178 — lot FAC : retrait complet du « 🎁 cadeau / payé comptant » (A5) puis notes d'atelier dans Facturer (A4).
//   A5 : migration idempotente (chargement, temps réel, poste en retard, import, relireMachines sans boucle, journal d'inventaire),
//        chemin de remplacement (« → Facturé » puis « ✓ Livrée », depuis « Prêt à facturer » et « Commande de pièce »),
//        aucune trace dans les fichiers servis (grep statique, hors des deux fonctions de purge).
//   A4 : notes d'atelier dans Facturer (ordre récent en premier, aucune mutation du bon, échappement, champ statique, brouillons,
//        téléphone, non-fuite vers QuickBooks / CSV / facturation).
// Autonome (faux Supabase en ligne, même moteur que outils-v178/test-lib-v178.js).
//   node outils-v178/run-in-chromium.js test-v178-fac.js ./index.html        (ou NODE_PATH=…/jsdom node test-v178-fac.js ./index.html)
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
const DOSSIER = FICHIER.replace(/[^/]*$/, "");
const cp = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
const attendre = async (f, ms = 5000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await dodo(20); return !!f(); };
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const EMP = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }];
const iso = (h, mn) => new Date(Date.UTC(2026, 8, 21, h, mn)).toISOString();

// ── Faux Supabase en mémoire (même moteur que outils-v178/test-lib-v178.js) ──
function creerSupabase(db) {
  const appels = [], canaux = [];
  const table = (nom) => {
    const q = { op: "select", vals: null, f: [], un: false, ord: null, lim: null };
    const exec = () => {
      appels.push({ table: nom, op: q.op, vals: cp(q.vals) });
      const rows = (db[nom] = db[nom] || []);
      const garde = (r) => q.f.every((fn) => fn(r));
      let data;
      if (q.op === "select") { data = rows.filter(garde); data = cp(data); }
      else if (q.op === "update") { data = rows.filter(garde); data.forEach((r) => Object.assign(r, cp(q.vals))); data = cp(data); }
      else if (q.op === "insert" || q.op === "upsert") {
        data = [].concat(q.vals).map((v) => cp(v));
        data.forEach((d) => { const i = rows.findIndex((r) => r.id === d.id); if (q.op === "upsert" && i >= 0) rows[i] = Object.assign(rows[i], d); else rows.push(d); });
      } else if (q.op === "delete") { data = rows.filter(garde); db[nom] = rows.filter((r) => !garde(r)); data = cp(data); }
      if (q.un) data = Array.isArray(data) ? data[0] || null : data;
      return { data, error: null };
    };
    const ch = new Proxy({}, { get(t, k) {
      if (k === "then") return (res, rej) => Promise.resolve(exec()).then(res, rej);
      if (["update", "insert", "upsert", "delete"].includes(k)) return (v) => { q.op = k; q.vals = v; return ch; };
      if (k === "eq") return (c, v) => { q.f.push((r) => r[c] === v); return ch; };
      if (k === "neq") return (c, v) => { q.f.push((r) => r[c] !== v); return ch; };
      if (k === "in") return (c, l) => { q.f.push((r) => (l || []).includes(r[c])); return ch; };
      if (k === "is") return (c, v) => { q.f.push((r) => (r[c] == null ? null : r[c]) === v); return ch; };
      if (k === "single" || k === "maybeSingle") return () => { q.un = true; return ch; };
      return () => ch;
    } });
    return ch;
  };
  const sb = {
    from: table,
    channel: (nom) => { const o = { nom, h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe(cb) { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return o; } }; canaux.push(o); return o; },
    removeChannel: () => {},
    auth: { getSession: async () => ({ data: { session: { access_token: "ok", user: { email: "g.brossault@mtrperformance.local" } } } }), getUser: async () => ({ data: { user: { email: "g.brossault@mtrperformance.local" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }) },
    functions: { invoke: async () => ({ data: null, error: { message: "non" } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: null, error: { message: "absent" } }) }) },
  };
  const pousser = (t, ligne, ev) => canaux.forEach((c) => c.h.filter((h) => h.f.table === t && (h.f.event === "*" || h.f.event === ev)).forEach((h) => h.cb({ eventType: ev, new: cp(ligne), old: null })));
  const ecrits = (id) => appels.filter((a) => a.table === "tableau" && a.op === "upsert" && a.vals && a.vals.id === id);
  return { sb, db, appels, pousser, canaux, ecrits, ligne: (id) => ((db.tableau || []).find((r) => r.id === id) || {}).donnees };
}

// ── L'application dans un faux navigateur ──
const apps = [];
async function chargerApp(S, { attente = 1500, matches = false } = {}) {
  let html = fs.readFileSync(FICHIER, "utf8");
  html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
  { const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
  const o = { alertes: [], confirmations: [], fetchs: [], appelsQbo: [], reponseQbo: null, mm: { matches } };
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/", beforeParse(w) {
    w.__sbStub = S.sb; w.alert = (m) => o.alertes.push(String(m)); w.confirm = (m) => { o.confirmations.push(String(m)); return true; }; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ get matches() { return o.mm.matches; }, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.open = () => ({ document: { write() {}, close() {} }, close() {}, location: {} });
    w.fetch = async (u, init) => { const corps = init && init.body ? (() => { try { return JSON.parse(init.body); } catch (e) { return init.body; } })() : null; o.fetchs.push({ url: String(u), body: corps });
      if (/functions\/v1\/quickbooks/.test(String(u))) { o.appelsQbo.push(corps); const r = o.reponseQbo ? o.reponseQbo(corps) : { status: 200, data: { ok: true } }; return { ok: r.status < 300, status: r.status, json: async () => r.data }; }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" }; };
    try { w.localStorage.clear(); } catch (_) {}
  } });
  const w = dom.window, erreurs = []; w.addEventListener("error", (e) => erreurs.push(e.message));
  const A = Object.assign(o, { dom, w, S, erreurs, $: (s) => w.document.querySelector(s), $$: (s) => [...w.document.querySelectorAll(s)],
    set: (n, v) => w.__set(n, v), get: (n) => w.__get(n) });
  A.machines = () => w.__get("machines");
  A.bt = (id) => A.machines().find((m) => m.id === id);
  A.local = () => { try { return JSON.parse(w.localStorage.getItem(w.__get("CLE"))); } catch (_) { return null; } };
  A.toasts = () => [...w.document.body.children].filter((x) => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map((x) => x.textContent);
  apps.push(A);
  await dodo(attente);
  return A;
}
const connecter = (A, nom = "Jason") => { A.set("EMPLOYES", cp(EMP)); A.set("sessionCourante", { nom, quand: new Date().toISOString() }); };
// Démarre comme un vrai poste : lecture du serveur par demarrerDonnees (charger), puis attente que les écritures de la migration se posent
async function ouvrir(db, { nom = "Jason", attente = 1200 } = {}) {
  const S = creerSupabase(db);
  const A = await chargerApp(S);
  connecter(A, nom);
  await A.w.demarrerDonnees();
  await dodo(attente);
  return A;
}
const fermer = (A) => { try { A.dom.frame && A.dom.frame.remove(); } catch (_) {} };

// ── Données de migration : ce que la v177 a laissé au serveur ──
const P = (num, nom, q, o) => Object.assign({ num, nom, qte: String(q), coche: true }, o || {});
const sale = () => ([
  { id: "c1", numeroBT: "BT-201", nom: "Can-Am Renegade", client: "Client un", statut: "prete", livreLe: "", chrono: [{ tech: "Gwendal", debut: iso(12, 0), fin: iso(13, 0), pauses: [] }],
    cadeau: { le: iso(14, 0), par: "Jason", montant: 190 }, invSortieFaite: true, invSortieSource: "cadeau", invSorties: { A1: { num: "A1", qte: 1, prixU: 15 } },
    pieces: [P("A1", "Anode", 1, { utilise: true, prixVente: 15 })], photos: [{ url: "p1" }], pretAFacturerLe: iso(9, 0) },
  { id: "c2", numeroBT: "BT-202", nom: "Polaris RZR", client: "Client deux", statut: "archive", livreLe: "2026-09-22",
    cadeau: { le: iso(15, 0), par: "Jason", montant: 23.29 }, invSortieFaite: true, invSortieSource: "cadeau", invSorties: { WCFQTC: { num: "WCFQTC", qte: 1, prixU: 23.29 } },
    rentabilite: { cadeau: true, comeback: false, revenuPotentiel: 23.29, coutTotal: 14, profit: -14, marge: 0, dateFin: "2026-09-22", calculeLe: iso(20, 0), taux: 100, heuresFacturees: 0, employes: [] },
    pieces: [P("WCFQTC", "Huile", 1, { utilise: true, prixVente: 23.29 })] },
  { id: "c3", numeroBT: "BT-203", nom: "Honda Pioneer", client: "Client trois", statut: "archive", livreLe: "2026-09-20", invSortieFaite: true, invSortieSource: "rattrapage", invSorties: { X9: { num: "X9", qte: 1, prixU: 12 } }, pieces: [P("X9", "Bougie", 1)] },
  { id: "c4", numeroBT: "BT-204", nom: "Yamaha FX", client: "Client quatre", statut: "prete", rentabilite: { cadeau: true, revenuPotentiel: 0, coutTotal: 5, profit: -5, dateFin: "2026-09-21", calculeLe: iso(18, 0) }, invSortieFaite: true, invSortieSource: "facture", invSorties: {}, pieces: [] },
  { id: "c5", numeroBT: "BT-205", nom: "Sea-Doo Spark", client: "Client cinq", statut: "reparation", pieces: [] },
]);
// ce que la migration doit donner : mêmes bons sans la clé cadeau ni invSortieSource « cadeau », rien d'autre
const propre = (liste) => liste.map((m) => { const x = cp(m); delete x.cadeau; if (x.invSortieSource === "cadeau") delete x.invSortieSource; return x; });
const mouvSales = () => ([
  { id: "v1", ts: iso(14, 1), num: "A1", desc: "Anode", qte: -1, avant: 6, apres: 5, motif: "vente", ref: "BT-201 · 🎁 cadeau", qui: "Jason", bt: "c1" },
  { id: "v2", ts: iso(15, 1), num: "WCFQTC", desc: "Huile", qte: -1, avant: 10, apres: 9, motif: "vente", ref: "BT-202 · 🎁 cadeau", qui: "Jason", bt: "c2" },
  { id: "v3", ts: iso(16, 0), num: "X9", desc: "Bougie", qte: -1, avant: 8, apres: 7, motif: "vente", ref: "BT-203", qui: "Gwendal" },
]);
const mouvPropres = () => mouvSales().map((x) => Object.assign(x, { ref: x.ref.replace(" · 🎁 cadeau", "") }));
const aDesTraces = (liste) => (liste || []).some((m) => m && (Object.prototype.hasOwnProperty.call(m, "cadeau") || m.invSortieSource === "cadeau"));
const refsSales = (liste) => (liste || []).some((x) => x && /🎁|cadeau/i.test(x.ref || ""));
const index = fs.readFileSync(FICHIER, "utf8");
const jsonSale = (t) => /"cadeau":\{"le"|"invSortieSource":"cadeau"|🎁 cadeau/.test(t);

(async () => {
 await dodo(200);
 let A = null;
 try {
  // ═══════════ M1. Chargement : la migration nettoie les bons et le journal, puis écrit UNE fois chaque ligne ═══════════
  const db1 = { tableau: [{ id: 1, donnees: sale() }, { id: 4, donnees: cp(EMP) }, { id: 12, donnees: mouvSales() }], tableau_sauvegardes: [] };
  A = await ouvrir(db1);
  const attendu = propre(sale());
  ok(A.machines().length === 5 && !aDesTraces(A.machines()) && !A.machines().some((m) => m.invSortieSource === "cadeau"), "chargement : plus aucun bon avec la clé cadeau ni invSortieSource « cadeau »");
  ok(JSON.stringify(A.machines()) === JSON.stringify(attendu) || A.machines().every((m, i) => JSON.stringify(Object.keys(m).sort()) === JSON.stringify(Object.keys(attendu[i]).sort()) && JSON.stringify(m) === JSON.stringify(attendu[i])), "tout le reste est intact : statuts, livreLe, chrono, pieces, photos, invSorties, numeroBT, pretAFacturerLe");
  ok(A.bt("c3").invSortieSource === "rattrapage" && A.bt("c4").invSortieSource === "facture", "invSortieSource « rattrapage » et « facture » conservés");
  ok(A.bt("c2").rentabilite && A.bt("c2").rentabilite.cadeau === true && A.bt("c4").rentabilite.cadeau === true && !("cadeau" in A.bt("c4")), "rentabilite.cadeau conservé (bascule 🎁 « offert » de la Rentabilité), y compris sans m.cadeau");
  ok(A.bt("c1").statut === "prete" && A.bt("c2").statut === "archive" && A.bt("c2").livreLe === "2026-09-22" && A.bt("c1").invSorties.A1.qte === 1, "statuts et livraison inchangés : c1 prete, c2 archive livré le 22 sept.");
  const mv = A.get("invMouv");
  ok(mv.length === 3 && !refsSales(mv) && mv.map((x) => x.ref).join("|") === "BT-201|BT-202|BT-203" && mv.every((x, i) => x.id === ["v1", "v2", "v3"][i] && x.qte === -1), "journal d'inventaire : refs sans « · 🎁 cadeau », les 3 mouvements gardés");
  const e1 = A.S.ecrits(1), e12 = A.S.ecrits(12);
  ok(e1.length === 1 && e12.length === 1, "UN upsert de la ligne 1 et UN de la ligne 12 (" + e1.length + " et " + e12.length + ")");
  ok(e1.length && !aDesTraces(e1[0].vals.donnees) && e1[0].vals.donnees.length === 5 && e12.length && !refsSales(e12[0].vals.donnees) && e12[0].vals.donnees.length === 3, "ce qui est écrit au serveur est propre : 5 bons sans cadeau, 3 mouvements sans 🎁");
  ok(!aDesTraces(A.S.ligne(1)) && !refsSales(A.S.ligne(12)), "le serveur (faux) est nettoyé : lignes 1 et 12");
  const loc = A.local();
  ok(loc && loc.length === 5 && !aDesTraces(loc) && !jsonSale(A.w.localStorage.getItem(A.get("CLE"))), "secours local (localStorage) sans trace");
  ok(!jsonSale(A.w.localStorage.getItem(A.get("CLE_MOUV")) || ""), "journal local (localStorage) sans trace");
  const jetons = A.S.db.tableau_sauvegardes;
  ok(Array.isArray(jetons), "(les instantanés tableau_sauvegardes ne se nettoient que par le SQL : voir edge/purge-cadeau-v178.sql)");
  const serveurApres = cp(A.S.db);
  fermer(A);

  // ═══════════ M2. Un 2e chargement n'écrit plus rien (idempotent) ═══════════
  A = await ouvrir(serveurApres);
  ok(A.machines().length === 5 && !aDesTraces(A.machines()), "2e chargement : toujours propre");
  ok(A.S.ecrits(1).length === 0 && A.S.ecrits(12).length === 0, "2e chargement : aucun upsert des lignes 1 et 12 (idempotent)");
  const sansEffet = cp(A.machines());
  ok(A.w.purgerCadeaux(A.machines()) === 0 && A.w.purgerCadeauxMouv() === 0 && JSON.stringify(A.machines()) === JSON.stringify(sansEffet), "purgerCadeaux() et purgerCadeauxMouv() rejouées : 0 changement");
  ok(A.w.purgerCadeaux(null) === 0 && A.w.purgerCadeaux({}) === 0 && A.w.purgerCadeaux([null, 5, "x", { id: "z" }]) === 0, "purgerCadeaux tolère une donnée absente ou bizarre");

  // ═══════════ M3. Temps réel : une ligne sale reçue d'un autre poste ═══════════
  const nE = A.S.ecrits(1).length, nAppli = { n: 0 };
  const sauveAppli = A.get("appliquerLigne1"); A.set("appliquerLigne1", (d) => { nAppli.n++; return sauveAppli(d); });
  const salePlus = sale().concat([{ id: "c6", numeroBT: "BT-206", nom: "Nouveau", client: "Six", statut: "avenir", cadeau: { le: iso(16, 0), par: "Jason", montant: 5 }, invSortieSource: "cadeau", pieces: [] }]);
  A.S.db.tableau.find((r) => r.id === 1).donnees = cp(salePlus);
  A.S.pousser("tableau", { id: 1, donnees: salePlus }, "UPDATE");
  await dodo(400);
  ok(nAppli.n === 1 && A.machines().length === 6 && !aDesTraces(A.machines()) && A.bt("c6") && A.bt("c1").statut === "prete", "temps réel : la ligne sale reçue est purgée avant d'entrer dans machines (6 bons, aucun cadeau)");
  ok(!jsonSale(A.w.localStorage.getItem(A.get("CLE")) || "") && A.S.ecrits(1).length === nE, "temps réel : le secours local est propre et AUCUN upsert n'est déclenché");
  A.set("appliquerLigne1", sauveAppli);

  // ═══════════ M4. relireMachines : purge AVANT la comparaison, donc aucune boucle de rendu ═══════════
  // le serveur reste sale ; ce poste est propre et à jour : rien à reprendre, ni 1re ni 2e relecture
  A.set("machines", propre(salePlus));
  const sauve2 = A.get("appliquerLigne1"); const compte = { n: 0 }; A.set("appliquerLigne1", (d) => { compte.n++; return sauve2(d); });
  const nEcrits = A.S.ecrits(1).length;
  await A.w.relireMachines(); await A.w.relireMachines();
  ok(compte.n === 0, "relireMachines ×2 : serveur sale mais identique après purge → appliquerLigne1 jamais appelée (pas de boucle de rendu à chaque focus) — appelée " + compte.n + " fois");
  ok(A.S.ecrits(1).length === nEcrits && aDesTraces(A.S.ligne(1)), "relireMachines : n'écrit rien (le serveur sale attend le SQL de purge)");
  // un vrai écart (un bon de plus au serveur) : repris UNE fois, propre, sans réécriture
  const srv2 = propre(salePlus).concat([{ id: "c7", numeroBT: "BT-207", nom: "Sept", client: "Sept", statut: "avenir", cadeau: { le: "x" }, pieces: [] }]);
  A.S.db.tableau.find((r) => r.id === 1).donnees = cp(srv2);
  await A.w.relireMachines(); await A.w.relireMachines(); await A.w.relireMachines();
  ok(compte.n === 1 && A.machines().length === 7 && A.bt("c7") && !aDesTraces(A.machines()), "relireMachines : un vrai écart est repris UNE seule fois, déjà purgé (appelée " + compte.n + " fois)");
  ok(A.S.ecrits(1).length === nEcrits, "relireMachines ne déclenche aucun upsert");
  A.set("appliquerLigne1", sauve2);

  // ═══════════ M5. Poste en retard : machines locales avec cadeau, puis sauvegarder() ═══════════
  const dbR = { tableau: [{ id: 1, donnees: propre(sale()).concat([{ id: "srv", numeroBT: "BT-300", nom: "Venu du serveur", client: "Dave", statut: "avenir", cadeau: { le: "x", par: "Jason", montant: 9 }, invSortieSource: "cadeau", pieces: [] }]) },
                         { id: 4, donnees: cp(EMP) }, { id: 12, donnees: mouvPropres() }] };
  fermer(A);
  A = await chargerApp(creerSupabase(dbR));
  connecter(A, "Jason");
  A.set("chargementOK", true);
  A.set("machines", sale());                      // un poste en retard : sa liste locale a encore le cadeau
  await A.w.sauvegarder();
  const w1 = A.S.ecrits(1);
  ok(w1.length >= 1 && w1.every((e) => !aDesTraces(e.vals.donnees) && !jsonSale(JSON.stringify(e.vals.donnees))), "poste en retard : l'upsert de sauvegarder() ne contient aucun cadeau (" + w1.length + " upsert)");
  ok(w1.length && w1[w1.length - 1].vals.donnees.some((m) => m.id === "srv") && !aDesTraces(w1[w1.length - 1].vals.donnees), "… y compris le bon venu du serveur à la fusion (fusionnerAjoutsServeur) : ajouté, sans cadeau");
  ok(!aDesTraces(A.machines()) && !jsonSale(A.w.localStorage.getItem(A.get("CLE")) || ""), "poste en retard : machines et localStorage sans cadeau");
  fermer(A);

  // ═══════════ M6. Import d'une sauvegarde (vieux fichier avec cadeau) ═══════════
  A = await chargerApp(creerSupabase({ tableau: [{ id: 1, donnees: [{ id: "x", nom: "Existant", statut: "avenir", pieces: [] }] }, { id: 4, donnees: cp(EMP) }] }));
  connecter(A, "Jason"); A.set("chargementOK", true);
  const fichier = new A.w.File([JSON.stringify(sale())], "sauvegarde-garage-vieille.json", { type: "application/json" });
  A.w.importer({ target: { files: [fichier], value: "x" } });
  await attendre(() => A.machines().length === 5, 3000); await dodo(700);
  ok(A.machines().length === 5 && !aDesTraces(A.machines()), "import : la sauvegarde importée est purgée (5 bons, aucun cadeau)");
  const wi = A.S.ecrits(1);
  ok(wi.length >= 1 && wi.every((e) => !jsonSale(JSON.stringify(e.vals.donnees))) && !jsonSale(A.w.localStorage.getItem(A.get("CLE")) || ""), "import : ni l'upsert ni le localStorage ne contiennent cadeau");
  fermer(A);

  // ═══════════ M7. Journal d'inventaire : réception temps réel, fusion, écriture ═══════════
  A = await ouvrir({ tableau: [{ id: 1, donnees: propre(sale()) }, { id: 4, donnees: cp(EMP) }, { id: 12, donnees: [mouvPropres()[0]] }] });
  const nE12 = A.S.ecrits(12).length;
  A.S.db.tableau.find((r) => r.id === 12).donnees = cp(mouvSales());
  A.S.pousser("tableau", { id: 12, donnees: mouvSales() }, "UPDATE");
  await dodo(300);
  const mvr = A.get("invMouv");
  ok(mvr.length === 3 && !refsSales(mvr) && mvr.find((x) => x.id === "v2").ref === "BT-202", "journal reçu en direct : les mouvements neufs sont fusionnés SANS le suffixe 🎁 (invFusionnerMouv)");
  ok(!jsonSale(A.w.localStorage.getItem(A.get("CLE_MOUV")) || "") && A.S.ecrits(12).length === nE12, "… localStorage propre, aucune écriture déclenchée");
  A.get("invMouv").push({ id: "v9", ts: iso(17, 0), num: "A1", qte: -1, motif: "vente", ref: "BT-209 · 🎁 cadeau", qui: "Jason" });
  await A.w.invSauverMouv();
  const e12b = A.S.ecrits(12);
  ok(e12b.length >= 1 && e12b.every((e) => !refsSales(e.vals.donnees)) && e12b[e12b.length - 1].vals.donnees.some((x) => x.id === "v9" && x.ref === "BT-209"), "invSauverMouv : un mouvement local avec « · 🎁 cadeau » est écrit sans le suffixe (le mouvement est gardé)");
  fermer(A);

  } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
  try {
  // ═══════════ M8. Rentabilité : seule rentabilite.cadeau compte (plus de m.cadeau) ═══════════
  A = await chargerApp(creerSupabase({ tableau: [{ id: 1, donnees: [] }, { id: 4, donnees: cp(EMP) }] }));
  connecter(A, "Jason"); A.set("chargementOK", true);
  const auj = new Date().toISOString().slice(0, 10);
  A.set("machines", [
    { id: "o1", numeroBT: "BT-501", nom: "Ancien", client: "A", statut: "prete", cadeau: { le: new Date().toISOString(), par: "Jason", montant: 99 }, pieces: [] },
    { id: "o2", numeroBT: "BT-502", nom: "Offert", client: "B", statut: "archive", livreLe: auj, rentabilite: { cadeau: true, revenuPotentiel: 40, coutTotal: 10, profit: -10, marge: 0, dateFin: auj, calculeLe: new Date().toISOString() }, pieces: [] },
  ]);
  const agg = A.get("aggCadeau")((x) => true);
  ok(agg.n === 1 && agg.val === 40 && agg.cout === 10, "aggCadeau : seul le bon avec rentabilite.cadeau compte (1 bon, 40 $) — un ancien m.cadeau n'est plus lu");
  ok(A.get("estCadeauRent")(A.bt("o1")) === false && A.get("estCadeauRent")(A.bt("o2")) === true && A.get("dateCadeau")(A.bt("o2")) === auj && A.get("valeurCadeau")(A.bt("o1")) === 0, "estCadeauRent / dateCadeau / valeurCadeau ne lisent que la rentabilité");
  fermer(A);

  } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
  try {
  // ═══════════ R. Chemin de remplacement : « → Facturé » puis « ✓ Livrée », depuis « Prêt à facturer » et « Commande de pièce » ═══════════
  A = await chargerApp(creerSupabase({ tableau: [{ id: 1, donnees: [] }, { id: 4, donnees: cp(EMP) }] }));
  connecter(A, "Jason"); A.set("chargementOK", true);
  A.set("catalPieces", [
    { num: "A1", desc: "Anode", prix: 15, cout: 6, suivi: true, qte: 6 },
    { num: "C1", desc: "Courroie", prix: 80, cout: 50, suivi: true, qte: 4 },
  ]);
  A.set("invMouv", []);
  A.set("machines", [
    { id: "r1", numeroBT: "BT-401", nom: "Can-Am Renegade", client: "Prêt à facturer", statut: "afacturer", pieces: [P("A1", "Anode", 1, { utilise: true, prixVente: 15 }), P("C1", "Courroie", 1, { utilise: true, prixVente: 80 })] },
    { id: "r2", numeroBT: "BT-402", nom: "Polaris RZR", client: "Commande de pièce", statut: "commande", pieces: [P("A1", "Anode", 2, { utilise: true, prixVente: 15 })] },
    { id: "r3", numeroBT: "BT-403", nom: "Honda", client: "En réparation", statut: "reparation", pieces: [] },
  ]);
  A.w.afficher();
  const cartes = A.$$("article.carte");
  ok(cartes.length === 3 && !cartes.some((c) => /🎁/.test(c.textContent) || c.querySelector(".btn-cadeau, .cadeau-discret, .badge-cadeau")), "cartes « Prêt à facturer », « Commande de pièce » et « Réparation » (admin) : aucun 🎁, aucun .btn-cadeau");
  connecter(A, "Gwendal"); A.w.afficher();
  ok(!A.$$("article.carte").some((c) => /🎁/.test(c.textContent) || c.querySelector(".btn-cadeau, .cadeau-discret")), "technicien : aucun 🎁 sur les cartes");
  connecter(A, "Jason"); A.w.afficher();
  A.w.factOuvrir("r1");
  ok(A.$("#fact-pop .fact-h3") && !A.$("#fact-pop .fact-h3 button") && A.w.document.getElementById("cadeau-pop") === null && typeof A.w.factCadeau === "undefined" && typeof A.w.cadeauConfirmer === "undefined", "fenêtre Facturer : le titre n'a pas de bouton ; #cadeau-pop absent ; factCadeau et cadeauConfirmer indéfinis");
  A.w.factFermer();
  const q = (n) => A.get("catalPieces").find((p) => p.num === n).qte;
  const mouv = () => A.get("invMouv");
  A.w.deplacer("r1", "prete"); A.w.deplacer("r2", "prete");
  const sources = [A.bt("r1").invSortieSource, A.bt("r2").invSortieSource];
  const apresFacture = mouv().length;
  A.w.archiver("r1"); A.w.archiver("r2");
  ok(A.bt("r1").statut === "archive" && A.bt("r2").statut === "archive" && !("cadeau" in A.bt("r1")) && !("cadeau" in A.bt("r2")), "depuis afacturer et depuis commande : « → Facturé » puis « ✓ Livrée » : aux archives, sans m.cadeau");
  ok(q("A1") === 3 && q("C1") === 3 && mouv().filter((x) => x.ref === "BT-401").length === 2 && mouv().filter((x) => x.ref === "BT-402").length === 1, "pièces sorties UNE seule fois (anode 6 → 3 : 1 + 2 ; courroie 4 → 3) ; mouvements « vente » réf. BT-401 et BT-402");
  ok(mouv().every((x) => x.motif === "vente" && !/🎁|cadeau/i.test(x.ref)) && sources.join() === "suggestion,suggestion" && apresFacture === 3 && mouv().length === 3, "mouvements « vente » sans 🎁, sortis à « → Facturé » d'après la suggestion ; « ✓ Livrée » n'en ajoute aucun");
  ok(!A.fetchs.some((f) => /quickbooks/i.test(f.url)), "aucun appel QuickBooks");
  fermer(A);

  } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
  try {
  // ═══════════ N. Notes d'atelier dans Facturer (A4) ═══════════
  A = await chargerApp(creerSupabase({ tableau: [{ id: 1, donnees: [] }, { id: 4, donnees: cp(EMP) }] }));
  connecter(A, "Jason"); A.set("chargementOK", true);
  A.set("catalPieces", [{ num: "A1", desc: "Anode", prix: 15, cout: 6, suivi: true, qte: 6 }]);
  A.set("invMouv", []);
  A.set("qboEtat", { connecte: true, company: "Groupe MTR", realm: "R1", env: "production", config: {} });
  A.reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, company: "Groupe MTR", realm: "R1", env: "production", config: {} } }
    : { status: 200, data: { ok: true, id: "1502", doc: "1502", total: 100, action: "cree", url: "https://app.qbo.intuit.com/app/invoice?txnId=1502", clientId: "77", clientNom: "Alex Paquin", realm: "R1", env: "production", company: "Groupe MTR" } };
  const bonN = (id, num, o) => Object.assign({ id, numeroBT: num, nom: "Sea-Doo " + num, client: "Alex Paquin", statut: "afacturer", pieces: [P("A1", "Anode", 1, { utilise: true, prixVente: 15 })] }, o || {});
  A.set("machines", [
    bonN("n1", "BT-601", { notesLive: [{ texte: "Remplacé l'anode", tech: "Gwendal", quand: iso(13, 0) }, { texte: "Vérifié la courroie", tech: "Gwendal", quand: iso(14, 0) }, { texte: "Essai à l'eau OK", tech: "Jason", quand: iso(15, 0) }] }),
    bonN("n2", "BT-602", { notesTech: "• Vidange faite\n- Bougies changées\nRien à signaler" }),
    bonN("n3", "BT-603", { notesLive: [{ texte: "<img src=x onerror=alert(1)> & <b>gras</b>", tech: "<i>Pirate</i>", quand: iso(13, 0) }] }),
    bonN("n4", "BT-604", { notesLive: [1, 2, 3, 4, 5].map((i) => ({ texte: "Note " + i, tech: "Gwendal", quand: iso(10 + i, 0) })) }),
    bonN("n5", "BT-605", {}),
  ]);
  const textes = () => A.$$("#fact-notes-liste li .txt").map((x) => x.textContent);
  const champ = () => A.$("#fact-note-champ");
  const titreN = () => A.$("#fact-notes-titre").textContent;
  const notesDe = (id) => (A.bt(id).notesLive || []).map((n) => n.texte);

  // N1. Le bloc, l'ordre, le compte, « 🔒 Interne »
  A.w.factOuvrir("n1");
  const det = A.$("#fact-notes");
  ok(det && det.tagName === "DETAILS" && det.open && A.$("#fact-pop").classList.contains("ouvert") && det.previousElementSibling && det.previousElementSibling.id === "fact-avis", "Facturer : <details id=fact-notes open> juste après #fact-avis, la fenêtre est ouverte");
  ok(titreN() === "📝 Notes d'atelier (3)" && /🔒 Interne/.test(A.$("#fact-notes > summary").textContent), "titre « 📝 Notes d'atelier (3) » et mention « 🔒 Interne »");
  ok(JSON.stringify(textes()) === JSON.stringify(["Essai à l'eau OK", "Vérifié la courroie", "Remplacé l'anode"]), "notes d'atelier du bon : la plus récente en premier");
  ok(/Gwendal/.test(A.$("#fact-notes-liste").textContent) && /Jason/.test(A.$("#fact-notes-liste").textContent), "chaque note montre qui l'a écrite");
  ok(champ() && champ().tagName === "INPUT" && !!A.$("#fact-notes .fact-notes-saisie button") && /Ajouter/.test(A.$("#fact-notes .fact-notes-saisie button").textContent), "champ de saisie et bouton « ＋ Ajouter »");
  // champ STATIQUE : factRendre() (rappelée à chaque case cochée) et rafraichirVues() ne le reconstruisent pas
  const noeud = champ(); noeud.value = "brouillon en cours";
  A.w.factRendre(); A.w.rafraichirVues();
  ok(champ() === noeud && champ().value === "brouillon en cours", "le champ garde son texte (et son nœud) après factRendre() et rafraichirVues()");
  // la liste suit via rafraichirVues (temps réel, autre poste)
  A.bt("n1").notesLive.push({ texte: "Note venue d'un autre poste", tech: "Gwendal", quand: iso(16, 0) });
  A.w.rafraichirVues();
  ok(textes()[0] === "Note venue d'un autre poste" && titreN() === "📝 Notes d'atelier (4)" && champ().value === "brouillon en cours", "rafraichirVues met la liste et le compte à jour sans toucher au champ");
  champ().value = "";

  // N2. Un bon sans notesLive : lecture seule, aucune mutation
  const avant = JSON.stringify(A.machines());
  A.w.factFermer();
  A.w.factOuvrir("n2"); A.w.factRendre(); A.w.rafraichirVues();
  ok(JSON.stringify(textes()) === JSON.stringify(["Rien à signaler", "Bougies changées", "Vidange faite"]) && titreN() === "📝 Notes d'atelier (3)", "bon sans notesLive : lignes de notesTech sans leur puce, récent en premier (3)");
  const n2avant = JSON.stringify(A.bt("n2"));
  const lu1 = JSON.stringify(A.w.factNotesAtelier(A.bt("n2"))), lu2 = JSON.stringify(A.w.factNotesAtelier(A.bt("n2")));
  ok(!("notesLive" in A.bt("n2")) && JSON.stringify(A.bt("n2")) === n2avant && lu1 === lu2, "affichage d'un bon sans notesLive : le bon reste sans notesLive, factNotesAtelier est pure");
  A.w.factFermer();
  ok(JSON.stringify(A.machines()) === avant, "JSON.stringify(machines) identique après avoir affiché, rafraîchi et fermé un bon sans notesLive");
  ok(A.w.factNotesAtelier(null).length === 0 && A.w.factNotesAtelier({}).length === 0 && A.w.factNotesAtelier({ notesLive: [] , notesTech: "• x" }).length === 0 && A.w.factNotesAtelier({ notesLive: [null, { texte: "  " }, "ok"] }).map((n) => n.texte).join() === "ok", "factNotesAtelier : bon vide, notesLive vide (pas de repli), entrées bizarres ignorées");

  // N3. Échappement
  A.w.factOuvrir("n3");
  ok(!A.$("#fact-notes-liste img") && !A.$("#fact-notes-liste b") && !A.$("#fact-notes-liste i") && /<img src=x onerror=alert\(1\)> & <b>gras<\/b>/.test(A.$("#fact-notes-liste").textContent) && /<i>Pirate<\/i>/.test(A.$("#fact-notes-liste").textContent) && !A.alertes.length, "texte et nom du technicien échappés : <img onerror> reste du texte, aucun élément injecté");
  A.w.factFermer();

  // N4. Ajout d'une note (bouton, touche Entrée), bon retrouvé par id, sauvegarde, notesTech suit
  A.w.factOuvrir("n2");
  champ().value = "  Nouvelle note de Jason  ";
  A.$("#fact-notes .fact-notes-saisie button").click();
  await dodo(150);
  const m2 = A.bt("n2");
  ok(notesDe("n2").join("|") === "Vidange faite|Bougies changées|Rien à signaler|Nouvelle note de Jason" && m2.notesLive[3].tech === "Jason" && /^\d{4}-\d\d-\d\dT/.test(m2.notesLive[3].quand), "« ＋ Ajouter » : la note (nettoyée) est ajoutée à notesLive avec son auteur et sa date ; les notes du bon imprimé sont reprises");
  ok(/• Nouvelle note de Jason$/.test(m2.notesTech) && m2.notesTech.split("\n").length === 4, "m.notesTech suit (liveMajNotesTech)");
  ok(textes()[0] === "Nouvelle note de Jason" && titreN() === "📝 Notes d'atelier (4)" && champ().value === "", "la liste montre la note en premier, le titre compte 4, le champ est vidé");
  ok(A.S.ecrits(1).some((e) => JSON.stringify(e.vals.donnees).includes("Nouvelle note de Jason")), "la note est enregistrée au serveur (sauvegarder)");
  ok(!m2.facturation && !m2.factureLe, "ajouter une note ne crée aucune facturation");
  champ().value = "Par la touche Entrée";
  champ().dispatchEvent(new A.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  ok(notesDe("n2").pop() === "Par la touche Entrée" && champ().value === "", "touche Entrée dans le champ : ajoute la note");
  const nAvant = notesDe("n2").length;
  champ().value = "   ";
  A.$("#fact-notes .fact-notes-saisie button").click();
  ok(notesDe("n2").length === nAvant && !A.alertes.length, "champ vide ou d'espaces : rien n'est ajouté");

  // N5. Brouillon non vide : ajouté à la fermeture, à « Enregistrer » et à « Facturer avec QuickBooks », jamais par l'appel silencieux
  champ().value = "Brouillon fermeture";
  A.w.factFermer();
  ok(notesDe("n2").pop() === "Brouillon fermeture" && !A.$("#fact-pop").classList.contains("ouvert") && champ().value === "", "brouillon tapé puis Fermer : la note est ajoutée");
  A.w.factOuvrir("n2");
  ok(champ().value === "" && textes()[0] === "Brouillon fermeture", "à la réouverture, le champ est vide et la liste à jour");
  champ().value = "Brouillon enregistrement";
  A.w.factEnregistrer();
  ok(notesDe("n2").pop() === "Brouillon enregistrement" && champ().value === "", "brouillon tapé puis 💾 Enregistrer : la note est ajoutée");
  champ().value = "Brouillon silencieux";
  const nSil = notesDe("n2").length;
  A.w.factEnregistrer(true); A.w.factLignesPour(A.bt("n2"));
  ok(notesDe("n2").length === nSil && champ().value === "Brouillon silencieux", "factEnregistrer(true) et factLignesPour (appels silencieux) n'ajoutent JAMAIS le brouillon");
  A.appelsQbo.length = 0;
  await A.w.factQuickBooks(A.$("#fact-btn-qbo"));
  ok(notesDe("n2").pop() === "Brouillon silencieux" && A.appelsQbo.some((c) => c.action === "facturer"), "brouillon tapé puis 📗 Facturer avec QuickBooks : la note est ajoutée ET la facture part");
  A.w.factFermer();
  A.w.factOuvrir("n5"); champ().value = "   "; A.w.factFermer();
  ok(!("notesLive" in A.bt("n5")), "brouillon d'espaces : rien n'est créé sur le bon");

  // N6. Les notes ne partent JAMAIS dans la facture (charge QuickBooks, mémo, CSV, facturation)
  A.w.factOuvrir("n1");
  champ().value = "SECRET-ATELIER-777";
  A.$("#fact-notes .fact-notes-saisie button").click();
  A.appelsQbo.length = 0;
  await A.w.factQuickBooks(A.$("#fact-btn-qbo"));
  const charge = JSON.stringify(A.appelsQbo);
  const facturer = A.appelsQbo.find((c) => c.action === "facturer");
  ok(!!facturer && notesDe("n1").includes("SECRET-ATELIER-777") && !/SECRET-ATELIER|notesLive|notesTech|Notes d'atelier|Remplacé l'anode|Essai à l'eau/.test(charge), "charge QuickBooks (gabarit appelsQbo de test-v159) : aucune note d'atelier ni notesLive / notesTech");
  ok(!/SECRET-ATELIER|Essai à l'eau/.test(JSON.stringify(A.bt("n1").facturation || {})) && !/SECRET-ATELIER/.test(A.$("#fact-memo").value), "m.facturation et le message au client ne contiennent aucune note");
  let csv = "";
  A.set("qboTelechargerCSV", (l, nom) => { csv = JSON.stringify(l) + " " + nom; });
  A.w.factOuvrir("n1"); A.w.factCSV();
  ok(csv.length > 20 && !/SECRET-ATELIER|Essai à l'eau|Remplacé l'anode/.test(csv), "CSV de facturation : aucune note d'atelier (fichier produit : " + csv.length + " caractères)");
  A.w.factFermer();

  // N7. Téléphone : bloc replié s'il y a plus de 3 notes ; l'ouverture n'est jamais empêchée par les notes
  A.mm.matches = true;
  A.w.factOuvrir("n4");
  ok(A.$("#fact-notes").open === false && titreN() === "📝 Notes d'atelier (5)" && A.$("#fact-pop").classList.contains("ouvert"), "téléphone et 5 notes : le bloc est replié (titre visible avec le compte)");
  A.w.factFermer();
  A.machines().push(bonN("n6", "BT-606", { notesLive: [1, 2, 3].map((i) => ({ texte: "Trois " + i, tech: "Gwendal", quand: iso(10 + i, 0) })) }));
  A.w.factOuvrir("n6");
  ok(A.$("#fact-notes").open === true && titreN() === "📝 Notes d'atelier (3)", "téléphone et exactement 3 notes : bloc ouvert (le repli commence au-dessus de 3)");
  A.w.factFermer(); A.w.factOuvrir("n1");
  ok(A.$("#fact-notes").open === false && notesDe("n1").length > 3, "téléphone et " + notesDe("n1").length + " notes (n1) : bloc replié");
  A.w.factFermer(); A.w.factOuvrir("n3");
  ok(A.$("#fact-notes").open === true, "téléphone et 1 note : bloc ouvert");
  A.w.factFermer(); A.mm.matches = false;
  A.w.factOuvrir("n4");
  ok(A.$("#fact-notes").open === true, "ordinateur et 5 notes : bloc ouvert");
  A.w.factFermer();
  const rendre = A.get("factNotesAtelier"); A.set("factNotesAtelier", () => { throw new Error("panne des notes"); });
  A.w.factOuvrir("n3");
  ok(A.$("#fact-pop").classList.contains("ouvert"), "si le rendu des notes plante, la fenêtre de facturation s'ouvre quand même");
  A.set("factNotesAtelier", rendre); A.w.factFermer();

  // N8. Technicien (non admin) : refus comme avant ; style du bloc
  connecter(A, "Gwendal");
  A.w.factOuvrir("n1");
  ok(!A.$("#fact-pop").classList.contains("ouvert") && A.toasts().some((t) => /réservée à l'administration/.test(t)), "technicien non admin : factOuvrir refuse comme avant");
  const nn = notesDe("n1").length; champ().value = "Tentative"; ok(A.w.factNoteAjouter() === false && notesDe("n1").length === nn, "technicien : factNoteAjouter() n'ajoute rien");
  champ().value = "";
  connecter(A, "Jason");
  const css = (index.match(/<style id="v178-FAC">([\s\S]*?)<\/style>/) || [, ""])[1];
  ok(/#fact-notes > summary \{[^}]*display:list-item/.test(css) && /min-height:44px/.test(css) && /#fact-notes \.champ \{[^}]*font-size:16px[^}]*min-width:0/.test(css) && /max-height:240px/.test(css) && /@media \(max-width: 820px\)[^}]*#fact-notes \.fact-notes-liste \{ max-height:none/.test(css), "CSS du lot : summary en display:list-item (la flèche de repli reste visible : block ou flex la font disparaître), 44 px, champ 16 px et min-width:0, liste 240 px (libre sur téléphone)");
  if (A.w.__NAVIGATEUR) {
    const cs = A.w.getComputedStyle(A.$("#fact-notes > summary")), cc = A.w.getComputedStyle(champ());
    ok(cs.display === "list-item" && parseFloat(cs.minHeight) >= 44 && parseFloat(cc.fontSize) === 16, "styles calculés : summary list-item (flèche visible), min-height ≥ 44 px, champ à 16 px");
  }
  fermer(A);

  } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
  try {
  // ═══════════ G. Aucune trace dans les fichiers servis (hors des deux fonctions de purge) ═══════════
  const d = index.indexOf("// v178-FAC-PURGE-DEBUT"), f = index.indexOf("// v178-FAC-PURGE-FIN");
  ok(d > 0 && f > d, "les deux fonctions de purge sont encadrées de marqueurs (v178-FAC-PURGE-DEBUT / -FIN)");
  const horsPurge = d > 0 && f > d ? index.slice(0, d) + index.slice(f) : index;
  const interdits = [/comptant/i, /m\.cadeau/, /factCadeau/, /cadeauConfirmer/, /cadeauFermer/, /cadeauBtId/, /cadeau-pop/, /badge-cadeau/, /btn-cadeau/, /cadeau-boite|cadeau-val|cadeau-actions/];
  const trouves = interdits.filter((re) => re.test(horsPurge)).map(String);
  ok(!trouves.length, "index.html hors purge : aucune trace de /comptant/i, m.cadeau, factCadeau, cadeauConfirmer, cadeau-pop, badge-cadeau, btn-cadeau" + (trouves.length ? " — trouvé : " + trouves.join(" ") : ""));
  const lignesCadeau = horsPurge.split("\n").filter((l) => /🎁/.test(l));
  ok(lignesCadeau.length > 0 && lignesCadeau.every((l) => /cadeau-discret|rl-cadeau|Cadeaux offerts|Rentabilité|offert|i\.cadeau/.test(l)), "les seuls 🎁 de l'application sont dans la Rentabilité (bascule « offert », bouton, récap) — " + lignesCadeau.length + " lignes");
  const servis = ["tv.html", "procedure.html", "sw.js", "mtr-ajouter-brp.user.js"];
  const sale2 = servis.filter((n) => { try { return /cadeau|comptant/i.test(fs.readFileSync(DOSSIER + n, "utf8")); } catch (_) { return false; } });
  ok(!sale2.length, "tv.html, procedure.html, sw.js, mtr-ajouter-brp.user.js : aucun « cadeau » ni « comptant »" + (sale2.length ? " — trouvé dans " + sale2.join(", ") : ""));
  ok(/purgerCadeaux\(machines\)[^\n]*\n\s*localStorage\.setItem\(CLE/.test(horsPurge.replace(/\/\/ v178-FAC[^\n]*/g, (s) => s.replace(/\n/g, ""))) || /async function sauvegarder\(\) \{\s*\n\s*try \{ purgerCadeaux\(machines\); \}/.test(horsPurge), "sauvegarder() commence par la purge, avant localStorage.setItem et ecrireAuto");
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 const totalErreurs = apps.reduce((n, a) => n + a.erreurs.length, 0);
 ok(totalErreurs === 0, "aucune erreur JavaScript (" + totalErreurs + ")" + (totalErreurs ? " : " + apps.flatMap((a) => a.erreurs).slice(0, 3).join(" | ") : ""));
 process.exit();
})();
