// v174 — Bon de travail imprimé (signature du client) : n° d'étiquette en haut (en gros s'il est inscrit, sinon un
//   rectangle vide pour l'écrire à la main), case « 🔑 Clé du client », dommages machine / remorque.
//   + une pièce ajoutée à la main dans le bon n'est plus mise en double par 🖨️ Imprimer puis 💾 Enregistrer.
// Se lance dans un navigateur (le bon s'ouvre dans une 2e fenêtre qui parle à l'app par window.opener).
// NODE_PATH=… node test-v174.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

const table = (nom) => { const ch = new Proxy({}, { get(t, k) {
  if (k === "then") return (ok) => ok({ data: [], error: null });
  if (k === "maybeSingle" || k === "single") return () => Promise.resolve({ data: null, error: null });
  return () => ch;
} }); return ch; };
const sbStub = { from: table, channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; }, removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: { access_token: "ok" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }) },
  functions: { invoke: async () => ({ data: null, error: null }) } };
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const ouverts = [];   // les fenêtres ouvertes par l'app (le bon de travail)
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) { w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => ""; w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.open = () => { const f = { closed: false, document: { html: "", write(h) { this.html += h; }, close() {} } }; ouverts.push(f); return f; }; } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const machine = (id) => w.__get("machines").find(m => m.id === id);

