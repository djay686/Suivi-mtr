// v164 — Ordre de travail : file des machines à faire + horaire de la journée par technicien.
//   En cours → commencées → RDV dépassés / du jour → déjà arrivées (on prend de l'avance) → sans RDV ;
//   rendez-vous pas encore arrivés à heure fixe ; un seul côte à côte à la fois ; ordre manuel ; horaire fixé à la main.
// NODE_PATH=… node test-v164.js ./index.html
// Le CORPS (entre les deux marqueurs) tourne aussi tel quel dans un navigateur (window = w).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

const table = () => { const ch = new Proxy({}, { get(t, k) { if (k === "then") return (ok) => ok({ data: [], error: null }); return (...a) => (k === "maybeSingle" || k === "single") ? Promise.resolve({ data: null, error: null }) : ch; } }); return ch; };
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

// ════════ CORPS DES TESTS ════════
async function corpsV164(w, ok, dodo) {
  const $ = (s) => w.document.querySelector(s);
  const $$ = (s) => [...w.document.querySelectorAll(s)];
  const AUJ = "2026-09-28", DEMAIN = "2026-09-29";              // lundi 28 septembre 2026
  const hm = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const chev = (a, b) => a.segs.some(s => b.segs.some(t => s[0] < t[1] && s[1] > t[0]));
  const il_y_a = (min) => new Date(Date.now() - min * 60000).toISOString();
  w.__set("sb", w.__sbStub); w.__set("chargementOK", true);
  w.ordreAjd = () => AUJ;                                         // horloge figée : lundi 9 h 00
  w.ordreMaintenant = () => 9 * 60;
  const HOR = { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null };
  w.__set("rdvConfig", { horaire: JSON.parse(JSON.stringify(HOR)), tampon: 15, diner: { actif: true, debut: 12, duree: 60 } });
  w.__set("dispoOverride", {});
  w.__set("commandes", []);
  w.__set("EMPLOYES", [
    { nom: "Jason", role: "admin", actif: true, horaire: null, vacances: [], competences: [] },
    { nom: "Gwendal", role: "technicien", actif: true, horaire: null, vacances: [], competences: [] },
    { nom: "Arno", role: "technicien", actif: true, horaire: null, vacances: [], competences: [] },
    { nom: "Samantha", role: "technicien", actif: true, horaire: null, vacances: [{ debut: "2026-09-28", fin: "2026-09-28" }], competences: [] },   // en congé lundi
    { nom: "Luc", role: "tache", actif: true, horaire: null, vacances: [], competences: [] },                         // homme à tout faire
  ]);
  const M = (o) => Object.assign({ id: o.id, nom: o.nom || "Machine " + o.id, client: o.client || "Client " + o.id, type: o.type || "VTT", statut: "avenir",
                                   dureeEstimee: 60, machineArrivee: false, pieceComplete: true, pieces: [], chrono: [] }, o);
  const base = () => [
    M({ id: "A", nom: "Outlander 650", statut: "reparation", machineArrivee: true, technicien: "Gwendal", dureeEstimee: 180,
        chrono: [{ tech: "Gwendal", debut: il_y_a(60), fin: null, pauses: [] }] }),                            // en cours : reste 2 h
    M({ id: "B", nom: "Renegade", type: "Motoneige", machineArrivee: true, echeance: "2026-09-25", heure: "10:00", dureeEstimee: 90 }),  // RDV dépassé
    M({ id: "C", nom: "Spark", type: "Motomarine", machineArrivee: true, echeance: "2026-10-02", heure: "10:00", dureeEstimee: 60 }),   // RDV jeudi, déjà là
    M({ id: "D", nom: "Sportsman", statut: "sansrdv", machineArrivee: true, arriveeLe: "2026-09-20T14:00:00.000Z", dureeEstimee: 60 }), // sans RDV
    M({ id: "E", nom: "Maverick X3", type: "Côte à côte", echeance: AUJ, heure: "13:00", technicien: "Arno", dureeEstimee: 120 }),    // RDV 13 h, pas arrivée
    M({ id: "F", statut: "attente", machineArrivee: true }),                                                    // en attente de pièce
    M({ id: "G", machineArrivee: true, pieceComplete: false, echeance: "2026-09-30", heure: "09:00", pieces: [{ num: "1", coche: true }, { num: "2", coche: false }] }),
    M({ id: "H", statut: "prete", machineArrivee: true }),                                                      // facturée : hors de l'ordre
    M({ id: "I", nom: "Defender", type: "Côte à côte", statut: "reparation", machineArrivee: true, technicien: "Arno", dureeEstimee: 120 }),  // commencée, pas live
  ];
  w.__set("machines", base());
  const P0 = () => w.ordrePlanifier({ auj: AUJ, maintenant: 9 * 60 });

  // ── 1. La file ──
  let P = P0();
  ok(P.F.file.map(x => x.m.id).join(",") === "A,I,B,C,D", "file : en cours → commencée → RDV dépassé → déjà arrivée (avance) → sans RDV (" + P.F.file.map(x => x.m.id).join(",") + ")");
  ok(P.F.bloquees.map(x => x.m.id).sort().join(",") === "F,G" && /attente de pièce/.test(P.F.bloquees.find(x => x.m.id === "F").bloque) && /Pièces pas toutes reçues \(1\/2\)/.test(P.F.bloquees.find(x => x.m.id === "G").bloque),
     "bloquées : en attente de pièce, pièces pas toutes reçues (1/2)");
  ok(P.F.attendues.map(x => x.m.id).join(",") === "E" && !P.F.file.some(x => x.m.id === "H"), "RDV pas encore arrivée à part ; facturée hors de l'ordre");

  // ── 2. L'horaire du lundi ──
  const J = P.jours[0], bl = (id) => J.blocs.find(b => b.id === id && b.genre !== "aide");
  ok(J.lanes.map(l => l.t.nom).join(",") === "Jason,Gwendal,Arno", "techniciens du jour : Samantha en congé, l'homme à tout faire exclu (" + J.lanes.map(l => l.t.nom).join(",") + ")");
  const a = bl("A");
  ok(a && a.genre === "encours" && a.tech === "Gwendal" && a.debut === 540 && a.fin === 660, "en cours : Gwendal continue maintenant, pour le temps qui reste (09:00 – 11:00)");
  const e = bl("E");
  ok(e && e.genre === "rdv" && e.tech === "Arno" && e.debut === hm("13:00") && e.fin === hm("15:00"), "rendez-vous pas encore arrivé : à son heure, avec son technicien (Arno 13:00 – 15:00)");
  const i = bl("I");
  ok(i && i.tech === "Arno" && i.debut === 540, "commencée et assignée à Arno : Arno la reprend à 09:00");
  ok(bl("B") && bl("B").debut === 540 && bl("B").tech === "Jason", "RDV dépassé : au premier technicien libre (Jason 09:00)");
  const c = bl("C");
  ok(c && c.iso === AUJ && c.genre === "auto", "RDV de jeudi, machine déjà là : placée aujourd'hui → on prend de l'avance");
  ok(J.blocs.filter(b => b.genre !== "aide").every(b => !(b.tech === "Arno" && b.id !== "E" && chev(b, e))), "rien n'est placé par-dessus le rendez-vous d'Arno");
  const diner = [hm("12:00"), hm("13:00")];
  ok(J.blocs.every(b => b.genre === "rdv" || b.segs.every(s => !(s[0] < diner[1] && s[1] > diner[0]))), "personne ne travaille pendant le dîner");
  ok(J.conflits.length === 0, "aucun conflit ce jour-là");

  // ── 3. Un seul côte à côte à la fois (même espace de travail) ──
  // I (Arno 09:00-11:00) et E (RDV 13:00) sont des côte à côte ; on en ajoute deux, arrivés, sans technicien.
  w.__get("machines").push(M({ id: "K1", nom: "Commander", type: "Côte à côte", statut: "sansrdv", machineArrivee: true, arriveeLe: "2026-09-21T10:00:00Z", dureeEstimee: 90 }),
                           M({ id: "K2", type: "Autre", nom: "RZR côte-à-côte", statut: "sansrdv", machineArrivee: true, arriveeLe: "2026-09-22T10:00:00Z", dureeEstimee: 60 }));
  P = P0();
  const J3 = P.jours[0], cotes = J3.blocs.filter(b => b.espace && b.espace.id === "cotecote");
  ok(cotes.length === 4 && cotes.every(b => ["I", "E", "K1", "K2"].includes(b.id)), "côte à côte reconnus par le type… et par le nom (« RZR côte-à-côte ») (" + cotes.map(b => b.id).join(",") + ")");
  let croise = false; cotes.forEach((x, k) => cotes.slice(k + 1).forEach(y => { if (chev(x, y)) croise = true; }));
  ok(!croise, "jamais deux côte à côte en même temps, tous techniciens confondus");
  const k1 = J3.blocs.find(b => b.id === "K1");
  ok(k1 && k1.debut >= hm("11:00"), "le 2e côte à côte attend que l'espace se libère (K1 à " + (k1 && w.ordreHHMM(k1.debut)) + ", après celui d'Arno)");
  const d3 = J3.blocs.find(b => b.id === "D");
  ok(d3 && d3.debut < k1.debut, "une machine ordinaire passe pendant ce temps (on ne laisse pas un technicien les bras croisés)");
  w.__set("machines", base());

  // ── 4. Dîner, fin de journée, suite le lendemain ──
  w.__get("machines").push(M({ id: "L", nom: "Grosse job", statut: "sansrdv", machineArrivee: true, arriveeLe: "2026-09-27T10:00:00Z", dureeEstimee: 600, technicien: "Jason" }));
  P = P0();
  const l1 = P.jours[0].blocs.find(b => b.id === "L"), l2 = P.jours[1].blocs.find(b => b.id === "L");
  ok(l1 && l1.segs.length === 2 && l1.segs[0][1] === hm("12:00") && l1.segs[1][0] === hm("13:00") && l1.fin === hm("17:00") && l1.reste > 0,
     "job de 10 h : s'arrête au dîner et à 17:00, le reste est reporté (" + (l1 && l1.segs.map(s => w.ordreHHMM(s[0]) + "-" + w.ordreHHMM(s[1])).join(" / ")) + ")");
  ok(l2 && l2.genre === "suite" && l2.tech === "Jason" && l2.debut === hm("09:00"), "le lendemain : reprise en premier, par le même technicien, à 09:00");
  const tot = [l1, l2].concat(P.jours.slice(2).map(j => j.blocs.find(b => b.id === "L")).filter(Boolean)).reduce((s, b) => s + b.segs.reduce((u, g) => u + g[1] - g[0], 0), 0);
  ok(tot === 600, "le temps total planifié = la durée estimée (" + tot + " min)");
  w.__set("machines", base());

  // ── 5. Pas de job entamée à 16 h 50 ; compétences ; vacances ──
  P = w.ordrePlanifier({ auj: AUJ, maintenant: hm("16:50") });
  ok(!P.jours[0].blocs.some(b => b.genre === "auto"), "à 16:50, aucune nouvelle job n'est entamée (moins de 30 min avant la fermeture)");
  ok(P.premier.get("B") && P.premier.get("B").iso === DEMAIN, "elles passent au lendemain matin");
  w.__get("EMPLOYES")[0].competences = ["Motoneige"];                // Jason : motoneiges seulement
  P = P0();
  ok(P.jours.every(j => j.blocs.every(b => b.tech !== "Jason" || b.m.type === "Motoneige" || b.genre === "encours")), "compétences respectées : Jason ne reçoit que des motoneiges");
  w.__get("EMPLOYES")[0].competences = [];
  ok(!P.jours[0].blocs.some(b => b.tech === "Samantha") && P.jours[1].lanes.some(l => l.t.nom === "Samantha"), "vacances respectées : Samantha absente lundi, présente mardi");

  // ── 6. Ordre manuel ──
  w.__set("machines", base());
  w.ordreDeplacer("D", 0);
  P = P0();
  ok(P.F.file.map(x => x.m.id).join(",") === "A,D,I,B,C", "⤒ Mettre en premier : D passe devant (l'en cours reste en tête) (" + P.F.file.map(x => x.m.id).join(",") + ")");
  ok(P.F.manuel && w.__get("machines").find(m => m.id === "D").ordreRang === 10, "l'ordre est enregistré sur les machines (ordreRang)");
  ok(P.premier.get("D").debut === 540, "l'horaire suit l'ordre manuel : D à 09:00");
  w.ordreDeplacer("I", 3);
  ok(w.ordreFile(AUJ).file.map(x => x.m.id).join(",") === "A,D,B,C,I", "▼ descendre : I après C");
  // une nouvelle arrivée (RDV dépassé, plus ancien que B) se glisse après la dernière machine que l'automatique mettrait avant elle
  w.__get("machines").push(M({ id: "N", machineArrivee: true, echeance: "2026-09-24", heure: "09:00" }));
  ok(w.ordreFile(AUJ).file.map(x => x.m.id).join(",") === "A,D,N,B,C,I", "nouvelle arrivée insérée à sa place sans défaire l'ordre manuel (" + w.ordreFile(AUJ).file.map(x => x.m.id).join(",") + ")");
  w.ordreRemettreAuto();
  ok(!w.__get("machines").some(m => m.ordreRang != null) && !w.ordreFile(AUJ).manuel, "↺ Revenir à l'ordre automatique : rangs effacés");

  // ── 7. Horaire fixé à la main ──
  w.__set("machines", base());
  const mD = w.__get("machines").find(m => m.id === "D");
  mD.planif = { jour: DEMAIN, heure: "14:00", tech: "Samantha", duree: 45 };
  P = P0();
  const pD = P.premier.get("D");
  ok(pD && pD.iso === DEMAIN && pD.genre === "manuel" && pD.tech === "Samantha" && pD.debut === hm("14:00") && pD.fin === hm("14:45"), "📌 fixé mardi 14:00 avec Samantha, 45 min : respecté");
  ok(!P.jours[0].blocs.some(b => b.id === "D"), "… et plus placé automatiquement lundi");
  mD.planif = { jour: "2026-09-20", heure: "14:00", tech: "Samantha" };            // date passée : ignorée
  ok(w.ordrePlanifier({ auj: AUJ, maintenant: 540 }).premier.get("D").genre === "auto", "un horaire fixé à une date passée est ignoré (retour à l'automatique)");
  // placée automatiquement, une machine contourne une heure fixée ; deux heures imposées qui se croisent → conflit.
  // Ici : un côte à côte fixé à 13:30 avec Jason, pendant le rendez-vous côte à côte d'Arno (13:00 – 15:00).
  w.__get("machines").push(M({ id: "K3", type: "Côte à côte", statut: "sansrdv", machineArrivee: true, dureeEstimee: 60, planif: { jour: AUJ, heure: "13:30", tech: "Jason" } }));
  P = P0();
  const k3 = P.jours[0].blocs.find(b => b.id === "K3");
  ok(k3 && k3.conflits.some(x => /Deux côte à côte en même temps/.test(x)) && P.jours[0].conflits.length >= 2, "📌 à la main par-dessus un autre côte à côte : conflit signalé (« Deux côte à côte en même temps »)");
  w.__set("machines", base());

  // ── 8. Écran « Ordre de travail » (administration) ──
  const s = { nom: "Jason", quand: new Date().toISOString() };
  w.__set("sessionCourante", s); try { w.localStorage.setItem("mtr-session-v1", JSON.stringify(s)); } catch (_) {}
  const cx = $("#ecran-connexion"); if (cx) cx.classList.remove("ouvert");
  w.appliquerDroits();
  ok(!!$("#btn-ordre") && $("#btn-ordre").style.display !== "none" && !!$('#menu-lateral .menu-item[data-section="ordre"]'), "bouton « 🔧 Ordre de travail » en haut et dans le menu");
  w.ouvrirOrdre(); await dodo(10);   // la pile des fenêtres (v71) pose le z-index juste après
  ok($("#ordre-page").classList.contains("ouvert") && +$("#ordre-page").style.zIndex > 1000, "la page s'ouvre par-dessus (pile des fenêtres)");
  ok($$("#od-liste > li").length === 5 && $$("#od-liste > li .od-rang").map(x => x.textContent).join("") === "12345", "5 machines numérotées dans la file");
  ok(/En cours/.test($("#od-liste > li").textContent) && !$("#od-liste > li").hasAttribute("draggable"), "l'en cours est en tête, pas déplaçable");
  ok($$("#od-liste > li[draggable=true]").length === 4 && $$("#od-liste .od-actions").length === 4, "les 4 autres : glisser, ⤒ ▲ ✏️ ▼");
  ok(/on prend de l'avance/.test($('#od-liste > li[data-id="C"]').textContent), "C : « déjà arrivée : on prend de l'avance »");
  ok(/Bloquées/.test($("#od-corps").textContent) && /attente de pièce/.test($("#od-corps").textContent), "section « 🔒 Bloquées »");
  ok($$(".od-tl-col").length === 3 && $$('.od-bloc[data-id="E"]').length === 1 && /Maverick/.test($('.od-bloc[data-id="E"]').textContent), "horaire : une colonne par technicien, le rendez-vous d'Arno affiché");
  ok($$(".od-bloc.od-espace").length >= 2, "les côte à côte sont marqués 🚙 dans l'horaire");
  $('#od-liste > li[data-id="D"] .od-btn[title="Mettre en premier"]').click(); await dodo(20);
  ok($$("#od-liste > li")[1].dataset.id === "D" && /ordre manuel/.test($("#od-corps").textContent) && $("#od-btn-auto").style.display !== "none", "clic ⤒ : D monte au 2e rang, « ✋ ordre manuel », bouton ↺ visible");
  $('#od-liste > li[data-id="D"] .od-btn[title="Fixer l\'heure ou le technicien"]').click(); await dodo(10);
  ok($("#voile-od-planif").classList.contains("ouvert") && $("#odp-jour").value === AUJ && /Sportsman/.test($("#odp-machine").textContent), "✏️ ouvre « Horaire de la machine », prérempli");
  ok([...$("#odp-tech").options].map(o => o.value).join(",") === "Jason,Gwendal,Arno", "technicien : seulement ceux à l'horaire ce jour-là");
  $("#odp-jour").value = DEMAIN; w.ordrePlanifMajTechs();
  ok([...$("#odp-tech").options].some(o => o.value === "Samantha"), "changer de jour met la liste des techniciens à jour (Samantha mardi)");
  $("#odp-tech").value = "Samantha"; $("#odp-heure").value = "15:30"; $("#odp-duree").value = "60";
  w.ordrePlanifValider(); await dodo(20);
  const pl = w.__get("machines").find(m => m.id === "D").planif;
  ok(!$("#voile-od-planif").classList.contains("ouvert") && pl && pl.jour === DEMAIN && pl.heure === "15:30" && pl.tech === "Samantha" && pl.duree === 60 && pl.par === "Jason",
     "📌 Fixer : enregistré sur la machine (jour, heure, technicien, durée, par qui)");
  ok(w.__get("ordreJourVu") === DEMAIN && $$('.od-bloc.od-k-manuel[data-id="D"]').length === 1, "l'horaire passe à mardi et montre le bloc 📌");
  w.ordrePlanifOuvrir("D"); await dodo(10);
  ok($("#odp-auto").style.display !== "none", "« ↺ Horaire automatique » proposé pour une machine fixée");
  w.ordrePlanifAuto(); await dodo(10);
  ok(!w.__get("machines").find(m => m.id === "D").planif, "↺ Horaire automatique : l'heure fixée est retirée");
  const eAvant = JSON.stringify(w.__get("machines").find(m => m.id === "E"));
  ok(eAvant.includes('"echeance":"2026-09-28"') && eAvant.includes('"heure":"13:00"') && eAvant.includes('"technicien":"Arno"'), "le rendez-vous au calendrier n'est jamais modifié");
  w.fermerOrdre();

  // ── 9. Tableau de bord, écran d'atelier, « Mon écran » ──
  w.afficher();
  ok($("#od-bandeau").style.display !== "none" && $$("#od-bandeau .od-bd-item").length === 5 && /À faire ensuite/.test($("#od-bandeau").textContent), "tableau de bord : bandeau « 🔧 À faire ensuite »");
  const p = w.tbPrefs(); p.blocs.ordre = false; w.__get("EMPLOYES").find(x => x.nom === "Jason").tableau = p; w.afficher();
  ok($("#od-bandeau").style.display === "none", "le bandeau se masque dans ⚙️ Mon tableau de bord");
  delete w.__get("EMPLOYES").find(x => x.nom === "Jason").tableau;
  w.rendreEcranAtelier();
  ok($("#ea-ordre").style.display !== "none" && $$("#ea-ordre-liste .ea-rdv-item").length === 4, "écran d'atelier : « 🔧 À faire ensuite » (sans l'en cours, déjà sur les tables)");
  // Gwendal (technicien) : voit, ne modifie pas
  const sg = { nom: "Gwendal", quand: new Date().toISOString() };
  w.__set("sessionCourante", sg);
  w.__set("pointageOuvert", () => true);                            // pointé
  ok(w.droit("ordre") && !w.ordrePeutModifier(), "technicien : voit l'ordre de travail, ne le modifie pas");
  w.ouvrirOrdre();
  ok($("#ordre-page").classList.contains("ouvert") && $$("#od-liste .od-actions").length === 0 && $$("#od-liste > li[draggable=true]").length === 0 && $("#od-btn-auto").style.display === "none",
     "technicien : ni ⤒ ▲ ▼ ✏️, ni glisser, ni ↺");
  w.fermerOrdre();
  w.ordreTechRendre(w.utilisateurCourant(), false);
  ok($("#tech-sec-ordre").style.display !== "none" && /En cours/.test($("#tech-ordre").textContent) && /Outlander/.test($("#tech-ordre").textContent), "« Mon écran » de Gwendal : « 🕐 Mon horaire aujourd'hui », sa machine en cours d'abord");
  ok($$("#tech-ordre .od-tm").length >= 2 && /Ensuite/.test($("#tech-ordre").textContent), "… puis « ▶ Ensuite » : sa prochaine machine");
  // homme à tout faire : pas d'accès
  w.__set("sessionCourante", { nom: "Luc", quand: new Date().toISOString() });
  ok(!w.droit("ordre"), "homme à tout faire : pas d'ordre de travail");
  w.ouvrirOrdre();
  ok(!$("#ordre-page").classList.contains("ouvert"), "… la page refuse de s'ouvrir");
  w.ordreTechRendre(w.utilisateurCourant(), true);
  ok($("#tech-sec-ordre").style.display === "none", "… ni de section sur son écran");
  w.__set("sessionCourante", s);

  // ── 10. Noms échappés ──
  w.__get("machines").find(m => m.id === "D").client = "<img src=x onerror=alert(1)>";
  w.ouvrirOrdre(); w.afficher();
  ok(!$("#od-corps img") && !$("#od-bandeau img") && /<img/.test($("#od-corps").textContent), "nom du client affiché comme texte partout (aucun HTML injecté)");
  w.fermerOrdre();
}
// ════════ FIN DU CORPS ════════

(async () => {
  await dodo(1500);
  try { await corpsV164(w, ok, dodo); }
  catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
  ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
  process.exit();
})();
