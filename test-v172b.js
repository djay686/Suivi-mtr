// v172 — Les travaux de la prise de rendez-vous suivent jusqu'au bon de travail (plus rien d'écrasé ni de perdu) :
//   type + précisions + détails, soumission rattachée (on AJOUTE sa main-d'œuvre et ses notes), soumission modifiée
//   ensuite, bons déjà vides (BT-125, demandes web : services cochés), note d'appel → rendez-vous, « Joindre ».
// NODE_PATH=… node test-v172b.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

const cp = (x) => JSON.parse(JSON.stringify(x));
const ecrits = [];
const table = (nom) => { const ch = new Proxy({}, { get(t, k) {
  if (k === "then") return (ok) => ok({ data: [], error: null });
  if (k === "maybeSingle" || k === "single") return () => Promise.resolve({ data: null, error: null });
  return (...a) => { if (k === "upsert" && nom === "tableau") ecrits.push(cp(a[0])); return ch; };
} }); return ch; };
const sbStub = { from: table, channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; }, removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: { access_token: "ok" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }) },
  functions: { invoke: async () => ({ data: null, error: null }) } };
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const alertes = [], confirmations = [];
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) { w.__sbStub = sbStub; w.alert = (m) => alertes.push(String(m)); w.confirm = (m) => { confirmations.push(String(m)); return true; }; w.prompt = () => ""; w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" }); } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const jourIso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
const bt = (id) => w.__get("machines").find(m => m.id === id);
const SO = (id, numero, mo, notes, o) => Object.assign({ id, numero, statut: "brouillon", clientNom: "Client " + numero, tel: "8195550000", type: "motomarine", marque: "BRP",
  lignes: [{ type: "mo", desc: mo, qte: 1.5, prix: 95 }, { type: "art", num: "X9", desc: "Bougie", qte: 3, prix: 12 }], notes: notes || "" }, o || {});

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true }, { nom: "Gwendal", role: "technicien", actif: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.__set("clients", []);
  w.__set("machines", []);
  w.__set("soumissions", [SO("so-100", "SO-0100", "Hivernisation / remisage", "Client fournit l'huile")]);

  // ══════ 1. Prise de rendez-vous : type + précisions + détails → travaux du bon ══════
  const remplir = (opts) => {
    w.ouvrirAppelRdv();
    $("#rdv-client-nom").value = opts.nom; $("#rdv-tel").value = "819-555-1111";
    w.genererGrilleMachineRdv({ type: "Motomarine", marque: "BRP", modele: "Spark", annee: "2020", serie: "" });
    $("#rdv-travaux-type").value = opts.type; w.rdvMajDuree();
    if (opts.autre != null) $("#rdv-travaux-autre").value = opts.autre;
    $("#rdv-travaux-details").value = opts.details || "";
    w.rdvRemplirSoumissions();
    if (opts.soum) { const sel = $("#rdv-soumission"); sel.innerHTML += `<option value="${opts.soum}">x</option>`; sel.value = opts.soum; }
  };
  ok($("#rdv-travaux-details") !== null, "prise de rendez-vous : nouveau champ « Détails des travaux »");
  remplir({ nom: "Alice Tremblay", type: "autre", autre: "Vérifier bruit moteur", details: "A coulé cet été\nBougies dans le coffre à gants" });
  w.confirmerRdv(jourIso(3), 9);
  const m1 = w.__get("machines").find(m => m.client === "Alice Tremblay");
  ok(m1 && m1.travaux === "Vérifier bruit moteur\nA coulé cet été\nBougies dans le coffre à gants", "bon créé : « Préciser les travaux » + les détails, tels quels");
  ok(alertes.some(a => /Vérifier bruit moteur/.test(a)), "(confirmation affichée)");

  // Avec un type du menu et une soumission choisie : on AJOUTE la soumission, on n'écrase plus
  const typeHiv = w.__get("TRAVAUX_TYPES").find(t => t.id !== "autre");
  remplir({ nom: "Bob Gagnon", type: typeHiv.id, details: "Machine a coulé cet été", soum: "so-100" });
  w.confirmerRdv(jourIso(4), 10);
  const m2 = w.__get("machines").find(m => m.client === "Bob Gagnon");
  ok(m2 && m2.travaux.startsWith(typeHiv.label + "\nMachine a coulé cet été\n"), "soumission choisie : le type et les détails restent (avant : remplacés par « … — soumission SO-0100 »)");
  ok(/🧾 SO-0100 : Hivernisation \/ remisage/.test(m2.travaux) && /📝 Client fournit l'huile/.test(m2.travaux), "… et la soumission s'ajoute : « 🧾 SO-0100 : Hivernisation / remisage » + « 📝 Client fournit l'huile »");
  const s100 = w.__get("soumissions").find(s => s.id === "so-100");
  ok(m2.soumissionId === "so-100" && s100.machineId === m2.id && m2.pieces.length === 1, "la soumission est rattachée (pièces copiées comme avant)");

  // ══════ 2. La soumission change ensuite : le bon suit (bloc remplacé, jamais doublé) ══════
  w.__set("soumCourante", s100);
  s100.lignes[0].desc = "Hivernisation complète"; s100.notes = "Client fournit l'huile\nLaver la machine";
  await w.soumSauver();
  const t2 = bt(m2.id).travaux;
  ok(/🧾 SO-0100 : Hivernisation complète/.test(t2) && /📝 Laver la machine/.test(t2) && !/remisage/.test(t2) && (t2.match(/🧾 SO-0100/g) || []).length === 1, "soumission modifiée : le bloc du bon est remplacé (Hivernisation complète, Laver la machine), pas doublé");
  ok(t2.startsWith(typeHiv.label + "\nMachine a coulé cet été"), "ce qu'on avait écrit au rendez-vous reste en tête");
  bt(m2.id).statut = "reparation";
  s100.notes = "Autre chose";
  await w.soumSauver();
  ok(!/Autre chose/.test(bt(m2.id).travaux), "machine en réparation : on ne touche plus au texte du technicien");
  w.__set("soumCourante", null);

  // ══════ 3. Bons déjà vides (avant la v172) : remplis d'après la soumission et la demande web ══════
  const S90 = SO("so-90", "SO-0090", "Hivernisation / remisage", "A déja les Bougie fourni par NC vla 2 ans\nSupposé etre dans le coffre a gant");
  const S65 = SO("so-65", "SO-0065", "Hivernisation / remisage", "Services demandés : Entretien fin de saison, Changement d'huile");
  w.__get("soumissions").push(S90, S65);
  w.__get("machines").push(
    { id: "b125", numeroBT: "BT-125", nom: "Sea-Doo", client: "C", statut: "avenir", echeance: jourIso(2), travaux: "", soumissionId: "so-90", pieces: [] },
    { id: "b120", numeroBT: "BT-120", nom: "Sea-Doo", client: "D", statut: "avenir", echeance: jourIso(2), travaux: "", origine: "demande-web", demandeId: "dem-120", pieces: [] },
    { id: "b117", numeroBT: "BT-117", nom: "Sea-Doo", client: "E", statut: "avenir", echeance: jourIso(2), travaux: "", origine: "demande-web", demandeId: "dem-117", soumissionId: "so-65", pieces: [] },
    { id: "b110", numeroBT: "BT-110", nom: "Sea-Doo", client: "F", statut: "avenir", echeance: jourIso(2), travaux: "Petite réparation : plastique arrière", demandeId: "dem-110", pieces: [] },
    { id: "bArc", numeroBT: "BT-050", nom: "Vieux", client: "G", statut: "archive", travaux: "", soumissionId: "so-90", pieces: [] });
  const DEM = [
    { id: "dem-120", services: ["Entretien fin de saison", "Changement d'huile"], description: "" },
    { id: "dem-117", services: "[\"Entretien fin de saison\", \"Changement d'huile\"]", description: "" },
    { id: "dem-110", services: ["Petite réparation"], description: "Changer le plastique" } ];
  const nEcrits = ecrits.filter(e => e.id === 1).length;
  const n = w.btRemplirTravauxVides(DEM);
  await dodo(200);   // (l'enregistrement relit le serveur avant d'écrire : un instant)
  ok(bt("b125").travaux === "🧾 SO-0090 : Hivernisation / remisage\n📝 A déja les Bougie fourni par NC vla 2 ans\n📝 Supposé etre dans le coffre a gant", "BT-125 (vide, tout était dans SO-0090) : main-d'œuvre et notes de la soumission");
  ok(bt("b120").travaux === "Entretien fin de saison · Changement d'huile", "BT-120 (demande web sans description) : les services cochés par le client");
  ok(bt("b117").travaux === "Entretien fin de saison · Changement d'huile\n🧾 SO-0065 : Hivernisation / remisage", "BT-117 : services (liste en texte aussi) + soumission, sans répéter « Services demandés »");
  ok(bt("b110").travaux === "Petite réparation : plastique arrière" && bt("bArc").travaux === "", "bon qui a déjà des travaux, bon archivé : pas touchés");
  ok(n === 3 && ecrits.filter(e => e.id === 1).length === nEcrits + 1, "3 bons remplis, une seule écriture au serveur");
  ok(w.btRemplirTravauxVides(DEM) === 0, "repassé : rien de plus (ne se répète pas)");
  ok(w.demTravauxTexte({ services: ["Petite réparation"], description: "Changer le plastique" }) === "Petite réparation\nChanger le plastique", "demande web : services puis description");

  // ══════ 4. Note d'appel → « 📅 Prendre un rendez-vous » : ce que le client a dit suit ══════
  w.commPrendreRdv("8195552222", null, "Jean Côté", "2021 Spark — bruit au démarrage, vibration");
  await dodo(120);
  ok($("#voile-rdv").classList.contains("ouvert") && $("#rdv-travaux-details").value === "2021 Spark — bruit au démarrage, vibration" && $("#rdv-client-nom").value === "Jean Côté",
     "note d'appel → prise de rendez-vous : « Détails des travaux » déjà remplis avec la note");
  w.fermerAppelRdv();
  w.ouvrirAppelRdv();
  ok($("#rdv-travaux-details").value === "", "nouvelle prise de rendez-vous : le champ repart vide");
  // « Faire une soumission » depuis la prise de rendez-vous : les travaux y vont aussi
  $("#rdv-client-nom").value = "Luc"; $("#rdv-travaux-type").value = "autre"; w.rdvMajDuree(); $("#rdv-travaux-autre").value = "Diagnostic électrique"; $("#rdv-travaux-details").value = "Batterie neuve";
  w.rdvVersSoumission();
  ok(w.__get("soumCourante") && w.__get("soumCourante").notes === "Travaux demandés : Diagnostic électrique\nBatterie neuve", "« 🧾 Faire une soumission » : la soumission reçoit les travaux demandés");
  if (w.soumFermer) try { w.soumFermer(); } catch (_) {}
  w.fermerAppelRdv();

  // ══════ 5. Formulaire du bon : « 🔗 Joindre une soumission » ajoute au lieu de remplacer ══════
  const S77 = SO("so-77", "SO-0077", "Freins avant", "Plaquettes fournies par le client");
  w.__get("soumissions").push(S77);
  w.__get("machines").push({ id: "b200", numeroBT: "BT-200", nom: "Outlander", client: "H", statut: "avenir", echeance: jourIso(5), heure: "09:00", travaux: "", pieces: [] });
  w.ouvrirEdition("b200"); await dodo(20);
  $("#f-travaux").value = "Vérifier le bruit à l'avant";   // tapé, pas encore enregistré
  const nConf = confirmations.length;
  w.rdvJoindreOuvrir(); await dodo(10);
  const js = $("#joindre-select"); if (![...js.options].some(o => o.value === "so-77")) js.innerHTML += '<option value="so-77">SO-0077</option>';
  js.value = "so-77"; $("#joindre-copier").checked = true;
  w.rdvJoindreValider(); await dodo(20);
  ok(confirmations.length === nConf, "« Joindre » : plus de question « les travaux seront remplacés »");
  ok(bt("b200").travaux === "Vérifier le bruit à l'avant\n🧾 SO-0077 : Freins avant\n📝 Plaquettes fournies par le client" && $("#f-travaux").value === bt("b200").travaux, "ce qui était tapé reste, la soumission s'ajoute (et le formulaire le montre)");
  if (w.fermerFormulaire) w.fermerFormulaire();

  // ══════ 6. Fonctions de fusion ══════
  const S = SO("so-x", "SO-0001", "Main-d'œuvre", "Travaux prévus : Hivernisation seulement\nVérifier bougie");
  ok(w.travauxAvecSoumission("Hivernisation seulement\nVérifier bougie", S) === "Hivernisation seulement\nVérifier bougie", "rien de neuf dans la soumission (« Main-d'œuvre » générique, note copiée du bon) : rien d'ajouté");
  ok(w.travauxAvecSoumission("", SO("so-y", "SO-0002", "", "")) === "", "soumission vide : rien");
 } catch (err) { ok(false, "exception : " + (err && err.stack || err)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
