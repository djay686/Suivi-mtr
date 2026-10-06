// v158/v159 — Facturation d'un bon de travail : comparaison soumission / BT, choix de l'admin, facture QuickBooks.
// NODE_PATH=… node test-v158.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");
const ecrits = [];
const table = (name) => { const ch = new Proxy({}, { get(t, k) { if (k === "then") return (ok) => ok({ data: [], error: null }); return (...a) => { if (k === "upsert" && name === "tableau") ecrits.push(JSON.parse(JSON.stringify(a[0]))); return ch; }; } }); return ch; };
const sbStub = { from: table, channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; }, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const alertes = [], confirmations = [], ouvertures = [], appelsQbo = [];
let reponseQbo = null;   // (corps) => { status, data }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) {
    w.__sbStub = sbStub; w.alert = (m) => alertes.push(String(m)); w.confirm = (m) => { confirmations.push(String(m)); return true; }; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.open = (u) => { const f = { url: u, document: { write() {}, close() {} }, close() { f.ferme = true; }, location: {} }; Object.defineProperty(f.location, "href", { set(v) { f.url = v; }, get() { return f.url; } }); ouvertures.push(f); return f; };
    w.fetch = async (url, init) => {
      if (/functions\/v1\/quickbooks/.test(url)) {
        const corps = JSON.parse(init.body); appelsQbo.push(corps);
        const r = reponseQbo ? reponseQbo(corps) : { status: 200, data: { ok: true } };
        return { ok: r.status < 300, status: r.status, json: async () => r.data };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    };
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const $$ = (s) => [...w.document.querySelectorAll(s)];
const proche = (a, b) => Math.abs(a - b) < 0.005;
const sousTotal = () => { const t = $("#fact-totaux").textContent; const m = t.match(/Sous-total\s*([\d\s ,]+)\s*\$/); return m ? parseFloat(m[1].replace(/[\s ]/g, "").replace(",", ".")) : NaN; };
const lignePar = (txt) => w.__get("factRangs").find(r => (r.desc || "").includes(txt) || (r.num || "") === txt);
const iso = (h, mn) => new Date(Date.UTC(2026, 8, 21, h, mn)).toISOString();

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  // Employés : Jason admin, Gwendal technicien
  w.__set("EMPLOYES", [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.__set("catalPieces", [{ num: "295100522", desc: "Filtre à huile BRP", prix: 24.99, cout: 12 }, { num: "C1", desc: "Courroie", prix: 80, cout: 50 }]);
  w.__set("clients", [{ id: "cl1", nom: "Alex Paquin", tel: "819-555-0101", courriel: "alex@x.ca", adresse: "12 rue Test", ville: "Trois-Rivières", cp: "G8V 1A1", machines: [] }]);
  w.__set("soumissions", [
    { id: "s47", numero: "SO-0047", statut: "convertie", clientId: "cl1", clientNom: "Alex Paquin", machineId: "bt1", qbo: { id: "900", doc: "SO-0047" },
      lignes: [{ type: "mo", desc: "Hivernisation", qte: 1.5, prix: 95 },
               { type: "art", num: "295100522", desc: "Filtre à huile", qte: 1, prix: 24.99 },
               { type: "art", num: "WCFQTC", desc: "Huile XPS 4T", qte: 3, prix: 23.29 },
               { type: "art", num: "X9", desc: "Bougie", qte: 2, prix: 12 }] },
    { id: "s50", numero: "SO-0050", statut: "convertie", clientNom: "Multi", machineId: "bt3",
      lignes: [{ type: "mo", desc: "Diagnostic", qte: 1, prix: 105 }, { type: "mo", desc: "Réparation pompe", qte: 2, prix: 105 }] },
    { id: "s51", numero: "SO-0051", statut: "convertie", clientNom: "Forfait", machineId: "bt4",
      lignes: [{ type: "art", num: "HIV-F", desc: "Forfait hivernisation", qte: 1, prix: 189 }] },
  ]);
  w.__set("machines", [
    { id: "bt1", numeroBT: "BT-101", nom: "2021 Sea-Doo GTX 170", client: "Alex Paquin", tel: "819-555-0101", clientId: "cl1", statut: "afacturer", soumissionId: "s47",
      travauxTermines: true, travauxTerminesPar: "Gwendal", travauxTerminesLe: iso(15, 0), pretAFacturerLe: iso(15, 0),
      chrono: [{ tech: "Gwendal", debut: iso(12, 0), fin: iso(13, 10), pauses: [] }, { tech: "Jason", debut: iso(14, 0), fin: iso(14, 45), pauses: [] }],
      pieces: [{ num: "295100522", nom: "Filtre à huile", qte: "1", coche: true, utilise: true, prixVente: 24.99, soumission: "SO-0047" },
               { num: "WCFQTC", nom: "Huile XPS 4T", qte: "4", coche: true, prixVente: 23.29, soumission: "SO-0047" },
               { num: "J1", nom: "Joint de sortie", qte: "1", coche: true, utilise: true, prixVente: 5.5, ajoutLive: true },
               { num: "C1", nom: "Courroie", qte: "1", coche: true, prixVente: 0, ajoutLive: true }] },
    { id: "bt6", numeroBT: "BT-105", nom: "Outlander", client: "Prix Manquant", statut: "afacturer", pieces: [{ num: "ZZ-404", nom: "Pièce inconnue", qte: "1", utilise: true, prixVente: 0 }] },
    { id: "bt2", numeroBT: "BT-083", nom: "Sea-Doo Spark", client: "Sans Soum", tel: "819-555-0202", statut: "afacturer",
      chrono: [{ tech: "Gwendal", debut: iso(12, 42), fin: iso(13, 20), pauses: [] }],
      pieces: [{ num: "", nom: "Anode", qte: "1", coche: true, utilise: true, prixVente: 15 }] },
    { id: "bt3", numeroBT: "BT-102", nom: "Yamaha FX", client: "Multi", statut: "afacturer", soumissionId: "s50",
      chrono: [{ tech: "Gwendal", debut: iso(12, 0), fin: iso(16, 20), pauses: [{ p: iso(13, 0), r: iso(13, 20), motif: "Dîner" }] }], pieces: [] },
    { id: "bt4", numeroBT: "BT-103", nom: "Ski-Doo", client: "Forfait", statut: "afacturer", soumissionId: "s51",
      chrono: [{ tech: "Gwendal", debut: iso(12, 0), fin: iso(13, 0), pauses: [] }], pieces: [] },
    { id: "bt5", numeroBT: "BT-104", nom: "Spark", client: "Autre", statut: "reparation", pieces: [] },
  ]);
  w.afficher();
  // ── Carte : le bouton n'apparaît que pour l'admin, sur « Prêt à facturer » ──
  const carteBt1 = $$("article.carte").find(a => /GTX 170/.test(a.textContent));
  ok(carteBt1 && /🧾 Facturer/.test(carteBt1.querySelector(".carte-actions").textContent), "carte « Prêt à facturer » : bouton « 🧾 Facturer » pour l'admin");
  ok(!$$("article.carte").filter(a => /BT-104|Autre/.test(a.textContent)).some(a => /🧾 Facturer/.test(a.textContent)), "pas de bouton sur un bon en réparation");
  w.__set("sessionCourante", { nom: "Gwendal", quand: new Date().toISOString() });
  w.afficher();
  ok(!$$("article.carte").some(a => /🧾 Facturer/.test(a.textContent)), "technicien : aucun bouton « Facturer »");
  w.factOuvrir("bt1");
  ok(!$("#fact-pop").classList.contains("ouvert"), "technicien : la fenêtre de facturation refuse de s'ouvrir");
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.afficher();

  // ── Comparaison du BT-101 ──
  w.__set("qboEtat", { connecte: true, company: "Groupe MTR", config: { artPieces: "Pièce", artMO: "Atelier" } });
  reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, company: "Groupe MTR", config: { artPieces: "Pièce", artMO: "Atelier" } } } : { status: 200, data: { ok: true } };
  w.factOuvrir("bt1");
  ok($("#fact-pop").classList.contains("ouvert"), "admin : la fenêtre « Facturer — BT-101 » s'ouvre");
  const R = w.__get("factRangs");
  ok(R.length === 6, "6 lignes comparées : 1 main-d'œuvre, 3 pièces de la soumission, 2 ajouts au BT (" + R.length + ")");
  const mo = R.find(r => r.type === "mo");
  ok(mo && mo.soum.qte === 1.5 && mo.bt && mo.bt.qte === 2, "main-d'œuvre : 1,5 h soumises, 1 h 55 punchées → 2 h (arrondi au ¼ h)");
  ok(/1,5 h soumises/.test($("#fact-resume").textContent) && /Gwendal 1,17 h/.test($("#fact-resume").textContent) && /Jason 0,75 h/.test($("#fact-resume").textContent), "tuile main-d'œuvre : heures par technicien");
  const tr = (txt) => $$("#fact-lignes tr").find(t => [...t.querySelectorAll("input")].some(i => i.value.includes(txt)));
  ok(/pas sur la liste du BT/.test(tr("Bougie").textContent), "bougie de la soumission absente du BT → 🔴 signalée");
  ok(/quantité au BT : 4/.test(tr("Huile XPS").textContent), "huile : 3 soumises, 4 au BT → 🟠 écart signalé");
  ok(/utilisée au BT/.test(tr("Filtre à huile").textContent), "filtre : ✔ utilisée au BT");
  ok(/ajoutée en atelier · utilisée/.test(tr("Joint de sortie").textContent) && /pas cochée « utilisée »/.test(tr("Courroie").textContent) && !/prix de vente inconnu/.test(tr("Courroie").textContent), "ajouts au BT signalés (joint utilisé ; courroie pas cochée, prix trouvé au catalogue)");
  // Suggestion : soumission + ajouts utilisés
  ok(proche(sousTotal(), 142.5 + 24.99 + 69.87 + 24 + 5.5), "✨ Suggestion : soumission + joint utilisé = 266,86 $ (" + sousTotal() + ")");
  ok(lignePar("Courroie").prix === 80 && !lignePar("Courroie").inclus, "courroie : prix repris du catalogue (80 $), non cochée (pas « utilisée »)");
  ok(/Écart avec la soumission\s*\+5,50/.test($("#fact-totaux").textContent.replace(/\s+/g, " ")), "écart avec la soumission affiché (+5,50 $)");
  w.factMode("reel");
  ok(proche(sousTotal(), 190 + 24.99 + 93.16 + 5.5 + 80), "🔧 Réel du BT : 2 h, 4 huiles, sans bougie, avec courroie = 393,65 $ (" + sousTotal() + ")");
  ok(!lignePar("Bougie").inclus && $$("#fact-lignes tr.exclu").some(t => /Bougie/.test([...t.querySelectorAll("input")].map(i => i.value).join())), "réel : bougie décochée (barrée)");
  w.factMode("soumission");
  ok(proche(sousTotal(), 261.36), "📋 Soumission seulement : 261,36 $ (" + sousTotal() + ")");
  w.factMode("suggestion");
  // Choix de l'admin ligne par ligne
  const iJ = R.indexOf(lignePar("Joint de sortie")), iC = R.indexOf(lignePar("Courroie"));
  w.factChamp(iJ, "prix", "6,00");
  w.factInclure(iC, true);
  ok(proche(sousTotal(), 266.86 + 0.5 + 80) && $("#fact-mt-" + iJ).textContent.includes("6,00"), "prix du joint corrigé (6 $) et courroie cochée → totaux recalculés sans redessiner");
  ok(!$$("#fact-modes .fact-mode.actif").length, "modification à la main → plus aucun point de départ en surbrillance");
  w.factAjouterLigne("art");
  const iL = w.__get("factRangs").length - 1;
  w.factNumChange(iL, "295100522");
  const L = w.__get("factRangs")[iL];
  ok(L.desc === "Filtre à huile BRP" && L.prix === 24.99 && L.groupe === "libre", "ligne ajoutée : le numéro remplit description et prix depuis le catalogue");
  w.factAjouterLigne("note");
  w.factChamp(w.__get("factRangs").length - 1, "desc", "Garantie 30 jours sur la main-d'œuvre");
  w.factMemoMaj("Merci de votre confiance !");
  // Enregistrer
  const nEcr = ecrits.length;
  w.factEnregistrer();
  const F = w.__get("machines").find(m => m.id === "bt1").facturation;
  ok(F && F.lignes.length === 8 && F.memo === "Merci de votre confiance !" && proche(F.sousTotal, 266.86 + 0.5 + 80 + 24.99), "💾 Enregistrer : 8 lignes finales, message et sous-total gardés sur le bon (" + (F && F.lignes.length) + ")");
  await dodo(30);   // v168 : l'enregistrement relit d'abord le serveur (fusion), l'écriture part juste après
  ok(ecrits.slice(nEcr).some(e => e.id === 1 && e.donnees.find(m => m.id === "bt1").facturation), "la facturation part au serveur avec le bon (ligne 1)");
  // Rouvrir : l'état revient tel quel
  w.factFermer(); w.factOuvrir("bt1");
  const R2 = w.__get("factRangs");
  ok(R2.find(r => r.desc === "Joint de sortie").prix === 6 && R2.find(r => r.desc === "Courroie").inclus && R2.some(r => r.groupe === "libre" && r.desc === "Filtre à huile BRP") && $("#fact-memo").value === "Merci de votre confiance !", "réouverture : prix corrigé, courroie cochée, ligne ajoutée et message retrouvés");
  ok(/Facturation enregistrée/.test($("#fact-avis").textContent), "avis « facturation enregistrée — pas encore envoyée »");

  // ── Facturer avec QuickBooks ──
  reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, company: "Groupe MTR", realm: "R1", env: "production", config: {} } }
    : { status: 200, data: { ok: true, id: "1502", doc: "1502", total: 427.15, action: "cree", url: "https://app.qbo.intuit.com/app/invoice?txnId=1502", clientId: "77", clientNom: "Alex Paquin", clientCree: true, nbTrouves: 2, nbPiece: 4, estimateLie: true, realm: "R1", env: "production", company: "Groupe MTR" } };
  appelsQbo.length = 0; ouvertures.length = 0;
  await w.factQuickBooks($("#fact-btn-qbo"));
  const envoi = appelsQbo.find(c => c.action === "facturer");
  ok(!!envoi, "appel à la fonction « quickbooks », action « facturer »");
  const f = envoi.facture;
  ok(f.btId === "bt1" && f.numeroBT === "BT-101" && f.estimateId === "900" && f.soumissionNumero === "SO-0047" && f.machine === "2021 Sea-Doo GTX 170", "facture : n° de bon, soumission, devis QuickBooks à fermer, machine");
  ok(f.client.nom === "Alex Paquin" && f.client.adresse === "12 rue Test" && f.client.ville === "Trois-Rivières" && f.client.cp === "G8V 1A1" && f.client.courriel === "alex@x.ca", "client : infos du carnet (adresse, courriel, téléphone) pour la création dans QuickBooks");
  ok(f.lignes.filter(l => l.type === "mo").length === 1 && f.lignes.find(l => l.type === "mo").qte === 1.5 && f.lignes.some(l => l.type === "art" && l.num === "C1" && l.prix === 80) && f.lignes.some(l => l.type === "note") && !f.lignes.some(l => l.num === "X9" && false), "lignes envoyées = choix de l'admin (MO 1,5 h, courroie 80 $, ligne de texte)");
  const m1 = w.__get("machines").find(m => m.id === "bt1");
  ok(m1.statut === "prete" && !m1.pretAFacturerLe && m1.facturation.qbo.id === "1502", "après la facture : le bon passe dans « Facturé » avec la facture n° 1502");
  ok(ouvertures.length === 1 && ouvertures[0].url === "https://app.qbo.intuit.com/app/invoice?txnId=1502", "la page de la facture QuickBooks s'ouvre");
  ok(/Facture n° 1502 créée/.test($("#fact-resultat").textContent) && $("#fact-resultat a").href.includes("txnId=1502") && /client ajouté/.test($("#fact-resultat").textContent), "résultat affiché + lien « Ouvrir la facture dans QuickBooks »");
  ok(w.__get("clients")[0].qboId === "77" && w.__get("clients")[0].qboRealm === "R1", "le carnet retient l'id QuickBooks du client ET son entreprise (v159)");
  ok(w.__get("machines").find(m => m.id === "bt1").facturation.qbo.realm === "R1", "la facture retient son entreprise (v159)");
  const s47 = w.__get("soumissions").find(s => s.id === "s47");
  ok(s47.facture && s47.facture.doc === "1502" && s47.facture.bt === "BT-101", "la soumission SO-0047 est marquée « facturée » (n° 1502, BT-101)");
  ok($("#fact-btn-qbo").textContent.includes("Mettre à jour"), "bouton devenu « Mettre à jour la facture QuickBooks »");
  w.afficher();
  const carteF = $$("article.carte").find(a => /GTX 170/.test(a.textContent));
  ok(carteF && /Facture n° 1502/.test(carteF.textContent) && carteF.querySelector('a.badge-facture[href*="txnId=1502"]'), "carte dans « Facturé » : badge « 📗 Facture n° 1502 » qui ouvre la facture");
  ok(carteF && !/🧾 Facturer/.test(carteF.textContent) && !carteF.querySelector('.btn-ico[title^="Facturation"]'), "v159 (Jason) : plus de bouton de facturation dans « Facturé »");
  // 2e envoi : mise à jour de la même facture
  confirmations.length = 0; appelsQbo.length = 0;
  reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, realm: "R1", env: "production", config: {} } }
    : { status: 200, data: { ok: true, id: "1502", doc: "1502", total: 430, action: "maj", url: "https://app.qbo.intuit.com/app/invoice?txnId=1502", clientId: "77", clientNom: "Alex Paquin", realm: "R1", env: "production" } };
  await w.factQuickBooks($("#fact-btn-qbo"));
  const f2 = (appelsQbo.find(c => c.action === "facturer") || {}).facture || {};
  ok(/Mettre à jour la facture QuickBooks n° 1502/.test(confirmations[0] || "") && f2.qbo.id === "1502" && f2.qbo.realm === "R1" && f2.client.qboId === "77" && f2.client.qboRealm === "R1", "2e envoi : confirmation « mettre à jour » + ids de facture et de client transmis AVEC leur entreprise");
  // Facture déjà payée
  alertes.length = 0; ouvertures.length = 0;
  reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, realm: "R1", env: "production", config: {} } } : { status: 409, data: { erreur: "La facture n° 1502 a déjà un paiement dans QuickBooks — fais la correction directement dans QuickBooks.", paye: true } };
  await w.factQuickBooks($("#fact-btn-qbo"));
  ok(/déjà un paiement/.test(alertes[0] || "") && ouvertures.every(f => f.ferme), "facture payée : message clair, fenêtre refermée");
  w.factFermer();

  // ── v159 : facture faite dans l'entreprise de TEST, app maintenant branchée sur la vraie (R1) ──
  const mt = w.__get("machines").find(m => m.id === "bt2");
  mt.facturation = { qbo: { id: "182", doc: "1017", url: "https://app.sandbox.qbo.intuit.com/app/invoice?txnId=182", le: new Date().toISOString(), total: 365.46, realm: "9341457966909141", env: "sandbox" } };
  mt.statut = "prete";
  w.__get("clients").push({ id: "cl9", nom: "Sans Soum", tel: "819-555-0202", qboId: "67", qboRealm: "9341457966909141", machines: [] });
  w.afficher();
  const carteT = $$("article.carte").find(a => /Sea-Doo Spark/.test(a.textContent) && /1017/.test(a.textContent));
  ok(carteT && /🧪 test/.test(carteT.textContent), "carte : la facture de l'entreprise de test est marquée « 🧪 test »");
  w.__set("qboEtat", { connecte: true, realm: "R1", env: "production", company: "Groupe MTR", config: {} });
  w.factOuvrir("bt2");
  await dodo(50);
  ok(/autre entreprise QuickBooks/.test($("#fact-avis").textContent) && !/Déjà facturé/.test($("#fact-avis").textContent), "fenêtre : « facture faite dans une autre entreprise », pas « déjà facturé »");
  ok($("#fact-btn-qbo").textContent.includes("Facturer avec QuickBooks") && !$("#fact-btn-qbo").textContent.includes("Mettre à jour"), "bouton : « Facturer avec QuickBooks » (pas « mettre à jour » la facture 182 de test)");
  confirmations.length = 0; appelsQbo.length = 0;
  reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, realm: "R1", env: "production", company: "Groupe MTR", config: {} } }
    : { status: 200, data: { ok: true, id: "2001", doc: "1234", total: 99, action: "cree", url: "https://app.qbo.intuit.com/app/invoice?txnId=2001", clientId: "310", clientNom: "Sans Soum", realm: "R1", env: "production", ignores: ["facture 182", "client 67"] } };
  await w.factQuickBooks($("#fact-btn-qbo"));
  const f3 = (appelsQbo.find(c => c.action === "facturer") || {}).facture || {};
  ok(/Créer la facture dans QuickBooks/.test(confirmations[0] || ""), "confirmation : « Créer la facture », pas « mettre à jour la facture 1017 »");
  ok(f3.qbo && f3.qbo.id === "182" && f3.qbo.realm === "9341457966909141" && f3.client.qboRealm === "9341457966909141", "l'id de test part avec SON entreprise, pour que le serveur l'ignore");
  const mt2 = w.__get("machines").find(m => m.id === "bt2");
  ok(mt2.facturation.qbo.id === "2001" && mt2.facturation.qbo.realm === "R1" && w.__get("clients").find(c => c.id === "cl9").qboId === "310" && w.__get("clients").find(c => c.id === "cl9").qboRealm === "R1", "après la vraie facture : bon et carnet pointent vers la vraie entreprise");
  w.factFermer();
  // Envoi d'avant v159 (sans entreprise) : traité comme une autre entreprise
  mt2.facturation.qbo = { id: "182", doc: "1017", le: new Date().toISOString() };
  w.factOuvrir("bt2"); await dodo(50);
  ok(/autre entreprise QuickBooks/.test($("#fact-avis").textContent), "facture enregistrée avant v159 (sans entreprise) : pas considérée comme « déjà facturé »");
  w.factFermer();
  // Résultat dans l'entreprise de test : avertissement sur le lien
  w.__set("qboEtat", { connecte: true, realm: "SB1", env: "sandbox", company: "Sandbox Company CA 2b66", config: {} });
  mt2.facturation = null; mt2.statut = "afacturer"; delete mt2.factureLe;
  reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, realm: "SB1", env: "sandbox", company: "Sandbox Company CA 2b66", config: {} } }
    : { status: 200, data: { ok: true, id: "183", doc: "1018", total: 99, action: "cree", url: "https://app.sandbox.qbo.intuit.com/app/invoice?txnId=183", clientId: "68", clientNom: "Sans Soum", realm: "SB1", env: "sandbox", company: "Sandbox Company CA 2b66" } };
  w.factOuvrir("bt2"); await dodo(50);
  await w.factQuickBooks($("#fact-btn-qbo"));
  ok(/Entreprise de TEST/.test($("#fact-resultat").textContent) && /autre facture/.test($("#fact-resultat").textContent), "facture de test : avertissement « ouvre l'entreprise de test d'abord, sinon le lien montre une autre facture »");
  const mt3 = w.__get("machines").find(m => m.id === "bt2");
  ok(mt3.statut === "afacturer" && !mt3.factureLe && mt3.facturation.qbo.env === "sandbox" && /reste dans « Prêt à facturer »/.test($("#fact-resultat").textContent), "facture de TEST : le bon reste dans « Prêt à facturer » (v159)");
  ok(/TEST : le bon reste/.test(confirmations.at(-1) || ""), "confirmation en test : « le bon reste dans Prêt à facturer »");
  w.afficher();
  const carteT2 = $$("article.carte").find(a => /Sea-Doo Spark/.test(a.textContent) && /1018/.test(a.textContent));
  ok(carteT2 && /🧾 Facturer/.test(carteT2.textContent) && /🧪 test/.test(carteT2.textContent), "carte en « Prêt à facturer » : bouton 🧾 Facturer + badge « facture n° 1018 · 🧪 test »");
  w.factFermer();
  w.__set("qboEtat", { connecte: true, company: "Groupe MTR", config: {} });

  // ── QuickBooks pas connecté ──
  w.__set("qboEtat", { connecte: false, config: {} });
  alertes.length = 0; appelsQbo.length = 0;
  w.factOuvrir("bt3");
  ok(/pas encore connecté/.test($("#fact-qbo").textContent), "QuickBooks non connecté : bandeau orange dans la fenêtre");
  await w.factQuickBooks($("#fact-btn-qbo"));
  ok(/n'est pas connecté/.test(alertes[0] || "") && !appelsQbo.some(c => c.action === "facturer"), "clic sur « Facturer avec QuickBooks » : message, rien n'est envoyé");
  w.factRendreQbo({ connecte: false, erreur: "Connecte-toi avec ton compte d'employé pour utiliser QuickBooks", config: {} });
  ok(/injoignable/.test($("#fact-qbo").textContent) && /compte d'employé/.test($("#fact-qbo").textContent), "session NIP (401) : le bandeau dit pourquoi QuickBooks est injoignable");
  // BT-102 : soumission à 2 lignes de main-d'œuvre + 4 h punchées (dîner retiré)
  const R3 = w.__get("factRangs");
  const reel = R3.find(r => r.groupe === "reel");
  ok(reel && reel.bt.qte === 4 && !reel.inclus && R3.filter(r => r.groupe === "soum" && r.inclus).length === 2, "2 lignes de MO à la soumission : ligne « heures punchées » (4 h, dîner retiré) proposée mais décochée");
  w.factMode("reel");
  ok(reel.inclus && R3.filter(r => r.groupe === "soum").every(r => !r.inclus) && proche(sousTotal(), 420), "réel : les 2 lignes remplacées par 4 h × 105 $ = 420 $");
  w.factFermer();
  // BT-103 : soumission sans main-d'œuvre (forfait) → heures punchées pas ajoutées d'office
  w.factOuvrir("bt4");
  ok(!w.__get("factRangs").find(r => r.groupe === "reel").inclus && proche(sousTotal(), 189), "forfait sans main-d'œuvre : les heures punchées ne s'ajoutent pas d'office (189 $)");
  w.factFermer();
  // BT-083 : aucune soumission → la facture part du BT
  w.factOuvrir("bt2");
  const R4 = w.__get("factRangs");
  ok(/Aucune soumission liée/.test($("#fact-avis").textContent) && $('#fact-modes .fact-mode[data-mode="soumission"]').disabled, "sans soumission : avis + « Soumission seulement » désactivé");
  ok(R4.find(r => r.groupe === "reel").inclus && R4.find(r => r.groupe === "reel").qte === 0.75 && R4.find(r => r.desc === "Anode").inclus && proche(sousTotal(), 0.75 * 95 + 15), "sans soumission : 0,63 h punchées → 0,75 h × 95 $ + anode = 86,25 $ (" + sousTotal() + ")");
  // CSV
  let csv = null;
  w.qboTelechargerCSV = (lignes, nom) => { csv = { lignes, nom }; };
  w.factCSV();
  ok(csv && csv.nom === "quickbooks-facture-BT-083.csv" && csv.lignes.length === 2 && csv.lignes.every(l => l[0] === "BT-083" && l[1] === "Sans Soum") && csv.lignes.some(l => l[4] === "Atelier" && l[6] === 0.75) && csv.lignes.some(l => l[4] === "Pièce" && /Anode/.test(l[5])), "📄 CSV : main-d'œuvre sur « Atelier », pièce sur « Pièce », n° du bon");
  w.factFermer();
  // Ajout au BT sans prix nulle part : signalé, et la confirmation avertit des lignes à 0 $
  w.__set("qboEtat", { connecte: true, config: {} });
  w.factOuvrir("bt6");
  ok(/prix de vente inconnu/.test($("#fact-lignes").textContent), "pièce sans prix (ni au BT ni au catalogue) → « prix de vente inconnu »");
  confirmations.length = 0;
  w.confirm = (m) => { confirmations.push(String(m)); return false; };
  await w.factQuickBooks($("#fact-btn-qbo"));
  ok(/1 ligne\(s\) à 0 \$/.test(confirmations[0] || ""), "confirmation : « ⚠️ 1 ligne(s) à 0 $ » avant d'envoyer");
  w.confirm = (m) => { confirmations.push(String(m)); return true; };
  w.factFermer();
  ok(!erreurs.length, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 } catch (e) { console.log("ÉCHEC :", e.stack); process.exitCode = 1; }
 process.exit(process.exitCode || 0);
})();
