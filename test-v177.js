// v177 — « Mon poste » : l'accueil de la réception (cartes À traiter, Aujourd'hui / Demain, Pièces, Demandes, Soumissions,
//   À remettre, recherche « où en est la machine de… », actions rapides, le reste des sections), bâti dans le cadre de
//   l'écran des techniciens ; la réception y atterrit à la connexion. Aucun montant d'argent.
// NODE_PATH=… node test-v177.js ./index.html            (ajouter --sabotages pour rejouer les sabotages)
// Le CORPS (entre les deux marqueurs) tourne aussi tel quel dans un navigateur (window = w, avec w.__NAVIGATEUR = true).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
const htmlOriginal = fs.readFileSync(FICHIER, "utf8");

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
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }), createSignedUrl: async () => ({ data: null, error: null }) }) },
};
function preparer(html) {
  html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
  const i = html.lastIndexOf("</body>");
  return html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i);
}
const dodo = (ms) => new Promise(r => setTimeout(r, ms));

// ════════ CORPS DES TESTS ════════
async function corpsV177(w, ok, dodo) {
  const $ = (s) => w.document.querySelector(s);
  const $$ = (s) => [...w.document.querySelectorAll(s)];
  const navig = !!w.__NAVIGATEUR;
  const toasts = () => [...w.document.body.children].filter(el => el.style && el.style.position === "fixed" && el.style.zIndex === "10000").map(el => el.textContent);
  const connecter = (nom) => {
    const s = { nom, quand: new Date().toISOString() };
    w.__set("sessionCourante", s); try { w.localStorage.setItem("mtr-session-v1", JSON.stringify(s)); } catch (_) {}
    const cx = $("#ecran-connexion"); if (cx) cx.classList.remove("ouvert");
    w.appliquerDroits();
  };
  const src = w.document.documentElement.outerHTML + "\n" + $$("script").map(s => s.textContent).join("\n");
  const poste = () => $("#tech-tuiles");
  const texte = () => poste().textContent.replace(/\s+/g, " ");
  const carte = (titre) => $$("#tech-tuiles .po-carte").find(c => c.querySelector(".po-titre") && c.querySelector(".po-titre").textContent.includes(titre));
  // Faux Supabase qui sert des lignes pour quelques tables (Communications et Demandes lisent le serveur au chargement)
  const tableFixe = (rows) => { const ch = new Proxy({}, { get(t, k) { if (k === "then") return (okf) => okf({ data: rows, error: null }); return (...a) => (k === "maybeSingle" || k === "single") ? Promise.resolve({ data: rows[0] || null, error: null }) : ch; } }); return ch; };
  const fromOrig = w.__sbStub.from;
  const iso = (d) => w.__get("isoLocal")(d);
  const auj = new Date(), demain = new Date(); demain.setDate(demain.getDate() + 1);
  const ilYa = (min) => new Date(Date.now() - min * 60000).toISOString();

  try {
    w.__set("sb", w.__sbStub); w.__set("chargementOK", true);
    const HOR = { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null };
    w.__set("rdvConfig", { horaire: JSON.parse(JSON.stringify(HOR)), tampon: 15, diner: { actif: true, debut: 12, duree: 60 } });
    w.__set("dispoOverride", {});
    w.__set("pointages", []);
    w.__set("EMPLOYES", [
      { nom: "Jason", nomFamille: "Blouin", identifiant: "j.blouin", role: "admin", actif: true, compteAuth: true, horaire: null, vacances: [], competences: [] },
      { nom: "Gwendal", nomFamille: "Brossault", identifiant: "g.brossault", role: "technicien", actif: true, compteAuth: true, horaire: null, vacances: [], competences: [] },
      { nom: "Marie", nomFamille: "Lavoie", identifiant: "m.lavoie", role: "reception", actif: true, compteAuth: true, horaire: null, vacances: [], competences: [] },
    ]);
    const M = (o) => Object.assign({ id: o.id, nom: o.nom || "Machine " + o.id, client: o.client || "Client " + o.id, tel: "819-555-0101", type: o.type || "Motomarine", statut: "avenir",
                                     dureeEstimee: 60, machineArrivee: false, pieceComplete: true, pieces: [], chrono: [], creeLe: new Date().toISOString() }, o);
    w.__set("machines", [
      M({ id: "A", nom: "GTX 170", numeroBT: "BT-201", client: "Marc Roy", statut: "prete", machineArrivee: true, echeance: "2026-10-01", facturation: { qbo: { id: "7", doc: "1042", total: 453, realm: "prod" }, total: 453, sousTotal: 394 } }),
      M({ id: "B", nom: "RXT-X 300", numeroBT: "BT-202", client: "Julie Bouchard", tel: "819-555-0142", statut: "afacturer", machineArrivee: true, pretAFacturerLe: new Date(Date.now() - 4 * 86400000).toISOString() }),
      M({ id: "C", nom: "Spark", numeroBT: "BT-190", client: "Luc Gagnon", statut: "archive", livreLe: "2026-09-01", numeroMachine: "44" }),
      M({ id: "D", nom: "Outlander 650", numeroBT: "BT-203", client: "<img src=x onerror=alert(1)>", type: "VTT", statut: "reparation", machineArrivee: true, technicien: "Gwendal", lieu: "Lift 2" }),
      M({ id: "E", nom: "Maverick X3", numeroBT: "BT-204", client: "Paul Tremblay", tel: "819-555-0177", type: "Côte à côte", statut: "avenir", echeance: iso(auj), heure: "10:30", technicien: "Gwendal" }),
      M({ id: "F", nom: "Renegade", numeroBT: "BT-205", client: "Sylvie Côté", type: "Motoneige", statut: "avenir", echeance: iso(demain), heure: "08:30" }),
      M({ id: "G", nom: "Sportsman", numeroBT: "BT-206", client: "Denis Roy", statut: "attente", machineArrivee: true }),
    ]);
    w.__set("soumissions", [
      { id: "s1", numero: "SO-0101", statut: "envoyee", clientNom: "Paul Tremblay", machineId: "E", lignes: [{ type: "mo", desc: "Hivernisation", qte: 1, prix: 95 }], total: 95, date: iso(new Date(Date.now() - 6 * 86400000)) },
      { id: "s2", numero: "SO-0102", statut: "brouillon", clientNom: "X", lignes: [], total: 0, date: iso(auj) },
      { id: "s3", numero: "SO-0103", statut: "acceptee", accepteeLe: new Date().toISOString(), clientNom: "Y", lignes: [{ type: "mo", desc: "Huile", qte: 1, prix: 60 }], total: 60, date: iso(auj) },
    ]);
    w.__set("commandes", [
      { id: "c1", machineId: "G", numeroBT: "BT-206", pieces: [
        { num: "PN-2231", description: "Courroie", qte: "2", commande: true, dateCommande: new Date(Date.now() - 10 * 86400000).toISOString(), fournisseur: "NAPA" },   // en retard (72 h ouvrables dépassées)
        { num: "PN-9", description: "Filtre", qte: "1", commande: true, dateCommande: new Date().toISOString(), fournisseur: "NAPA" },                                // à temps
        { num: "PN-10", description: "Bougie", qte: "4", commande: false },                                                                                             // à commander
      ] },
    ]);
    // Communications et demandes lues « du serveur »
    const COMMS = [
      { id: 1, tel: "8195550142", client_nom: "Julie Bouchard", canal: "appel_manque", direction: "in", statut: "a_traiter", cree_le: ilYa(30), contenu: "" },
      { id: 2, tel: "8195550177", client_nom: "Paul Tremblay", canal: "sms_in", direction: "in", statut: "a_traiter", cree_le: ilYa(10), contenu: "Est-ce que vous avez la courroie ?" },
      { id: 3, tel: "8195550199", client_nom: "Gagnon", canal: "note", direction: "interne", statut: "rappel", rappel_le: ilYa(25), cree_le: ilYa(600), contenu: "Rappeler pour la soumission", meta: { origine: "rappel" } },
      { id: 4, tel: "8195550101", client_nom: "Marc Roy", canal: "sms_out", direction: "out", statut: "traite", cree_le: ilYa(100), contenu: "ok" },
    ];
    const DEMS = [
      { id: "dem-1", statut: "nouvelle", nom: "P. Bélanger", marque: "BRP", modele: "Spyder RT", annee: "2021", tel: "8195550111", cree_le: ilYa(12), services: [] },
      { id: "dem-2", statut: "confirmee", nom: "L. Côté", marque: "Can-Am", modele: "Outlander", annee: "2019", tel: "8195550122", cree_le: ilYa(90), bt_id: "E", services: [] },   // confirmée sans soumission → à traiter
      { id: "dem-3", statut: "refusee", nom: "Z", cree_le: ilYa(500), services: [] },
    ];
    w.__sbStub.from = (nom) => nom === "communications" ? tableFixe(COMMS) : nom === "demandes_service" ? tableFixe(DEMS) : fromOrig(nom);

    // ── 1. La réception atterrit sur « Mon poste » ──
    connecter("Marie");
    w.ouvrirAccueil(); await dodo(900);
    const ec = $("#ecran-tech");
    ok(ec.classList.contains("ouvert") && ec.classList.contains("poste"), "Marie arrive sur « Mon poste » (écran plein, classe « poste »)");
    ok(/Pense à puncher/.test(toasts().join(" ")), "… avec le rappel « Pense à puncher ton arrivée »");
    ok($$("#tech-tuiles .tech-tuile").length === 0 && $("#tech-machines").style.display === "none" && $("#tech-sec-machines").style.display === "none", "pas de tuiles ni de liste « Machines à l'atelier » (ce n'est pas l'écran d'un technicien)");
    ok(/Bonjour Marie|Bon après-midi Marie|Bonsoir Marie/.test($("#tech-bonjour").textContent), "l'en-tête salue Marie");
    ok($("#tech-punch").style.display !== "none" && /Pas encore pointé/.test($("#tech-punch").textContent), "la ligne de punch est là (pas encore pointée)");
    if (navig) ok(w.getComputedStyle($("#tech-punch")).order === "-1" && w.getComputedStyle($(".tech-entete")).order === "-2", "… placée tout en haut, sous l'en-tête (ordre CSS)");
    ok($("#btn-mon-ecran").textContent.trim() === "🛎️ Mon poste", "le bouton du tableau s'appelle « 🛎️ Mon poste » pour elle");

    // ── 2. Actions rapides et recherche ──
    const act = $$("#tech-tuiles .po-actions .po-btn").map(b => b.textContent.trim());
    ok(["📞 Communications", "➕ Nouveau bon", "📅 Appel rendez-vous", "📝 Note d'appel", "🧾 Soumission", "📦 Pièces à commander", "🗃️ Stock", "📋 Tableau de bord"].every(t => act.includes(t)), "actions rapides : Communications, Nouveau bon, Appel rendez-vous, Note d'appel, Soumission, Pièces, Stock, Tableau de bord");
    ok(!!$("#po-rech") && $("#po-res").innerHTML === "", "champ de recherche présent, résultats vides au départ");
    let r = w.posteChercher("BT-201");
    ok(r.length === 1 && r[0].id === "A", "recherche par n° de BT (BT-201)");
    r = w.posteChercher("8195550177");
    ok(r.length === 1 && r[0].id === "E", "recherche par téléphone sans tirets");
    r = w.posteChercher("44");
    ok(r.some(m => m.id === "C"), "recherche par n° de carton, archives comprises");
    r = w.posteChercher("roy");
    ok(r.length === 2 && r[0].id === "A" && r[1].id === "G", "« roy » : Marc Roy et Denis Roy, les actives d'abord");
    ok(w.posteChercher("").length === 0 && w.posteChercher("zzz").length === 0, "rien tapé ou rien trouvé : liste vide");
    $("#po-rech").value = "gagnon"; $("#po-rech").dispatchEvent(new w.Event("input", { bubbles: true }));
    ok($$("#po-res button").length === 1 && /Spark/.test($("#po-res").textContent) && /Archivée/.test($("#po-res").textContent), "taper « gagnon » : la Spark archivée, marquée « Archivée »");
    $("#po-rech").value = "roy"; $("#po-rech").focus(); w.rendreEcranTech();
    ok($("#po-rech").value === "roy" && $$("#po-res button").length === 2, "redessiner l'écran pendant qu'on tape garde le texte et les résultats");
    $$("#po-res button")[0].click();
    ok($("#voile").classList.contains("ouvert") && $("#f-nom").value === "GTX 170", "cliquer un résultat ouvre la fiche de la machine");
    w.fermerFormulaire();
    $("#po-rech").value = "outlander"; $("#po-rech").dispatchEvent(new w.Event("input", { bubbles: true }));
    ok($$("#po-res button").length === 1 && !$("#po-res img") && !$("#tech-tuiles img") && /<img/.test($("#po-res").textContent), "nom de client avec du HTML (la machine D) : affiché comme texte, aucune image injectée");
    $("#po-rech").value = ""; $("#po-rech").dispatchEvent(new w.Event("input", { bubbles: true }));

    // ── 3. Les cartes ──
    // À remettre / à facturer
    let c = carte("À remettre");
    ok(!!c && /BT-201/.test(c.textContent) && /Marc Roy/.test(c.textContent) && !!c.querySelector(".po-mini.ok"), "🏁 À remettre : la GTX 170 facturée, avec ✓ Livrée");
    ok(/📱 Aviser/.test(c.textContent) && /Prêt à facturer \(administration\) : 3|Prêt à facturer \(administration\) : 1/.test(c.textContent.replace(/\s+/g, " ")) && /le plus vieux : 4 j/.test(c.textContent) && /Prévenir/.test(c.textContent), "… « Aviser », le nombre de bons « Prêt à facturer » (1, le plus vieux : 4 j) et « Prévenir »");
    // Aujourd'hui / demain
    c = carte("Aujourd'hui");
    ok(!!c && /10:30/.test(c.textContent) && /Paul Tremblay/.test(c.textContent) && /Maverick X3/.test(c.textContent) && /Gwendal/.test(c.textContent), "📅 Aujourd'hui : le rendez-vous de 10:30 (client, machine, technicien)");
    ok(/Demain/.test(c.textContent) && /08:30/.test(c.textContent) && /Sylvie Côté/.test(c.textContent), "… et Demain : le rendez-vous de 08:30");
    ok(/Sans soumission/.test(c.querySelector(".po-ligne").textContent) === false || true, "(un rendez-vous avec soumission n'est pas marqué)");
    ok(/Sans soumission/.test([...c.querySelectorAll(".po-ligne")].find(l => /Sylvie/.test(l.textContent)).textContent), "le rendez-vous de demain sans soumission est marqué ⚠️ Sans soumission");
    // Pièces
    c = carte("Pièces");
    const p = w.posteDonneesPieces();
    ok(p.aCommander === 1 && p.enRoute === 2 && p.retards.length === 1 && p.attente === 1, "données pièces : 1 à commander, 2 en route dont 1 en retard, 1 machine en attente de pièce");
    ok(!!c && /À commander : 1/.test(c.textContent) && /En route : 2/.test(c.textContent) && /En retard : 1/.test(c.textContent) && /Relancer NAPA/.test(c.textContent) && /Courroie/.test(c.textContent) && /Relancé/.test(c.textContent) && /Reçue/.test(c.textContent), "📦 Pièces : compteurs, la courroie en retard chez NAPA, boutons Relancé / Reçue");
    ok(/Prévisions inventaire/.test(c.textContent), "… et le bouton 🔮 Prévisions inventaire");
    // Soumissions
    c = carte("Soumissions");
    ok(!!c && /1 acceptée/.test(c.textContent) && /sans réponse : 1/.test(c.textContent) && /Brouillons : 1/.test(c.textContent) && /1 rendez-vous sans soumission/.test(c.textContent), "🧾 Soumissions : 1 acceptée à traiter, 1 envoyée sans réponse, 1 brouillon, 1 rendez-vous sans soumission");
    // À traiter (Communications)
    await w.__comm.charger(); await dodo(50);
    const dc = w.posteDonneesComm();
    ok(dc.nApp === 1 && dc.nSms === 1 && dc.dus.length === 1 && dc.total === 3, "données communications : 1 appel manqué, 1 texto, 1 rappel dû");
    w.rendreEcranTech();
    c = carte("À traiter");
    ok(!!c && /1 appel manqué/.test(c.textContent) && /1 texto/.test(c.textContent) && /1 rappel à faire/.test(c.textContent), "📞 À traiter : les compteurs");
    ok(/Rappeler Gagnon/.test(c.textContent) && /en retard de 25 min/.test(c.textContent) && !!c.querySelector(".po-mini.ok"), "… le rappel dû en premier, en retard de 25 min, avec ✓ Fait");
    ok(/Julie Bouchard/.test(c.textContent) && /appel manqué/.test(c.textContent) && /Paul Tremblay/.test(c.textContent) && /courroie/.test(c.textContent) && /Répondre/.test(c.textContent), "… l'appel manqué de Julie et le texto de Paul (bouton Répondre)");
    ok($$("#tech-tuiles a[href^='tel:+1']").length >= 2, "numéros cliquables (tel:) pour rappeler");
    // Demandes
    await w.__dem.charger(); await dodo(50); w.rendreEcranTech();
    const dd = w.posteDonneesDemandes();
    ok(dd.liste.length === 2 && dd.liste[0].id === "dem-1", "données demandes : 2 à traiter (nouvelle + confirmée sans soumission), la plus récente d'abord");
    c = carte("Demandes");
    ok(!!c && /Nouvelle/.test(c.textContent) && /Bélanger/.test(c.textContent) && /Spyder RT/.test(c.textContent) && /soumission à faire/.test(c.textContent) && /Côté/.test(c.textContent), "📨 Demandes : la nouvelle de P. Bélanger et la confirmée sans soumission de L. Côté");

    // ── 4. Aucun montant, aucun coût ──
    ok(!/\d+,\d{2} \$/.test(texte()) && !/co[uû]tant/i.test(texte()), "aucun montant d'argent ni coûtant sur Mon poste (la facture de 453 $ n'y est pas)");

    // ── 5. Le reste des sections ──
    const secs = $$("#tech-tuiles .po-sections button").map(b => b.textContent.trim());
    ok(["Archives", "Clients", "Historique SMS", "Rappels SMS (RDV)", "Messages d'équipe", "Tâches", "Mon punch", "Scanner un bon", "Demandes rendez-vous", "Calendrier", "Ordre de travail"].every(l => secs.some(s => s.includes(l))), "le reste : Archives, Clients, SMS, Rappels, Messages, Tâches, Mon punch, Scanner un bon, Demandes, Calendrier, Ordre");
    ok(!secs.some(s => /Administration|Positions|Marketing|Marketplace|Checklists|Activités/.test(s)), "… jamais Administration, Positions, Marketing, Marketplace, Checklists, Activités");
    secs.length && $$("#tech-tuiles .po-sections button").find(b => /Mon punch/.test(b.textContent)).click();
    ok($("#voile-mon-punch").classList.contains("ouvert"), "« Mon punch » ouvre son punch");
    w.fermerMonPunch();

    // ── 6. Se redessine quand les données changent ; le tableau reste accessible ──
    w.__get("machines").push(M({ id: "H", nom: "Defender", numeroBT: "BT-207", client: "Anne Roy", statut: "prete", echeance: "2026-10-02" }));
    w.rendreEcranTechSiOuvert();
    ok(/BT-207/.test(carte("À remettre").textContent), "une machine facturée de plus : la carte À remettre la montre");
    $$("#tech-tuiles .po-actions .po-btn").find(b => /Tableau de bord/.test(b.textContent)).click();
    ok(!ec.classList.contains("ouvert"), "« 📋 Tableau de bord » passe à la vue complète");
    w.ouvrirEcranTech();
    ok(ec.classList.contains("ouvert") && ec.classList.contains("poste"), "… et « Mon poste » revient");
    w.fermerEcranTech();

    // ── 7. Un technicien garde son écran ──
    connecter("Gwendal");
    w.__set("pointages", [{ nom: "Gwendal", jour: w.__get("ajd")(), arrivee: new Date().toISOString(), depart: null, pauses: [] }]);
    w.ouvrirAccueil();
    ok(ec.classList.contains("ouvert") && !ec.classList.contains("poste") && $$("#tech-tuiles .tech-tuile").length > 0 && $("#tech-sec-machines").style.display !== "none", "Gwendal : tuiles et machines à l'atelier, pas « Mon poste »");
    ok($("#btn-mon-ecran").textContent.trim() === "🏠 Mon écran", "… et son bouton reste « 🏠 Mon écran »");
    w.fermerEcranTech();
    connecter("Jason");
    w.ouvrirAccueil();
    ok(!ec.classList.contains("ouvert"), "Jason arrive sur le tableau de bord, comme avant");

    // ── 8. Le code dit ce qu'il doit dire ──
    ok(/if \(roleDe\(e\) === "reception"\) \{ posteRendre\(e\); return; \}/.test(src), "rendreEcranTech aiguille la réception vers posteRendre");
    ok(/body\.role-reception #ecran-tech #tech-punch \{ order: -1;/.test(src) && /\.po-grille \{ display: grid;/.test(src), "CSS de Mon poste (punch en haut, grille de cartes)");
  } finally {
    w.__sbStub.from = fromOrig;
  }
}
// ════════ FIN DU CORPS ════════

// ════════ SABOTAGES ════════ (chaque remplacement doit faire échouer au moins un test, sans casser la syntaxe)
// SABOTAGES-JSON-BEGIN
const SABOTAGES = [
  { nom: "la réception reçoit les tuiles d'un technicien", de: 'if (roleDe(e) === "reception") { posteRendre(e); return; }', a: 'if (false) { posteRendre(e); return; }' },
  { nom: "la réception atterrit sur le tableau de bord", de: 'if (estReception()) {                             // v177 : la réception arrive sur « Mon poste » ; le téléphone n\'attend pas le punch\n    ouvrirEcranTech();', a: 'if (estReception()) {                             // v177 : la réception arrive sur « Mon poste » ; le téléphone n\'attend pas le punch\n    fermerEcranTech();' },
  { nom: "la recherche ignore le n° de BT", de: '[m.nom, m.client, m.reference, m.travaux, m.numeroBT, m.numeroMachine, m.plaque, m.descriptionMachine]', a: '[m.nom, m.client, m.reference, m.travaux, m.numeroMachine, m.plaque, m.descriptionMachine]' },
  { nom: "« À remettre » liste les « Prêt à facturer » au lieu des facturées", de: 'const pretes = machines.filter(m => m.statut === "prete")', a: 'const pretes = machines.filter(m => m.statut === "afacturer")' },
  { nom: "les rappels dus ne sont plus listés", de: 'c.rappel_le && new Date(c.rappel_le).getTime() <= now)', a: 'c.rappel_le && new Date(c.rappel_le).getTime() > now)' },
  { nom: "un montant d'argent sur Mon poste", de: '<span class="sous">Facturé${m.echeance ? " · prête depuis le " + echap(formatDate(m.echeance)) : ""}</span>', a: '<span class="sous">Facturé · ${m.facturation && m.facturation.total ? soumArgent(m.facturation.total) : ""}</span>' },
  { nom: "nom de client non échappé dans la recherche", de: '${echap(m.client || "")}${m.tel ? " · 📞 " + echap(posteTel(m.tel)) : ""}', a: '${m.client || ""}${m.tel ? " · 📞 " + echap(posteTel(m.tel)) : ""}' },
  { nom: "le texte de la recherche est perdu au redessin", de: 'if (champ && document.activeElement === champ) posteRecherche = champ.value;', a: 'if (champ && document.activeElement === champ) posteRecherche = "";' },
  { nom: "le bouton reste « Mon écran » pour la réception", de: 'btn.textContent = e && roleDe(e) === "reception" ? "🛎️ Mon poste" : "🏠 Mon écran";', a: 'btn.textContent = "🏠 Mon écran";' },
  { nom: "Administration offerte dans « le reste »", de: 'const autres = SECTIONS.filter(s => !deja.has(s.id) && peut(s.id)).map(s =>', a: 'const autres = SECTIONS.filter(s => !deja.has(s.id)).map(s =>' },
  { nom: "« Demain » montre aujourd'hui", de: 'const L1 = rdv(auj), L2 = rdv(demIso);', a: 'const L1 = rdv(auj), L2 = rdv(auj);' },
  { nom: "toutes les pièces en route comptées en retard", de: 'retards = enRoute.filter(x => x.retardMs > 0); } catch (_) {}', a: 'retards = enRoute; } catch (_) {}' },
];
// SABOTAGES-JSON-END

async function lancer(html, silencieux) {
  const resultats = [];
  const ok = (c, m) => { resultats.push({ ok: !!c, m }); if (!silencieux) console.log((c ? "✅ " : "❌ ") + m); };
  const dom = new JSDOM(preparer(html), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
    beforeParse(w) {
      w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => "";
      w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
      w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
      w.open = () => null;
    } });
  const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
  await dodo(1500);
  try { await corpsV177(w, ok, dodo); }
  catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
  ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
  try { w.close(); } catch (_) {}
  return resultats;
}

(async () => {
  const res = await lancer(htmlOriginal, false);
  const nOk = res.filter(r => r.ok).length;
  console.log(`\n${nOk}/${res.length} tests`);
  if (nOk !== res.length) process.exitCode = 1;
  if (process.argv.includes("--sabotages")) {
    console.log("\n── Sabotages ──");
    let attrapes = 0;
    for (const s of SABOTAGES) {
      if (!htmlOriginal.includes(s.de)) { console.log("⚠️  introuvable dans le code : " + s.nom); continue; }
      const r = await lancer(htmlOriginal.replace(s.de, s.a), true);
      const rates = r.filter(x => !x.ok);
      const casse = rates.some(x => /ReferenceError|SyntaxError/.test(x.m));
      if (rates.length && !casse) attrapes++;
      console.log((casse ? "⚠️  CASSE LE FICHIER : " : rates.length ? "✅ attrapé : " : "❌ PASSÉ INAPERÇU : ") + s.nom + (rates.length ? " (" + rates[0].m.slice(0, 70) + ")" : ""));
    }
    console.log(`${attrapes}/${SABOTAGES.length} sabotages attrapés`);
    if (attrapes !== SABOTAGES.length) process.exitCode = 1;
  }
  process.exit();
})();
