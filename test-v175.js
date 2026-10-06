// v175 — TV du lift : cocher chaque case de la procédure à la télécommande (▲ ▼ la ligne, OK la coche, partagée avec le
//   cell), et ouvrir les figures reliées à la ligne (badge 📷 à droite ; ⏯ pour passer de l'une à l'autre).
// Se lance dans un navigateur (Chromium) : vraies images, défilement de la liste.
// NODE_PATH=… node test-v175.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
const htmlTv = fs.readFileSync(FICHIER.replace(/index\.html$/, "tv.html"), "utf8");
const CDN = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]*><\/script>/;

// ── Supabase en mémoire ──
const cp = (x) => JSON.parse(JSON.stringify(x));
const EMP = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }];
const lignes = (n, pre) => Array.from({ length: n }, (_, i) => pre + " " + (i + 1));
const PROC = { id: "P", bt_id: "bt-1", statut: "prete", contenu: {
  titre: "Procédure BT-200", bt: { numero: "BT-200", machine: "2021 Can-Am Maverick X3", client: "Client test" },
  images: { a: { chemin: "P/a.jpg", legende: "Accès" }, b: { chemin: "P/b.jpg" }, c: { chemin: "P/c.jpg" }, x: { legende: "Sans photo" } },
  etapes: [
    { id: "s0", court: "Préparation", titre: "Avant de commencer", items: ["Machine sur le lift"], figures: [] },
    { id: "s1", court: "Bougies", titre: "Changement des bougies", specs: [{ nom: "Bougie", valeur: "11 N·m" }],
      figures: [{ image: "a", legende: "Pièces à enlever pour l'accès", page: 342 }, { image: "b", legende: "Couvercle de service" }, { image: "c", legende: "Vis de l'intercooler" }],
      items: [{ t: "Enlever le couvercle de service", figs: ["a", "b"], cotes: [], pages: [] },
              { t: "Enlever les vis de l'intercooler", figs: ["c", "x"], cotes: [], pages: [] },
              { t: "Boucher les tuyaux de boost", figs: [], cotes: [], pages: [] },
              { t: "Serrer les bougies", figs: [], cotes: ["G", "D"], pages: [] },
              "Rebrancher les bobines", "Remettre le couvercle"] },
    { id: "s2", court: "Photos", titre: "Étape sans cases", items: [], figures: [{ image: "a", legende: "Vue A" }, { image: "b", legende: "Vue B" }] },
    { id: "s3", court: "Longue", titre: "Liste de 40 lignes", items: lignes(40, "Ligne"), figures: [] },
    { id: "s4", court: "Fin", titre: "Essai final", items: ["Essai routier"], figures: [] },
  ] } };
const db = { procedures: [PROC], procedure_etat: [{ procedure_id: "P", cle: "c:s1-0", valeur: { done: true, at: new Date().toISOString(), par: "Gwendal" } }],
  tableau: [{ id: 1, donnees: [{ id: "bt-1", numeroBT: "BT-200", nom: "Maverick", statut: "reparation" }] }, { id: 4, donnees: EMP }],
  ecrans: [{ id: "lift", nom: "Lift 2 colonnes", mode: "procedure", procedure_id: "P", etape: 1, tech: "Gwendal" }] };
let pannes = {};
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
      data = [].concat(q.vals).map(v => cp(v));
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
const stockage = {};
const canaux = [];
const sb = {
  from: table,
  channel: (nom) => { const o = { nom, h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe(cb) { if (cb) setTimeout(() => cb("SUBSCRIBED"), 0); return o; } }; canaux.push(o); return o; },
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: { user: { email: "g.brossault@mtrperformance.local" } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }), signInWithPassword: async () => ({ data: {}, error: { message: "x" } }) },
  functions: { invoke: async () => ({ data: null, error: { message: "non" } }) },
  storage: { from: (b) => ({ createSignedUrl: async (c) => { const x = stockage[b + "/" + c]; return x ? { data: { signedUrl: URL.createObjectURL(x) }, error: null } : { data: null, error: { message: "Object not found" } }; } }) },
};
const pousser = (tableNom, ligne, ev) => canaux.forEach(c => c.h.filter(h => h.f.table === tableNom && (h.f.event === "*" || h.f.event === ev)).forEach(h => h.cb({ eventType: ev, new: cp(ligne), old: ev === "DELETE" ? cp(ligne) : null })));

const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const attendre = async (f, ms = 5000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await dodo(20); return f(); };
const ligneDb = (cle) => db.procedure_etat.find(r => r.procedure_id === "P" && r.cle === cle);