// Ouvre le bon imprimable d'une machine, comme le bouton 🖨️ de l'app, dans sa propre fenêtre (opener = l'app)
async function ouvrirBon(id) {
  ouverts.length = 0;
  w.bonDeTravail(id);
  const f = ouverts[ouverts.length - 1];
  if (!f) throw new Error("le bon ne s'est pas ouvert");
  const d = new JSDOM(f.document.html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/bon",
    beforeParse(b) { b.opener = w; b.alert = () => {}; b.confirm = () => true; b.print = () => {}; b.close = () => {}; } });
  const b = d.window; b.addEventListener("error", e => erreurs.push("bon : " + e.message));
  await dodo(250);
  b.$ = (s) => b.document.querySelector(s);
  return b;
}
const ecrire = (b, el, texte) => { el.focus && el.focus(); el.textContent = texte; el.dispatchEvent(new b.Event("input", { bubbles: true })); };
const quitter = (b, el) => el.dispatchEvent(new b.Event("blur"));
const texte = (el) => (el ? el.textContent : "").replace(/\s+/g, " ").trim();

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", role: "admin", actif: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.__set("clients", []);
  const base = { client: "Marc Tremblay", tel: "819-555-1234", type: "Motoneige", marque: "Ski-Doo", modele: "Renegade", annee: "2019", statut: "avenir", echeance: "2026-10-06", heure: "09:00",
    travaux: "Entretien annuel\nChanger la courroie", pieces: [{ num: "417300571", qte: "1", nom: "Courroie" }] };
  w.__set("machines", [
    Object.assign({ id: "m-sans", numeroBT: "BT-130", nom: "2019 Ski-Doo Renegade" }, base),
    Object.assign({ id: "m-avec", numeroBT: "BT-131", nom: "2021 Can-Am Outlander", numeroMachine: "47", cleClient: true,
      dommagesMachine: "Égratignure capot gauche\nMiroir fissuré", dommagesRemorque: "Pneu droit usé" }, base),
    Object.assign({ id: "m-xss", numeroBT: "BT-132", nom: "RZR", numeroMachine: "<b>9</b>", dommagesMachine: "<img src=x onerror=alert(1)>" }, base),
    Object.assign({}, base, { id: "m-pieces", numeroBT: "BT-133", nom: "Spark", pieces: [{ num: "417300571", qte: "1", nom: "Courroie" }] }),
  ]);
  let nSauv = 0; const sauvOrig = w.__get("sauvegarder");
  w.__set("sauvegarder", function () { nSauv++; try { return sauvOrig.apply(this, arguments); } catch (_) {} });

  // ══════ 1. Étiquette déjà inscrite : en gros, en haut ══════
  const b1 = await ouvrirBon("m-avec");
  const cadre = b1.$("#bt-etiq-cadre"), num = b1.$("#bt-etiq");
  ok(cadre && cadre.parentElement.classList.contains("titre-bon"), "en haut du bon, à côté du n° de BT : le cadre « 🏷️ N° d'étiquette »");
  ok(num && texte(num) === "47", "étiquette déjà inscrite (47) : elle est dans le cadre");
  ok(parseFloat(b1.getComputedStyle(num).fontSize) >= 36 && parseInt(b1.getComputedStyle(num).fontWeight, 10) >= 800, "… en gros et en gras (" + b1.getComputedStyle(num).fontSize + ") pour être bien visible");
  ok(parseFloat(b1.getComputedStyle(cadre).borderTopWidth) >= 3, "… dans un rectangle au trait épais");
  ok(!b1.$(".num-machine-bt"), "(l'ancienne petite pastille « Machine n° » est remplacée par le cadre)");
  const kids = [...b1.$(".titre-bon").children].map(e => e.className);
  ok(kids.indexOf("etiq-bt") === 1 && /codes-bt/.test(kids[2] || ""), "ordre en haut : BON DE TRAVAIL + n° › étiquette › codes à scanner");

  // ══════ 2. Clé et dommages : déjà inscrits ══════
  ok(b1.$("#bt-cle") && b1.$("#bt-cle").type === "checkbox" && b1.$("#bt-cle").checked, "🔑 Clé du client : case cochée (la clé est à l'atelier)");
  ok(/Clé du client/.test(texte(b1.$(".cle-bt"))), "… avec « 🔑 Clé du client — laissée à l'atelier »");
  const dm = b1.$("#bt-dom-machine"), dr = b1.$("#bt-dom-remorque");
  ok(dm && dr && /Dommages — machine/.test(texte(dm.parentElement)) && /Dommages — remorque/.test(texte(dr.parentElement)), "deux zones : « Dommages — machine » et « Dommages — remorque »");
  ok(dm.innerHTML === "Égratignure capot gauche<br>Miroir fissuré" && texte(dr) === "Pneu droit usé", "… remplies de ce qui est déjà noté (retours de ligne gardés)");
  const titres = [...b1.document.querySelectorAll(".feuille:not(.verso) .section-titre")].map(e => texte(e));
  ok(titres.indexOf("État à l'arrivée") >= 0 && titres.indexOf("État à l'arrivée") < titres.indexOf("Travaux demandés"), "section « État à l'arrivée » au recto, avant les travaux (donc avant la signature du client)");
  ok(/Je confirme l'état à l'arrivée noté ci-dessus \(clé, dommages de la machine et de la remorque\)/.test(texte(b1.$(".feuille:not(.verso) .approbation"))), "le client signe aussi l'état noté : phrase ajoutée à l'autorisation");
  const lignes = b1.getComputedStyle(dm).backgroundImage;
  ok(/repeating-linear-gradient/.test(lignes) && parseFloat(b1.getComputedStyle(dm).minHeight) >= 70, "zones lignées (3 lignes) pour écrire à la main");

  // ══════ 3. Étiquette pas encore inscrite : rectangle vide à remplir à la main ══════
  const b2 = await ouvrirBon("m-sans");
  const n2 = b2.$("#bt-etiq");
  ok(n2 && texte(n2) === "" && b2.$("#bt-etiq-cadre"), "pas encore d'étiquette : le rectangle est là, vide");
  ok(/à écrire/.test(b2.getComputedStyle(n2, "::before").content), "à l'écran : « à écrire » en pâle dans le rectangle");
  b2.document.body.classList.add("compact");   // les mêmes règles qu'à l'impression (mesure du recto)
  const avImp = b2.getComputedStyle(n2, "::before").content;
  ok(!/à écrire/.test(avImp), "à l'impression : rectangle vraiment vide pour écrire à la main (" + avImp + ")");
  ok(parseFloat(b2.getComputedStyle(n2).minHeight) >= 40, "… assez haut pour écrire un numéro à la main (" + b2.getComputedStyle(n2).minHeight + ")");
  const zImp = b2.getComputedStyle(b2.$("#bt-dom-machine"));
  ok(parseFloat(zImp.minHeight) >= 76 && parseFloat(zImp.lineHeight) >= 20, "à l'impression : 4 lignes de 20 px par zone de dommages, assez pour écrire à la main (" + zImp.minHeight + ")");
  b2.document.body.classList.remove("compact");
  ok(!b2.$("#bt-cle").checked && texte(b2.$("#bt-dom-machine")) === "" && texte(b2.$("#bt-dom-remorque")) === "", "clé pas cochée et dommages vides (à remplir à la main)");

  // ══════ 4. Remplir à l'écran : tout est gardé dans la fiche ══════
  nSauv = 0;
  ecrire(b2, n2, "52");
  ok(texte(b2.$("#bt-num-machine")) === "52", "écrire 52 dans le rectangle du haut : la ligne « N° machine » suit");
  quitter(b2, n2);
  ok(machine("m-sans").numeroMachine === "52" && nSauv === 1, "en sortant du rectangle : l'étiquette 52 est enregistrée sur la fiche");
  ecrire(b2, b2.$("#bt-num-machine"), "53"); quitter(b2, b2.$("#bt-num-machine"));
  ok(texte(n2) === "53" && machine("m-sans").numeroMachine === "53", "et l'inverse : la ligne « N° machine » met le rectangle à jour");
  const ent = new b2.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }); n2.dispatchEvent(ent);
  ok(ent.defaultPrevented, "Entrée dans le rectangle : pas de retour de ligne (le numéro reste sur une ligne)");
  b2.$("#bt-cle").checked = true; b2.$("#bt-cle").dispatchEvent(new b2.Event("change", { bubbles: true }));
  ok(machine("m-sans").cleClient === true, "cocher « Clé du client » : enregistré tout de suite");
  ecrire(b2, b2.$("#bt-dom-machine"), "Bosse pare-chocs avant"); quitter(b2, b2.$("#bt-dom-machine"));
  ecrire(b2, b2.$("#bt-dom-remorque"), "Feu arrière brisé"); quitter(b2, b2.$("#bt-dom-remorque"));
  ok(machine("m-sans").dommagesMachine === "Bosse pare-chocs avant" && machine("m-sans").dommagesRemorque === "Feu arrière brisé", "dommages machine et remorque : enregistrés en sortant de la zone");
  const n0 = nSauv; quitter(b2, b2.$("#bt-dom-machine"));
  ok(nSauv === n0, "sortir d'une zone sans rien changer : aucune écriture de plus");
  b2.$("#bt-cle").checked = false; b2.$("#bt-cle").dispatchEvent(new b2.Event("change", { bubbles: true }));
  ok(machine("m-sans").cleClient === false, "décocher : la clé n'est plus notée");

  // Un bon resté ouvert n'efface pas une étiquette inscrite ailleurs entre-temps
  machine("m-avec").numeroMachine = "47";
  const b3 = await ouvrirBon("m-sans");   // étiquette 53, clé non
  machine("m-sans").numeroMachine = "88";   // inscrite ailleurs (« Machine arrivée ») pendant que le bon est ouvert
  ecrire(b3, b3.$("#bt-dom-remorque"), "Feu arrière brisé, aile pliée"); quitter(b3, b3.$("#bt-dom-remorque"));
  ok(machine("m-sans").numeroMachine === "88" && machine("m-sans").dommagesRemorque === "Feu arrière brisé, aile pliée", "bon resté ouvert : noter un dommage n'écrase pas l'étiquette inscrite ailleurs entre-temps (88 gardé)");

  // Enregistrer / Imprimer (tout le bon) garde aussi l'état
  const b4 = await ouvrirBon("m-avec");
  b4.$("#bt-cle").checked = false;
  b4.$("#bt-dom-machine").textContent = "Aucun";
  ok(b4.sauverBon() === true && machine("m-avec").cleClient === false && machine("m-avec").dommagesMachine === "Aucun" && machine("m-avec").numeroMachine === "47",
    "💾 Enregistrer / 🖨️ Imprimer : la clé et les dommages suivent avec le reste du bon");

  // ══════ 5. Texte échappé, recto sur une page ══════
  const b5 = await ouvrirBon("m-xss");
  ok(!b5.$("#bt-etiq b") && texte(b5.$("#bt-etiq")) === "<b>9</b>" && !b5.$("#bt-dom-machine img") && /<img src=x/.test(texte(b5.$("#bt-dom-machine"))), "étiquette et dommages affichés tels quels (aucun HTML injecté)");
  const b6 = await ouvrirBon("m-avec");
  b6.ajusterRectoImpression();
  const recto = b6.$(".feuille:not(.verso)"), zoom = recto.style.zoom, h = recto.scrollHeight;
  b6.restaurerApresImpression();
  ok(!zoom || parseFloat(zoom) >= 0.85, "recto d'un bon ordinaire : tient sur une page lettre (hauteur " + h + " px, réduction " + (zoom || "aucune") + ")");
  ok(!b6.document.body.classList.contains("compact") && !recto.style.zoom, "(après l'impression, l'écran revient à la normale)");

  // ══════ 6. Pièce ajoutée à la main dans le bon : plus en double (🖨️ Imprimer puis 💾 Enregistrer) ══════
  const b7 = await ouvrirBon("m-pieces");
  const vides = [...b7.document.querySelectorAll("tr.bt-piece")].filter(r => r.getAttribute("data-i") === null);
  let c = vides[0].querySelectorAll("td"); c[0].textContent = "2"; c[1].textContent = "Filtre à huile"; c[2].textContent = "420956744";
  b7.sauverBon(); b7.sauverBon();
  const noms = () => machine("m-pieces").pieces.map(p => p.nom + " ×" + p.qte).join(", ");
  ok(noms() === "Courroie ×1, Filtre à huile ×2", "pièce ajoutée à la main, bon enregistré deux fois (Imprimer puis Enregistrer) : une seule fois sur la fiche (avant : en double) → " + noms());
  c[0].textContent = "3"; b7.sauverBon();
  ok(noms() === "Courroie ×1, Filtre à huile ×3", "la corriger ensuite dans le bon : la même pièce est modifiée (pas une 3e ligne)");
  c = vides[1].querySelectorAll("td"); c[1].textContent = "Bougie"; c[2].textContent = "BR9ECS"; b7.sauverBon();
  ok(noms() === "Courroie ×1, Filtre à huile ×3, Bougie ×1", "une autre pièce ajoutée ensuite : ajoutée une fois, les autres intactes");
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
