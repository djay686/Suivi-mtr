// v170 — Inventaire : le journal fait foi (BT-103 : 2,2 WCFQTC jamais sortis), « Stock à corriger », catalogue et journal
//   plus jamais écrasés par un appareil en retard (fusion avant d'écrire, temps réel fusionné) ; n° de BT sur les cartes ;
//   horaire : les rendez-vous du calendrier passent avant le reste ; TV : tuile « Brancher une TV », code ?tvcode=,
//   jumelage sur la TV (code, QR, attente, connexion à usage unique, refus admin, expiration) ; bandeau « nouvelle version ».
// NODE_PATH=… node test-v170.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");
let htmlTv = fs.readFileSync(FICHIER.replace(/index\.html$/, "tv.html"), "utf8");
const CDN = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]*><\/script>/;

const pad = (n) => String(n).padStart(2, "0");
const jourIso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
const EMP = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true },
             { nom: "Arno", identifiant: "arno", role: "technicien", actif: true }];
const F = (lignes, o) => Object.assign({ lignes, confirmeLe: new Date(Date.now() - 86400000).toISOString(), confirmePar: "Jason" }, o || {});
const MACHINES = [
  // BT-103 (le cas de Jason) : « Facturé », facture QuickBooks, marqué « sorti »… mais aucun mouvement au journal
  { id: "bt103", numeroBT: "BT-103", nom: "2020 Sea-Doo GTI 130", client: "Client 103", statut: "prete", invSortieFaite: true, invSorties: { WCFQTC: { num: "WCFQTC", qte: 2.2, prixU: 23.29 } },
    facturation: F([{ type: "mo", desc: "Entretien", qte: 1, prix: 95 }, { type: "art", num: "WCFQTC", desc: "Huile XPS 4T", qte: 2.2, prix: 23.29 }], { qbo: { id: "1700", doc: "1700", realm: "R1", env: "production" } }), pieces: [] },
  { id: "bt97", numeroBT: "BT-097", nom: "Polaris RZR", client: "Trop sorti", statut: "prete", invSortieFaite: true, facturation: F([{ type: "art", num: "WCFQTC", desc: "Huile", qte: 3, prix: 23.29 }]), pieces: [] },
  { id: "bt90", numeroBT: "BT-090", nom: "Outlander 45 j", client: "Livré 45 j", statut: "archive", livreLe: jourIso(-45), facturation: F([{ type: "art", num: "X9", desc: "Bougie", qte: 1, prix: 12 }]), pieces: [] },
  { id: "bt80", numeroBT: "BT-080", nom: "Vieux 90 j", client: "Livré 90 j", statut: "archive", livreLe: jourIso(-90), invSortieFaite: true, facturation: F([{ type: "art", num: "X9", desc: "Bougie", qte: 1, prix: 12 }]), pieces: [] },
  { id: "bt95", numeroBT: "BT-095", nom: "Spark concorde", client: "Concorde", statut: "archive", livreLe: jourIso(-5), invSortieFaite: true, facturation: F([{ type: "art", num: "C1", desc: "Courroie", qte: 1, prix: 80 }]), pieces: [] },
  { id: "bt96", numeroBT: "BT-096", nom: "Joint pas suivi", client: "Pas suivi", statut: "prete", facturation: F([{ type: "art", num: "J1", desc: "Joint", qte: 1, prix: 5.5 }]), pieces: [] },
  { id: "rv1", numeroBT: "BT-110", nom: "Can-Am Outlander", client: "Rendez-vous", statut: "avenir", echeance: jourIso(2), heure: "10:00", pieces: [] },
  { id: "rv2", nom: "Yamaha Grizzly", client: "Sans numéro", statut: "avenir", echeance: jourIso(3), heure: "09:00", pieces: [] },
];
const CAT = [
  { num: "WCFQTC", desc: "Huile XPS 4T", prix: 23.29, cout: 14, suivi: true, qte: 21, maj: "2026-09-16" },
  { num: "X9", desc: "Bougie", prix: 12, cout: 5, suivi: true, qte: 8 },
  { num: "C1", desc: "Courroie", prix: 80, cout: 50, suivi: true, qte: 4 },
  { num: "J1", desc: "Joint", prix: 5.5, cout: 2, suivi: false },
  { num: "Z1", desc: "À supprimer ici", prix: 1, suivi: true, qte: 1 },
  { num: "Y1", desc: "Supprimé ailleurs", prix: 1, suivi: true, qte: 1 },
  { num: "OLD1", desc: "À renommer", prix: 1, suivi: false },
];
const MV = [
  { id: "c1", ts: "2026-09-10T12:00:00.000Z", num: "WCFQTC", desc: "Huile XPS 4T", qte: 21, avant: 0, apres: 21, motif: "creation", ref: "", qui: "Jason" },
  { id: "l95", ts: "2026-09-20T12:00:00.000Z", num: "C1", desc: "Courroie", qte: -1, avant: 5, apres: 4, motif: "vente", ref: "BT-095", qui: "Gwendal" },
  { id: "v97", ts: "2026-09-25T12:00:00.000Z", num: "WCFQTC", desc: "Huile", qte: -4, avant: 25, apres: 21, motif: "vente", ref: "BT-097", bt: "bt97", prixU: 23.29, qui: "Jason" },
];
const cp = (x) => JSON.parse(JSON.stringify(x));
const db = { tableau: [{ id: 1, donnees: cp(MACHINES) }, { id: 4, donnees: EMP }, { id: 9, donnees: cp(CAT) }, { id: 12, donnees: cp(MV) }], ecrans: [{ id: "lift", nom: "Lift 2 colonnes", mode: "rien", etape: 0 }] };
const ligne = (id) => db.tableau.find(r => r.id === id).donnees;
const upserts = {};
let pannes = {};
const table = (nom) => {
  const q = { op: "select", vals: null, filtres: [], un: false };
  const exec = () => {
    if (pannes[nom + ":" + q.op]) return { data: null, error: { message: pannes[nom + ":" + q.op] } };
    const rows = (db[nom] = db[nom] || []);
    const garde = r => q.filtres.every(f => f(r));
    let data = null;
    if (q.op === "select") data = cp(rows.filter(garde));
    else if (q.op === "update") { data = rows.filter(garde); data.forEach(r => Object.assign(r, cp(q.vals))); }
    else if (q.op === "insert") { [].concat(q.vals).forEach(v => rows.push(cp(v))); data = q.vals; }
    else if (q.op === "upsert") { [].concat(q.vals).forEach(v => { const c = cp(v); const i = rows.findIndex(r => r.id === c.id); if (i >= 0) rows[i] = c; else rows.push(c); if (nom === "tableau") upserts[c.id] = (upserts[c.id] || 0) + 1; }); data = q.vals; }
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
let fonction = async () => ({ data: null, error: { message: "non" } });
const appels = [];
const faireStub = (canaux, auth) => ({
  from: table,
  channel: (nom) => { const o = { nom, h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe(cb) { o.sub = cb; if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return o; } }; canaux.push(o); return o; },
  removeChannel: () => {},
  auth: auth || { getSession: async () => ({ data: { session: { access_token: "ok", user: { email: "g.brossault@mtrperformance.local" } } } }), getUser: async () => ({ data: { user: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }) },
  functions: { invoke: async (n, o) => { appels.push({ n, corps: o && o.body }); return fonction(n, o && o.body); } },
  storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: null }) }) },
});
const canaux1 = [], sb1 = faireStub(canaux1);
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/?tvcode=482913",
  beforeParse(w) {
    w.__sbStub = sb1; w.alert = () => {}; w.confirm = () => true; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
    // Banc d'essai dans un navigateur (iframe sans adresse) : le code arrive comme après la redirection de connexion
    if (!/tvcode/.test(w.location.search)) try { w.sessionStorage.setItem("mtr-tvcode", JSON.stringify({ c: "482913", t: Date.now() })); } catch (_) {}
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const attendre = async (f, ms = 4000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await dodo(20); return f(); };
const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
const txt = (el) => (el ? el.textContent : "").replace(/\s+/g, " ");
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const art = (num) => w.__get("catalPieces").find(p => p.num === num);
const artServeur = (num) => ligne(9).find(p => p.num === num);
const mouv = () => w.__get("invMouv");
const bt = (id) => w.__get("machines").find(m => m.id === id);
const tempsReel = () => canaux1.find(c => c.nom === "tableau-live");
const pousser = (id, donnees) => tempsReel().h.find(h => h.f.table === "tableau").cb({ eventType: "UPDATE", new: { id, donnees: cp(donnees) } });

(async () => {
 await dodo(1500);
 try {
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  await w.demarrerDonnees();
  await attendre(() => w.__get("chargementOK") && w.__get("catalPieces").length === 7 && mouv().length === 3);
  ok(w.__get("catalPieces").length === 7 && mouv().length === 3 && w.__get("invBaseCat").size === 7, "chargement : catalogue (7 articles, base de fusion retenue) et journal (3 mouvements)");

  // ══════════ 1. BT-103 : le journal fait foi ══════════
  const plan = w.invPlanBT(bt("bt103"), bt("bt103").facturation.lignes);
  const r103 = plan.rangs.find(r => r.num === "WCFQTC");
  ok(r103 && r103.qte === 2.2 && r103.deja === 0 && r103.delta === 2.2, "BT-103 marqué « sorti » sans aucun mouvement : 2,2 WCFQTC restent à sortir (le drapeau ne suffit plus)");
  const r97 = w.invPlanBT(bt("bt97"), bt("bt97").facturation.lignes).rangs.find(r => r.num === "WCFQTC");
  ok(r97 && r97.deja === 4 && r97.delta === -1, "BT-097 : 4 sortis au journal, 3 facturés → 1 à remettre en stock");
  const r95 = w.invPlanBT(bt("bt95"), bt("bt95").facturation.lignes).rangs.find(r => r.num === "C1");
  ok(r95 && r95.deja === 1 && r95.delta === 0, "bon d'avant la v168 (mouvement au journal par son n°, sans bt) : déjà sorti, rien de plus");

  // ══════════ 2. Inventaire › Articles : « Stock à corriger » ══════════
  w.ouvrirInventaire(); w.invOnglet("articles");
  const z = () => $("#inv-rattrapage");
  ok(/Stock à corriger — 3 bons facturés/.test(txt(z())), "Inventaire : encadré « ⚠️ Stock à corriger — 3 bons facturés dont les pièces n'ont pas suivi »");
  ok(/BT-103.*WCFQTC.*facturé 2,2, sorti 0 → sort 2,2 · en main 21 → 18,8/.test(txt(z())), "BT-103 : « facturé 2,2, sorti 0 → sort 2,2 · en main 21 → 18,8 »");
  ok(/BT-097.*remet 1/.test(txt(z())) && /BT-090.*livré il y a 45 j/.test(txt(z())), "BT-097 : « remet 1 » ; BT-090 livré il y a 45 jours");
  ok(!/BT-080/.test(txt(z())) && !/BT-095/.test(txt(z())) && !/BT-096/.test(txt(z())), "pas dans la liste : livré il y a plus de 60 jours, déjà concordant, article pas suivi");
  const coche = (id) => $(`#inv-rattrapage input[data-bt="${id}"]`);
  ok(coche("bt103").checked && coche("bt97").checked && !coche("bt90").checked, "cochés d'avance : les bons récents (BT-103, BT-097) ; pas celui livré il y a 45 jours");
  coche("bt97").checked = false;
  const nSortie = mouv().length;
  $("#inv-rattrapage .btn-principal").click();
  ok(art("WCFQTC").qte === 18.8 && art("X9").qte === 8, "« 📦 Mettre le stock à jour » : WCFQTC 21 → 18,8 ; les bons décochés ne bougent pas");
  const v103 = mouv().filter(x => x.bt === "bt103");
  ok(mouv().length === nSortie + 1 && v103.length === 1 && v103[0].motif === "vente" && v103[0].qte === -2.2 && v103[0].ref === "BT-103" && v103[0].qui === "Jason" && v103[0].prixU === 23.29,
     "un mouvement « vente » −2,2 au journal, réf. BT-103, par Jason, au prix de la facture");
  ok(toasts().some(t => /Stock mis à jour : 1 article\(s\) sur 1 bon\(s\)/.test(t)), "toast « 📦 Stock mis à jour : 1 article(s) sur 1 bon(s) »");
  ok(!/BT-103/.test(txt(z())) && /BT-097/.test(txt(z())) && /2 bons facturés/.test(txt(z())), "la liste se met à jour : BT-103 disparaît, restent BT-097 et BT-090");
  await attendre(() => artServeur("WCFQTC").qte === 18.8 && ligne(12).some(x => x.bt === "bt103"));
  ok(artServeur("WCFQTC").qte === 18.8 && ligne(12).some(x => x.bt === "bt103" && x.qte === -2.2), "enregistré au serveur : catalogue (18,8) et journal");
  await attendre(() => (ligne(1).find(m => m.id === "bt103") || {}).invSortieSource === "rattrapage");
  ok(bt("bt103").invSortieSource === "rattrapage", "le bon retient la correction (source « rattrapage »)");
  w.archiver("bt103");
  ok(art("WCFQTC").qte === 18.8 && mouv().filter(x => x.bt === "bt103").length === 1, "BT-103 livré ensuite : aucune 2e sortie");
  ok(/^BT-111$/.test(bt("rv2").numeroBT || ""), "un bon sans numéro reçoit le suivant à l'enregistrement (" + bt("rv2").numeroBT + ")");

  // ══════════ 3. Appareil en retard : fusion avant d'écrire ══════════
  // Un autre appareil (B) écrit au serveur ; celui-ci (A) n'a rien reçu en temps réel.
  await dodo(400);
  artServeur("WCFQTC").qte = 16.6;                     // B vend 2,2 d'huile
  artServeur("X9").prix = 13;                          // B change le prix des bougies
  ligne(9).push({ num: "NEW1", desc: "Ajouté par B", prix: 9, suivi: true, qte: 5 });
  db.tableau.find(r => r.id === 9).donnees = ligne(9).filter(p => p.num !== "Y1");   // B supprime Y1
  ligne(12).push({ id: "mB1", ts: new Date().toISOString(), num: "WCFQTC", desc: "Huile", qte: -2.2, avant: 18.8, apres: 16.6, motif: "vente", ref: "BT-120", bt: "bt120", qui: "Arno" });
  ok(art("WCFQTC").qte === 18.8 && !art("NEW1") && art("Y1"), "(ce poste a encore sa vieille copie : 18,8, pas de NEW1, Y1 encore là)");
  w.invMouvement("X9", 2, "reception", "test", "Jason");
  await w.invSauverArticles(); await w.invSauverMouv();
  ok(artServeur("WCFQTC").qte === 16.6, "la vente de B n'est pas effacée : WCFQTC reste à 16,6 au serveur (avant : remis à 18,8)");
  ok(artServeur("X9").qte === 10 && artServeur("X9").prix === 13, "X9 : la réception d'ici s'ajoute (8 + 2 = 10) et le nouveau prix de B est gardé (13 $)");
  ok(artServeur("NEW1") && !artServeur("Y1"), "l'article ajouté par B reste ; celui que B a supprimé ne revient pas");
  ok(ligne(12).some(x => x.id === "mB1") && ligne(12).some(x => x.num === "X9" && x.motif === "reception"), "journal : le mouvement de B et celui d'ici sont tous les deux gardés");
  ok(art("WCFQTC").qte === 16.6 && art("NEW1") && !art("Y1") && mouv().some(x => x.id === "mB1"), "ce poste est à jour lui aussi (16,6, NEW1, pas de Y1, mouvement de B)");
  // Deux ventes en même temps sur deux appareils : les deux comptent
  artServeur("WCFQTC").qte = 14.4;                     // B : −2,2
  w.invMouvement("WCFQTC", -1, "vente", "BT-121", "Jason");   // A : −1 (sa copie : 16,6 → 15,6)
  await w.invSauverArticles();
  ok(artServeur("WCFQTC").qte === 13.4 && art("WCFQTC").qte === 13.4, "deux sorties au même moment sur deux appareils : 16,6 − 2,2 − 1 = 13,4 (aucune perdue)");
  // Supprimé ici pendant que B ajoute un autre article
  ligne(9).push({ num: "NEW2", desc: "Ajouté par B pendant ce temps", prix: 3, suivi: false });
  w.soumPieceSuppr(w.__get("catalPieces").findIndex(p => p.num === "Z1"));
  await attendre(() => !artServeur("Z1"));
  await w.__get("invFileCat");
  ok(!artServeur("Z1") && artServeur("NEW2") && art("NEW2"), "supprimé ici (Z1) : parti du serveur ; l'article ajouté par B pendant ce temps reste");
  // Renommé ici
  w.soumPieceMaj(w.__get("catalPieces").findIndex(p => p.num === "OLD1"), "num", "NEW-OLD1");
  await w.__get("invFileCat");
  await w.soumSauverPieces();
  ok(!artServeur("OLD1") && artServeur("NEW-OLD1") && ligne(9).filter(p => /OLD1/.test(p.num)).length === 1, "n° renommé ici : l'ancien ne revient pas du serveur (pas de doublon)");

  // ══════════ 4. Temps réel : fusionné, jamais ignoré ══════════
  w.invMouvement("C1", -1, "vente", "BT-122", "Jason");      // pas encore enregistré : C1 4 → 3 ici
  const s9 = cp(ligne(9)); s9.find(p => p.num === "C1").desc = "Courroie (renommée par B)"; s9.find(p => p.num === "C1").qte = 6;   // B : réception de 2
  db.tableau.find(r => r.id === 9).donnees = cp(s9);
  pousser(9, s9);
  ok(art("C1").desc === "Courroie (renommée par B)" && art("C1").qte === 5, "reçu de B pendant un changement pas encore enregistré ici : nouvelle description, 6 − 1 = 5 (les deux gardés)");
  await w.soumSauverPieces();
  ok(artServeur("C1").qte === 5, "enregistré : 5 au serveur");
  w.__set("enEcriture", true);   // une écriture d'ici est en cours : avant, tout ce qui arrivait était ignoré
  const s9b = cp(ligne(9)); s9b.push({ num: "NEW3", desc: "Arrivé pendant une écriture", prix: 1, suivi: false });
  pousser(9, s9b);
  pousser(12, ligne(12).concat([{ id: "mB2", ts: new Date().toISOString(), num: "X9", qte: -1, motif: "vente", ref: "BT-130", bt: "bt130" }]));
  w.__set("enEcriture", false);
  ok(art("NEW3") && mouv().some(x => x.id === "mB2"), "arrivé pendant une écriture d'ici : pris quand même (article NEW3, mouvement de B)");
  const n9 = upserts[9] || 0;
  pousser(9, w.__get("catalPieces"));   // l'écho de notre propre écriture
  await dodo(50);
  ok((upserts[9] || 0) === n9, "écho de notre propre écriture : rien à refaire (aucune écriture de plus)");
  w.__set("invEcritureCat", true);
  w.invRecevoirCatalogue(JSON.parse(w.__get("invEcritCatJson")));
  ok(w.__get("invCatARenvoyer") === false, "notre propre écho reçu pendant un envoi : pas de réécriture inutile");
  w.invRecevoirCatalogue(cp(ligne(9)).concat([{ num: "NEW4", desc: "Pendant notre envoi", prix: 1, suivi: false }]));
  ok(w.__get("invCatARenvoyer") === true && art("NEW4"), "changement reçu PENDANT notre envoi : pris ici, et on réécrit juste après (il ne sera pas effacé au serveur)");
  w.__set("invEcritureCat", false); w.__set("invCatARenvoyer", false);

  // ══════════ 5. N° de BT sur les cartes du tableau de bord ══════════
  // (le tableau montre les 5 prochains jours ouvrables : on prend des jours ouvrables, peu importe le jour du test)
  const ouv = [...w.calProchainsJoursOuvrables(5)].sort();
  bt("rv1").echeance = ouv[1]; bt("rv2").echeance = ouv[2];
  w.afficher();
  const carte = (t) => $$("article.carte").find(a => a.textContent.includes(t));
  const c1 = carte("Can-Am Outlander");
  ok(c1 && c1.querySelector(".num-bt") && c1.querySelector(".num-bt").textContent === "BT-110", "carte de rendez-vous : le n° du bon (BT-110) en évidence");
  ok(carte("Yamaha Grizzly") && carte("Yamaha Grizzly").querySelector(".num-bt").textContent === "BT-111", "le bon qui n'avait pas de numéro l'affiche aussi (BT-111)");
  w.__get("machines").push({ id: "x-html", numeroBT: "BT-<i>9</i>", nom: "Échappement", client: "X", statut: "avenir", echeance: ouv[1], heure: "08:00", pieces: [] });
  w.afficher();
  const cx = carte("Échappement"), nb = cx && cx.querySelector(".num-bt");
  ok(nb && !nb.querySelector("i") && nb.textContent === "BT-<i>9</i>", "n° affiché comme texte (aucun HTML injecté) [" + (nb ? nb.innerHTML : cx ? "pas de .num-bt" : "pas de carte") + "]");
  w.__set("machines", w.__get("machines").filter(m => m.id !== "x-html"));

  // ══════════ 6. Horaire : les rendez-vous du calendrier passent avant le reste ══════════
  const AUJ = "2026-09-28";                                                  // lundi
  const hm = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const vraiAjd = w.ordreAjd, vraiMaint = w.ordreMaintenant;
  w.ordreAjd = () => AUJ; w.ordreMaintenant = () => 9 * 60;
  w.__set("rdvConfig", { horaire: { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null }, tampon: 15, diner: { actif: true, debut: 12, duree: 60 } });
  w.__set("dispoOverride", {});
  const empAvant = w.__get("EMPLOYES");
  w.__set("EMPLOYES", [{ nom: "Gwendal", role: "technicien", actif: true, horaire: null, vacances: [], competences: [] },
                       { nom: "Arno", role: "technicien", actif: true, horaire: null, vacances: [], competences: [] }]);
  const M = (o) => Object.assign({ nom: "Machine " + o.id, client: "Client " + o.id, type: "VTT", statut: "avenir", dureeEstimee: 60, machineArrivee: true, pieceComplete: true, pieces: [], chrono: [] }, o);
  const machAvant = w.__get("machines");
  w.__set("machines", [
    M({ id: "C1", nom: "Commencée Gwendal", statut: "reparation", technicien: "Gwendal", dureeEstimee: 180 }),
    M({ id: "C2", nom: "Commencée Arno", statut: "reparation", technicien: "Arno", dureeEstimee: 120 }),
    M({ id: "R1", nom: "RDV 10 h", echeance: AUJ, heure: "10:00", technicien: "Gwendal", dureeEstimee: 60 }),
    M({ id: "R2", nom: "RDV 8 h 30 en retard", echeance: AUJ, heure: "08:30", technicien: "Arno", dureeEstimee: 60 }),
    M({ id: "R4", nom: "RDV fixé à la main", echeance: AUJ, heure: "15:00", technicien: "Arno", dureeEstimee: 30, planif: { jour: AUJ, heure: "16:00", tech: "Gwendal", duree: 30 } }),
    M({ id: "R5", nom: "RDV reporté à la main", echeance: AUJ, heure: "15:00", technicien: "Arno", dureeEstimee: 30, planif: { jour: "2026-09-29", heure: "09:00", tech: "Arno", duree: 30 } }),
    M({ id: "E", nom: "RDV pas arrivé", machineArrivee: false, echeance: AUJ, heure: "13:00", technicien: "Arno", dureeEstimee: 60 }),
    M({ id: "D", nom: "Sans RDV", statut: "sansrdv", arriveeLe: "2026-09-20T14:00:00.000Z", dureeEstimee: 60 }),
    M({ id: "B", nom: "Bloquée", statut: "attente", echeance: AUJ, heure: "11:00" }),
  ]);
  const P = w.ordrePlanifier({ auj: AUJ, maintenant: 9 * 60, jours: 2 }), J = P.jours[0];
  const bl = (id) => J.blocs.find(b => b.id === id && b.genre !== "aide");
  const chev = (a, b) => a.segs.some(s => b.segs.some(t => s[0] < t[1] && s[1] > t[0]));
  const r1 = bl("R1");
  ok(r1 && r1.genre === "rdvici" && r1.tech === "Gwendal" && r1.debut === hm("10:00") && r1.fin === hm("11:00"), "machine déjà sur place avec rendez-vous à 10 h : à son heure, avec le technicien du calendrier (Gwendal 10:00 – 11:00)");
  const c1b = bl("C1");
  ok(c1b && !chev(c1b, r1) && c1b.tech === "Gwendal", "la job commencée de Gwendal se place autour du rendez-vous (" + (c1b && c1b.segs.map(s => w.ordreHHMM(s[0]) + "-" + w.ordreHHMM(s[1])).join(" / ")) + ")");
  const r2 = bl("R2");
  ok(r2 && r2.genre === "rdvici" && r2.tech === "Arno" && r2.debut === hm("09:00") && r2.notes.some(n => /Rendez-vous à 08:30 : passe avant le reste/.test(n)), "rendez-vous de 8 h 30 (machine là, heure passée) : Arno le prend en premier, à 9:00");
  const c2 = bl("C2");
  ok(c2 && c2.debut >= r2.fin, "la job commencée d'Arno passe après le rendez-vous (" + (c2 && w.ordreHHMM(c2.debut)) + ")");
  const r4 = bl("R4");
  ok(r4 && r4.genre === "manuel" && r4.tech === "Gwendal" && r4.debut === hm("16:00") && !J.blocs.some(b => b.id === "R4" && b.genre === "rdvici"), "une heure fixée à la main l'emporte sur l'heure du calendrier");
  ok(!J.blocs.some(b => b.id === "R5") && P.jours[1].blocs.some(b => b.id === "R5" && b.genre === "manuel" && b.debut === hm("09:00")), "rendez-vous d'aujourd'hui reporté à la main à demain : rien aujourd'hui, demain 9:00 📌");
  const e = bl("E");
  ok(e && e.genre === "rdv" && e.tech === "Arno" && e.debut === hm("13:00"), "rendez-vous pas encore arrivé : toujours à son heure (Arno 13:00)");
  ok(!J.blocs.some(b => b.id === "B"), "machine bloquée (en attente de pièce) : pas dans l'horaire, même avec un rendez-vous");
  ok(J.blocs.filter(b => b.genre !== "aide").every(b => ["R1", "R2", "E", "R4"].includes(b.id) || !J.blocs.some(r => ["R1", "E"].includes(r.id) && r.tech === b.tech && chev(r, b))), "rien n'est placé par-dessus un rendez-vous du calendrier");
  ok(J.conflits.length === 0, "aucun conflit");
  ok(["R1", "R2"].every(id => P.jours.every(j => j.blocs.filter(b => b.id === id).length <= 1) && P.jours.reduce((n, j) => n + j.blocs.filter(b => b.id === id).length, 0) === 1), "chaque rendez-vous est placé une seule fois (pas de 2e bloc plus loin dans la file)");
  // Bandeau « À faire ensuite » du tableau de bord : dans l'ordre de l'horaire
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.ordreBandeauRendre();
  const heures = $$("#od-bandeau .od-bd-q").map(e => (/^(\d\d:\d\d)/.exec(e.textContent) || [])[1]).filter(Boolean);
  ok(heures.length >= 5 && heures.every((h, i) => i === 0 || heures[i - 1] <= h) && heures[0] === "09:00", "tableau de bord « À faire ensuite » : dans l'ordre de l'horaire (" + heures.join(", ") + ")");
  // Sur « Mon écran » du technicien et au tableau de bord
  $("#tech-sec-ordre") && w.ordreTechRendre(w.__get("EMPLOYES")[0]);
  ok(!$("#tech-ordre") || /📅 Rendez-vous/.test(txt($("#tech-ordre"))) && /rendez-vous de 10:00 au calendrier/.test(txt($("#tech-ordre"))), "« Mon écran » de Gwendal : « 📅 Rendez-vous · rendez-vous de 10:00 au calendrier »");
  w.ordreRendre && $("#od-corps") && (w.__set("ordreJourVu", AUJ), w.ordreRendre());
  ok(!$("#od-corps") || /Les rendez-vous du calendrier passent avant tout/.test(txt($("#od-corps"))), "page Ordre de travail : la règle est écrite en haut");
  w.__set("EMPLOYES", empAvant); w.__set("machines", machAvant);
  w.ordreAjd = vraiAjd; w.ordreMaintenant = vraiMaint;

  // ══════════ 7. « 📺 Brancher une TV » ══════════
  // Arrivé par le code QR de la TV (?tvcode=482913) : la fenêtre s'ouvre toute seule, code rempli
  w.__set("sessionCourante", { nom: "Gwendal", quand: new Date().toISOString() });
  await attendre(() => $("#voile-tvcode") && $("#voile-tvcode").classList.contains("ouvert"), 5000);
  ok($("#voile-tvcode") && $("#voile-tvcode").classList.contains("ouvert") && $("#tvcode-champ").value === "482 913", "lien du code QR (?tvcode=482913) : la fenêtre s'ouvre, code rempli (482 913)");
  ok(!/tvcode/.test(w.location.search), "le code est retiré de l'adresse (pas rejoué au rechargement)");
  w.ouvrirEcranTech(); await dodo(30);   // « Mon écran » s'ouvre juste après (connexion d'un technicien)
  ok($("#voile-tvcode").classList.contains("ouvert") && (Number(w.getComputedStyle($("#voile-tvcode")).zIndex) || 0) > (Number(w.getComputedStyle($("#ecran-tech")).zIndex) || 0),
     "« Mon écran » ouvert après : la fenêtre du code reste par-dessus");
  if (!$("#voile-tvcode")) w.tvBrancherOuvrir("482913");
  fonction = async (n, c) => c.action === "confirmer" && c.code === "482913" ? { data: { ok: true, ecran: "lift", tech: "Gwendal" }, error: null } : { data: { erreur: "Code inconnu ou expiré : regarde le code affiché sur la TV" }, error: null };
  $("#tvcode-ok").click();
  await attendre(() => !$("#voile-tvcode").classList.contains("ouvert"));
  ok(appels.some(a => a.n === "tv-jumelage" && a.corps.action === "confirmer" && a.corps.code === "482913") && !$("#voile-tvcode").classList.contains("ouvert"), "« 📺 Brancher » : la fonction tv-jumelage confirme le code avec le compte de Gwendal");
  ok(toasts().some(t => /La TV se branche avec ton compte \(Gwendal\)/.test(t)), "toast « La TV se branche avec ton compte (Gwendal) — elle suivra ton punch »");
  // Tuile sur « Mon écran »
  w.ouvrirEcranTech && w.ouvrirEcranTech();
  w.rendreEcranTech();
  ok($("#tech-tuile-tv") && /Brancher une TV/.test($("#tech-tuile-tv").textContent), "« Mon écran » d'un technicien : tuile « 📺 Brancher une TV »");
  $("#tech-tuile-tv").click(); await dodo(20);
  const zi = (s) => Number(w.getComputedStyle($(s)).zIndex) || 0;
  ok($("#voile-tvcode").classList.contains("ouvert") && $("#tvcode-champ").value === "", "la tuile ouvre la fenêtre du code (vide)");
  ok(zi("#voile-tvcode") > zi("#ecran-tech"), "la fenêtre passe par-dessus « Mon écran » (" + zi("#voile-tvcode") + " > " + zi("#ecran-tech") + ")");
  $("#tvcode-champ").value = "111 222"; $("#tvcode-ok").click();
  await attendre(() => /Code inconnu ou expiré/.test($("#tvcode-msg").textContent));
  ok(/Code inconnu ou expiré/.test($("#tvcode-msg").textContent) && $("#voile-tvcode").classList.contains("ouvert"), "mauvais code : le message du serveur s'affiche, la fenêtre reste ouverte");
  $("#tvcode-champ").value = "12"; $("#tvcode-ok").click();
  ok(/6 chiffres/.test($("#tvcode-msg").textContent), "code incomplet : « Le code a 6 chiffres »");
  $("#voile-tvcode").classList.remove("ouvert");
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.rendreEcranTech();
  ok(!$("#tech-tuile-tv"), "administration : pas de tuile (jamais un compte admin sur la TV)");
  w.fermerEcranTech && w.fermerEcranTech();

  // ══════════ 8. Nouvelle version en ligne ══════════
  const VA = w.__get("APP_VERSION"), VN = "v" + (parseInt(VA.slice(1), 10) + 1);
  w.fetch = async (u) => /version\.txt/.test(u) ? { ok: true, status: 200, text: async () => VA + "\n" } : { ok: false, status: 404, text: async () => "" };
  await w.versionVerifier();
  ok(!$("#maj-bandeau"), "même version en ligne : pas de bandeau");
  w.fetch = async (u) => /version\.txt/.test(u) ? { ok: true, status: 200, text: async () => VN } : { ok: false, status: 404, text: async () => "" };
  await w.versionVerifier();
  ok($("#maj-bandeau") && $("#maj-bandeau").textContent.includes("Nouvelle version de l'app en ligne (" + VN + ")") && $("#maj-bandeau").textContent.includes(VA) && $("#maj-bandeau button"), "nouvelle version déployée : bandeau « 🔄 Nouvelle version (" + VN + ") — Recharger »");
  w.fetch = async () => ({ ok: true, status: 200, text: async () => "<!doctype html>" });
  $("#maj-bandeau").remove(); await w.versionVerifier();
  ok(!$("#maj-bandeau"), "réponse bizarre (page HTML) : ignorée");
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
 } catch (err) { ok(false, "exception (app) : " + (err && err.stack || err)); }
 ok(erreurs.length === 0, "app : aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));

 // ══════════ 9. La TV : brancher avec un code (rien à taper sur la TV) ══════════
 const faireTv = async (reponses, compteVerif) => {
  const canaux = [], vus = { demander: 0, attendre: 0, otp: [], deconnexions: 0, qr: [] };
  let rappel = null;
  const auth = {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: (cb) => { rappel = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    signInWithPassword: async () => ({ data: {}, error: { message: "x" } }),
    signOut: async () => { vus.deconnexions++; return { error: null }; },
    verifyOtp: async (o) => { vus.otp.push(o); return compteVerif ? { data: { user: compteVerif, session: {} }, error: null } : { data: {}, error: { message: "Token has expired or is invalid" } }; },
  };
  const sb = faireStub(canaux, auth);
  sb.functions = { invoke: async (n, o) => { const c = o.body; vus[c.action] = (vus[c.action] || 0) + 1; return reponses(c, vus); } };
  const d = new JSDOM(htmlTv.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/tv.html?ecran=lift",
    beforeParse(t) { t.supabase = { createClient: () => sb }; t.__TV_ECRAN = "lift"; t.__TV_JUM_MS = 30;
      t.QRCode = function (el, o) { vus.qr.push(o.text); el.appendChild(t.document.createElement("canvas")); }; t.QRCode.CorrectLevel = { M: 0 }; } });
  const tw = d.window, errs = []; tw.addEventListener("error", e => errs.push(e.message));
  const T = (s) => tw.document && tw.document.querySelector(s);
  await attendre(() => T("#jum-msg"));
  return { tw, vus, errs, T, X: (s) => (T(s) || {}).textContent || "" };
 };
 try {
  const code = { code: "483920", secret: "s3cr3t", expire_le: new Date(Date.now() + 600000).toISOString() };
  // Gwendal confirme au 3e coup d'œil de la TV
  const A = await faireTv((c, vus) => c.action === "demander" ? { data: code, error: null }
    : c.action === "attendre" ? { data: vus.attendre < 3 ? { etat: "attente" } : { etat: "pret", token_hash: "hash-g", tech: "Gwendal" }, error: null } : { data: {}, error: null },
    { id: "u-g", email: "g.brossault@mtrperformance.local" });
  await attendre(() => A.X("#jum-code") === "483 920");
  ok(A.X("#jum-code") === "483 920" && !A.T("#cx").hidden, "TV pas branchée : un code à 6 chiffres en très gros (483 920)");
  ok(A.vus.qr[0] === "https://atelier.mtrperformance.ca/?tvcode=483920" && !A.T("#jum-qr").hidden, "code QR vers l'app avec le code (?tvcode=483920) : on le vise avec le cell");
  await attendre(() => !A.T("#ecran").hidden, 4000);
  ok(A.vus.attendre >= 3 && A.vus.otp.length === 1 && A.vus.otp[0].token_hash === "hash-g" && A.vus.otp[0].type === "magiclink", "la TV attend la confirmation puis se connecte avec la connexion à usage unique (magiclink)");
  await attendre(() => db.ecrans[0].tech === "Gwendal");
  ok(!A.T("#ecran").hidden && A.T("#cx").hidden && db.ecrans[0].mode === "bt" && db.ecrans[0].tech === "Gwendal", "branchée avec le compte de Gwendal : elle suit son punch");
  const nAtt = A.vus.attendre; await dodo(150);
  ok(A.vus.attendre === nAtt, "une fois branchée, la TV arrête de demander");
  ok(A.errs.length === 0, "TV : aucune erreur JavaScript (" + A.errs.length + ")" + (A.errs.length ? " : " + A.errs[0] : ""));
  // Un compte d'administration : refusé, déconnecté, nouveau code
  db.ecrans[0] = { id: "lift", nom: "Lift 2 colonnes", mode: "rien", etape: 0 };
  // (la connexion est à usage unique : le serveur ne la remet qu'une fois)
  const B = await faireTv((c, vus) => c.action === "demander" ? { data: code, error: null } : { data: vus.attendre === 1 ? { etat: "pret", token_hash: "hash-j" } : { etat: "attente" }, error: null },
    { id: "u-j", email: "j.blouin@mtrperformance.local" });
  await attendre(() => /administration/.test(B.X("#cx-err")));
  ok(/Pas de compte d'administration/.test(B.X("#cx-err")) && B.vus.deconnexions === 1 && B.T("#ecran").hidden && db.ecrans[0].mode === "rien", "confirmé avec un compte d'administration : refusé, déconnecté, rien à l'écran");
  await attendre(() => B.vus.demander >= 2);
  ok(B.vus.demander >= 2 && B.X("#jum-code") === "483 920", "… et un nouveau code s'affiche");
  // Code expiré : message, et le bouton du centre en redemande un
  const C = await faireTv((c) => c.action === "demander" ? { data: code, error: null } : { data: { etat: "expire" }, error: null }, null);
  await attendre(() => /Code expiré/.test(C.X("#jum-msg")));
  ok(/Code expiré/.test(C.X("#jum-msg")) && C.X("#jum-code") === "—", "code expiré : « Code expiré. Appuie sur le bouton du centre… »");
  const n0 = C.vus.demander;
  const ev = new C.tw.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }); C.tw.document.body.dispatchEvent(ev);
  await attendre(() => C.vus.demander > n0); await attendre(() => C.X("#jum-code") !== "…");
  ok(C.vus.demander === n0 + 1 && /483 920|—/.test(C.X("#jum-code")), "bouton du centre de la télécommande : nouveau code");
  // Connexion à usage unique refusée par Supabase : message, nouveau code
  const D = await faireTv((c, vus) => c.action === "demander" ? { data: code, error: null } : { data: vus.attendre === 1 ? { etat: "pret", token_hash: "vieux" } : { etat: "attente" }, error: null }, null);
  await attendre(() => /Branchement refusé/.test(D.X("#jum-msg")));
  ok(/Branchement refusé \(Token has expired or is invalid\)/.test(D.X("#jum-msg")) && D.T("#ecran").hidden, "connexion à usage unique refusée : « Branchement refusé » (rien d'ouvert)");
  // Fonction pas déployée : repli sur le mot de passe
  const E = await faireTv(() => ({ data: null, error: { message: "Function not found" } }), null);
  await attendre(() => /Code indisponible/.test(E.X("#jum-msg")));
  ok(/Code indisponible \(Function not found\)/.test(E.X("#jum-msg")) && E.T("#cx-details").open, "fonction tv-jumelage absente : « Code indisponible », le mot de passe s'ouvre en dessous");
  ok(![A, B, C, D, E].some(x => x.errs.length), "TV : aucune erreur JavaScript dans les 5 cas");
 } catch (err) { ok(false, "exception (TV) : " + (err && err.stack || err)); }
 process.exit();
})();
