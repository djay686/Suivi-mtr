// v172 — Pièces commandées : à part dans les prévisions (plus de manque ni de « retard » tant que le délai n'est pas
//   dépassé), choix de nos fournisseurs en commandant, délais de commande (par défaut 72 h + par fournisseur, jours
//   ouvrables), rappel ⏰ au tableau de bord + notification quand le délai est dépassé, 📞 Relancé, ✓ Reçue.
// NODE_PATH=… node test-v172.js ./index.html
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
const canaux = [];
const sbStub = { from: table, channel: (nom) => { const o = { nom, h: [], on(t, f, cb) { o.h.push({ f, cb }); return o; }, subscribe() { return o; } }; canaux.push(o); return o; }, removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: { access_token: "ok" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }) },
  functions: { invoke: async () => ({ data: null, error: null }) } };
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) { w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => { throw new Error("prompt() ne doit plus servir"); }; w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" }); } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
const txt = (el) => (el ? el.textContent : "").replace(/\s+/g, " ");
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const pad = (n) => String(n).padStart(2, "0");
const jourIso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
const ilYa = (jours) => new Date(Date.now() - jours * 86400000).toISOString();
const hm = (d) => pad(d.getHours()) + ":" + pad(d.getMinutes());
const ecritLigne = (id) => ecrits.filter(e => e.id === id).at(-1);

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true }, { nom: "Gwendal", role: "technicien", actif: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.__set("catalPieces", [{ num: "X9", desc: "Bougie NGK", suivi: true, qte: 0, four: "fo-amsoil", cout: 5, prix: 12 }]);
  w.__set("invData", { four: [
      { id: "fo-napa", nom: "Napa", delai: 0 },
      { id: "fo-amsoil", nom: "Amsoil", delai: 2 },                       // vieille fiche : 2 jours
      { id: "fo-x", nom: "<b>Pirate</b>", delai: 0 } ],
    po: [], cpt: 0, reglages: {} });
  const M1 = { id: "m1", numeroBT: "BT-120", nom: "Outlander 650", client: "Client A", statut: "attente", echeance: jourIso(-3), heure: "09:00",
    pieces: [{ num: "X9", nom: "Bougie NGK", qte: "1", coche: false }, { num: "", nom: "Joint spécial", qte: "2", coche: false }] };
  const M2 = { id: "m2", numeroBT: "BT-121", nom: "Spark", client: "Client B", statut: "attente", echeance: jourIso(-2), pieces: [{ num: "", nom: "Pompe à eau", qte: "1", coche: false }] };
  w.__set("machines", [M1, M2]);
  w.__set("commandes", [
    { id: "cmd-1", machineId: "m1", numeroBT: "BT-120", technicien: "Gwendal", creeLe: ilYa(1), pieces: [
      { qte: "1", num: "X9", description: "Bougie NGK", commande: false, dateCommande: null, fournisseur: "", recu: false, dateRecue: null },
      { qte: "2", num: "", description: "Joint spécial", commande: false, dateCommande: null, fournisseur: "", recu: false, dateRecue: null } ] },
    { id: "cmd-2", machineId: "m2", numeroBT: "BT-121", technicien: "Gwendal", creeLe: ilYa(1), pieces: [
      { qte: "1", num: "", description: "Pompe à eau", commande: false, dateCommande: null, fournisseur: "", recu: false, dateRecue: null } ] } ]);
  w.afficher(); w.majBoutonCommandes();
  try { w.ecouterTempsReel(); } catch (_) {}

  // ══════ 1. Délais : 72 h par défaut, fiche du fournisseur, jours ouvrables ══════
  ok(w.cmdDelaiDefautH() === 72 && w.cmdDelaiFourH(null) === 72 && w.cmdDelaiFourH(w.invFour("fo-napa")) === 72, "délai par défaut : 72 h (fournisseur sans délai → défaut)");
  ok(w.cmdDelaiFourH(w.invFour("fo-amsoil")) === 48, "vieille fiche « 2 jours » → 48 h");
  const r1 = w.cmdPlusHeuresOuvrables(new Date(2026, 9, 2, 15, 0), 72);   // vendredi 2 oct. 15 h
  ok(r1.getDay() === 3 && r1.getDate() === 7 && hm(r1) === "15:00", "vendredi 15 h + 72 h = mercredi 15 h (fin de semaine non comptée)");
  const r2 = w.cmdPlusHeuresOuvrables(new Date(2026, 9, 3, 10, 0), 24);   // samedi
  ok(r2.getDate() === 6 && hm(r2) === "10:00", "commandée un samedi : le compte part lundi (+ 24 h = mardi)");
  if (w.estFerie("2026-10-12")) {
    const r3 = w.cmdPlusHeuresOuvrables(new Date(2026, 9, 9, 15, 0), 24);
    ok(r3.getDate() === 13, "jour férié (Action de grâce) non compté : vendredi + 24 h = mardi");
  }
  ok(w.cmdFourDe({ fournisseur: "napa" }).id === "fo-napa" && w.cmdFourDe({ fournisseur: " NAPA " }).id === "fo-napa" && !w.cmdFourDe({ fournisseur: "nc" }), "pièce commandée avant (texte « napa ») → reconnue comme Napa ; « nc » inconnu → délai par défaut");

  // ══════ 2. Avant : la pièce du bon compte comme un manque « en retard » ══════
  const b0 = w.invBesoins();
  ok(b0["X9"] && /BT-120 \(en retard\)/.test(b0["X9"].sources.join()) && w.prevArticlesEnManque().some(x => x.num === "X9"), "avant la commande : la bougie du BT-120 est un manque « en retard » et fait sonner 🔮 Prévisions");

  // ══════ 3. Commander : choix de nos fournisseurs (plus de prompt) ══════
  w.ouvrirCommandes(); await dodo(20);
  let cases = $$("#commandes-liste .cmd-piece input[type=checkbox]");
  cases[0].checked = true; cases[0].dispatchEvent(new w.Event("change", { bubbles: true })); await dodo(20);
  const v = () => $("#voile-cmd-four");
  ok(v() && v().classList.contains("ouvert") && /BT-120/.test(txt(v())) && /Bougie NGK/.test(txt(v())), "« commandée » : une fenêtre s'ouvre (plus de question tapée au clavier)");
  const fours = $$("#voile-cmd-four [data-four]").map(b => txt(b));
  ok(fours.some(t => /^Amsoil/.test(t)) && fours.some(t => /^Napa/.test(t)) && fours.at(-1) === "Autre…", "nos fournisseurs en boutons (Amsoil, Napa…) + « Autre… »");
  ok($("#voile-cmd-four [data-four='fo-amsoil']").classList.contains("on"), "choisi d'office : le fournisseur de l'article au catalogue (Amsoil)");
  ok(/Délai normal : 48 h \(2 jours ouvrables\) \(Amsoil\)/.test(txt($(".cmdf-delai"))) && /arrivée prévue/.test(txt($(".cmdf-delai"))), "délai d'Amsoil (48 h) et arrivée prévue affichés");
  ok(!$$("#voile-cmd-four [data-four]").some(b => b.querySelector("b")) && fours.some(t => /<b>Pirate<\/b>/.test(t)), "nom de fournisseur affiché comme texte (aucun HTML injecté)");
  ok($("#cmdf-tous") && $("#cmdf-tous").checked && /autre pièce à commander de BT-120/.test(txt(v())), "« l'autre pièce de BT-120 aussi, chez le même fournisseur » (cochée d'office)");
  $("#voile-cmd-four [data-four='fo-napa']").click(); await dodo(10);
  ok($("#voile-cmd-four [data-four='fo-napa']").classList.contains("on") && /72 h \(3 jours ouvrables\) \(par défaut\)/.test(txt($(".cmdf-delai"))), "Napa choisi : délai par défaut (72 h)");
  $("#voile-cmd-four [data-four='fo-amsoil']").click(); await dodo(10);
  $("#cmdf-ok").click(); await dodo(40);
  const c1 = w.__get("commandes")[0];
  ok(c1.pieces.every(p => p.commande && p.fournisseurId === "fo-amsoil" && p.fournisseur === "Amsoil" && p.dateCommande && !p.attenduLe), "les 2 pièces du BT-120 : commandées chez Amsoil (arrivée calculée avec le délai)");
  ok(!v().classList.contains("ouvert") && toasts().some(t => /2 pièces commandées chez Amsoil — arrivée prévue/.test(t)), "toast « 🛒 2 pièces commandées chez Amsoil — arrivée prévue … »");
  ok(ecritLigne(5) && ecritLigne(5).donnees[0].pieces[0].fournisseurId === "fo-amsoil", "enregistré au serveur (commandes)");
  w.cmdOnglet("reception"); await dodo(10);
  ok(/Arrivée prévue/.test(txt($("#commandes-liste"))) && /chez Amsoil/.test(txt($("#commandes-liste"))), "onglet Réception : « Commandée le … chez Amsoil · 📅 Arrivée prévue … »");

  // ══════ 4. Après : plus de manque, plus d'alarme — à part dans « Pièces commandées » ══════
  const b1 = w.invBesoins();
  ok(!b1["X9"] && !Object.values(b1).some(e => /Joint spécial/.test(e.desc)), "commandées : ni la bougie ni le joint ne comptent comme un manque");
  ok(!w.prevArticlesEnManque().some(x => x.num === "X9"), "🔮 Prévisions ne sonne plus pour la bougie (en route)");
  w.ouvrirInventaire(); w.invOnglet("previsions"); await dodo(20);
  const er = txt($("#inv-prev-enroute"));
  ok(/📦 Pièces commandées — en route \(2\)/.test(er) && /toutes à temps/.test(er) && /Bougie NGK/.test(er) && /Amsoil/.test(er) && /BT-120/.test(er), "Prévisions : section à part « 📦 Pièces commandées — en route (2) », toutes à temps");
  ok(!/Bougie NGK/.test(txt($("#inv-prev-liste"))), "… et elles ne sont plus dans le tableau des manques");
  ok(!$("#cmdr-bandeau") || $("#cmdr-bandeau").style.display === "none", "à temps : aucun rappel au tableau de bord");
  w.fermerInventaire && w.fermerInventaire();

  // ══════ 5. Délai dépassé : rappel ⏰, notification une fois, bouton rouge ══════
  c1.pieces[0].dateCommande = ilYa(10);
  const nToasts = toasts().length;
  w.majBoutonCommandes(); w.cmdAlarmesRendre();
  const bd = $("#cmdr-bandeau");
  ok(bd && bd.style.display !== "none" && /⏰ Rappels · 📦 Pièces commandées/.test(txt(bd)) && /Relancer Amsoil/.test(txt(bd)) && /1× Bougie NGK \(X9\) — BT-120/.test(txt(bd)) && /en retard de \d+ j/.test(txt(bd)), "délai dépassé : rappel au tableau de bord « Relancer Amsoil · 1× Bougie NGK (X9) — BT-120 … en retard de N j »");
  ok(/1 en route, à temps/.test(txt(bd)), "… et ce qui est encore à temps, en gris");
  ok(/⚠️ 1 en retard/.test($("#lbl-commandes").textContent) && $("#btn-commandes").classList.contains("cmd-retard"), "bouton « Pièces à commander · ⚠️ 1 en retard »");
  ok(toasts().length === nToasts + 1 && /📦 Pièce en retard : Bougie NGK/.test(toasts().at(-1)) && /Chez Amsoil · BT-120/.test(toasts().at(-1)), "notification « 📦 Pièce en retard : Bougie NGK — Chez Amsoil · BT-120 »");
  w.cmdAlarmesRendre();
  ok(toasts().length === nToasts + 1, "… une seule fois (pas à chaque vérification)");
  ok(w.invBesoins()["X9"] === undefined, "même en retard, elle ne redevient pas un « manque » dans les prévisions");
  w.ouvrirInventaire(); w.invOnglet("previsions"); await dodo(20);
  ok(/⚠️ 1 en retard/.test(txt($("#inv-prev-enroute"))) && /en retard de/.test(txt($("#inv-prev-enroute"))), "Prévisions › Pièces commandées : « ⚠️ en retard de … »");
  w.fermerInventaire && w.fermerInventaire();
  // Réception : en retard en premier, avec « 📞 Relancé »
  w.cmdOnglet("reception"); await dodo(10);
  ok(/En retard de/.test(txt($("#commandes-liste"))) && $("#commandes-liste .cp-retard .cm-r-btn"), "Pièces à commander › Réception : « ⚠️ En retard de … » en rouge avec « 📞 Relancé »");

  // ══════ 6. 📞 Relancé : nouvelle arrivée prévue = maintenant + délai ══════
  bd.querySelector("[data-cmd-relance]").click(); await dodo(40);
  const p0 = c1.pieces[0], att = new Date(p0.attenduLe);
  ok(p0.relances === 1 && p0.relancePar === "Jason" && att.getTime() > Date.now() + 40 * 3600000, "📞 Relancé : relancé 1 fois, nouvelle arrivée prévue dans 48 h (délai d'Amsoil)");
  ok($("#cmdr-bandeau").style.display === "none" && !/en retard/.test($("#lbl-commandes").textContent), "plus en retard : le rappel disparaît");
  ok(toasts().some(t => /Amsoil relancé — nouvelle arrivée prévue/.test(t)), "toast « 📞 Amsoil relancé — nouvelle arrivée prévue … »");
  p0.attenduLe = ilYa(1); w.majBoutonCommandes();
  const n2 = toasts().length; w.cmdAlarmesRendre();
  ok(toasts().length === n2 + 1 && /\(relancé 1 fois\)/.test(txt($("#cmdr-bandeau"))), "de nouveau dépassé après la relance : nouvelle notification, « relancé 1 fois »");

  // ══════ 7. ✓ Reçue ══════
  $("#cmdr-bandeau [data-cmd-recue]").click(); await dodo(150);
  ok(p0.recu && p0.dateRecue && w.__get("machines")[0].pieces[0].coche === true, "✓ Reçue : la pièce passe reçue (et cochée au bon)");
  ok($("#cmdr-bandeau").style.display === "none", "rappel retiré");

  // ══════ 8. Autre fournisseur : ajouté à nos fiches ══════
  w.cmdOnglet("commander"); await dodo(10);
  cases = $$("#commandes-liste .cmd-piece input[type=checkbox]").filter(x => !x.checked);
  cases[0].checked = true; cases[0].dispatchEvent(new w.Event("change", { bubbles: true })); await dodo(20);
  $("#voile-cmd-four [data-four='__autre']").click(); await dodo(10);
  const a = $("#cmdf-autre"); a.value = "Lapointe Joliette"; a.dispatchEvent(new w.Event("change")); await dodo(10);
  ok($("#cmdf-ajouter") && $("#cmdf-ajouter").checked && /Ajouter « Lapointe Joliette » à nos fournisseurs/.test(txt(v())), "« Autre… » : « Ajouter « Lapointe Joliette » à nos fournisseurs » (coché)");
  const promis = new Date(Date.now() + 5 * 86400000); promis.setSeconds(0, 0);
  const loc = promis.getFullYear() + "-" + pad(promis.getMonth() + 1) + "-" + pad(promis.getDate()) + "T" + hm(promis);
  const pr = $("#cmdf-promis"); pr.value = loc; pr.dispatchEvent(new w.Event("change")); await dodo(10);
  $("#cmdf-ok").click(); await dodo(40);
  const lj = w.__get("invData").four.find(f => f.nom === "Lapointe Joliette");
  const pp = w.__get("commandes")[1].pieces[0];
  ok(lj && pp.commande && pp.fournisseurId === lj.id && pp.fournisseur === "Lapointe Joliette", "nouveau fournisseur créé et choisi");
  ok(pp.attenduLe && Math.abs(new Date(pp.attenduLe) - promis) < 60000 && ecritLigne(11) && ecritLigne(11).donnees.four.some(f => f.nom === "Lapointe Joliette"), "date promise par le fournisseur gardée ; la fiche est enregistrée (inventaire)");

  // ══════ 9. ⏱️ Délais de commande (réglages) ══════
  w.cmdDelaisOuvrir(); await dodo(10);
  const vd = $("#voile-cmd-delais");
  ok(vd.classList.contains("ouvert") && $("#cmdd-defaut").value === "72" && vd.querySelector("[data-four='fo-amsoil']").value === "48" && vd.querySelector("[data-four='fo-napa']").value === "", "réglages : 72 h par défaut ; Amsoil 48 h ; Napa vide (= défaut)");
  $("#cmdd-defaut").value = "24"; vd.querySelector("[data-four='fo-napa']").value = "120";
  $("#cmdd-ok").click(); await dodo(40);
  let inv = w.__get("invData");
  ok(inv.reglages.delaiH === 24 && w.invFour("fo-napa").delaiH === 120 && w.invFour("fo-napa").delai === 5 && ecritLigne(11).donnees.reglages.delaiH === 24, "enregistré : défaut 24 h, Napa 120 h (5 j) — au serveur aussi");
  ok(w.cmdDelaiFourH(null) === 24 && w.cmdDelaiFourH(w.invFour("fo-napa")) === 120, "tout suit : les délais s'appliquent partout");
  // Rechargé d'ailleurs (temps réel) : les réglages restent
  const live = canaux.find(c => c.nom === "tableau-live"), rt = live && live.h.find(h => h.f && h.f.table === "tableau");
  await dodo(400);   // (fin de notre propre écriture)
  if (rt) { const d = cp(ecritLigne(11).donnees); d.four.push({ id: "fo-kim", nom: "Kimpex", delai: 0 }); rt.cb({ eventType: "UPDATE", new: { id: 11, donnees: d } }); await dodo(10); }
  ok(rt && w.__get("invData").four.some(f => f.id === "fo-kim") && w.__get("invData").reglages.delaiH === 24, "rechargé du serveur (temps réel) : les délais de commande sont gardés");
  // Fiche fournisseur en heures
  w.invFournOuvrir("fo-amsoil");
  ok($("#inv-fo-delai").value === "48" && /heures/.test(txt($("#inv-fo-delai").closest(".so-champ"))), "fiche fournisseur : « Délai normal de livraison (heures) » = 48");
  $("#inv-fo-nom").value = "Amsoil"; $("#inv-fo-delai").value = "36"; await w.invFournEnregistrer();
  ok(w.invFour("fo-amsoil").delaiH === 36 && w.invFour("fo-amsoil").delai === 1.5, "modifié dans la fiche : 36 h");
  w.invRendreFournisseurs && w.invRendreFournisseurs();

  // ══════ 10. Bons de commande de l'inventaire : même délai, même rappel ══════
  inv = w.__get("invData");   // (remplacé par le temps réel)
  inv.po.push({ id: "po1", po: "PO-0003", fourId: "fo-napa", fourNom: "Napa", statut: "envoye", envoyeLe: ilYa(20), creeLe: ilYa(20), lignes: [{ num: "A1", desc: "Anode", qte: 2, recu: 0 }, { num: "C1", desc: "Courroie", qte: 1, recu: 0 }] });
  w.majBoutonCommandes(); w.cmdAlarmesRendre();
  ok(/Relancer Napa · 2 articles \(A1, C1\) — PO-0003/.test(txt($("#cmdr-bandeau"))), "bon de commande envoyé il y a 20 jours (Napa, 120 h) : rappel « Relancer Napa · 2 articles — PO-0003 »");
  $$("#cmdr-bandeau [data-cmd-recue]").find(b => /po\|po1/.test(b.getAttribute("data-cmd-recue"))).click(); await dodo(40);
  ok($("#voile-inventaire").classList.contains("ouvert") && $("#inv-recu-po").value === "po1", "✓ Reçue sur un bon de commande : la réception de l'inventaire s'ouvre sur PO-0003");
  w.fermerInventaire && w.fermerInventaire();
  $$("#cmdr-bandeau [data-cmd-relance]").find(b => /po\|po1/.test(b.getAttribute("data-cmd-relance"))).click(); await dodo(40);
  ok(inv.po[0].relances === 1 && new Date(inv.po[0].attenduLe) > new Date(), "📞 Relancé sur le bon de commande : nouvelle arrivée prévue");

  // ══════ 11. Réglages du tableau : le rappel peut se cacher ══════
  inv.po[0].attenduLe = ilYa(1); w.majBoutonCommandes();
  ok($("#cmdr-bandeau").style.display !== "none", "(en retard de nouveau)");
  if (w.tbCocher) { await w.tbCocher("blocs", "cmdretard", false); w.majBoutonCommandes(); ok($("#cmdr-bandeau").style.display === "none", "Réglages de mon tableau : « ⏰ Rappels des pièces commandées en retard » décoché → caché"); await w.tbCocher("blocs", "cmdretard", true); }
 } catch (err) { ok(false, "exception : " + (err && err.stack || err)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
