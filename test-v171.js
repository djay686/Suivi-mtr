// v171 — 📥 Importer une procédure déjà faite par Claude (page HTML seule, .zip avec les photos, ou dossier) dans le bon live,
//   puis la voir sur la TV et la piloter avec la télécommande (▶ ◀ étapes ; depuis la v175 : ▲ ▼ lignes, ⏯ figures).
// Se lance dans un navigateur (Chromium) : cadre isolé (sandbox), .zip (DecompressionStream) et vraies images.
// Fichiers du banc d'essai : bt089/ (la vraie « Procédure BT-089 » : index.html + img/) et bt089.zip (le même dossier, compressé).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");
let htmlProc = fs.readFileSync(FICHIER.replace(/index\.html$/, "procedure.html"), "utf8");
let htmlTv = fs.readFileSync(FICHIER.replace(/index\.html$/, "tv.html"), "utf8");
const CDN = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]*><\/script>/;

// ── Supabase en mémoire ──
const cp = (x) => JSON.parse(JSON.stringify(x));
const EMP = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }];
const M1 = { id: "bt-1", numeroBT: "BT-089", nom: "2021 Can-Am Maverick X3 Turbo", client: "Alexandre Alarie", statut: "reparation", machineArrivee: true, travaux: "Entretien 50 h", chrono: [{ tech: "Gwendal", debut: new Date(Date.now() - 3600000).toISOString(), pauses: [] }] };
const M2 = { id: "bt-2", numeroBT: "BT-103", nom: "2020 Sea-Doo GTI", client: "Client 103", statut: "reparation", machineArrivee: true, travaux: "Entretien" };
const db = { procedures: [], procedure_etat: [], manuels: [], tableau: [{ id: 1, donnees: [M1, M2] }, { id: 4, donnees: EMP }], ecrans: [{ id: "lift", nom: "Lift 2 colonnes", mode: "rien", etape: 0 }] };
let prochainId = 1, pannes = {};
const cleL = (nom, r) => nom === "procedure_etat" ? r.procedure_id + "|" + r.cle : r.id;
const table = (nom) => {
  const q = { op: "select", vals: null, filtres: [], un: false };
  const exec = () => {
    if (pannes[nom + ":" + q.op]) return { data: null, error: { message: pannes[nom + ":" + q.op] } };
    const rows = (db[nom] = db[nom] || []);
    const garde = r => q.filtres.every(f => f(r));
    let data = null;
    if (q.op === "select") data = cp(rows.filter(garde));
    else if (q.op === "update") { data = rows.filter(garde); data.forEach(r => Object.assign(r, cp(q.vals))); }
    else if (q.op === "insert" || q.op === "upsert") {
      if (nom === "procedures") nInsertions++;
      data = [].concat(q.vals).map(v => Object.assign(nom === "procedures" ? { id: "P" + prochainId++, cree_le: new Date().toISOString() } : {}, cp(v)));
      data.forEach(d => { const i = rows.findIndex(r => cleL(nom, r) === cleL(nom, d)); if (q.op === "upsert" && i >= 0) rows[i] = Object.assign(rows[i], d); else rows.push(d); });
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
const stockage = {}, retraits = [], liens = [];
let nEnvois = 0, nInsertions = 0;
const faireStub = (canaux, auth) => ({
  from: table,
  channel: (nom) => { const o = { nom, h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe(cb) { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return o; } }; canaux.push(o); return o; },
  removeChannel: () => {},
  auth: auth || { getSession: async () => ({ data: { session: { access_token: "ok" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }) },
  functions: { invoke: async () => ({ data: null, error: { message: "non" } }) },
  storage: { from: (b) => ({
    upload: async (chemin, f, opts) => { nEnvois++; if (pannes.upload) return { data: null, error: { message: pannes.upload } }; stockage[b + "/" + chemin] = { blob: f, type: opts && opts.contentType }; return { data: { path: chemin }, error: null }; },
    createSignedUrl: async (c) => { liens.push(b + "/" + c); const x = stockage[b + "/" + c]; return x ? { data: { signedUrl: URL.createObjectURL(x.blob) }, error: null } : { data: null, error: { message: "Object not found" } }; },
    remove: async (l) => { l.forEach(c => { retraits.push(b + "/" + c); delete stockage[b + "/" + c]; }); return { data: l, error: null }; },
  }) },
});
const pousser = (canaux, tableNom, ligne, ev = "UPDATE") => canaux.forEach(c => c.h.filter(h => h.f.table === tableNom && (h.f.event === "*" || h.f.event === ev)).forEach(h => h.cb({ eventType: ev, new: cp(ligne) })));

const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const attendre = async (f, ms = 5000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await dodo(20); return f(); };
const fichier = (contenu, nom, type, rel) => { const f = new File([contenu], nom, { type: type || "" }); if (rel) Object.defineProperty(f, "webkitRelativePath", { value: rel }); return f; };

(async () => {
 // Les vraies pièces : la procédure BT-089 faite par Claude, et son .zip
 const htmlBt = await (await fetch("bt089/index.html", { cache: "no-store" })).text();
 const zipBt = await (await fetch("bt089.zip", { cache: "no-store" })).blob();
 const idsFig = [...new Set([...htmlBt.matchAll(/"id": "([\w-]+)", "cap"/g)].map(x => x[1]))];
 const imgBt = async (id) => (await fetch("bt089/img/" + id + ".jpg", { cache: "no-store" })).blob();

 const canaux1 = [], sb1 = faireStub(canaux1);
 let h1 = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
 { const i = h1.lastIndexOf("</body>"); h1 = h1.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + h1.slice(i); }
 const confirmations = [], alertes = [];
 let repConfirm = true;
 const dom = new JSDOM(h1, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
   beforeParse(w) { w.__sbStub = sb1; w.alert = (m) => alertes.push(String(m)); w.confirm = (m) => { confirmations.push(String(m)); return repConfirm; }; w.prompt = () => ""; w.scrollTo = () => {};
     w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
     w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" }); } });
 const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
 const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
 const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
 await dodo(1500);
 let P1 = null, P2 = null;
 try {
  w.__set("sb", sb1); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true }, { nom: "Gwendal", role: "technicien", actif: true }]);
  w.__set("sessionCourante", { nom: "Gwendal", quand: new Date().toISOString() });
  w.__set("machines", [cp(M1), cp(M2)]);
  w.__set("liveId", "bt-1");
  const lignes = [];
  const vraiL = w.procImpLigne; w.procImpLigne = (t, e) => { const l = vraiL(t, e); if (l) lignes.push(l); return l; };
  const txtLignes = () => lignes.map(l => l.texte).join(" | ");

  // ══════ 1. La place pour importer, dans le bon live ══════
  await w.procedureDialogue(); await dodo(30);
  const zone = $("#proc-boite").textContent.replace(/\s+/g, " ");
  ok(/📥 Procédure déjà faite/.test(zone) && $("#proc-imp-fichier") && $("#proc-imp-dossier"), "fenêtre 📋 du bon live : « 📥 Procédure déjà faite » avec « 📄 Fichier .html ou .zip » et « 📁 Dossier »");
  ok(/\.html/.test($("#proc-imp-fichier").getAttribute("accept")) && /\.zip/.test($("#proc-imp-fichier").getAttribute("accept")) && $("#proc-imp-dossier").hasAttribute("webkitdirectory"), "le fichier accepte .html et .zip ; le dossier se choisit au complet");

  // ══════ 2. La page seule (index.html de la procédure BT-089) ══════
  await w.procImporter([fichier(htmlBt, "index.html", "text/html")]);
  P1 = db.procedures[0];
  ok(P1 && P1.statut === "prete" && P1.bt_id === "bt-1" && P1.cree_par === "Gwendal" && P1.titre === "Procédure BT-089", "importée dans le bon : prête, par Gwendal, titre « Procédure BT-089 »");
  const c1 = P1.contenu, E = c1.etapes;
  ok(E.length === 15 && E[0].court === "Préparation" && E[2].titre === "Changement des bougies (moteur froid)" && E[14].court === "Essai final", "15 étapes (préparation + 14), titres repris tels quels");
  ok(c1.bt.numero === "BT-089" && c1.bt.client === "Alexandre Alarie" && c1.import.bt === "BT-089" && c1.import.client === "Alexandre Alarie" && c1.import.fichier === "index.html", "le bon de l'app, et d'où vient la procédure (fichier, BT-089, Alexandre Alarie)");
  ok(E[2].items.length === 15 && E[2].items[11].t === "Visser à la main, serrer à **11 N·m**" && E[2].specs[2].valeur === "11 N·m" && E[2].specs[2].detail === "± 1 · 97 lbf·po", "cases et specs de l'étape (bougie 11 N·m, valeurs en gras gardées)");
  ok(E[9].items[0].cotes.join() === "G,D" && E[10].items[1].cotes.join() === "AVG,AVD,ARG,ARD", "cases par côté (G / D) et par coin (AVG AVD ARG ARD)");
  ok(E[3].alertes[0].niveau === "danger" && /clé à chocs/.test(E[3].alertes[0].texte) && E[0].titre_liste === "Pièces et produits", "alertes (danger) et titre de liste gardés");
  const champ = (id) => E.flatMap(e => e.champs).find(c => c.id === id);
  const belt = champ("belt");
  ok(belt.type === "nombre" && belt.unite === "mm" && belt.min === 34.7 && belt.max === null && belt.hors_niveau === "bad" && belt.hors_message === "Sous la limite de 34,7 mm : appeler le client" && belt.ok_message === "Dans la limite", "mesure « courroie » : la vérification de la page devient min 34,7 mm, message rouge et message vert");
  const toe = champ("toeLb");
  ok(toe.min === 2.6 && toe.max === 12.8 && /Hors spec \(2,6 à 12,8 mm/.test(toe.hors_message) && toe.ok_message === "Dans la spec", "pincement : plage 2,6 à 12,8 mm");
  ok(champ("engLI").min === 25 && champ("engLI").ok_message === "OK" && champ("padAVG").min === 0.5 && champ("padAVG").hors_niveau === "warn", "engagement min 25 mm ; plaquettes min 0,5 mm en avertissement (jaune)");
  const mag = champ("oilMag"), diff = champ("diffState");
  ok(mag.type === "choix" && mag.options.find(o => o.valeur === "Éclats").verdict === "bad" && /Dommage interne/.test(mag.options.find(o => o.valeur === "Éclats").message) && mag.options.find(o => o.valeur === "Propre").verdict === "", "choix « aimant » : Éclats → rouge « Dommage interne possible », Propre → rien");
  ok(diff.options.find(o => o.valeur === "Claire").verdict === "ok" && diff.options.find(o => o.valeur === "Foncée / brûlée").verdict === "warn", "choix « huile du diff » : Claire → vert, Foncée → jaune");
  ok(champ("tires").type === "choix" && E[0].champs.length === 3 && champ("hours").type === "texte" && champ("tireF").exemple === "ex. 30x10-14", "décisions du client (préparation) et champs texte avec exemple");
  ok(c1.specs.length === 4 && c1.specs[0].groupe === "Moteur" && c1.specs[0].lignes[0].element === "Huile moteur", "onglet Specs : 4 groupes (Moteur, Transmission…)");
  ok(E[2].ref === "Ignition Coils and Spark Plugs p. 342-346" && E[2].figures.length === 11 && E[2].figures[0].image === "bg-acces" && E[2].figures[0].page === 342, "références du manuel et figures de l'étape (11 pour les bougies)");
  ok(E[2].items[0].figs.join() === "bg-acces,bg-couvercle" && Object.keys(c1.images).length === 75 && !Object.values(c1.images).some(x => x.chemin), "figures liées aux cases ; page seule : 75 figures connues, aucune photo");
  ok(/Photos : pas dans ce que tu as choisi \(75 figures\)/.test(txtLignes()), "page seule : « Photos : pas dans ce que tu as choisi — importe le .zip ou le dossier »");
  ok(toasts().some(t => /📥 Procédure importée : 14 étapes/.test(t)), "toast « 📥 Procédure importée : 14 étapes »");
  ok($("#proc-voile").classList.contains("ouvert") && $("#proc-cadre").getAttribute("src") === "procedure.html?id=" + P1.id, "la procédure s'ouvre tout de suite");
  ok(typeof w.__mtrExp === "undefined" && !$("#rail") && !$("#lbZoom"), "le code de la page n'a jamais tourné dans l'app (cadre isolé)");
  ok(!$$("iframe[sandbox]").length, "le cadre isolé est retiré après la lecture");
  w.procedureFermer();

  // ══════ 3. Le .zip avec les photos, dans un autre bon (BT-103) ══════
  w.__set("liveId", "bt-2");
  await w.procedureDialogue(); await dodo(30);
  lignes.length = 0;
  repConfirm = false;
  const [e0, i0] = [nEnvois, nInsertions];
  await w.procImporter([fichier(zipBt, "Procédure BT-089.zip", "application/zip")]);
  ok(/faite pour BT-089 \(Alexandre Alarie\)/.test(confirmations.at(-1)) && /dans BT-103/.test(confirmations.at(-1)) && db.procedures.length === 1 && !Object.keys(stockage).length && nEnvois === e0 && nInsertions === i0, "faite pour un autre bon : on demande (« faite pour BT-089… l'importer dans BT-103 ? ») ; Non → rien d'envoyé au serveur");
  repConfirm = true; lignes.length = 0;
  await w.procImporter([fichier(zipBt, "Procédure BT-089.zip", "application/zip")]);
  P2 = db.procedures.find(p => p.bt_id === "bt-2");
  const c2 = P2 && P2.contenu;
  ok(P2 && P2.statut === "prete" && c2.etapes.length === 15 && c2.bt.numero === "BT-103" && c2.import.fichier === "Procédure BT-089.zip", "Oui → importée dans BT-103 (depuis le .zip : dossier « Procédure BT-089/ » à l'intérieur)");
  const photos = Object.keys(stockage).filter(k => k.startsWith("procedures/" + P2.id + "/"));
  ok(photos.length === 75 && Object.values(c2.images).every(x => x.chemin && x.chemin.startsWith(P2.id + "/")) && /Photos : 75 \/ 75/.test(txtLignes()), "75 photos envoyées au stockage « procedures », rangées sous la procédure (« Photos : 75 / 75 »)");
  const orig = await imgBt("al-angle"), envoye = stockage["procedures/" + c2.images["al-angle"].chemin];
  ok(envoye.type === "image/jpeg" && envoye.blob.size === orig.size && orig.size === 67548, "photo décompressée intacte (al-angle.jpg : 67 548 octets, image/jpeg)");
  const oa = new Uint8Array(await orig.arrayBuffer()), ea = new Uint8Array(await envoye.blob.arrayBuffer());
  ok(oa.length === ea.length && oa.every((o, i) => o === ea[i]), "… octet pour octet");
  ok(toasts().some(t => /14 étapes, 75 photos/.test(t)), "toast « 14 étapes, 75 photos »");
  w.procedureFermer();

  // ══════ 4. Le dossier (choisi au complet) ══════
  w.__set("liveId", "bt-1");
  await w.procedureDialogue(); await dodo(30);
  const cvt = idsFig.filter(id => /^cvt-/.test(id));
  const dossier = [fichier(htmlBt, "index.html", "text/html", "Procédure BT-089/index.html")];
  for (const id of cvt) dossier.push(fichier(await imgBt(id), id + ".jpg", "image/jpeg", "Procédure BT-089/img/" + id + ".jpg"));
  lignes.length = 0;
  await w.procImporter(dossier);
  const P3 = db.procedures.at(-1), c3 = P3.contenu;
  ok(P3.bt_id === "bt-1" && c3.import.fichier === "Procédure BT-089" && Object.values(c3.images).filter(x => x.chemin).length === cvt.length && c3.images["cvt-baio"].chemin, "dossier : le nom du dossier est gardé ; les " + cvt.length + " photos présentes sont envoyées");
  ok(!c3.images["bg-acces"].chemin, "les photos absentes du dossier restent sans photo (le reste de la procédure est là)");
  w.procedureFermer();

  // ══════ 5. Erreurs ══════
  await w.procedureDialogue(); await dodo(30);
  const avant = db.procedures.length;
  await w.procImporter([fichier("<!doctype html><html><head><title>Rien</title></head><body><h1>Bonjour</h1><p>Pas de procédure ici.</p></body></html>", "rien.html", "text/html")]);
  ok(db.procedures.length === avant && /aucune étape trouvée/.test($("#proc-boite").textContent) && toasts().some(t => /Import impossible : aucune étape trouvée/.test(t)), "page sans procédure : « aucune étape trouvée », rien d'enregistré, message dans la fenêtre");
  await w.procImporter([fichier(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), "abime.zip", "application/zip")]);
  ok(db.procedures.length === avant && /ce fichier \.zip est illisible/.test($("#proc-boite").textContent), ".zip abîmé : « ce fichier .zip est illisible »");
  await w.procImporter([fichier("bonjour", "notes.txt", "text/plain")]);
  ok(db.procedures.length === avant && /aucune page \.html/.test($("#proc-boite").textContent), "pas de page .html : « aucune page .html dans ce que tu as choisi »");
  // Stockage des photos pas installé : la procédure est gardée sans photos
  pannes.upload = "Bucket not found";
  await w.procImporter([fichier(zipBt, "bt089.zip", "application/zip")]);
  const P4 = db.procedures.at(-1);
  ok(db.procedures.length === avant + 1 && P4.statut === "prete" && !Object.values(P4.contenu.images).some(x => x.chemin) && /l'espace « procedures » n'existe pas : exécute edge\/procedures\.sql/.test(txtLignes()), "stockage « procedures » absent : procédure gardée sans photos, « exécute edge/procedures.sql »");
  delete pannes.upload;
  w.procedureFermer();
  // L'enregistrement final échoue : rien ne reste (ni la procédure, ni ses photos)
  await w.procedureDialogue(); await dodo(30);
  const nPhotos = Object.keys(stockage).length;
  pannes["procedures:update"] = "refus du serveur";
  await w.procImporter([fichier(zipBt, "bt089.zip", "application/zip")]);
  ok(db.procedures.length === avant + 1 && Object.keys(stockage).length === nPhotos && /enregistrement refusé : refus du serveur/.test($("#proc-boite").textContent), "enregistrement final refusé : la procédure et ses photos déjà envoyées sont retirées, le message reste affiché");
  delete pannes["procedures:update"];
  w.procedureFermer();
  // Table absente
  await w.procedureDialogue(); await dodo(30);
  pannes["procedures:insert"] = 'relation "public.procedures" does not exist';
  await w.procImporter([fichier(htmlBt, "index.html", "text/html")]);
  ok(/exécute edge\/procedures\.sql/.test($("#proc-boite").textContent), "tables absentes : dit quoi installer");
  delete pannes["procedures:insert"];

  // ══════ 6. Une page piégée : isolée, rien ne sort ══════
  const piege = `<!doctype html><html><head><title>Piège</title></head><body><h1>x</h1><script>
(function(){ "use strict";
var STEPS=[{id:"s0",short:"Prép",title:"<img src=x onerror=alert(1)>",items:["Case <b>grasse</b>"],fields:[{id:"jeu",type:"num",label:"Jeu",unit:"mm",check:function(v){return v>2?["bad","Trop de jeu"]:["ok","Bon"];}}]},{id:"s1",short:"Un",title:"Étape 1",items:["A"]}];
try{ parent.document.body.setAttribute("data-pirate","1"); }catch(e){}
try{ parent.localStorage.setItem("pirate","1"); }catch(e){}
parent.postMessage({mtrImport:"faux",data:{ok:true,etapes:[{id:"z",titre:"FAUX"}]}},"*");
})();
<\/script></body></html>`;
  await w.procImporter([fichier(piege, "piege.html", "text/html")]);
  const P5 = db.procedures.at(-1);
  ok(P5.contenu.etapes.length === 2 && P5.contenu.etapes[0].titre === "<img src=x onerror=alert(1)>" && !P5.contenu.etapes.some(e => e.titre === "FAUX"), "page piégée : ses données sont lues, le faux message est ignoré, le titre reste du texte");
  ok(!w.document.body.hasAttribute("data-pirate") && w.localStorage.getItem("pirate") === null && !alertes.length, "le code de la page ne touche ni l'app ni son stockage");
  const jeu = P5.contenu.etapes[0].champs[0];
  ok(jeu.max === 2 && jeu.min === null && jeu.hors_message === "Trop de jeu" && jeu.ok_message === "Bon", "limite au-dessus (jeu > 2 mm → rouge)");
  w.procedureFermer();

  // ══════ 7. Autre format (pas le moteur BT-089) : lecture du texte ══════
  await w.procedureDialogue(); await dodo(30);
  const gen = `<!doctype html><html><head><title>Vidange VTT</title></head><body><h1>Vidange</h1><h2>Préparation</h2><p>Sortir les pièces.</p><ul><li>Huile 2 L</li><li>Filtre</li></ul><h2>Vidange</h2><ol><li>Enlever le bouchon</li><li>Reposer à <b>25 N·m</b></li></ol><img src="img/bouchon.jpg" alt="Bouchon de vidange"></body></html>`;
  await w.procImporter([fichier(gen, "index.html", "text/html", "Vidange/index.html"), fichier(await imgBt("hm-bouchons"), "bouchon.jpg", "image/jpeg", "Vidange/img/bouchon.jpg")]);
  const P6 = db.procedures.at(-1), c6 = P6.contenu;
  ok(c6.import.texteSeulement && c6.etapes.length === 2 && c6.etapes[0].titre === "Préparation" && c6.etapes[0].pourquoi === "Sortir les pièces." && c6.etapes[1].items.map(i => i.t).join("|") === "Enlever le bouchon|Reposer à 25 N·m", "autre format : titres → étapes, listes → cases, paragraphe → « pourquoi »");
  ok(c6.etapes[1].figures.length === 1 && c6.images[c6.etapes[1].figures[0].image].chemin && c6.etapes[1].figures[0].legende === "Bouchon de vidange", "… et son image (avec sa légende) envoyée");
  w.procedureFermer();
 } catch (err) { ok(false, "exception (app) : " + (err && err.stack || err)); }

 // ══════ 8. La visionneuse (procedure.html) : photos, figures des cases, mesures ══════
 const canaux2 = [], sb2 = faireStub(canaux2);
 const dom2 = new JSDOM(htmlProc.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/procedure.html?id=" + (P2 && P2.id),
   beforeParse(v) { v.__PROC_ID = P2 && P2.id; v.supabase = { createClient: () => sb2 }; v.scrollTo = () => {}; } });
 const v = dom2.window; const erreurs2 = []; v.addEventListener("error", e => erreurs2.push(e.message));
 const V = (s) => v.document.querySelector(s), VV = (s) => [...v.document.querySelectorAll(s)];
 try {
  await attendre(() => V("#stepview h1"));
  v.document.querySelector('[data-go="2"]').click(); await dodo(30);
  ok(/Changement des bougies/.test(V("#stepview h1").textContent) && /Manuel\s*Ignition Coils and Spark Plugs p\. 342-346/.test(V(".ref").textContent), "visionneuse : étape des bougies, référence du manuel");
  ok(/Figures \(11\)/.test(V("#stepview").textContent) && VV(".thumb .ph.photo[data-photo]").length === 11, "galerie « Figures (11) » avec les photos");
  await attendre(() => VV(".thumb img").length === 11);
  ok(VV(".thumb img").length === 11 && /^blob:/.test(VV(".thumb img")[0].getAttribute("src")), "les 11 photos s'affichent (lien signé du stockage privé)");
  const fb = VV("#stepview .figbtn")[0];
  ok(fb && /2 fig\./.test(fb.textContent) && fb.getAttribute("data-imgs") === "bg-acces|bg-couvercle", "1re case : bouton « 2 fig. » (les figures de cette case)");
  fb.click(); await attendre(() => V("#lbWrap img"));
  ok(!V("#lb").hidden && /Pièces à enlever pour l'accès/.test(V("#lbCap").textContent) && /page 342/.test(V("#lbRef").textContent) && /^blob:/.test(V("#lbWrap img").getAttribute("src")) && V("#lbCount").textContent === "1 / 2", "la figure s'ouvre en grand : légende, page 342, 1 / 2");
  V("#lbNext").click(); await attendre(() => /Couvercle de service arrière/.test(V("#lbCap").textContent));
  ok(/Couvercle de service arrière/.test(V("#lbCap").textContent) && V("#lbCount").textContent === "2 / 2", "Suivante : 2 / 2");
  V("#lbClose").click();
  VV('#stepview [data-key]')[0].click(); await dodo(40);
  ok(db.procedure_etat.some(r => r.procedure_id === P2.id && r.cle === "c:s2-0" && r.valeur && r.valeur.done), "une case cochée : partagée (une ligne par case, comme les autres procédures)");
  v.document.querySelector('[data-go="3"]').click(); await dodo(30);
  const inp = V('[data-input="belt"]'); inp.value = "34,2"; inp.dispatchEvent(new v.Event("input", { bubbles: true })); await dodo(20);
  ok(/Sous la limite de 34,7 mm : appeler le client/.test(V("#v-belt").textContent) && V("#v-belt").classList.contains("bad") && V(".alert.danger"), "mesure 34,2 mm : rouge « Sous la limite de 34,7 mm : appeler le client », remonte en alerte");
  v.document.querySelector('[data-go="5"]').click(); await dodo(30);
  V('[data-choice="oilMag"][data-val="Éclats"]').click(); await dodo(20);
  ok(V("#v-oilMag").classList.contains("bad") && /Dommage interne possible/.test(V("#v-oilMag").textContent), "choix « Éclats » : rouge « Dommage interne possible »");
  v.document.querySelector('[data-view="specs"]').click(); await dodo(20);
  ok(/Procédure importée \(« Procédure BT-089\.zip »\)/.test(V("#view-specs").textContent) && /Huile de gearbox/.test(V("#view-specs").textContent), "onglet Specs : « Procédure importée », tableau des specs");
 } catch (err) { ok(false, "exception (visionneuse) : " + (err && err.stack || err)); }
 ok(erreurs2.length === 0, "visionneuse : aucune erreur JavaScript (" + erreurs2.length + ")" + (erreurs2.length ? " : " + erreurs2.slice(0, 3).join(" | ") : ""));

 // ══════ 9. La TV : la procédure importée, pilotée à la télécommande ══════
 const canaux3 = [];
 const auth3 = { getSession: async () => ({ data: { session: { user: { email: "g.brossault@mtrperformance.local" } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
   signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }) };
 const sb3 = faireStub(canaux3, auth3);
 Object.assign(db.ecrans[0], { mode: "procedure", procedure_id: P2 && P2.id, etape: 2, tech: "Gwendal" });
 const dom3 = new JSDOM(htmlTv.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/tv.html?ecran=lift",
   beforeParse(t) { t.supabase = { createClient: () => sb3 }; t.__TV_ECRAN = "lift"; } });
 const t = dom3.window; const erreurs3 = []; t.addEventListener("error", e => erreurs3.push(e.message));
 const T = (s) => t.document.querySelector(s);
 const texte = () => (T("#ecran") ? T("#ecran").textContent : "").replace(/\s+/g, " ");
 const touche = (key, keyCode) => { const ev = new t.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }); Object.defineProperty(ev, "keyCode", { get: () => keyCode }); t.document.dispatchEvent(ev); };
 try {
  await attendre(() => /Changement des bougies/.test(texte()), 6000);
  ok(/Changement des bougies/.test(texte()) && /11 N·m/.test(texte()), "TV : l'étape en cours de la procédure importée, en gros (bougies, 11 N·m)");
  // v175 : ▲ ▼ choisissent la ligne (la 1re pas cochée au départ), ses figures s'ouvrent à côté ; ⏯ passe de l'une à l'autre
  const leg = () => T(".figure .leg") ? T(".figure .leg").textContent : "";
  await attendre(() => T("#fig-img") && !T("#fig-img").hidden);
  ok(T("#fig-img") && !T("#fig-img").hidden && /^blob:/.test(T("#fig-img").getAttribute("src")) && T("#cases li.ici") && T("#cases li.ici").getAttribute("data-ligne") === "1" && /1 \/ 4 ⏯/.test(leg()),
    "la ligne en cours (la 1re pas cochée : les vis de l'intercooler) ouvre ses 4 figures à côté (1 / 4 ⏯)");
  ok(/▲ ▼ ligne · OK cocher · ◀ ▶ étape · ⏯ figures/.test(T("#pied").textContent), "en bas : « ▲ ▼ ligne · OK cocher · ◀ ▶ étape · ⏯ figures »");
  touche("MediaPlayPause", 179); await attendre(() => /2 \/ 4/.test(leg()));
  ok(/2 \/ 4/.test(leg()) && /Figure 2 \/ 4/.test(T("#bulle").textContent) && db.ecrans[0].etape === 2, "⏯ : figure suivante de la ligne (2 / 4), l'étape ne change pas");
  touche("ArrowUp", 38); await dodo(30);
  ok(/Pièces à enlever pour l'accès/.test(leg()) && /1 \/ 2/.test(leg()), "▲ : la 1re ligne, ses 2 figures (Pièces à enlever pour l'accès, 1 / 2)");
  await attendre(() => T("#fig-img") && !T("#fig-img").hidden);
  ok(/^blob:/.test(T("#fig-img").getAttribute("src")), "… la photo suit");
  touche("ArrowDown", 40); touche("ArrowDown", 40); touche("ArrowDown", 40); await dodo(20);
  ok(/Pièces à enlever pour l'accès/.test(leg()) && /1 \/ 11/.test(leg()), "▼ ▼ ▼ : une ligne sans figure (boucher les tuyaux) → les 11 figures de l'étape (1 / 11)");
  touche("ArrowRight", 39); await attendre(() => /CVT : passer l'air/.test(texte()));
  ok(/CVT : passer l'air/.test(texte()) && db.ecrans[0].etape === 3 && T(".figure"), "▶ : étape suivante (CVT), avec ses figures ; le cell suit (ligne d'écran)");
  touche("ArrowRight", 39); await attendre(() => /Essai routier de diagnostic/.test(texte()));
  ok(!T(".figure"), "étape sans figure : rien à côté");
  touche("ArrowRight", 39); await attendre(() => db.ecrans[0].etape === 5);
  ok(db.ecrans[0].etape === 5 && /Huile moteur et filtre/.test(texte()), "▶ : étape suivante (huile moteur)");
 } catch (err) { ok(false, "exception (TV) : " + (err && err.stack || err)); }
 ok(erreurs3.length === 0, "TV : aucune erreur JavaScript (" + erreurs3.length + ")" + (erreurs3.length ? " : " + erreurs3.slice(0, 3).join(" | ") : ""));

 // ══════ 10. Supprimer la procédure : ses photos partent aussi ══════
 try {
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.__set("liveId", "bt-2");
  await w.procedureDialogue(); await dodo(30);
  retraits.length = 0;
  await w.procSupprimer(P2.id);
  ok(!db.procedures.some(p => p.id === P2.id) && retraits.length === 75 && !Object.keys(stockage).some(k => k.startsWith("procedures/" + P2.id + "/")), "🗑️ (administration) : la procédure et ses 75 photos sont retirées");
 } catch (err) { ok(false, "exception (suppression) : " + (err && err.stack || err)); }
 ok(erreurs.length === 0, "app : aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