(async () => {
 // de vraies petites images pour les photos de la procédure
 const png = (couleur) => new Promise(r => { const c = document.createElement("canvas"); c.width = c.height = 8; const x = c.getContext("2d"); x.fillStyle = couleur; x.fillRect(0, 0, 8, 8); c.toBlob(r, "image/png"); });
 stockage["procedures/P/a.jpg"] = await png("#c00"); stockage["procedures/P/b.jpg"] = await png("#0c0"); stockage["procedures/P/c.jpg"] = await png("#00c");

 const dom = new JSDOM(htmlTv.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/tv.html?ecran=lift",
   beforeParse(t) { t.supabase = { createClient: () => sb }; t.__TV_ECRAN = "lift"; } });
 const t = dom.window; const erreurs = []; t.addEventListener("error", e => erreurs.push(e.message));
 const T = (s) => t.document.querySelector(s), TT = (s) => [...t.document.querySelectorAll(s)];
 const texte = () => (T("#ecran") ? T("#ecran").textContent : "").replace(/\s+/g, " ");
 const touche = (key, keyCode) => { const ev = new t.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }); Object.defineProperty(ev, "keyCode", { get: () => keyCode }); t.document.dispatchEvent(ev); };
 const ici = () => { const li = T("#cases li.ici"); return li ? parseInt(li.getAttribute("data-ligne"), 10) : -1; };
 const leg = () => (T(".figure .leg") || { textContent: "" }).textContent;
 const bulle = () => T("#bulle").textContent;
 const photo = () => T("#fig-img") && !T("#fig-img").hidden && /^blob:/.test(T("#fig-img").getAttribute("src") || "");
 try {
  await attendre(() => /Changement des bougies/.test(texte()), 6000);
  ok(/Changement des bougies/.test(texte()), "TV : l'étape en cours (bougies)");

  // ══════ 1. Là où on est rendu, et les figures de la ligne à droite ══════
  ok(ici() === 1, "en arrivant sur l'étape : la ligne en cours est la 1re pas cochée (la 1re a été cochée sur le cell)");
  const li1 = T('#cases li[data-ligne="1"]');
  ok(li1.classList.contains("ici") && /rgb\(245, 176, 42\)/.test(t.getComputedStyle(li1).boxShadow), "… encadrée en or");
  const fbs = TT("#cases .fb").map(b => b.closest("li").getAttribute("data-ligne") + ":" + b.textContent);
  ok(fbs.join(" | ") === "0:📷 2 fig. | 1:📷 Fig.", "badge à droite des lignes qui ont des figures : « 📷 2 fig. », « 📷 Fig. » (une photo absente ne compte pas) ; rien sur les autres");
  const r1 = li1.getBoundingClientRect(), rb = li1.querySelector(".fb").getBoundingClientRect(), rt = li1.querySelector(".t").getBoundingClientRect(), cs1 = t.getComputedStyle(li1);
  const bordDroit = r1.right - parseFloat(cs1.paddingRight) - parseFloat(cs1.borderRightWidth);
  ok(Math.abs(bordDroit - rb.right) < 2 && rb.left > rt.right + 20, "le badge est tassé à droite de la ligne, loin après le texte");
  await attendre(photo);
  ok(photo() && /📷 Vis de l'intercooler/.test(leg()) && !/\//.test(leg()) && li1.querySelector(".fb").classList.contains("vu"), "la ligne en cours ouvre SA figure à droite (« 📷 Vis de l'intercooler »), son badge s'allume");
  ok(/▲ ▼ ligne · OK cocher · ◀ ▶ étape/.test(T("#pied").textContent), "en bas : « ▲ ▼ ligne · OK cocher · ◀ ▶ étape »");

  // ══════ 2. ▲ ▼ : changer de ligne ; les figures suivent ══════
  touche("ArrowDown", 40); await dodo(30);
  ok(ici() === 2 && db.ecrans[0].etape === 1, "▼ : ligne suivante (l'étape ne change pas)");
  ok(/^Pièces à enlever pour l'accès · p\. 342 · 1 \/ 3 ⏯/.test(leg()), "ligne sans figure : les figures de l'étape (1 / 3 ⏯), comme avant");
  touche("ArrowUp", 38); touche("ArrowUp", 38); await dodo(30);
  ok(ici() === 0 && /📷 Pièces à enlever pour l'accès · p\. 342 · 1 \/ 2 ⏯/.test(leg()), "▲ ▲ : 1re ligne, ses 2 figures (1 / 2 ⏯)");
  ok(/⏯ figures/.test(T("#pied").textContent), "en bas : « · ⏯ figures » quand il y en a plusieurs");
  touche("MediaPlayPause", 179); await dodo(30);
  ok(/📷 Couvercle de service · 2 \/ 2 ⏯/.test(leg()) && /Figure 2 \/ 2/.test(bulle()), "⏯ : figure suivante de la ligne (Couvercle, 2 / 2)");
  await attendre(photo);
  ok(photo(), "… la photo suit");
  touche("MediaPlayPause", 179); await dodo(30);
  ok(/1 \/ 2/.test(leg()), "⏯ encore : on fait le tour (1 / 2)");
  touche("ArrowUp", 38); await dodo(20);
  ok(ici() === 0 && /Première ligne/.test(bulle()), "▲ sur la 1re ligne : « Première ligne », rien ne bouge");

  // ══════ 3. OK : cocher, partagé avec le cell ══════
  touche("Enter", 13); await dodo(40);
  ok(!ligneDb("c:s1-0") && /☐ Décochée/.test(bulle()) && ici() === 0, "OK sur une ligne cochée : décochée (sur le serveur aussi), on reste dessus");
  touche("Enter", 13); await dodo(40);
  const l0 = ligneDb("c:s1-0");
  ok(l0 && l0.valeur.done === true && l0.valeur.par === "Gwendal" && l0.par === "Gwendal" && l0.valeur.at, "OK : cochée, dans la même table que le cell (procedure_etat), par Gwendal");
  ok(ici() === 1 && /✔ Cochée/.test(bulle()), "… et on passe tout seul à la prochaine ligne pas cochée");
  ok(T('#cases li[data-ligne="0"]').classList.contains("fait") && /✔/.test(T('#cases li[data-ligne="0"] .c').textContent), "la ligne cochée est barrée ✔ à l'écran");
  touche("Enter", 23); await dodo(40);   // bouton du centre de la Fire TV (keyCode 23)
  ok(ligneDb("c:s1-1") && ici() === 2, "bouton du centre (Fire TV) : même chose");
  touche("Enter", 13); await dodo(40);
  ok(ici() === 3, "ligne 3 (côtés G / D)");
  touche("Enter", 13); await dodo(40);
  ok(ligneDb("c:s1-3-G") && !ligneDb("c:s1-3-D") && ici() === 3 && /✔ G · OK pour D/.test(bulle()), "ligne par côté : un côté à chaque OK (« ✔ G · OK pour D »), on reste sur la ligne");
  touche("Enter", 13); await dodo(40);
  ok(ligneDb("c:s1-3-D") && ici() === 4, "… D : la ligne est faite, on passe à la suivante");

  // Coché ailleurs (cell) : la TV le montre, et OK saute les lignes déjà faites
  const cell = { procedure_id: "P", cle: "c:s1-5", valeur: { done: true, at: new Date().toISOString(), par: "Jason" } };
  db.procedure_etat.push(cell); pousser("procedure_etat", cell, "INSERT"); await dodo(30);
  ok(T('#cases li[data-ligne="5"]').classList.contains("fait"), "coché sur le cell : la TV le montre en 1 à 2 secondes");
  touche("Enter", 13); await dodo(40);
  ok(ligneDb("c:s1-4") && /✅ Étape terminée · ▶ étape suivante/.test(bulle()), "dernière case : « ✅ Étape terminée · ▶ étape suivante »");
  touche("ArrowDown", 40); await dodo(20);
  touche("ArrowDown", 40); await dodo(20);
  ok(ici() === 5 && /Dernière ligne/.test(bulle()), "▼ sur la dernière ligne : « Dernière ligne · ▶ étape suivante »");
  ok(TT(".pied .pts i")[1].classList.contains("ici"), "(barre des étapes : l'étape en cours marquée)");

  // Coché dans le désordre : OK ramène à ce qui reste plus haut
  touche("ArrowUp", 38); touche("ArrowUp", 38); touche("ArrowUp", 38); await dodo(20);
  touche("Enter", 13); await dodo(40);   // décoche la ligne 2
  ok(!ligneDb("c:s1-2") && ici() === 2, "(ligne 2 décochée)");
  touche("ArrowDown", 40); touche("ArrowDown", 40); touche("ArrowDown", 40); await dodo(20);
  touche("Enter", 13); await dodo(40);   // décoche puis recoche la 5
  touche("Enter", 13); await dodo(40);
  ok(ici() === 2 && /il en reste plus haut/.test(bulle()), "une ligne sautée plus haut : OK y ramène (« il en reste plus haut »)");

  // Réseau coupé : la coche est refusée à l'écran aussi
  pannes["procedure_etat:upsert"] = "réseau";
  touche("Enter", 13); await dodo(60);
  ok(!ligneDb("c:s1-2") && !T('#cases li[data-ligne="2"]').classList.contains("fait") && /Pas enregistré/.test(bulle()), "écriture refusée (réseau) : la case redevient vide et la TV le dit (« Pas enregistré »)");
  delete pannes["procedure_etat:upsert"];

  // ══════ 4. Au pointeur ou au doigt ══════
  T('#cases li[data-ligne="2"] .t').click(); await dodo(40);
  ok(ligneDb("c:s1-2") && T('#cases li[data-ligne="2"]').classList.contains("fait"), "toucher une ligne : elle est cochée");
  T('#cases li[data-ligne="0"] .fb').click(); await dodo(30);
  ok(ici() === 0 && ligneDb("c:s1-0") && /📷 Pièces à enlever/.test(leg()), "toucher le badge 📷 d'une ligne : ses figures s'ouvrent (sans rien cocher ni décocher)");
  T('#cases li[data-ligne="0"] .fb').click(); await dodo(30);
  ok(/2 \/ 2/.test(leg()), "… le toucher encore : figure suivante");

  // ══════ 5. ◀ ▶ : les étapes, comme avant ══════
  touche("ArrowRight", 39); await attendre(() => /Étape sans cases/.test(texte()));
  ok(db.ecrans[0].etape === 2 && db.ecrans[0].maj_par === "télécommande", "▶ : étape suivante (le cell suit)");
  ok(!T("#cases") && /1 \/ 2 ▲▼/.test(leg()) && /◀ ▶ télécommande ou cell · ▲ ▼ figures/.test(T("#pied").textContent), "étape sans cases : comme avant (▲ ▼ figures)");
  touche("ArrowDown", 40); await dodo(30);
  ok(/Vue B · 2 \/ 2/.test(leg()) && db.ecrans[0].etape === 2, "… ▼ : figure suivante");
  touche("Enter", 13); await attendre(() => /Liste de 40 lignes/.test(texte()));
  ok(db.ecrans[0].etape === 3, "… et le bouton du centre fait avancer, comme avant");

  // ══════ 6. Une longue liste défile pour suivre la ligne en cours ══════
  const ul = T("#cases");
  ok(ul.scrollHeight > ul.clientHeight + 2 && ici() === 0, "40 lignes : elles ne tiennent pas toutes (le texte a déjà rapetissé au plus)");
  ok(/▼ \d+ plus bas/.test(T("#plus").textContent) && !T("#plus").hidden, "en bas : « ▼ N plus bas »");
  for (let i = 0; i < 39; i++) touche("ArrowDown", 40);
  await dodo(60);
  const li39 = T('#cases li[data-ligne="39"]'), ul2 = T("#cases");
  ok(ici() === 39 && li39.offsetTop >= ul2.scrollTop && li39.offsetTop + li39.offsetHeight <= ul2.scrollTop + ul2.clientHeight + 1, "▼ jusqu'à la 40e ligne : la liste défile, la ligne en cours reste à l'écran");
  ok(/▲ \d+ plus haut/.test(T("#plus").textContent) && !/plus bas/.test(T("#plus").textContent), "… « ▲ N plus haut »");
  for (let i = 0; i < 37; i++) touche("ArrowUp", 38);
  await dodo(60);
  const li2 = T('#cases li[data-ligne="2"]'), ul3 = T("#cases");
  ok(ici() === 2 && li2.offsetTop >= ul3.scrollTop && li2.offsetTop + li2.offsetHeight <= ul3.scrollTop + ul3.clientHeight + 1, "▲ jusqu'à la 3e ligne : la liste remonte avec elle");
  ok(/▲ [12] plus haut/.test(T("#plus").textContent) && /▼ \d+ plus bas/.test(T("#plus").textContent), "… une ligne d'avance visible au-dessus (« ▲ 1 plus haut · ▼ N plus bas »)");
  ok(t.getComputedStyle(T(".proc h1")).display !== "none" && T(".proc h1").getBoundingClientRect().top >= T("#corps").getBoundingClientRect().top - 1, "le titre de l'étape reste en haut (seule la liste défile)");

  // ══════ 7. Changement d'étape par le cell : on repart de la 1re ligne pas cochée ══════
  const d3 = ligneDb("c:s1-3-D"); db.procedure_etat = db.procedure_etat.filter(r => r !== d3); pousser("procedure_etat", d3, "DELETE"); await dodo(20);   // décoché sur le cell
  db.ecrans[0].etape = 1; pousser("ecrans", db.ecrans[0], "UPDATE"); await attendre(() => /Changement des bougies/.test(texte()));
  ok(/Changement des bougies/.test(texte()) && ici() === 3, "retour aux bougies (envoyé du cell) : la ligne en cours est la 1re pas finie (côté D décoché sur le cell)");
  ok(/<i class="ok">G<\/i><i class="">D<\/i>/.test(T('#cases li[data-ligne="3"]').innerHTML), "… G coché, D pas coché");
 } catch (err) { ok(false, "exception (TV) : " + (err && err.stack || err)); }
 ok(erreurs.length === 0, "TV : aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
