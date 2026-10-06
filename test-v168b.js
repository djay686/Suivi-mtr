// v168 — Rendez-vous confirmé disparu du calendrier (Dave Thibault, 17 sept.) : la ligne 1 n'est plus écrasée à l'aveugle.
//   Fusion avant d'écrire, suppressions respectées, changement arrivé pendant l'écriture, relecture au réveil,
//   écriture en échec renvoyée, import = remplacement, déconnexion ; alerte + « ↩️ Remettre au calendrier ».
// NODE_PATH=… node test-v168b.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

const pad = (n) => String(n).padStart(2, "0");
const jourIso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
const AUJ = jourIso(0), J2 = jourIso(2), J3 = jourIso(3), J4 = jourIso(4), J5 = jourIso(5), HIER = jourIso(-1);
const EMP = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }];
const mA = { id: "mA", numeroBT: "BT-201", nom: "Spark A", client: "Alpha", tel: "819-555-0001", statut: "avenir", echeance: J3, heure: "10:00" };
const mB = { id: "mB", numeroBT: "BT-202", nom: "Outlander B", client: "Bravo", tel: "819-555-0002", statut: "avenir", echeance: J4, heure: "13:00", demandeId: "dem-b" };
const dem = (o) => Object.assign({ statut: "confirmee", choix: 1, lu: true, cree_le: new Date(Date.now() - 12 * 86400000).toISOString(), confirme_le: new Date(Date.now() - 12 * 86400000).toISOString(), soum_id: "so-x" }, o);
const db = {
  tableau: [{ id: 1, donnees: [mA, mB] }, { id: 4, donnees: EMP }, { id: 10, donnees: [{ id: "so-49", numero: "SO-0049", statut: "envoyee", machineId: "", lignes: [] }] }],
  demandes_service: [
    dem({ id: "dem-dave", nom: "Dave Thibault", tel: "+18199090767", bt_id: "bt-dave", annee: "2022", marque: "BRP", modele: "Spark Trixx", type_machine: "Motomarine",
          description: "Message entretien requis sea doo 103hrs", soum_id: "so-49", soum_numero: "SO-0049",
          creneaux: [{ no: 1, iso: AUJ, heure: "09:00", duree: 60 }, { no: 2, iso: J2, heure: "13:00", duree: 60 }] }),
    dem({ id: "dem-eric", nom: "Éric Tremblay", tel: "819-555-0003", bt_id: "bt-eric", marque: "Polaris", modele: "RZR", creneaux: [{ no: 1, iso: J2, heure: "10:00", duree: 90 }] }),
    dem({ id: "dem-html", nom: "<img src=x onerror=alert(1)>", tel: "819-555-0004", bt_id: "bt-html", modele: "Test", creneaux: [{ no: 1, iso: J5, heure: "08:00", duree: 60 }] }),
    dem({ id: "dem-b", nom: "Bravo", tel: "819-555-0002", bt_id: "mB", creneaux: [{ no: 1, iso: J4, heure: "13:00", duree: 60 }] }),
    dem({ id: "dem-passe", nom: "Vieux", tel: "819-555-0005", bt_id: "bt-vieux", creneaux: [{ no: 1, iso: HIER, heure: "09:00", duree: 60 }] }),
    dem({ id: "dem-refait", nom: "Alpha", tel: "819-555-0001", bt_id: "bt-perdu-refait", creneaux: [{ no: 1, iso: J3, heure: "10:00", duree: 60 }] }),
  ],
  creneaux_actifs: [], demandes_journal: [], sms_recus: [], tableau_sauvegardes: [],
};
const l1 = () => db.tableau.find(r => r.id === 1).donnees;
const setL1 = (v) => { db.tableau.find(r => r.id === 1).donnees = JSON.parse(JSON.stringify(v)); };
const upserts1 = [];
let pannes = {};
const table = (nom) => {
  const q = { op: "select", vals: null, filtres: [], un: false };
  const exec = () => {
    if (pannes[nom + ":" + q.op]) return { data: null, error: { message: pannes[nom + ":" + q.op] } };
    const rows = (db[nom] = db[nom] || []);
    const garde = r => q.filtres.every(f => f(r));
    let data = null;
    if (q.op === "select") data = JSON.parse(JSON.stringify(rows.filter(garde)));
    else if (q.op === "update") { data = rows.filter(garde); data.forEach(r => Object.assign(r, JSON.parse(JSON.stringify(q.vals)))); }
    else if (q.op === "insert") { [].concat(q.vals).forEach(v => rows.push(JSON.parse(JSON.stringify(v)))); data = q.vals; }
    else if (q.op === "upsert") { [].concat(q.vals).forEach(v => { const c = JSON.parse(JSON.stringify(v)); const i = rows.findIndex(r => r.id === c.id); if (i >= 0) rows[i] = c; else rows.push(c); if (nom === "tableau" && c.id === 1) upserts1.push(c.donnees); }); data = q.vals; }
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
const canaux = [];
const sbStub = {
  from: table,
  channel: (nom) => { const o = { nom, h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe(cb) { o.sub = cb; if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return o; } }; canaux.push(o); return o; },
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: { access_token: "ok" } } }), getUser: async () => ({ data: { user: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }),
  },
  functions: { invoke: async () => ({ data: null, error: { message: "non" } }) },
  storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: null }) }) },
};
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const alertes = [];
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) {
    w.__sbStub = sbStub; w.alert = (m) => alertes.push(String(m)); w.confirm = () => true; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
const machines = () => w.__get("machines");
const ici = (id) => machines().find(m => m.id === id);
const surServeur = (id) => l1().find(m => m.id === id);
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const attendre = async (f, ms = 4000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await dodo(20); return f(); };
const bandeau = () => $("#rdvp-bandeau");
const tempsReel = () => canaux.find(c => c.nom === "tableau-live");
const pousser = (donnees) => tempsReel().h.find(h => h.f.table === "tableau").cb({ eventType: "UPDATE", new: { id: 1, donnees: JSON.parse(JSON.stringify(donnees)) } });
let visible = "visible";
const reveil = async () => { Object.defineProperty(w.document, "visibilityState", { get: () => visible, configurable: true }); visible = "hidden"; w.document.dispatchEvent(new w.Event("visibilitychange")); w.__set("ongletCacheLe", Date.now() - 20000); visible = "visible"; w.document.dispatchEvent(new w.Event("visibilitychange")); await dodo(60); };

(async () => {
 await dodo(1500);
 try {
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  await w.demarrerDonnees();
  await attendre(() => w.__get("chargementOK") && machines().length === 2);
  await attendre(() => bandeau() && bandeau().style.display !== "none");
  ok(machines().length === 2 && ici("mA") && ici("mB"), "chargement : 2 bons au serveur");

  // ── 1. Alerte : rendez-vous confirmés dont le bon n'est plus au calendrier ──
  const bt = bandeau().textContent;
  ok(bandeau().style.display !== "none" && /3 rendez-vous confirmés ne sont plus au calendrier/.test(bt), "bandeau rouge au tableau de bord : 3 rendez-vous confirmés absents du calendrier");
  ok(/Dave Thibault/.test(bt) && /2022 BRP Spark Trixx/.test(bt) && /Remettre au calendrier/.test(bt), "Dave Thibault · 2022 BRP Spark Trixx, avec « ↩️ Remettre au calendrier »");
  ok(!/Vieux/.test(bt) && !/Bravo/.test(bt) && !w.__dem.bonManquant(db.demandes_service.find(d => d.id === "dem-refait")), "pas d'alerte : rendez-vous passé, bon présent, ou client déjà replacé à la main le même jour");
  ok(!bandeau().querySelector("img") && /<img src=x/.test(bt), "nom du client affiché comme texte (aucun HTML injecté)");
  const pastille = $("#btn-dem-tb .dem-pastille");
  ok(pastille && pastille.textContent === "3", "bouton « Demandes rendez-vous » : 3 à traiter");
  w.__set("sessionCourante", { nom: "Gwendal", quand: new Date().toISOString() }); w.rdvPerdusRendre();
  ok(bandeau().style.display === "none", "technicien (sans la section Demandes) : pas de bandeau");
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() }); w.rdvPerdusRendre();

  // ── 2. Appareil en retard : le bon est encore au serveur → on le reprend, pas de 2e bon ──
  setL1([{ id: "bt-eric", nom: "Polaris RZR", client: "Éric Tremblay", tel: "819-555-0003", statut: "avenir", echeance: J2, heure: "10:00", demandeId: "dem-eric", technicien: "Gwendal" }].concat(l1()));
  await w.__dem.remettreBon("dem-eric");
  ok(ici("bt-eric") && ici("bt-eric").technicien === "Gwendal" && !ici("bt-eric").retabliLe && machines().filter(m => m.id === "bt-eric").length === 1, "bon encore au serveur : repris tel quel (technicien gardé), aucun doublon");
  ok(toasts().some(t => /encore au serveur : cet appareil est maintenant à jour/.test(t)), "toast « le bon était encore au serveur »");

  // ── 3. Dave : « ↩️ Remettre au calendrier » depuis la demande ──
  await w.ouvrirDemandes();
  await w.__dem.ouvrirFiche("dem-dave"); await dodo(30);
  ok(/Ce rendez-vous n'est plus au calendrier/.test($("#dem-voile").textContent) && $("#dem-bon-remettre") && $("#dem-bon-ignorer"), "fiche de la demande : « Ce rendez-vous n'est plus au calendrier » + 2 boutons");
  $("#dem-bon-remettre").click();
  await attendre(() => surServeur("bt-dave"));
  const d = ici("bt-dave");
  ok(d && d.statut === "avenir" && d.echeance === AUJ && d.heure === "09:00" && d.dureeEstimee === 60 && d.client === "Dave Thibault" && d.tel === "+18199090767" && d.nom === "2022 BRP Spark Trixx",
     "bon recréé avec le même id : aujourd'hui 9 h, 60 min, Dave Thibault, 2022 BRP Spark Trixx");
  ok(d.demandeId === "dem-dave" && d.soumissionId === "so-49" && d.origine === "demande-web" && d.retabliPar === "Jason" && /103hrs/.test(d.travaux), "lié à la demande et à la soumission SO-0049, travaux repris, « rétabli par Jason »");
  ok(surServeur("bt-dave") && surServeur("mA") && surServeur("bt-eric"), "enregistré au serveur (avec les autres bons)");
  await attendre(() => (w.__get("soumissions").find(s => s.id === "so-49") || {}).machineId === "bt-dave");
  ok(w.__get("soumissions").find(s => s.id === "so-49").machineId === "bt-dave", "la soumission SO-0049 pointe vers le bon");
  await attendre(() => db.demandes_journal.some(j => j.evenement === "bt_retabli"));
  ok(db.demandes_journal.some(j => j.demande_id === "dem-dave" && j.evenement === "bt_retabli" && j.detail.iso === AUJ), "historique de la demande : « Bon remis au calendrier »");
  ok(toasts().some(t => /Rendez-vous de Dave Thibault remis au calendrier/.test(t)), "toast « Rendez-vous de Dave Thibault remis au calendrier »");
  w.afficher();
  ok($$("article.carte").some(a => /Spark Trixx/.test(a.textContent)), "la carte est de retour au tableau");
  ok(/1 rendez-vous confirmé|Un rendez-vous confirmé/.test(bandeau().textContent) && !/Dave/.test(bandeau().textContent), "bandeau : il en reste un (pas Dave)");

  // ── 4. « Annulé ou replacé à la main » ──
  await w.__dem.bonIgnorer("dem-html");
  ok(db.demandes_service.find(x => x.id === "dem-html").bt_id === null && bandeau().style.display === "none", "annulé / replacé : la demande ne réclame plus son bon, le bandeau disparaît");
  ok(db.demandes_journal.some(j => j.demande_id === "dem-html" && j.evenement === "bt_ignore"), "historique : « Bon disparu : rendez-vous annulé ou replacé »");
  w.document.getElementById("dem-voile").classList.remove("ouvert");

  // ── 5. LA CAUSE : un bon ajouté au serveur (confirmation par texto) sans que ce poste le sache ──
  await dodo(400);
  setL1([{ id: "bt-sms", nom: "Ski-Doo Summit", client: "Nouveau Client", statut: "avenir", echeance: J4, heure: "08:00", origine: "demande-web" }].concat(l1()));
  ici("mA").heure = "11:00";
  await w.sauvegarder();
  ok(surServeur("bt-sms") && surServeur("mA").heure === "11:00" && ici("bt-sms"), "écriture d'un poste en retard : le bon créé par le serveur reste (avant : effacé), et la modification part aussi");
  // Suppression voulue : pas ramenée par la fusion ; la demande ne la réclame plus
  await dodo(400);
  w.supprimer("mB");
  await attendre(() => !surServeur("mB"));
  ok(!surServeur("mB") && !ici("mB"), "un bon supprimé sur ce poste n'est pas ramené du serveur");
  await attendre(() => db.demandes_service.find(x => x.id === "dem-b").bt_id === null);
  ok(db.demandes_service.find(x => x.id === "dem-b").bt_id === null, "bon venu d'une demande supprimé : la demande ne le réclame plus (pas d'alerte)");

  // ── 6. Bon ajouté ailleurs PENDANT notre écriture (entre notre lecture et notre écriture) ──
  await dodo(400);
  ici("mA").heure = "12:00";
  await w.sauvegarder();                                    // notre écriture vient d'effacer le bon au serveur…
  ok(w.__get("enEcriture") && !surServeur("bt-course"), "(pendant les 300 ms qui suivent notre écriture)");
  pousser([{ id: "bt-course", nom: "Yamaha", client: "Course", statut: "avenir", echeance: J5, heure: "15:00" }].concat(l1()));   // …son avis arrive en retard
  ok(ici("bt-course"), "le bon arrivé pendant l'écriture est pris tout de suite (avant : ignoré)");
  await attendre(() => surServeur("bt-course"), 2000);
  ok(surServeur("bt-course") && surServeur("mA").heure === "12:00", "et il est réécrit au serveur juste après (notre écriture l'avait effacé)");

  // Pendant que ce poste écrit une AUTRE ligne (soumission, pointage…), un changement de la liste arrive : appliqué
  await dodo(400);
  w.__set("enEcriture", true);
  pousser(l1().map(m => m.id === "mA" ? Object.assign({}, m, { technicien: "Arno" }) : m));
  ok(ici("mA").technicien === "Arno", "ce poste écrit une soumission : un changement de la liste venu d'ailleurs est quand même appliqué (avant : ignoré)");
  w.__set("enEcriture", false);

  // ── 7. Réveil : la liste est relue ──
  await dodo(400);
  setL1(l1().map(m => m.id === "mA" ? Object.assign({}, m, { heure: "14:00", technicien: "Gwendal" }) : m));
  await reveil();
  await attendre(() => ici("mA").heure === "14:00");
  ok(ici("mA").heure === "14:00" && ici("mA").technicien === "Gwendal", "onglet revenu après 15 s : la liste est relue (changement fait ailleurs pendant la veille)");
  setL1(l1().map(m => m.id === "mA" ? Object.assign({}, m, { heure: "14:30" }) : m));
  canaux.find(c => c.nom === "tableau-live").sub("SUBSCRIBED");
  await attendre(() => ici("mA").heure === "14:30");
  ok(ici("mA").heure === "14:30", "temps réel rebranché après une coupure : la liste est relue");

  // ── 8. Écriture en échec (réseau) : au retour, ce poste renvoie ses changements (pas écrasés par le serveur) ──
  await dodo(400);
  pannes["tableau:upsert"] = "Failed to fetch";
  ici("mA").heure = "15:00";
  await w.sauvegarder();
  ok(w.__get("ligne1EnAttente") && surServeur("mA").heure === "14:30", "réseau coupé : la modification attend sur le poste");
  delete pannes["tableau:upsert"];
  await dodo(400);
  w.dispatchEvent(new w.Event("online"));
  await attendre(() => surServeur("mA").heure === "15:00");
  ok(surServeur("mA").heure === "15:00" && ici("mA").heure === "15:00" && !w.__get("ligne1EnAttente"), "réseau revenu : la modification part (le serveur ne l'écrase pas)");

  // ── 9. Déconnexion : rien ne se recharge ──
  await dodo(400);
  w.__set("sessionCourante", null);
  setL1(l1().map(m => m.id === "mA" ? Object.assign({}, m, { heure: "16:00" }) : m));
  await reveil();
  ok(ici("mA").heure === "15:00", "après la déconnexion, le réveil ne recharge rien sur l'appareil");
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });

  // ── 10. Import d'une sauvegarde : un vrai remplacement ──
  await dodo(400);
  setL1([{ id: "bt-x", nom: "Intrus", statut: "avenir" }].concat(l1()));
  w.__set("machines", [JSON.parse(JSON.stringify(ici("mA")))]);
  w.__set("ligne1Remplacement", true);
  await w.sauvegarder();
  ok(l1().length === 1 && l1()[0].id === "mA", "import d'une sauvegarde : remplace tout (pas de fusion)");
  ok(!w.__get("ligne1Remplacement"), "… une seule fois");
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
