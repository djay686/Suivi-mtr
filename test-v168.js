// v168 — L'inventaire suit la facturation finale (QuickBooks, « Facturé »).
// v178 : le « 🎁 cadeau / payé comptant » est retiré de l'application. Les actions qui passaient par la fenêtre cadeau passent
// maintenant par « → Facturé » (deplacer(id, "prete")) puis « ✓ Livrée » (archiver) ; mêmes fixtures bt7 / bt8 / bt9, mêmes soldes de stock.
// La Rentabilité garde sa bascule 🎁 « offert » (rentabilite.cadeau) : section 11.
// NODE_PATH=… node test-v168.js ./index.html
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
let reponseQbo = null;
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
const iso = (h, mn) => new Date(Date.UTC(2026, 8, 21, h, mn)).toISOString();
const art = (num) => w.__get("catalPieces").find(p => p.num === num);
const qte = (num) => art(num).qte;
const bt = (id) => w.__get("machines").find(m => m.id === id);
const mouv = () => w.__get("invMouv");
const lignePar = (txt) => w.__get("factRangs").find(r => (r.desc || "").includes(txt) || (r.num || "") === txt);
const iDe = (txt) => w.__get("factRangs").indexOf(lignePar(txt));
const carte = (txt) => $$("article.carte").find(a => a.textContent.includes(txt));
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const prod = (id, doc, action) => (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, company: "Groupe MTR", realm: "R1", env: "production", config: {} } }
  : { status: 200, data: { ok: true, id, doc, total: 100, action, url: "https://app.qbo.intuit.com/app/invoice?txnId=" + id, clientId: "77", clientNom: "Alex Paquin", realm: "R1", env: "production", company: "Groupe MTR" } };

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }]);
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
  w.__set("catalPieces", [
    { num: "295100522", desc: "Filtre à huile BRP", prix: 24.99, cout: 12, suivi: true, qte: 5 },
    { num: "WCFQTC", desc: "Huile XPS 4T", prix: 23.29, cout: 14, suivi: true, qte: 10 },
    { num: "X9", desc: "Bougie", prix: 12, cout: 5, suivi: true, qte: 8 },
    { num: "C1", desc: "Courroie", prix: 80, cout: 50, suivi: true, qte: 4 },
    { num: "J1", desc: "Joint de sortie", prix: 5.5, cout: 2, suivi: false },
    { num: "A1", desc: "Anode", prix: 15, cout: 6, suivi: true, qte: 6 },
  ]);
  w.__set("invMouv", []);
  w.__set("clients", [{ id: "cl1", nom: "Alex Paquin", tel: "819-555-0101", courriel: "alex@x.ca", adresse: "12 rue Test", ville: "Trois-Rivières", cp: "G8V 1A1", machines: [] }]);
  w.__set("soumissions", [
    { id: "s47", numero: "SO-0047", statut: "convertie", clientId: "cl1", clientNom: "Alex Paquin", machineId: "bt1",
      lignes: [{ type: "mo", desc: "Hivernisation", qte: 1.5, prix: 95 },
               { type: "art", num: "295100522", desc: "Filtre à huile", qte: 1, prix: 24.99 },
               { type: "art", num: "WCFQTC", desc: "Huile XPS 4T", qte: 3, prix: 23.29 },
               { type: "art", num: "X9", desc: "Bougie", qte: 2, prix: 12 }] },
  ]);
  const P = (num, nom, q, o) => Object.assign({ num, nom, qte: String(q), coche: true }, o || {});
  w.__set("machines", [
    { id: "bt1", numeroBT: "BT-101", nom: "2021 Sea-Doo GTX 170", client: "Alex Paquin", tel: "819-555-0101", clientId: "cl1", statut: "afacturer", soumissionId: "s47",
      travauxTermines: true, chrono: [{ tech: "Gwendal", debut: iso(12, 0), fin: iso(13, 30), pauses: [] }],
      pieces: [P("295100522", "Filtre à huile", 1, { utilise: true }), P("WCFQTC", "Huile XPS 4T", 4), P("J1", "Joint de sortie", 1, { utilise: true, ajoutLive: true, prixVente: 5.5 }),
               P("C1", "Courroie", 1, { ajoutLive: true }), P("A1", "Anode", 1, { utilise: true, ajoutLive: true, prixVente: 15 })] },
    { id: "bt2", numeroBT: "BT-102", nom: "Sea-Doo Spark", client: "Test Sandbox", statut: "afacturer", pieces: [P("X9", "Bougie", 1, { utilise: true, prixVente: 12 })] },
    { id: "bt3", numeroBT: "BT-103", nom: "Yamaha FX", client: "Enregistré", statut: "afacturer", pieces: [P("C1", "Courroie", 1, { utilise: true, prixVente: 80 })] },
    { id: "bt4", numeroBT: "BT-104", nom: "Outlander", client: "Sans facturation", statut: "afacturer", pieces: [P("A1", "Anode", 2, { utilise: true, prixVente: 15 })] },
    { id: "bt5", numeroBT: "BT-095", nom: "Vieille Spark", client: "Avant v168", statut: "prete", invSortieFaite: true, pieces: [P("X9", "Bougie", 1)] },
    { id: "bt6", numeroBT: "BT-096", nom: "Vieux Ski-Doo", client: "Facturé avant v168", statut: "prete",
      facturation: { lignes: [{ type: "art", num: "295100522", desc: "Filtre", qte: 2, prix: 24.99 }], confirmeLe: iso(10, 0), sousTotal: 49.98 }, pieces: [P("295100522", "Filtre", 3)] },
    { id: "bt7", numeroBT: "BT-107", nom: "Can-Am Renegade", client: "Fermé en Facturé", statut: "afacturer",
      chrono: [{ tech: "Gwendal", debut: iso(12, 0), fin: iso(13, 0), pauses: [] }],
      pieces: [P("A1", "Anode", 1, { utilise: true, prixVente: 15 }), P("C1", "Courroie", 1, { utilise: true, prixVente: 80 })] },
    { id: "bt8", numeroBT: "BT-108", nom: "Polaris RZR", client: "Facturé puis livré", statut: "afacturer", pieces: [P("WCFQTC", "Huile XPS 4T", 2, { utilise: true, prixVente: 23.29 })] },
    { id: "bt9", numeroBT: "BT-109", nom: "Kawasaki Teryx", client: "Déjà facturé", statut: "afacturer",
      facturation: { qbo: { id: "1600", doc: "1600", realm: "R1", env: "production", le: iso(9, 0) } }, pieces: [] },
    { id: "bt10", numeroBT: "BT-110", nom: "Honda Pioneer", client: "En réparation", statut: "reparation", pieces: [] },
    { id: "bt11", numeroBT: "BT-097", nom: "Vieux RZR", client: "Sorti avant v168", statut: "prete", invSortieFaite: true, pieces: [P("C1", "Courroie", 1, { utilise: true, prixVente: 80 })] },
  ]);
  w.__set("qboEtat", { connecte: true, company: "Groupe MTR", realm: "R1", env: "production", config: {} });
  w.afficher();

  // ── 1. Plus de 🎁 sur les cartes ni de fenêtre cadeau ──
  const c7 = carte("Can-Am Renegade");
  ok(c7 && /🧾 Facturer/.test(c7.textContent) && !c7.querySelector(".btn-cadeau") && !c7.querySelector(".cadeau-discret") && !/🎁/.test(c7.textContent), "carte « Prêt à facturer » : le bouton 🧾 Facturer reste, plus aucun 🎁");
  ok(!carte("Honda Pioneer").querySelector(".btn-cadeau") && !$$("article.carte .btn-cadeau, article.carte .badge-cadeau").length, "aucune carte (réparation, prêt à facturer, admin) ne porte 🎁 ni badge cadeau");
  ok(w.document.getElementById("cadeau-pop") === null && typeof w.factCadeau === "undefined" && typeof w.cadeauConfirmer === "undefined" && typeof w.cadeauFermer === "undefined", "#cadeau-pop est absent ; factCadeau, cadeauConfirmer et cadeauFermer sont indéfinis");
  w.__set("sessionCourante", { nom: "Gwendal", quand: new Date().toISOString() }); w.afficher();
  ok(!$$("article.carte .btn-cadeau").length && !$$("article.carte").some(a => /🎁/.test(a.textContent)), "technicien : aucun 🎁");
  w.__set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() }); w.afficher();

  // ── 2. Fenêtre de facturation : encadré 📦 Inventaire ──
  reponseQbo = prod("1502", "1502", "cree");
  w.factOuvrir("bt1");
  const inv = () => $("#fact-inv").textContent.replace(/\s+/g, " ");
  ok(/Inventaire — à la facturation/.test(inv()), "fenêtre : encadré « 📦 Inventaire — à la facturation, le stock suit ces lignes »");
  ok(/295100522.*sort 1 · en main 5 → 4/.test(inv()) && /WCFQTC.*sort 3 · en main 10 → 7/.test(inv()) && /X9.*sort 2 · en main 8 → 6/.test(inv()), "✨ Suggestion : filtre 5 → 4, huile 10 → 7 (3 à la soumission), bougies 8 → 6");
  ok(/J1.*quantité non tenue/.test(inv()) && /A1.*sort 1 · en main 6 → 5/.test(inv()) && !/C1/.test(inv()), "joint pas suivi : « quantité non tenue » ; anode utilisée sort ; courroie pas cochée : rien");
  w.factInclure(iDe("Anode"), false);
  ok(!/A1 Anode · 1 facturé/.test(inv()) && /Utilisée au BT mais pas facturée : A1 Anode — reste en stock/.test(inv()), "anode décochée : elle ne sort plus, et l'encadré avertit « utilisée au BT mais pas facturée — reste en stock »");
  w.factChamp(iDe("Huile XPS"), "qte", "4");
  ok(/WCFQTC.*sort 4 · en main 10 → 6/.test(inv()), "quantité d'huile corrigée à 4 : l'encadré suit tout de suite (10 → 6)");
  w.factAjouterLigne("art");
  const iL = w.__get("factRangs").length - 1;
  w.factChamp(iL, "num", "ZZ-9"); w.factChamp(iL, "desc", "Pièce spéciale"); w.factChamp(iL, "prix", "30");
  ok(/Hors inventaire.*Pièce spéciale/.test(inv()), "ligne hors catalogue : « hors inventaire — ne touche pas au stock »");
  ok(qte("295100522") === 5 && qte("WCFQTC") === 10 && !mouv().length, "rien ne bouge tant que la facture n'est pas faite");
  const resC1 = w.invReserve("C1"), resA1 = w.invReserve("A1");
  ok(resC1 === 3 && resA1 === 4, "avant la facture : courroies et anodes des bons ouverts réservées (3 et 4)");

  // ── 3. Facture QuickBooks : le stock suit les lignes envoyées ──
  await w.factQuickBooks($("#fact-btn-qbo"));
  const m1 = bt("bt1");
  ok(m1.statut === "prete" && qte("295100522") === 4 && qte("WCFQTC") === 6 && qte("X9") === 6 && qte("A1") === 6 && qte("C1") === 4, "facture QuickBooks : filtre 4, huile 6, bougies 6 ; anode et courroie (pas facturées) intactes");
  const v1 = mouv().filter(x => x.ref === "BT-101");
  ok(v1.length === 4 && v1.every(x => x.motif === "vente" && x.qui === "Jason" && x.bt === "bt1" && x.client === "Alex Paquin"), "4 mouvements « vente » (dont le joint pas suivi, pour les ventes), réf. BT-101, par Jason");
  const vh = v1.find(x => x.num === "WCFQTC");
  ok(vh.qte === -4 && vh.prixU === 23.29 && vh.coutU === 14 && vh.avant === 10 && vh.apres === 6, "huile : −4 au prix de la facture (23,29 $), coûtant 14 $, solde 10 → 6");
  ok(m1.invSorties && m1.invSorties.WCFQTC.qte === 4 && m1.invSorties["295100522"].qte === 1 && !m1.invSorties.A1 && m1.invSortieSource === "facture", "le bon retient ce qu'il a sorti (huile 4, filtre 1, pas l'anode)");
  ok(w.invReserve("C1") === resC1 - 1 && w.invReserve("A1") === resA1 - 1, "facturé : le BT-101 ne réserve plus rien (sa courroie et son anode libérées)");
  ok(/inventaire mis à jour \(4 articles\)/.test($("#fact-resultat").textContent), "résultat : « 📦 inventaire mis à jour (4 articles) »");
  ok(!appelsQbo.some(c => c.action === "facturer" && c.facture.lignes.some(l => l.num === "A1")), "l'anode décochée n'est pas sur la facture QuickBooks");

  // ── 4. Facture mise à jour : seulement la différence ──
  reponseQbo = prod("1502", "1502", "maj");
  w.factChamp(iDe("Huile XPS"), "qte", "3");
  w.factInclure(iDe("Bougie"), false);
  ok(/WCFQTC.*déjà 4 sorti|WCFQTC.*remet 1 en stock/.test(inv()) && /X9.*remet 2 en stock · en main 6 → 8/.test(inv()), "encadré : huile « remet 1 », bougies « remet 2 en stock (6 → 8) »");
  await w.factQuickBooks($("#fact-btn-qbo"));
  ok(qte("WCFQTC") === 7 && qte("X9") === 8 && qte("295100522") === 4, "mise à jour de la facture : huile 6 → 7, bougies 6 → 8, filtre inchangé (pas de double sortie)");
  const an = mouv().filter(x => x.motif === "annul");
  ok(an.length === 2 && an.find(x => x.num === "X9").qte === 2 && an.find(x => x.num === "X9").prixU === 12, "2 mouvements « ↩️ facture corrigée » (remis en stock au prix d'origine)");
  ok(!bt("bt1").invSorties.X9 && bt("bt1").invSorties.WCFQTC.qte === 3, "le bon retient les nouvelles quantités (huile 3, plus de bougies)");
  w.factFermer();
  // Ventes : les corrections viennent en moins
  $("#inv-v-periode").value = "mois"; $("#inv-v-rech").value = "WCFQTC";
  w.invRendreVentes();
  ok(/Huile XPS 4T\s*3\s*69,87/.test($("#inv-v-liste").textContent.replace(/\s+/g, " ").replace(/ /g, " ")), "Inventaire › Ventes : huile 3 × 23,29 = 69,87 $ (4 vendues − 1 corrigée)");
  $("#inv-v-rech").value = "";
  $("#inv-mv-motif").value = "annul"; $("#inv-mv-periode").value = "30"; $("#inv-mv-rech").value = "";
  w.invRendreMouvements();
  ok(/Facture corrigée \(remis en stock\)/.test($("#inv-mv-table").textContent) && /\+2/.test($("#inv-mv-table").textContent), "Mouvements : filtre « ↩️ Facture corrigée (remis en stock) », +2 bougies");

  // ── 5. Facture de TEST : aucun mouvement ──
  w.__set("qboEtat", { connecte: true, realm: "SB1", env: "sandbox", config: {} });
  reponseQbo = (c) => c.action === "statut" ? { status: 200, data: { ok: true, connecte: true, realm: "SB1", env: "sandbox", config: {} } }
    : { status: 200, data: { ok: true, id: "183", doc: "1018", total: 12, action: "cree", url: "https://app.sandbox.qbo.intuit.com/x", clientId: "68", realm: "SB1", env: "sandbox" } };
  const nM = mouv().length;
  w.factOuvrir("bt2"); await dodo(30);
  await w.factQuickBooks($("#fact-btn-qbo"));
  ok(bt("bt2").statut === "afacturer" && qte("X9") === 8 && mouv().length === nM && !bt("bt2").invSorties && /inventaire inchangé/.test($("#fact-resultat").textContent), "facture de TEST : le stock ne bouge pas (« inventaire inchangé »)");
  w.factFermer();
  w.__set("qboEtat", { connecte: true, company: "Groupe MTR", realm: "R1", env: "production", config: {} });

  // ── 6. « → Facturé » sans QuickBooks : facturation enregistrée, sinon suggestion ──
  w.factOuvrir("bt3");
  w.factChamp(iDe("Courroie"), "prix", "75");
  w.factEnregistrer(true);
  w.factFermer();
  w.deplacer("bt3", "prete");
  ok(bt("bt3").statut === "prete" && qte("C1") === 3 && mouv().some(x => x.ref === "BT-103" && x.num === "C1" && x.prixU === 75), "« → Facturé » : la courroie sort d'après la facturation enregistrée (prix 75 $)");
  ok(toasts().some(t => /1 article\(s\) sorti\(s\) de l'inventaire \(BT-103 facturé\)/.test(t)), "toast « 📦 1 article(s) sorti(s) de l'inventaire »");
  w.deplacer("bt4", "prete");
  ok(qte("A1") === 4 && bt("bt4").invSortieSource === "suggestion", "« → Facturé » sans facturation : sortie d'après la suggestion (anodes utilisées 6 → 4)");

  // ── 7. « ✓ Livrée » : pas de double sortie ; anciens bons ──
  w.archiver("bt3");
  ok(bt("bt3").statut === "archive" && qte("C1") === 3 && mouv().filter(x => x.ref === "BT-103").length === 1, "livrée après la facture : aucune 2e sortie");
  // v170 : un bon d'avant la v168 a sa sortie AU JOURNAL (réf. = n° du bon, sans bt) — c'est le journal qui fait foi
  mouv().push({ id: "old1", ts: iso(8, 0), num: "X9", desc: "Bougie", qte: -1, avant: 9, apres: 8, motif: "vente", ref: "BT-095", qui: "Gwendal" },
              { id: "old2", ts: iso(8, 5), num: "C1", desc: "Courroie", qte: -1, avant: 5, apres: 4, motif: "vente", ref: "BT-097", qui: "Gwendal" });
  w.archiver("bt5");
  ok(qte("X9") === 8, "bon sorti avant la v168 (à la livraison) : rien de plus");
  w.archiver("bt6");
  ok(qte("295100522") === 2 && bt("bt6").invSortieSource === "livraison", "bon « Facturé » avant la v168 : sort à la livraison d'après sa facturation (2 filtres, pas les 3 du BT)");
  // Bon dont les pièces sont sorties avant la v168 : ramené puis refacturé, il ne sort rien de plus
  w.deplacer("bt11", "afacturer");
  w.factOuvrir("bt11");
  ok(/C1.*✔ déjà sorti du stock/.test($("#fact-inv").textContent.replace(/\s+/g, " ")), "fenêtre : courroie « ✔ déjà sorti du stock » (sortie d'avant la v168, au journal)");
  w.factFermer();
  w.deplacer("bt11", "prete");
  ok(qte("C1") === 3 && mouv().filter(x => x.ref === "BT-097").length === 1, "refacturé : aucune 2e sortie de la courroie");

  // ── 8. Bon sans facturation enregistrée (ancien chemin 🎁) : « → Facturé » puis « ✓ Livrée » ──
  appelsQbo.length = 0;
  w.deplacer("bt7", "prete");
  const m7 = bt("bt7");
  ok(m7.statut === "prete" && !("cadeau" in m7) && m7.invSortieSource === "suggestion", "« → Facturé » : le BT-107 passe dans « Facturé », sorti d'après la suggestion, sans marque cadeau");
  ok(qte("A1") === 3 && qte("C1") === 2 && mouv().filter(x => x.ref === "BT-107").length === 2, "anode et courroie sortent du stock une seule fois (réf. « BT-107 », sans 🎁)");
  ok(!mouv().some(x => /🎁|cadeau/i.test(x.ref)) && !appelsQbo.length && !m7.facturation?.qbo && !m7.factureLe, "aucun mouvement ne porte 🎁 ; rien envoyé à QuickBooks, aucune facture");
  w.afficher();
  const c7b = carte("Can-Am Renegade");
  ok(!/payé comptant|🎁/i.test(c7b.textContent) && !c7b.querySelector(".btn-cadeau"), "carte du bon fermé : ni badge « payé comptant » ni 🎁");
  ok(toasts().some(t => /1 article\(s\) sorti\(s\) de l'inventaire|2 article\(s\) sorti\(s\) de l'inventaire/.test(t)), "toast « 📦 article(s) sorti(s) de l'inventaire (BT-107 facturé) »");
  // Revenir en arrière : la réservation reprend seulement l'excédent
  w.deplacer("bt7", "afacturer");
  ok(bt("bt7").statut === "afacturer" && qte("A1") === 3, "ramené dans « Prêt à facturer » : le stock ne bouge pas");
  ok(w.invReserve("A1") === 0, "réservation : rien de plus que ce qui est déjà sorti");
  bt("bt7").pieces[0].qte = "2";
  ok(w.invReserve("A1") === 1, "une 2e anode ajoutée au bon : 1 réservée (l'excédent)");
  w.deplacer("bt7", "prete");
  ok(qte("A1") === 2 && bt("bt7").invSorties.A1.qte === 2, "refacturé : seulement l'anode de plus sort (3 → 2)");
  w.archiver("bt7");
  ok(bt("bt7").statut === "archive" && qte("A1") === 2 && qte("C1") === 2, "« ✓ Livrée » : aux archives, aucune 2e sortie");

  // ── 9. Fenêtre de facturation sans 🎁 ; lignes enregistrées puis « → Facturé » et « ✓ Livrée » ──
  w.factOuvrir("bt8");
  ok($(".fact-h3") && !$(".fact-h3 button") && $(".fact-h3").children.length === 1 && /🧾 Facturer/.test($(".fact-h3").textContent) && !/🎁/.test($("#fact-pop").textContent), "fenêtre de facturation : le titre est « 🧾 Facturer » seul, sans bouton 🎁");
  w.factChamp(iDe("Huile XPS"), "qte", "1");
  w.factEnregistrer(true);
  w.factFermer();
  w.deplacer("bt8", "prete");
  w.archiver("bt8");
  const m8 = bt("bt8");
  ok(m8.statut === "archive" && m8.livreLe && !("cadeau" in m8) && qte("WCFQTC") === 6 && !$("#fact-pop").classList.contains("ouvert"), "« → Facturé » puis « ✓ Livrée » : aux archives, 1 huile sortie (7 → 6), fenêtre de facturation fermée");
  ok(m8.facturation && m8.facturation.lignes.length === 1 && m8.facturation.lignes[0].qte === 1 && mouv().filter(x => x.ref === "BT-108").length === 1, "la facturation de la fenêtre est gardée sur le bon ; un seul mouvement « BT-108 »");

  // ── 10. Bon déjà facturé dans QuickBooks : « → Facturé » ne rappelle pas QuickBooks ──
  const nMouvAvant = mouv().length;
  w.deplacer("bt9", "prete");
  ok(bt("bt9").statut === "prete" && !("cadeau" in bt("bt9")) && !appelsQbo.length && bt("bt9").facturation.qbo.id === "1600" && mouv().length === nMouvAvant, "bon déjà facturé (n° 1600) : passe dans « Facturé », aucun appel QuickBooks, facture conservée, pas de mouvement");

  // ── 11. Rentabilité : garde sa bascule 🎁 « offert » (rentabilite.cadeau), sans notion de paiement ──
  w.ouvrirEditRent("bt8");
  ok(!$("#rent-btn-offert").classList.contains("actif") && w.__get("estCadeauRent")(bt("bt8")) === false, "Rentabilité du BT-108 : 🎁 « offert » pas actif tant qu'il n'a pas été choisi");
  w.toggleCadeauRent();
  ok($("#rent-btn-offert").classList.contains("actif"), "la bascule 🎁 « offert » de la Rentabilité fonctionne toujours");
  w.enregistrerRentApp();
  ok(bt("bt8").rentabilite && bt("bt8").rentabilite.cadeau === true && w.__get("estCadeauRent")(bt("bt8")) === true, "enregistrée : rentabilite.cadeau = true");
  w.rendreRecapCadeaux();
  ok(/BT-108/.test($("#cad-liste").textContent) && $("#cad-liste").textContent.replace(/\s/g, "").includes(w.__get("fmtArgentApp")(bt("bt8").rentabilite.revenuPotentiel).replace(/\s/g, "")), "récap « Cadeaux offerts » : BT-108 avec son revenu potentiel (rentabilité)");
  w.rendreListeRent();
  ok(!!$$("#rent-liste .rent-ligne-bt").find(l => /BT-108/.test(l.textContent) && l.querySelector(".rl-cadeau")), "liste de rentabilité : 🎁 sur le BT-108");
  ok(w.__get("estCadeauRent")({ cadeau: { le: "2026-10-01T10:00:00Z", montant: 50 }, statut: "prete" }) === false && w.__get("valeurCadeau")({ cadeau: { montant: 50 } }) === 0, "un reste de m.cadeau (ancien bon) ne compte plus comme offert : seule rentabilite.cadeau compte");

  // ── 12. Échappement ──
  bt("bt10").statut = "afacturer"; bt("bt10").pieces = [P("<b>x</b>", "<img src=x onerror=alert(1)>", 1, { utilise: true, prixVente: 1 })];
  w.factOuvrir("bt10");
  ok(!$("#fact-inv img") && !$("#fact-pop img[src='x']") && /<img src=x/.test($("#fact-inv").textContent + $("#fact-pop").textContent) && !alertes.length, "texte des pièces affiché comme texte dans la fenêtre de facturation");
  w.factFermer();
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
