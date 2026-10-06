// v166 — ⏰ Rappels clients (« rappeler tel client pour telle job, dans tant de temps ») + bandeau « 📞 Communications »
//        au tableau de bord (appels manqués, textos à traiter, rappels du jour) + délai au choix dans la note d'appel.
// NODE_PATH=… node test-v166.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

// Supabase bouchonné, avec de vraies tables en mémoire (select / update / insert / delete filtrés par eq / neq / in)
const donnees = { communications: [], telephonie_config: [], tableau: [] };
const appels = [];
let prochainId = 1000;
const table = (nom) => {
  const q = { op: "select", vals: null, filtres: [], un: false };
  const exec = () => {
    const rows = (donnees[nom] = donnees[nom] || []);
    const garde = r => q.filtres.every(f => f(r));
    let data = null;
    if (q.op === "select") data = rows.filter(garde);
    else if (q.op === "update") { data = rows.filter(garde); data.forEach(r => Object.assign(r, JSON.parse(JSON.stringify(q.vals)))); }
    else if (q.op === "insert" || q.op === "upsert") { data = [].concat(q.vals).map(v => Object.assign({ id: prochainId++, cree_le: new Date().toISOString() }, JSON.parse(JSON.stringify(v)))); if (nom !== "tableau") rows.push(...data); }
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
    return () => ch;   // select, order, limit…
  } });
  return ch;
};
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
const effacerToasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).forEach(x => x.remove());
const bandeau = () => ($("#cm-bandeau") || { textContent: "" }).textContent;
const MIN = 60000, ilya = (min) => new Date(Date.now() - min * MIN).toISOString(), dans = (min) => new Date(Date.now() + min * MIN).toISOString();
const ecartMin = (iso, min) => Math.abs(new Date(iso).getTime() - (Date.now() + min * MIN)) / MIN;   // écart à « maintenant + min », en minutes
const ligne = (id) => donnees.communications.find(c => c.id === id);
const changer = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true, compteAuth: true },
                       { nom: "Gwendal", role: "technicien", actif: true, compteAuth: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  $("#ecran-connexion") && $("#ecran-connexion").classList.remove("ouvert");
  w.localStorage.removeItem("mtr_rappels_avises");
  w.__set("clients", [{ id: "cl-1", nom: "Marc Tremblay", tel: "819-555-1234", courriel: "", machines: [{ id: "mc-1", nom: "2019 Ski-Doo Renegade 850" }] }]);
  w.__set("machines", [{ id: "bt-112", numeroBT: "BT-112", nom: "2021 Can-Am Outlander 650", client: "Marc Tremblay", clientId: "cl-1", tel: "819-555-1234", statut: "reparation", machineArrivee: true }]);
  donnees.communications.push(
    { id: 1, tel: "4185550000", canal: "appel_manque", direction: "in", contenu: "Appel manqué", statut: "a_traiter", cree_le: ilya(30) },
    { id: 2, tel: "4185551111", canal: "sms_in", direction: "in", contenu: "Est-ce que ma motoneige est prête?", statut: "a_traiter", cree_le: ilya(25) },
    { id: 3, tel: "8195551234", client_id: "cl-1", client_nom: "Marc Tremblay", canal: "note", direction: "interne", statut: "rappel", rappel_le: ilya(20), cree_le: ilya(200),
      contenu: "⏰ Rappeler — 2021 Can-Am Outlander 650 · BT-112 — courroie arrivée", meta: { origine: "rappel", machine: "2021 Can-Am Outlander 650 · BT-112", machine_id: "bt-112", note: "courroie arrivée" } },
    { id: 4, tel: "4185552222", client_nom: "Julie Bouchard", canal: "note", direction: "interne", statut: "rappel", rappel_le: dans(1), cree_le: ilya(90), contenu: "Statut machine — Renegade — la rappeler", meta: { origine: "manuel" } },
    { id: 5, tel: "4185553333", client_nom: "Luc Bergeron", canal: "note", direction: "interne", statut: "rappel", rappel_le: dans(3 * 1440), cree_le: ilya(60), contenu: "Soumission RZR", meta: { origine: "manuel" } },
    { id: 6, tel: "4185554444", client_nom: "Déjà réglé", canal: "note", direction: "interne", statut: "traite", cree_le: ilya(10), contenu: "rien" },
    { id: 7, tel: "4185556666", client_nom: "Sophie Lavoie", canal: "note", direction: "interne", statut: "rappel", rappel_le: ilya(40), cree_le: ilya(80), contenu: "Hivernisation Spark", meta: { origine: "manuel" } });

  // ── 1. Bandeau « 📞 Communications » au tableau de bord ──
  await dodo(800);   // le module fait son premier chargement tout seul (et peut déjà aviser) : on repart à zéro après
  w.localStorage.removeItem("mtr_rappels_avises");
  await w.__comm.charger(); w.__comm.majBadge(); w.afficher();
  ok($("#cm-bandeau").style.display !== "none", "tableau de bord : bandeau « 📞 Communications » affiché");
  const tb = bandeau();
  ok(/📵 1 appel manqué/.test(tb) && /💬 1 texto reçu/.test(tb), "il compte ce qui attend : « 📵 1 appel manqué », « 💬 1 texto reçu »");
  ok(/⏰ 2 rappels à faire/.test(tb) && /⏰ 1 plus tard/.test(tb), "rappels : « ⏰ 2 rappels à faire », « ⏰ 1 plus tard » (dans 3 jours)");
  const lignes = $$("#cm-bandeau .cm-rappel");
  ok(lignes.map(l => l.dataset.id).join() === "7,3,4", "lignes : en retard d'abord (le plus ancien en premier), puis ce qui vient plus tard aujourd'hui (" + lignes.map(l => l.dataset.id).join() + ")");
  ok(lignes[1].classList.contains("du") && /Rappeler Marc Tremblay/.test(lignes[1].textContent) && /Outlander 650 · BT-112 — courroie arrivée/.test(lignes[1].textContent) && /en retard de 20 min/.test(lignes[1].textContent),
     "rappel en retard : « Rappeler Marc Tremblay · …BT-112 — courroie arrivée », « en retard de 20 min »");
  const lienTel = lignes[1].querySelector('a[href^="tel:"]');
  ok(lienTel && lienTel.getAttribute("href") === "tel:+18195551234" && /819-555-1234/.test(lienTel.textContent), "bouton 📞 819-555-1234 (appelle le client)");
  ok(lignes[2].classList.contains("plus-tard") && !lignes[2].querySelector("[data-plus]") && !!lignes[2].querySelector("[data-fait]"), "rappel plus tard aujourd'hui : en gris, « ✓ Fait » seulement");
  ok(!!$("#cm-nouveau") && /➕ Rappel/.test($("#cm-nouveau").textContent), "bouton « ➕ Rappel » toujours présent");

  // ── 2. Notification à l'échéance : une seule fois par rappel ──
  effacerToasts();
  const n1 = w.__comm.verifierRappels();
  ok(n1 === 2 && toasts().some(t => /⏰ 2 rappels à faire : Marc Tremblay, Sophie Lavoie/.test(t)), "à l'échéance : « ⏰ 2 rappels à faire : Marc Tremblay, Sophie Lavoie »");
  ok(w.__comm.verifierRappels() === 0, "pas deux fois pour le même rappel");
  ligne(4).rappel_le = ilya(0.2);
  effacerToasts();
  ok(w.__comm.verifierRappels() === 1 && toasts().some(t => /⏰ Rappeler Julie Bouchard — Statut machine/.test(t)), "un seul rappel arrivé : « ⏰ Rappeler Julie Bouchard — … »");

  // ── 3. Actions du bandeau ──
  $('#cm-bandeau [data-plus="3"]').click(); await dodo(60);
  ok(ligne(3).statut === "rappel" && ecartMin(ligne(3).rappel_le, 60) < 1, "« +1 h » : reporté d'une heure");
  $('#cm-bandeau [data-demain="7"]').click(); await dodo(60);
  const d7 = new Date(ligne(7).rappel_le);
  ok(d7.getHours() === 9 && d7.getMinutes() === 0 && d7 > new Date() && d7.getDay() !== 0 && d7.getDay() !== 6, "« Demain » : prochain jour ouvrable à 9 h 00");
  const jo = (n, a, m, j, h) => { const d = w.__comm.joursOuvrablesPlus(n, new Date(a, m - 1, j, h)); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + " " + d.getHours() + "h"; };
  ok(jo(1, 2026, 10, 2, 15) === "2026-10-5 9h" && jo(2, 2026, 10, 2, 15) === "2026-10-6 9h" && jo(1, 2026, 10, 3, 11) === "2026-10-5 9h" && jo(1, 2026, 9, 29, 16) === "2026-9-30 9h",
     "jours ouvrables : vendredi + 1 → lundi 9 h, vendredi + 2 → mardi, samedi + 1 → lundi, mardi + 1 → mercredi");
  $('#cm-bandeau [data-fait="4"]').click(); await dodo(60);
  ok(ligne(4).statut === "traite" && ligne(4).traite_par === "Jason" && !$('#cm-bandeau .cm-rappel[data-id="4"]'), "« ✓ Fait » : réglé (par Jason), disparaît du bandeau");
  ok(toasts().some(t => /Rappel fait — Julie Bouchard/.test(t)), "toast « ✓ Rappel fait — Julie Bouchard »");

  // ── 4. ➕ Rappel : client du carnet, job, pourquoi, dans 2 h ──
  $("#cm-nouveau").click(); await dodo(10);
  ok($("#comm-voile2").classList.contains("ouvert") && /Rappel client/.test($("#comm-boite2").textContent), "« ➕ Rappel » ouvre « ⏰ Rappel client »");
  ok([...$("#rp-clients").options].some(o => o.value === "Marc Tremblay — 819-555-1234"), "le carnet est proposé (« Marc Tremblay — 819-555-1234 »)");
  changer($("#rp-client"), "Marc Tremblay — 819-555-1234"); await dodo(10);
  ok($("#rp-tel").value === "819-555-1234" && $("#rp-client").value === "Marc Tremblay", "choisir le client remplit son numéro");
  const jobs = $$("#comm-boite2 [data-job]").map(b => b.dataset.job);
  ok(jobs.join(" | ") === "2021 Can-Am Outlander 650 · BT-112 | 2019 Ski-Doo Renegade 850", "ses jobs : le bon à l'atelier (BT-112), puis la machine du carnet");
  $('#comm-boite2 [data-job="2021 Can-Am Outlander 650 · BT-112"]').click(); await dodo(5);
  $("#rp-note").value = "lui dire que la courroie est posée";
  $('#comm-boite2 [data-q="2h"]').click(); await dodo(5);
  ok(/⏰ Rappel (aujourd'hui|demain) à \d\d:\d\d/.test($("#rp-cible").textContent), "l'heure du rappel s'affiche (« ⏰ Rappel aujourd'hui à … »)");
  effacerToasts();
  $("#rp-ok").click(); await dodo(80);
  const neuf = donnees.communications.find(c => c.id >= 1000);
  ok(neuf && neuf.statut === "rappel" && neuf.canal === "note" && ecartMin(neuf.rappel_le, 120) < 1, "enregistré : une ligne « rappel » dans 📞 Communications, pour dans 2 h");
  ok(neuf.tel === "8195551234" && neuf.client_id === "cl-1" && neuf.client_nom === "Marc Tremblay" && neuf.par === "Jason", "… au bon numéro, rattachée au client du carnet, par Jason");
  ok(neuf.meta.origine === "rappel" && neuf.meta.machine === "2021 Can-Am Outlander 650 · BT-112" && neuf.meta.machine_id === "bt-112" && neuf.meta.note === "lui dire que la courroie est posée"
     && neuf.contenu === "⏰ Rappeler — 2021 Can-Am Outlander 650 · BT-112 — lui dire que la courroie est posée", "… avec la job et le pourquoi");
  ok(!$("#comm-voile2").classList.contains("ouvert") && toasts().some(t => /⏰ Rappel (aujourd'hui|demain) à \d\d:\d\d : Marc Tremblay/.test(t)), "fenêtre fermée, toast « ⏰ Rappel aujourd'hui à … : Marc Tremblay »");

  // ── 5. ⏰ sur la carte de la machine : tout est prérempli ; date précise ──
  w.afficher();
  const bCarte = $$("#colonnes button").find(b => /commRappelNouveau\(\{ machineId: 'bt-112' \}\)/.test(b.getAttribute("onclick") || ""));
  ok(!!bCarte && bCarte.textContent === "⏰", "carte de la machine : bouton ⏰");
  bCarte.click(); await dodo(10);
  ok($("#rp-client").value === "Marc Tremblay" && $("#rp-tel").value === "819-555-1234" && $("#rp-job").value === "2021 Can-Am Outlander 650 · BT-112", "⏰ de la carte : client, numéro et job déjà remplis");
  $('#comm-boite2 [data-q="date"]').click(); await dodo(5);
  ok(!!$("#rp-date") && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test($("#rp-date").value), "« 📅 Date et heure… » : champ date + heure prérempli");
  const hier = new Date(Date.now() - 86400000), pad = (x) => String(x).padStart(2, "0");
  $("#rp-date").value = `${hier.getFullYear()}-${pad(hier.getMonth() + 1)}-${pad(hier.getDate())}T10:00`; alertes.length = 0;
  let n0 = donnees.communications.length;
  $("#rp-ok").click(); await dodo(40);
  ok(alertes.some(a => /déjà passée/.test(a)) && donnees.communications.length === n0, "date passée : refusée");
  const jeudi = new Date(Date.now() + 3 * 86400000);
  const jeudiTxt = `${jeudi.getFullYear()}-${pad(jeudi.getMonth() + 1)}-${pad(jeudi.getDate())}T14:30`;
  $("#rp-date").value = jeudiTxt; $("#rp-ok").click(); await dodo(80);
  const r2 = donnees.communications[donnees.communications.length - 1];
  ok(donnees.communications.length === n0 + 1 && new Date(r2.rappel_le).getTime() === new Date(jeudiTxt).getTime() && r2.meta.machine_id === "bt-112", "date précise : enregistrée à 14:30 dans 3 jours");

  // ── 6. Client pas au carnet ; numéro obligatoire ──
  w.commRappelNouveau({}); await dodo(5);
  alertes.length = 0; n0 = donnees.communications.length;
  $("#rp-ok").click(); await dodo(30);
  ok(alertes.some(a => /Il faut le numéro à rappeler/.test(a)) && donnees.communications.length === n0, "sans numéro : refusé");
  changer($("#rp-client"), "Jean Nouveau"); await dodo(5);
  changer($("#rp-tel"), "418 555 9999"); await dodo(5);
  $("#rp-note").value = "soumission remorque";
  $('#comm-boite2 [data-q="demain"]').click(); await dodo(5);
  $("#rp-ok").click(); await dodo(80);
  const r3 = donnees.communications[donnees.communications.length - 1];
  ok(r3.tel === "4185559999" && r3.client_nom === "Jean Nouveau" && !r3.client_id && new Date(r3.rappel_le).getHours() === 9, "client hors carnet : son nom et son numéro sont gardés ; « Demain matin » = 9 h");

  // ── 7. Modifier / supprimer un rappel ──
  ligne(3).rappel_le = ilya(3);   // de nouveau en retard
  w.__comm.majBadge();
  $('#cm-bandeau [data-voir="3"]').click(); await dodo(10);
  ok(/Modifier le rappel/.test($("#comm-boite2").textContent) && $("#rp-note").value === "courroie arrivée" && $("#rp-job").value === "2021 Can-Am Outlander 650 · BT-112" && !!$("#rp-date"),
     "clic sur un rappel : « Modifier le rappel », prérempli (job, pourquoi, date)");
  n0 = donnees.communications.length;
  $("#rp-note").value = "courroie posée, prête vendredi"; $('#comm-boite2 [data-q="1h"]').click(); await dodo(5); $("#rp-ok").click(); await dodo(80);
  ok(donnees.communications.length === n0 && ligne(3).meta.note === "courroie posée, prête vendredi" && ecartMin(ligne(3).rappel_le, 60) < 1, "enregistrer : la même ligne est modifiée (pas de doublon)");
  w.__comm.rappelModifier(ligne(3)); await dodo(5);
  $("#rp-suppr").click(); await dodo(60);
  ok(!ligne(3), "Supprimer : le rappel est effacé");
  ligne(7).rappel_le = ilya(2); w.__comm.majBadge();
  $('#cm-bandeau [data-voir="7"]').click(); await dodo(10);   // pas créé par ⏰ (note d'appel) : ouvre le fil
  ok($("#comm-voile").classList.contains("ouvert") && /Sophie Lavoie/.test($("#comm-fil").textContent), "clic sur un rappel venu d'une note d'appel : ouvre le fil du client");
  $("#comm-voile").classList.remove("ouvert");

  // ── 8. Note d'appel : « Garder en rappel » + dans combien de temps ──
  await w.commNoteAppel("4185557777", { manuel: true }); await dodo(10);
  ok(!!$("#cn-quand") && [...$("#cn-quand").options].map(o => o.value).join() === "30m,1h,2h,demain,2j,1s", "note d'appel : choix « dans 30 min … dans 1 semaine » à côté de « Garder en rappel »");
  changer($("#cn-quand"), "30m"); await dodo(5);
  ok($("#cn-rappel").checked, "choisir un délai coche « Garder en rappel »");
  $("#cn-texte").value = "rappeler pour le prix du pneu";
  $("#cn-ok").click(); await dodo(120);
  const nt = donnees.communications.filter(c => c.tel === "4185557777").pop();
  ok(nt && nt.statut === "rappel" && ecartMin(nt.rappel_le, 30) < 1, "note gardée en rappel pour dans 30 min (avant : toujours demain 9 h)");

  // ── 9. Dans 📞 Communications ──
  await w.ouvrirCommunications(); await dodo(20);
  ok(!!$("#comm-nouveau-rappel"), "📞 Communications : bouton « ⏰ Rappel » en haut");
  await w.ouvrirCommunications("8195551234"); await dodo(20);
  ok(!!$('#comm-fil [data-x="rappel"]'), "fil du client : bouton « ⏰ Rappel »");
  const evs = $$("#comm-fil .comm-ev .meta button").map(b => b.textContent);
  ok(evs.includes("✎ Modifier le rappel") && !evs.includes("✎ Note"), "dans le fil, un rappel se modifie avec « ✎ Modifier le rappel » (pas l'éditeur de note)");
  $('#comm-fil [data-x="rappel"]').click(); await dodo(10);
  ok($("#rp-tel").value === "819-555-1234" && $("#rp-client").value === "Marc Tremblay", "⏰ du fil : client et numéro remplis");
  $("#rp-annuler").click(); $("#comm-voile").classList.remove("ouvert");

  // ── 10. Réglages et droits ──
  const pr = w.tbPrefs(); pr.blocs.comm = false; w.__get("EMPLOYES")[0].tableau = pr; w.afficher();
  ok($("#cm-bandeau").style.display === "none", "le bandeau se masque dans ⚙️ Mon tableau de bord → « Sur le tableau »");
  delete w.__get("EMPLOYES")[0].tableau;
  w.__set("sessionCourante", { nom: "Gwendal", quand: new Date().toISOString() });
  w.afficher(); w.__comm.majBadge();
  ok($("#cm-bandeau").style.display === "none" && !$$("#colonnes button").some(b => /commRappelNouveau/.test(b.getAttribute("onclick") || "")), "technicien sans « Communications » : ni bandeau, ni ⏰ sur les cartes");
  effacerToasts(); w.commRappelNouveau({ machineId: "bt-112" }); await dodo(5);
  ok(!$("#comm-voile2").classList.contains("ouvert") && toasts().some(t => /Communications n'est pas ouverte pour toi/.test(t)), "… et le rappel lui est refusé");
  ok(w.__comm.verifierRappels() === 0, "… et il ne reçoit pas les notifications de rappel");
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });

  // ── 11. Nom échappé ──
  donnees.communications.push({ id: 50, tel: "4185558888", client_nom: "<img src=x onerror=alert(1)>", canal: "note", direction: "interne", statut: "rappel", rappel_le: ilya(1), contenu: "<b>gras</b>", meta: { origine: "manuel" } });
  await w.__comm.charger(); w.__comm.majBadge();
  ok(!$("#cm-bandeau img") && !$("#cm-bandeau .cm-rappel b b") && /<img src=x/.test(bandeau()), "nom et texte affichés comme texte (aucun HTML injecté)");
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
