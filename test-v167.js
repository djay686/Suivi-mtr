// v167 — 📋 Procédure de travail créée par Claude, dans le bon de travail live, + visionneuse procedure.html.
//   App : fenêtre, contexte envoyé, plan puis détails par groupes en parallèle, assemblage, coût, erreurs, « Compléter »,
//         bibliothèque de manuels (PDF lu page par page, stockage), notes du BT.
//   Visionneuse : étapes, coches partagées (une ligne par case), côtés, mesures avec limites, temps réel, hors ligne, résumé.
// NODE_PATH=… node test-v167.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");
let htmlProc = fs.readFileSync(FICHIER.replace(/index\.html$/, "procedure.html"), "utf8");

// ── Supabase en mémoire (select / insert / update / upsert / delete ; eq / neq / in) ──
const donnees = { procedures: [], manuels: [], manuel_pages: [], procedure_etat: [], tableau: [] };
const appels = [], invocations = [], televersements = [];
let prochainId = 1, pannes = {};
const cleLigne = (nom, r) => nom === "procedure_etat" ? r.procedure_id + "|" + r.cle : null;
const table = (nom) => {
  const q = { op: "select", vals: null, filtres: [], un: false };
  const exec = () => {
    if (pannes[nom + ":" + q.op]) return { data: null, error: { message: pannes[nom + ":" + q.op] } };
    const rows = (donnees[nom] = donnees[nom] || []);
    const garde = r => q.filtres.every(f => f(r));
    let data = null;
    if (q.op === "select") data = JSON.parse(JSON.stringify(rows.filter(garde)));
    else if (q.op === "update") { data = rows.filter(garde); data.forEach(r => Object.assign(r, JSON.parse(JSON.stringify(q.vals)))); }
    else if (q.op === "insert" || q.op === "upsert") {
      data = [].concat(q.vals).map(v => Object.assign({ id: nom === "procedures" ? "P" + prochainId++ : nom === "manuels" ? "M" + prochainId++ : prochainId++, cree_le: new Date().toISOString() }, JSON.parse(JSON.stringify(v))));
      if (nom !== "tableau") data.forEach(d => {
        const k = cleLigne(nom, d), i = k ? rows.findIndex(r => cleLigne(nom, r) === k) : -1;
        if (q.op === "upsert" && i >= 0) rows[i] = d; else rows.push(d);
      });
    }
    else if (q.op === "delete") { data = rows.filter(garde); donnees[nom] = rows.filter(r => !garde(r)); }
    appels.push({ table: nom, op: q.op, vals: q.vals ? JSON.parse(JSON.stringify(q.vals)) : null });
    if (q.un) data = Array.isArray(data) ? (data[0] || null) : data;
    return { data, error: null };
  };
  const ch = new Proxy({}, { get(t, k) {
    if (k === "then") return (ok, ko) => Promise.resolve(exec()).then(ok, ko);
    if (["update", "insert", "upsert", "delete"].includes(k)) return (v) => { q.op = k; q.vals = v; return ch; };
    if (k === "eq") return (c, v) => { q.filtres.push(r => r[c] === v); return ch; };
    if (k === "neq") return (c, v) => { q.filtres.push(r => r[c] !== v); return ch; };
    if (k === "in") return (c, l) => { q.filtres.push(r => (l || []).includes(r[c])); return ch; };
    if (k === "single" || k === "maybeSingle") return () => { q.un = true; return ch; };
    return () => ch;
  } });
  return ch;
};
let repondre = null, enCours = 0, maxEnCours = 0;
const canaux = [];
const faireStub = (liste = canaux) => ({
  from: table,
  channel: () => { const o = { h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe() { return o; } }; liste.push(o); return o; },
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: { access_token: "ok" } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }),
  },
  functions: { invoke: async (nom, o) => {
    const corps = JSON.parse(JSON.stringify((o && o.body) || {}));
    invocations.push({ nom, corps });
    enCours++; maxEnCours = Math.max(maxEnCours, enCours);
    await new Promise(r => setTimeout(r, 15 + Math.random() * 20));
    enCours--;
    return repondre(corps);
  } },
  storage: { from: (b) => ({
    upload: async (chemin, f, opts) => { televersements.push({ b, chemin, taille: f && f.size, opts }); return pannes.upload ? { data: null, error: { message: pannes.upload } } : { data: { path: chemin }, error: null }; },
    createSignedUrl: async (c) => ({ data: { signedUrl: "https://x/" + c }, error: null }),
  }) },
});
const sbStub = faireStub();
const alertes = [];
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) {
    w.__sbStub = sbStub; w.alert = (m) => { alertes.push(String(m)); }; w.confirm = () => true; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const attendre = async (f, ms = 4000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await dodo(20); return f(); };

// ── Ce que « Claude » répond (fonction serveur simulée) ──
const PLAN = {
  titre: "Entretien 50 h et freins", resume: "Bougies moteur froid, CVT, essai, huile chaude, freins, essai final.",
  alertes: [{ niveau: "danger", texte: "Jamais de clé à chocs sur le couvercle CVT." }],
  decisions: [{ id: "purge frein!", label: "Purge du liquide de frein", options: ["Approuvée", "Refusée", "En attente"] }],
  materiel: ["AMSOIL 5W-40 : **3,5 L**", "Filtre à huile + joint torique"], outils: ["Clé dynamométrique", "BUDS2"],
  etapes: [1, 2, 3, 4, 5, 6, 7].map(i => ({ court: "É" + i, titre: "Étape numéro " + i, pourquoi: "Parce que " + i, contenu: ["Faire la chose " + i, "Vérifier " + i], pages: i === 2 ? [171, 172] : [] })),
  specs: [{ groupe: "Moteur", lignes: [{ element: "Huile", valeur: "3,5 L", detail: "avec filtre" }] }],
  faits: [{ sujet: "Couple bougie", valeur: "11 N·m", source: "manuel p. 346" }],
  sources: [{ titre: "AMSOIL", url: "https://www.amsoil.ca" }], references: [{ page: 171, sujet: "CVT" }],
};
const detailPour = (i) => ({ index: i, specs: [{ nom: "Vis", valeur: "6 N·m", detail: "± 0,7" }], alertes: [], titre_liste: "À faire",
  items: [{ t: "Action A de l'étape " + i + " à **6 N·m**", cotes: [], pages: i === 2 ? [171] : [] }, { t: "Action B " + i, cotes: i === 2 ? ["G", "D"] : [], pages: [] }],
  champs: i === 2 ? [{ id: "belt", type: "nombre", label: "Largeur de courroie", unite: "mm", exemple: "", options: [], min: 34.7, max: null, hors_niveau: "bad", hors_message: "Sous la limite de 34,7 mm", ok_message: "Dans la limite" }] : [],
  figures: i === 2 ? [{ page: 171, legende: "Couvercle CVT" }] : [] });
let echecsVoulus = {};
const repondreNormal = (c) => {
  if (c.etape === "plan") return { data: { plan: PLAN, pages: c.manuelId ? [171, 172, 346] : [], usage: { entree: 60000, sortie: 5000, cache: 0, recherches: 4 } }, error: null };
  if (c.etape === "details") {
    const k = c.indices.join(",");
    if (echecsVoulus[k]) { echecsVoulus[k]--; return { data: { erreur: "Claude a pris trop de temps ou n'a pas répondu : réessaie" }, error: null }; }
    return { data: { etapes: c.indices.map(detailPour), usage: { entree: 20000, sortie: 3000, cache: 0, recherches: 0 } }, error: null };
  }
  return { data: { erreur: "etape inconnue" }, error: null };
};

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true, compteAuth: true }, { nom: "Gwendal", role: "technicien", actif: true, compteAuth: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  $("#ecran-connexion") && $("#ecran-connexion").classList.remove("ouvert");
  const m = { id: "bt-1", numeroBT: "BT-089", nom: "2021 Can-Am Maverick X3 Turbo", marque: "BRP", modele: "Maverick X3", annee: "2021", type: "Côte à côte",
    client: "Alexandre Alarie", travaux: "Entretien 50 h, bougies, CVT, freins 4 roues", kilometrage: "3200", heuresMachine: "212", reference: "3JBVGAX27MK000123",
    pieces: [{ qte: 1, nom: "Filtre à huile", num: "420956744" }], soumissionId: "so-1", statut: "reparation", machineArrivee: true,
    notesLive: [{ texte: "Volant croche vers la gauche", tech: "Gwendal", quand: new Date().toISOString() }] };
  w.__set("machines", [m]);
  w.__set("soumissions", [{ id: "so-1", machineId: "bt-1", statut: "envoyee", lignes: [{ type: "mo", desc: "Main-d'œuvre freins", qte: 2 }, { type: "art", desc: "Plaquettes", num: "715900438", qte: 4 }] }]);
  donnees.manuels.push({ id: "M-x3", titre: "Manuel de service Maverick X3 2018", type: "Côte à côte", marque: "BRP", modele: "Maverick X3", annee_de: 2017, annee_a: 2022, nb_pages: 600, chemin: "M-x3.pdf" },
                       { id: "M-ski", titre: "Manuel Ski-Doo REV Gen4", type: "Motoneige", marque: "BRP", modele: "Summit", annee_de: 2017, annee_a: 2021, nb_pages: 500, chemin: null });
  repondre = repondreNormal;
  w.__set("liveId", "bt-1");

  // ── 1. Bouton et fenêtre ──
  ok(!!$("#live-btn-proc") && /Procédure/.test($("#live-btn-proc").textContent), "bon de travail live : bouton « 📋 Procédure »");
  await w.procedureDialogue(); await dodo(30);
  ok($("#voile-proc").classList.contains("ouvert") && /BT-089/.test($(".proc-tete").textContent) && /Alexandre Alarie/.test($(".proc-tete").textContent), "fenêtre « 📋 Procédure de travail » : bon, machine, client");
  const opts = [...$("#proc-manuel").options];
  ok(opts[1].value === "M-x3" && /^★ Manuel de service Maverick X3 2018/.test(opts[1].textContent) && $("#proc-manuel").value === "M-x3", "manuel du bon modèle proposé en premier (★) et choisi d'office");
  ok(!/★/.test(opts[2].textContent) && /texte seulement/.test(opts[2].textContent), "un manuel d'un autre modèle : sans ★ ; « texte seulement » quand le PDF n'est pas gardé");
  ok($("#proc-web").checked && !$("#proc-web").disabled, "avec manuel : recherche internet cochée, mais on peut la décocher");
  $("#proc-manuel").value = ""; $("#proc-manuel").dispatchEvent(new w.Event("change")); await dodo(10);
  ok($("#proc-web").checked && $("#proc-web").disabled && /obligatoire sans manuel/.test($("#proc-boite").textContent), "sans manuel : recherche internet obligatoire");
  $("#proc-manuel").value = "M-x3"; $("#proc-manuel").dispatchEvent(new w.Event("change")); await dodo(10);
  ok(/Travaux : Entretien 50 h/.test($(".proc-ctx").textContent) && /Pièces au bon : 1/.test($(".proc-ctx").textContent) && /Lignes de soumission : 2/.test($(".proc-ctx").textContent), "on voit ce que Claude va recevoir (travaux, pièces, soumission, notes)");

  // ── 2. Création : plan, puis détails en parallèle ──
  $("#proc-consignes").value = "Machine reprogrammée"; $("#proc-consignes").dispatchEvent(new w.Event("input"));
  $("#proc-creer").click();
  await attendre(() => donnees.procedures.length && donnees.procedures[0].statut === "prete");
  const p = donnees.procedures[0];
  const plan = invocations.find(i => i.corps.etape === "plan");
  ok(plan && plan.nom === "procedure-claude" && plan.corps.manuelId === "M-x3" && plan.corps.recherche === true && plan.corps.consignes === "Machine reprogrammée", "1er appel « plan » : manuel choisi, recherche internet, précisions");
  const b = plan.corps.bt;
  ok(b.numero === "BT-089" && b.client === "Alexandre Alarie" && /Maverick X3 Turbo/.test(b.machine) && b.serie === "3JBVGAX27MK000123" && b.kilometrage === "3200" && b.heures === "212"
     && b.pieces[0].num === "420956744" && b.soumission.length === 2 && b.soumission[1].num === "715900438" && b.notes[0] === "Volant croche vers la gauche", "contexte envoyé : bon, client, machine, série, compteur, pièces, soumission, notes du technicien");
  const det = invocations.filter(i => i.corps.etape === "details");
  ok(det.map(d => d.corps.indices.join(",")).sort().join(" | ") === "1,2,3 | 4,5,6 | 7", "détail des 7 étapes par groupes de 3 : (1,2,3) (4,5,6) (7)");
  ok(maxEnCours >= 2 && maxEnCours <= 4, "les groupes partent en parallèle (au plus 4 à la fois : " + maxEnCours + ")");
  ok(det.every(d => d.corps.plan && d.corps.plan.titre === "Entretien 50 h et freins" && d.corps.manuelId === "M-x3"), "chaque groupe reçoit le plan et le manuel");
  const c = p.contenu;
  ok(p.statut === "prete" && p.titre === "Entretien 50 h et freins" && p.bt_id === "bt-1" && p.numero_bt === "BT-089" && p.cree_par === "Jason" && p.manuel_id === "M-x3", "procédure enregistrée : prête, titre, bon, créée par Jason, manuel");
  ok(c.etapes.length === 8 && c.etapes[0].titre === "Avant de commencer" && c.etapes[0].items.map(x => x.t).join(" | ") === "AMSOIL 5W-40 : **3,5 L** | Filtre à huile + joint torique | Outils : Clé dynamométrique, BUDS2",
     "étape Préparation : pièces, produits et outils");
  ok(c.etapes[0].champs[0].id === "s0_purgefrein" && c.etapes[0].champs[0].type === "choix" && c.etapes[0].champs[0].options.map(o => o.valeur).join() === "Approuvée,Refusée,En attente" && c.etapes[0].alertes[0].niveau === "danger",
     "décisions du client en boutons de choix (identifiant nettoyé), alertes générales");
  const e2 = c.etapes[2];
  ok(e2.detaille && e2.items[1].cotes.join() === "G,D" && e2.items[0].pages.join() === "171" && e2.champs[0].id === "s2_belt" && e2.champs[0].min === 34.7 && e2.figures[0].page === 171 && e2.specs[0].valeur === "6 N·m",
     "étape détaillée : cases G/D, pages du manuel, mesure avec limite (id préfixé par l'étape), specs");
  ok(c.manuel.id === "M-x3" && c.manuel.chemin === "M-x3.pdf" && c.sources[0].url === "https://www.amsoil.ca" && c.specs[0].groupe === "Moteur" && c.plan && c.plan.titre, "manuel, sources web, specs, plan gardé (pour compléter plus tard)");
  ok(p.cout && p.cout.entree === 120000 && p.cout.sortie === 14000 && p.cout.recherches === 4, "coût noté : jetons et recherches web de tous les appels");
  ok($("#proc-voile").classList.contains("ouvert") && /procedure\.html\?id=P1$/.test($("#proc-cadre").getAttribute("src")) && !$("#voile-proc").classList.contains("ouvert"), "prête : la visionneuse s'ouvre sur la procédure (la fenêtre se ferme)");
  ok(toasts().some(t => /Procédure prête \(≈ 0,80 \$\)/.test(t)), "toast « 📋 Procédure prête (≈ 0,80 $) » (120 000 jetons lus, 14 000 écrits, 4 recherches)");
  w.procedureFermer();
  ok(!$("#proc-voile").classList.contains("ouvert") && $("#proc-cadre").getAttribute("src") === "about:blank", "« Fermer » de la visionneuse : retour au bon de travail");
  ok(w.procedureClient() === sbStub, "la visionneuse passe par la connexion de l'app");

  // ── 3. Liste ; un groupe qui échoue deux fois ; « Compléter » ──
  await w.procedureDialogue(); await dodo(30);
  ok($$(".proc-ligne").length === 1 && /Entretien 50 h et freins/.test($(".proc-ligne").textContent) && /prête/.test($(".proc-ligne").textContent) && /≈ 0,80 \$/.test($(".proc-ligne").textContent), "liste des procédures du bon : titre, prête, coût");
  ok(/Refaire la procédure/.test($("#proc-creer").textContent), "bouton « ✨ Refaire la procédure »");
  echecsVoulus = { "4,5,6": 2 };
  invocations.length = 0;
  $("#proc-web").checked = false; $("#proc-web").dispatchEvent(new w.Event("change"));
  $("#proc-creer").click();
  await attendre(() => donnees.procedures.length === 2 && donnees.procedures[1].statut !== "en_cours");
  const p2 = donnees.procedures[1];
  ok(invocations.find(i => i.corps.etape === "plan").corps.recherche === false, "recherche internet décochée (avec manuel) : Claude ne cherche pas sur internet");
  ok(p2.statut === "erreur" && /3 étape\(s\) sans détail/.test(p2.erreur) && invocations.filter(i => i.corps.indices && i.corps.indices.join() === "4,5,6").length === 2, "un groupe qui échoue deux fois : procédure « incomplète », message clair (2 essais)");
  ok(!p2.contenu.etapes[4].detaille && p2.contenu.etapes[4].items.map(x => x.t).join(" | ") === "Faire la chose 4 | Vérifier 4" && p2.contenu.etapes[7].detaille, "les étapes manquantes gardent la liste du plan (la procédure reste utilisable)");
  ok(toasts().some(t => /Procédure créée, mais incomplète/.test(t)), "toast « Procédure créée, mais incomplète »");
  w.procedureFermer();
  await w.procedureDialogue(); await dodo(30);
  const ligneErr = $$(".proc-ligne").find(l => l.classList.contains("erreur"));
  ok(!!ligneErr && /incomplète/.test(ligneErr.textContent) && /Compléter/.test(ligneErr.textContent), "dans la liste : « incomplète » avec « ↻ Compléter »");
  invocations.length = 0;
  await w.procContinuer(p2.id);
  await attendre(() => donnees.procedures[1].statut === "prete");
  ok(donnees.procedures[1].statut === "prete" && invocations.map(i => i.corps.indices.join()).join(" | ") === "4,5,6" && donnees.procedures[1].contenu.etapes[5].detaille, "« Compléter » : seulement les étapes manquantes, puis prête");
  w.procedureFermer();

  // ── 4. Erreurs ──
  repondre = () => ({ data: { erreur: "Clé ANTHROPIC_API_KEY manquante dans les secrets de la fonction" }, error: null });
  await w.procedureDialogue(); await dodo(30);
  $("#proc-creer").click();
  await attendre(() => donnees.procedures.length === 3 && donnees.procedures[2].statut === "erreur");
  ok(donnees.procedures[2].statut === "erreur" && /ANTHROPIC_API_KEY/.test(donnees.procedures[2].erreur) && toasts().some(t => /n'a pas pu être créée : Clé ANTHROPIC_API_KEY/.test(t)), "plan refusé par le serveur : procédure en erreur, vrai message affiché");
  repondre = repondreNormal;
  pannes["procedures:select"] = 'relation "public.procedures" does not exist';
  await w.procedureDialogue(); await dodo(30);
  ok(/exécute edge\/procedures\.sql/.test($("#proc-boite").textContent) && /GUIDE-PROCEDURES\.md/.test($("#proc-boite").textContent), "tables absentes : on dit quoi installer (procedures.sql, guide)");
  delete pannes["procedures:select"];
  w.procedureFermerDialogue();

  // ── 5. Bibliothèque de manuels (lecteur PDF simulé) ──
  w.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 3, getPage: async (i) => ({ getTextContent: async () => ({ items: [
    { str: "Page " + i + " —", hasEOL: false }, { str: "Spark plug torque 11 N·m", hasEOL: true }, { str: "x".repeat(200), hasEOL: false }] }) }) }) }) };
  await w.procedureDialogue(); await dodo(30);
  [...$$("#proc-boite button")].find(x => /Ajouter un manuel/.test(x.textContent)).click(); await dodo(10);
  ok(!!$("#pm-fichier") && $("#pm-type").value === "Côte à côte" && $("#pm-marque").value === "BRP" && $("#pm-modele").value === "Maverick X3" && $("#pm-de").value === "2021", "« ➕ Ajouter un manuel » : formulaire prérempli avec la machine du bon");
  const fichier = new w.File(["%PDF-1.4 faux"], "Maverick_X3-2021-service.pdf", { type: "application/pdf" });
  Object.defineProperty($("#pm-fichier"), "files", { value: [fichier] });
  $("#pm-fichier").dispatchEvent(new w.Event("change"));
  ok($("#pm-titre").value === "Maverick X3 2021 service", "le titre se propose à partir du nom du fichier");
  $("#pm-ajouter").click();
  await attendre(() => toasts().some(t => /Manuel ajouté/.test(t)));
  const man = donnees.manuels.find(x => x.titre === "Maverick X3 2021 service");
  ok(man && man.nb_pages === 3 && man.marque === "BRP" && man.annee_de === 2021 && man.ajoute_par === "Jason", "manuel enregistré : titre, 3 pages, marque, années, ajouté par Jason");
  const pg = donnees.manuel_pages.filter(x => x.manuel_id === man.id);
  ok(pg.length === 3 && pg[0].page === 1 && /^Page 1 — Spark plug torque 11 N·m\n/.test(pg[0].texte), "texte gardé page par page (fins de ligne respectées)");
  ok(televersements.length === 1 && televersements[0].b === "manuels" && televersements[0].chemin === man.id + ".pdf" && man.chemin === man.id + ".pdf", "PDF envoyé dans le stockage « manuels », chemin noté");
  ok($("#proc-manuel") && $("#proc-manuel").value === man.id, "de retour à la fenêtre : le nouveau manuel est choisi");
  pannes.upload = "The object exceeded the maximum allowed size";
  [...$$("#proc-boite button")].find(x => /Ajouter un manuel/.test(x.textContent)).click(); await dodo(10);
  Object.defineProperty($("#pm-fichier"), "files", { value: [new w.File(["%PDF"], "gros.pdf", { type: "application/pdf" })] });
  $("#pm-fichier").dispatchEvent(new w.Event("change"));
  $("#pm-ajouter").click();
  await attendre(() => donnees.manuels.some(x => x.titre === "gros") && toasts().some(t => /Manuel ajouté : gros/.test(t)));
  const gros = donnees.manuels.find(x => x.titre === "gros");
  ok(gros && !gros.chemin && [...$("#proc-manuel").options].some(o => o.value === gros.id && /texte seulement/.test(o.textContent)), "PDF trop gros pour le stockage : le texte est gardé quand même (« texte seulement »)");
  delete pannes.upload;
  pannes["manuel_pages:insert"] = "payload too large";
  const nbManuels = donnees.manuels.length;
  [...$$("#proc-boite button")].find(x => /Ajouter un manuel/.test(x.textContent)).click(); await dodo(10);
  Object.defineProperty($("#pm-fichier"), "files", { value: [new w.File(["%PDF"], "casse.pdf", { type: "application/pdf" })] });
  $("#pm-fichier").dispatchEvent(new w.Event("change"));
  $("#pm-ajouter").click();
  await attendre(() => /Arrêt : payload too large/.test($("#proc-boite").textContent));
  await dodo(30);
  ok(/Arrêt : payload too large/.test($("#proc-boite").textContent) && donnees.manuels.length === nbManuels && !donnees.manuels.some(x => x.titre === "casse"), "texte pas enregistré : le manuel à moitié ajouté est retiré, l'erreur est affichée");
  delete pannes["manuel_pages:insert"];
  w.procedureFermerDialogue();
  // Un autre bon : pas le manuel ni les précisions du bon d'avant
  const m2 = { id: "bt-2", numeroBT: "BT-090", nom: "2019 Ski-Doo Summit 850", marque: "BRP", modele: "Summit", annee: "2019", type: "Motoneige", client: "Marc Tremblay", travaux: "Courroie", statut: "reparation", machineArrivee: true, notesLive: [] };
  w.__get("machines").push(m2); w.__set("liveId", "bt-2");
  await w.procedureDialogue(); await dodo(30);
  ok(/BT-090/.test($(".proc-tete").textContent) && $("#proc-manuel").value === "M-ski" && $("#proc-web").checked && $("#proc-consignes").value === "", "autre bon : son manuel proposé, recherche cochée, précisions vides");
  w.procedureFermerDialogue();
  w.__get("machines").pop(); w.__set("liveId", "bt-1");

  // ── 6. Notes du BT, droits, échappement ──
  w.procedureNoteBT("bt-1", "BT-089 · Alexandre Alarie\nProcédure : Entretien\nProgression : 12 / 40 points faits\n\nMESURES ET OBSERVATIONS\n- Largeur de courroie : 34 mm (Sous la limite de 34,7 mm)\n- Couleur du liquide : Foncé");
  const n = w.__get("machines")[0].notesLive.slice(-1)[0];
  ok(n.texte === "📋 Procédure (12 / 40 points faits) — Largeur de courroie : 34 mm (Sous la limite de 34,7 mm) · Couleur du liquide : Foncé" && n.tech === "Jason" && /Largeur de courroie/.test(w.__get("machines")[0].notesTech),
     "« Ajouter aux notes du BT » : une ligne claire dans les notes du technicien");
  w.__set("sessionCourante", { nom: "Gwendal", quand: new Date().toISOString() });
  await w.procedureDialogue(); await dodo(30);
  ok(!$$("#proc-boite button").some(x => x.textContent === "🗑️") && $$(".proc-ligne .live-btn-ok").length >= 2, "technicien : il ouvre et crée des procédures, mais n'en supprime pas");
  w.procedureFermerDialogue();
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  donnees.procedures[0].titre = "<img src=x onerror=alert(1)>";
  await w.procedureDialogue(); await dodo(30);
  ok(!$("#proc-boite img[src='x']") && /<img src=x/.test($("#proc-boite").textContent), "titre affiché comme texte (aucun HTML injecté)");
  w.procedureFermerDialogue();
 } catch (e) { ok(false, "exception (app) : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "app : aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));

 // ══════════════ La visionneuse procedure.html ══════════════
 try {
  const CONTENU = {
    version: 1, titre: "Entretien 50 h", bt: { numero: "BT-089", client: "Alexandre Alarie", machine: "2021 Maverick X3 Turbo" },
    manuel: { id: "M-x3", titre: "Manuel X3 2018", chemin: null },
    etapes: [
      { id: "s0", court: "Préparation", titre: "Avant de commencer", pourquoi: "Sortir les pièces", alertes: [{ niveau: "danger", texte: "Pneus : pas de permutation" }], specs: [], titre_liste: "Pièces, produits et outils",
        items: [{ t: "Huile **3,5 L**", cotes: [], pages: [] }], champs: [{ id: "s0_purge", type: "choix", label: "Purge du liquide de frein", unite: "", exemple: "", options: [{ valeur: "Approuvée", verdict: "", message: "" }, { valeur: "Refusée", verdict: "", message: "" }], min: null, max: null, hors_niveau: "bad", hors_message: "", ok_message: "" }], figures: [], pages: [] },
      { id: "s1", court: "Bougies", titre: "Changement des bougies", pourquoi: "Moteur froid", alertes: [], specs: [{ nom: "Bougie", valeur: "11 N·m", detail: "± 1" }], titre_liste: "À faire",
        items: [{ t: "Serrer à **11 N·m**", cotes: ["1", "2", "3"], pages: [346] }, { t: "Remonter l'intercooler <img src=x onerror=alert(1)>", cotes: [], pages: [] }], champs: [], figures: [{ page: 346, legende: "Bobine et bougie" }], pages: [346] },
      { id: "s2", court: "CVT", titre: "CVT", pourquoi: "", alertes: [], specs: [], titre_liste: "À faire", items: [{ t: "Mesurer la courroie", cotes: [], pages: [] }],
        champs: [{ id: "s2_belt", type: "nombre", label: "Largeur de courroie", unite: "mm", exemple: "", options: [], min: 34.7, max: null, hors_niveau: "bad", hors_message: "Sous la limite de 34,7 mm : appeler le client", ok_message: "Dans la limite" },
                 { id: "s2_aimant", type: "choix", label: "Aimant", unite: "", exemple: "", options: [{ valeur: "Propre", verdict: "ok", message: "Rien à signaler" }, { valeur: "Éclats", verdict: "bad", message: "Dommage interne possible" }], min: null, max: null, hors_niveau: "bad", hors_message: "", ok_message: "" }], figures: [], pages: [] },
    ],
    specs: [{ groupe: "Moteur", lignes: [{ element: "Bougie", valeur: "11 N·m ± 1", detail: "NGK LMAR9AI-8D" }, { element: "Huile", valeur: "3,5 L", detail: "" }] }],
    sources: [{ titre: "AMSOIL", url: "https://www.amsoil.ca" }], references: [{ page: 346, sujet: "Bougies" }],
  };
  const ETAT = { procedure_etat: [], procedures: [{ id: "PX", bt_id: "bt-1", statut: "prete", contenu: CONTENU }] };
  const canaux2 = [];   // les abonnements de CETTE visionneuse (une visionneuse ouverte dans l'app plus haut peut s'abonner aussi)
  const stub2 = faireStub(canaux2);
  stub2.from = (nom) => { const t = table(nom); return t; };
  donnees.procedures.push(...ETAT.procedures);
  htmlProc = htmlProc.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]*><\/script>/, "");
  const erreurs2 = [];
  const dom2 = new JSDOM(htmlProc, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/procedure.html?id=PX",
    beforeParse(v) {
      v.__PROC_ID = "PX"; v.supabase = { createClient: () => stub2 }; v.scrollTo = () => {};
      try { v.localStorage.setItem("mtr-session-v1", JSON.stringify({ nom: "Gwendal", quand: new Date().toISOString() })); v.localStorage.setItem("mtr-theme", "nuit"); } catch (_) {}
    } });
  const v = dom2.window; v.addEventListener("error", e => erreurs2.push(e.message));
  const V = (s) => v.document.querySelector(s), VV = (s) => [...v.document.querySelectorAll(s)];
  await attendre(() => V("#rail button"));
  ok(V("#btNum").textContent === "BT-089" && V("#whoClient").textContent === "Alexandre Alarie" && /Maverick X3 Turbo · Entretien 50 h/.test(V("#whoMachine").textContent), "visionneuse : BT-089, client, machine et titre dans l'en-tête");
  ok(v.document.documentElement.getAttribute("data-theme") === "dark", "suit le thème de l'app (nuit)");
  ok(VV("#rail button").length === 3 && /Décisions du client/.test(V("#stepview").textContent) && /Pneus : pas de permutation/.test(V("#alerts").textContent), "rail de 3 étapes ; Préparation : décisions du client et alertes");
  ok(V("#stepview .v") && V("#stepview .v").textContent === "3,5 L", "valeurs clés en évidence (**3,5 L**)");
  V('[data-choice="s0_purge"][data-val="Approuvée"]').click(); await dodo(40);
  ok(donnees.procedure_etat.some(r => r.procedure_id === "PX" && r.cle === "f:s0_purge" && r.valeur.v === "Approuvée" && r.par === "Gwendal"), "décision du client enregistrée (une ligne, par Gwendal)");
  V("#next").click(); await dodo(20);
  ok(/Changement des bougies/.test(V("#stepview h1").textContent) && VV("#stepview .side").map(b => b.textContent).join() === "1,2,3", "étape 1 : cases par cylindre (1, 2, 3)");
  ok(/Purge du liquide de frein : Approuvée/.test(V("#alerts").textContent), "la décision du client se rappelle dans les étapes suivantes");
  ok(!V("#stepview img[src='x']") && /<img src=x/.test(V("#stepview").textContent), "texte de Claude affiché comme texte (aucun HTML injecté)");
  V('[data-key="s1-0-2"]').click(); await dodo(40);
  ok(V('[data-key="s1-0-2"]').getAttribute("aria-pressed") === "true" && donnees.procedure_etat.some(r => r.cle === "c:s1-0-2" && r.valeur.done && r.par === "Gwendal"), "case du cylindre 2 cochée et partagée (c:s1-0-2)");
  V('[data-key="s1-1"]').click(); await dodo(40);
  ok(V('[data-key="s1-1"]').getAttribute("aria-checked") === "true" && /Gwendal/.test(V('[data-key="s1-1"] .when').textContent), "case simple : heure et nom de qui l'a cochée");
  ok(/^2 \/ 6$/.test(V("#progTxt").textContent), "progression générale : 2 / 6 (chaque cylindre compte)");
  // un autre technicien coche sur sa tablette (temps réel)
  const ecoute = (ev) => canaux2.flatMap(c => c.h).filter(h => h.f.table === "procedure_etat" && h.f.event === ev);
  ecoute("INSERT")[0].cb({ eventType: "INSERT", new: { procedure_id: "PX", cle: "c:s1-0-1", valeur: { done: true, at: new Date().toISOString(), par: "Arno" } } }); await dodo(10);
  ok(V('[data-key="s1-0-1"]').getAttribute("aria-pressed") === "true", "temps réel : la case cochée par Arno apparaît");
  ecoute("DELETE")[0].cb({ eventType: "DELETE", old: { procedure_id: "AUTRE", cle: "c:s1-0-1" } }); await dodo(10);
  ok(V('[data-key="s1-0-1"]').getAttribute("aria-pressed") === "true", "une suppression dans une autre procédure est ignorée");
  ecoute("DELETE")[0].cb({ eventType: "DELETE", old: { procedure_id: "PX", cle: "c:s1-0-1" } }); await dodo(10);
  ok(V('[data-key="s1-0-1"]').getAttribute("aria-pressed") === "false", "… celle de cette procédure décoche la case");
  // pages du manuel
  V('#stepview .figbtn[data-pages="346"]').click(); await dodo(20);
  ok(!V("#lb").hidden && /pas dans l'app/.test(V("#lbWrap").textContent) && /Manuel X3 2018, page 346/.test(V("#lbRef").textContent) && /Bobine et bougie/.test(V("#lbCap").textContent), "bouton « p. 346 » : page du manuel (ici : PDF pas gardé, on le dit)");
  V("#lbClose").click();
  // mesures
  V("#next").click(); await dodo(20);
  const inp = V('[data-input="s2_belt"]');
  inp.value = "34,2"; inp.dispatchEvent(new v.Event("input", { bubbles: true })); await dodo(20);
  ok(V("#v-s2_belt").className === "verdict bad" && /Sous la limite de 34,7 mm : appeler le client/.test(V("#v-s2_belt").textContent) && /Largeur de courroie : 34,2 mm/.test(V("#alerts").textContent), "mesure sous la limite : verdict rouge et alerte en haut de l'étape");
  inp.value = "35"; inp.dispatchEvent(new v.Event("input", { bubbles: true })); await dodo(20);
  ok(V("#v-s2_belt").className === "verdict ok" && V("#v-s2_belt").textContent === "Dans la limite", "dans la limite : verdict vert");
  await dodo(800);
  ok(donnees.procedure_etat.some(r => r.cle === "f:s2_belt" && r.valeur.v === "35"), "la mesure est enregistrée (après la frappe)");
  V('[data-choice="s2_aimant"][data-val="Éclats"]').click(); await dodo(20);
  ok(V("#v-s2_aimant").className === "verdict bad" && V("#v-s2_aimant").textContent === "Dommage interne possible", "choix avec verdict : « Éclats » en rouge");
  // hors ligne, puis retour
  pannes["procedure_etat:upsert"] = "Failed to fetch";
  V('[data-key="s2-0"]').click(); await dodo(60);
  ok(/Cet appareil seulement/.test(V("#sync").textContent) && JSON.parse(v.localStorage.getItem("proc-PX-attente"))["c:s2-0"], "réseau coupé : « Cet appareil seulement », la coche attend sur l'appareil");
  delete pannes["procedure_etat:upsert"];
  v.__proc.vider(); await dodo(80);
  ok(/Synchronisé/.test(V("#sync").textContent) && donnees.procedure_etat.some(r => r.cle === "c:s2-0") && !Object.keys(JSON.parse(v.localStorage.getItem("proc-PX-attente"))).length, "réseau revenu : la coche part, « Synchronisé »");
  // specs, résumé
  V("#tab-specs").click(); await dodo(20);
  ok(VV("#specbody tr:not(.grp)").length === 2 && V('.liens a[href="https://www.amsoil.ca"]') && /Bougies/.test(V("#view-specs").textContent), "onglet Specs : tableau, pages du manuel, sources web");
  V("#specq").value = "ngk"; V("#specq").dispatchEvent(new v.Event("input")); await dodo(10);
  ok(VV("#specbody tr:not(.grp)").length === 1, "recherche dans les specs");
  V("#tab-resume").click(); await dodo(20);
  const res = V("#sumtxt").value;
  ok(/^BT-089 · Alexandre Alarie · 2021 Maverick X3 Turbo/.test(res) && /DÉCISIONS DU CLIENT\n- Purge du liquide de frein : Approuvée/.test(res) && /Largeur de courroie : 35 mm/.test(res) && /Aimant : Éclats \(Dommage interne possible\)/.test(res) && /À TERMINER/.test(res),
     "résumé : bon, décisions, mesures (avec les verdicts), ce qui reste");
  V("#wipe").click(); await dodo(10);
  ok(/Confirmer/.test(V("#wipe").textContent), "« Tout effacer » demande une confirmation");
  V("#wipe").click(); await dodo(300);
  ok(!donnees.procedure_etat.some(r => r.procedure_id === "PX"), "confirmé : toutes les coches et mesures effacées (toutes les tablettes)");
  ok(erreurs2.length === 0, "visionneuse : aucune erreur JavaScript (" + erreurs2.length + ")" + (erreurs2.length ? " : " + erreurs2.slice(0, 3).join(" | ") : ""));
 } catch (e) { ok(false, "exception (visionneuse) : " + (e && e.stack || e)); }
 process.exit();
})();
