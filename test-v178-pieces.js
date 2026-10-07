// v178-PCS — Recherche de pièce BRP depuis « Pièces à commander » et le BT live (A2).
//   Le catalogue BRP s'ouvre pour UN bon de travail ; la pièce cliquée (message MTR_AJOUT_PIECE du script Tampermonkey)
//   va dans les « pièces à commander » du bon ET dans sa liste de pièces. Sans cible : soumission, comme avant.
// Dans Chromium :  node outils-v178/run-in-chromium.js test-v178-pieces.js ./index.html   (MTR_FAKE_NOW facultatif)
const L = require("./outils-v178/test-lib-v178.js");
const { ok, dodo, cp } = L;
const FICHIER = process.argv[2] || "./index.html";
const SITE = "https://sea-doo-shop.brp.com/ca/fr/shop/sales/parts/";
const CHEMIN = ["Sea-Doo (Canada) CAD", "Sea-Doo Watercraft", "2021", "GTI Family", "2021 00060FA00 GTI 90"];
const URL_ATTENDUE = SITE + "#mtr=" + encodeURIComponent(JSON.stringify(CHEMIN));
const PN1 = "420685333", PN2 = "293300100", PN3 = "711 987-654";
const EMPLOYES = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }, { nom: "Marie", role: "reception", actif: true }];
const bonsDeBase = () => [
  { id: "m1", numeroBT: "BT-201", nom: "2021 BRP GTI 90", marque: "BRP", modele: "GTI 90", modeleId: "brp-gti90", annee: "2021", type: "Motomarine", client: "Marc Tremblay", technicien: "D'Amours", statut: "reparation", pieces: [], pieceComplete: false },
  { id: "m2", numeroBT: "BT-202", nom: "2020 Yamaha VX", marque: "Yamaha", modele: "VX", annee: "2020", type: "Motomarine", client: "Luc Roy", technicien: "Gwendal", statut: "reparation", pieces: [] },
  { id: "m3", numeroBT: "BT-203", nom: "2019 BRP Spark Trixx", marque: "BRP", modele: "Spark Trixx", modeleId: "brp-trixx", annee: "2019", type: "Motomarine", client: "Eve Gagnon", technicien: "Gwendal", statut: "attente", pieces: [] },
  { id: "m4", numeroBT: "BT-204", nom: "2022 Ski-Doo MXZ", marque: "BRP", modele: "MXZ", modeleId: "sm-brp-mxz-600ho", annee: "2013", type: "Motoneige", client: "Paul Côté", technicien: "Gwendal", statut: "avenir", pieces: [] },
];

(async () => {
  const S = L.creerSupabase({ tableau: [{ id: 1, donnees: bonsDeBase() }, { id: 4, donnees: cp(EMPLOYES) }, { id: 5, donnees: [] }] });
  const A = await L.chargerApp({ sb: S.sb });
  const ouvertures = [];
  const fenetre = () => { const f = { closed: false, posts: [], postMessage(m) { f.posts.push(m); } }; return f; };
  A.w.open = (u, nom) => { const f = fenetre(); f.url = u; f.nom = nom; ouvertures.push(f); return f; };
  const purger = () => [...A.w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).forEach(x => x.remove());
  const post = (d) => A.w.dispatchEvent(new A.w.MessageEvent("message", { data: d, origin: SITE }));
  const piece = (pn, extra) => Object.assign({ type: "MTR_AJOUT_PIECE", pn, nom: "Pièce " + pn, prix: 125.5, qte: 1, date: "2026-10-07", remplace: null, repere: "12", marque: "seadoo", source: "brp", ver: "2.4" }, extra || {});
  const machine = (id) => A.get("machines").find(m => m.id === id);
  const cmds = (id) => A.get("commandes").filter(c => c.machineId === (id || "m1"));
  const upsertsCmd = () => S.ecrits("tableau", "upsert").filter(a => a.vals && a.vals.id === 5).length;
  const repartir = () => {
    A.set("machines", cp(bonsDeBase())); A.set("commandes", []);
    A.set("EMPLOYES", cp(EMPLOYES)); A.set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
    A.get("brpData").liens["brp-gti90|2021"] = [{ chemin: CHEMIN.map(t => ({ t })), label: "2021 00060FA00 GTI 90", date: "2026-10-01" }];
    A.get("brpData").inexistants = {};
    A.set("brpCibleBT", null); A.set("soumCourante", null); A.set("brpFenetre", null);
    A.set("brpScriptConnu", false); A.set("brpScriptVer", ""); A.set("brpSondeMs", 15000);
    try { A.w.sessionStorage.removeItem("mtr_brp_cible"); } catch (_) {}
    ouvertures.length = 0; purger();
  };
  const ouvrirBon = (id = "m1", origine = "carte") => { const r = A.w.brpOuvrirPourMachine(id, origine); purger(); return r; };
  try {
    L.connecter(A, "Jason", EMPLOYES);
    repartir();

    // ── T1 : ouverture pour un bon BRP avec chemin appris ──
    A.w.brpOuvrirPourMachine("m1", "carte");
    ok(ouvertures.length === 1 && ouvertures[0].url === URL_ATTENDUE && ouvertures[0].nom === "brp-catalogue", "T1 machine BRP avec chemin appris : window.open(site + « #mtr= » + chemin) — " + (ouvertures[0] ? ouvertures[0].url.slice(0, 80) : "aucun appel"));
    const c1 = A.get("brpCibleBT");
    ok(c1 && c1.machineId === "m1" && c1.numeroBT === "BT-201" && c1.origine === "carte" && c1.tech === "Jason" && Math.abs(c1.le - Date.now()) < 5000, "T1 la cible est posée (bon, n° de BT, origine, technicien = l'utilisateur connecté, heure)");
    ok(A.toasts().length === 1 && /BT-201/.test(A.toasts()[0]) && /pièces à commander/.test(A.toasts()[0]), "T1 UN seul toast à l'ouverture (« " + A.toasts().join(" | ").slice(0, 90) + "… »)");
    let stock = null; try { stock = JSON.parse(A.w.sessionStorage.getItem("mtr_brp_cible")); } catch (_) {}
    ok(stock && stock.machineId === "m1", "T1 la cible est aussi dans sessionStorage « mtr_brp_cible » (survit à un rechargement de l'onglet)");
    ok(ouvertures[0].posts.length === 1 && ouvertures[0].posts[0].type === "MTR_PANIER" && ouvertures[0].posts[0].cible === "BT-201 · pièces à commander", "T1 une fenêtre BRP déjà ouverte reçoit tout de suite sa nouvelle cible (MTR_PANIER · cible)");

    // ── T2 : marques non BRP refusées, marque vide tolérée ──
    repartir();
    const r2 = A.w.brpOuvrirPourMachine("m2", "carte");
    ok(r2 === false && ouvertures.length === 0 && A.get("brpCibleBT") === null && /BRP/.test(A.toasts().join()) && A.toasts().length === 1, "T2 marque Yamaha : refus, window.open non appelé, aucune cible, un toast");
    repartir();
    machine("m2").marque = ""; machine("m2").modeleId = "yam-18-a";
    const modeleYam = A.w.soumModeleParId("yam-18-a") || A.w.soumModeleParId("yam-vx");
    A.w.brpOuvrirPourMachine("m2", "carte");
    ok(modeleYam ? ouvertures.length === 0 : true, "T2 marque vide mais modèle Yamaha connu : refus" + (modeleYam ? "" : " (modèle de test absent du catalogue : ignoré)"));
    repartir();
    machine("m2").marque = ""; machine("m2").modeleId = ""; machine("m2").annee = "";
    A.w.brpOuvrirPourMachine("m2", "carte");
    ok(ouvertures.length === 1 && ouvertures[0].url === SITE && A.get("brpCibleBT") && A.get("brpCibleBT").machineId === "m2", "T2 marque vide et rien d'autre de connu : on n'a aucune raison de refuser — accueil du site Sea-Doo");
    repartir();
    machine("m2").marque = ""; machine("m2").modeleId = "brp-gti90"; machine("m2").annee = "2021";
    A.w.brpOuvrirPourMachine("m2", "carte");
    ok(ouvertures.length === 1 && ouvertures[0].url === URL_ATTENDUE, "T2 marque vide, modèle BRP du catalogue : le chemin appris est utilisé");
    repartir();
    A.w.brpOuvrirPourMachine("m3", "carte");
    ok(ouvertures.length === 1 && ouvertures[0].url === SITE && A.get("brpCibleBT").machineId === "m3" && A.toasts().length === 1 && /non appris/.test(A.toasts()[0]), "T2 marque BRP sans chemin appris : accueil du bon site + un toast « chemin non appris »");
    repartir();
    machine("m4").annee = "2013";
    A.w.brpOuvrirPourMachine("m4", "carte");
    ok(ouvertures.length === 1 && /^https:\/\/ski-doo-shop\.brp\.com\//.test(ouvertures[0].url), "T2 motoneige : le site Ski-Doo (pas Sea-Doo)");
    repartir();
    A.w.brpOuvrirPourMachine("m-inconnu", "carte");
    ok(ouvertures.length === 0 && A.get("brpCibleBT") === null && A.toasts().length === 1, "T2 bon inexistant : rien ne s'ouvre, un toast, aucune exception");

    // ── T2b : pop-up bloqué (window.open renvoie null) ──
    repartir();
    const ouvrirOrig = A.w.open; A.w.open = () => null;
    const r2b = A.w.brpOuvrirPourMachine("m1", "carte");
    A.w.open = ouvrirOrig;
    ok(r2b === false && A.get("brpCibleBT") === null && A.w.sessionStorage.getItem("mtr_brp_cible") === null && A.toasts().length === 1 && /pop-up|bloqu/i.test(A.toasts()[0]), "T2b window.open renvoie null : la cible est remise à null (aussi dans sessionStorage) et on avertit (« " + A.toasts().join().slice(0, 60) + "… »)");

    // ── T3 : pièce reçue avec cible ──
    repartir();
    ouvrirBon("m1", "carte");
    const avant = upsertsCmd();
    post(piece(PN1));
    await dodo(80);
    ok(cmds().length === 1 && cmds()[0].pieces.length === 1, "T3 une commande pour le BT (une carte, une ligne)");
    const l1 = cmds()[0].pieces[0];
    ok(l1.num === PN1 && l1.source === "brp" && l1.qte === "1" && typeof l1.qte === "string" && l1.commande === false && l1.recu === false && l1.prixBRP === 125.5 && cmds()[0].technicien === "Jason" && cmds()[0].numeroBT === "BT-201", "T3 la ligne de commande : source « brp », qte « 1 » en CHAÎNE, prixBRP 125,5, non commandée (technicien Jason)");
    const p1 = machine("m1").pieces;
    ok(p1.length === 1 && p1[0].num === PN1 && p1[0].qte === "1" && p1[0].coche === false && p1[0].nom === "Pièce " + PN1, "T3 la liste du BT (m.pieces) a la ligne, non cochée, qte « 1 » en chaîne");
    ok(!("prixVente" in p1[0]) && !("coutAchat" in p1[0]) && !("prixVente" in l1) && !("coutAchat" in l1), "T3 aucune écriture de prixVente ni de coutAchat sur la ligne BRP");
    ok(machine("m1").pieceComplete === false, "T3 pieceComplete reste faux");
    ok(upsertsCmd() - avant === 1, "T3 UN seul sauverCommandes (écriture de la ligne 5) : " + (upsertsCmd() - avant));
    ok(!("ajoutBRP" in p1[0]), "T3 aucun marqueur inconnu sur m.pieces (lirePiecesFormulaire effacerait les champs inconnus)");
    ok(A.toasts().length === 1 && /ajouté aux pièces à commander de BT-201/.test(A.toasts()[0]) && !/pas à jour/.test(A.toasts()[0]), "T3 un seul toast de confirmation, sans avertissement de version (le message porte ver 2.4)");
    ok(ouvertures[0].posts.some(p => p.type === "MTR_PANIER" && p.lignes.some(x => x.pn === PN1 && x.qte === 1) && p.cible === "BT-201 · pièces à commander" && p.numero === "BT-201"), "T3 le panier renvoyé à BRP vient du bon : la pièce y est (ligne verte), cible « BT-201 · pièces à commander »");
    ok(A.get("brpData").memo["brp-gti90|2021"] && A.get("brpData").memo["brp-gti90|2021"].includes(PN1), "T3 la mémoire du catalogue suit la machine du bon (brp-gti90|2021)");

    // ── T4 : même pièce deux fois → qté 2, une seule ligne ──
    purger();
    post(piece(PN1));
    await dodo(80);
    ok(cmds().length === 1 && cmds()[0].pieces.length === 1 && cmds()[0].pieces[0].qte === "2" && typeof cmds()[0].pieces[0].qte === "string", "T4 même pièce deux fois : qte « 2 » dans la commande, une seule ligne");
    ok(machine("m1").pieces.length === 1 && machine("m1").pieces[0].qte === "2", "T4 qte « 2 » aussi dans la liste du BT, une seule ligne");
    post(piece(PN1, { pn: "420 685-333" }));
    await dodo(80);
    ok(cmds()[0].pieces.length === 1 && cmds()[0].pieces[0].qte === "3" && machine("m1").pieces.length === 1 && machine("m1").pieces[0].qte === "3", "T4 la fusion se fait par invNorm(n°) : « 420 685-333 » = « 420685333 » → qte « 3 »");
    let inv = null; try { inv = A.w.invBesoins({ estimer: false }); } catch (e) { inv = { erreur: e.message }; }
    const cle1 = A.w.invNorm(PN1);
    ok(inv && inv[cle1] && inv[cle1].j30 === 3 && inv[cle1].sources.length === 1, "T4 la pièce est comptée UNE seule fois dans invBesoins (3 requises, pas 6) : " + (inv && inv[cle1] ? inv[cle1].j30 + " · " + inv[cle1].sources.length + " source(s)" : JSON.stringify(inv).slice(0, 80)));

    // ── T5 : pièce différente → seconde ligne dans la MÊME carte ──
    purger();
    post(piece(PN2, { qte: 2 }));
    await dodo(80);
    ok(cmds().length === 1 && cmds()[0].pieces.length === 2 && cmds()[0].pieces[1].num === PN2 && cmds()[0].pieces[1].qte === "2", "T5 pièce différente : seconde ligne dans la MÊME carte (qte « 2 » venue du message)");
    ok(machine("m1").pieces.length === 2 && machine("m1").pieces[1].num === PN2 && machine("m1").pieces[1].coche === false, "T5 seconde ligne aussi dans la liste du BT, non cochée");

    // ── T6 : pièce déjà commandée / reçue → nouvelle ligne, pieceComplete faux ──
    purger();
    cmds()[0].pieces[0].commande = true; cmds()[0].pieces[0].recu = true; cmds()[0].pieces[0].dateRecue = new Date().toISOString();
    machine("m1").pieces[0].coche = true; machine("m1").pieces[1].coche = true; machine("m1").pieceComplete = true;
    post(piece(PN1));
    await dodo(80);
    const lignes6 = cmds()[0].pieces.filter(p => p.num === PN1);
    ok(lignes6.length === 2 && lignes6[0].recu === true && lignes6[0].qte === "3" && lignes6[1].qte === "1" && lignes6[1].recu === false && lignes6[1].commande === false && cmds().length === 1, "T6 pièce déjà reçue : nouvelle ligne « 1 » dans la carte encore ouverte, la ligne reçue (qte « 3 ») ne bouge pas");
    const pm6 = machine("m1").pieces.filter(p => p.num === PN1);
    ok(pm6.length === 2 && pm6[0].coche === true && pm6[1].coche === false && pm6[1].qte === "1", "T6 liste du BT : nouvelle ligne non cochée à côté de la ligne cochée");
    ok(machine("m1").pieceComplete === false, "T6 pieceComplete remis à faux");
    // réception de la nouvelle ligne : c'est la ligne NON cochée qui se coche (pas la première du même n°)
    const iNouv = cmds()[0].pieces.indexOf(lignes6[1]);
    A.w.cocherReception(cmds()[0].id, iNouv, true);
    await dodo(50);
    const pm6b = machine("m1").pieces.filter(p => p.num === PN1);
    ok(pm6b.every(p => p.coche === true), "T6 « Reçue » sur la nouvelle ligne coche la ligne qui restait à recevoir (sinon le bon ne serait jamais « pièce complète »)");
    // tout est reçu ou commandé : nouvelle carte
    purger();
    cmds()[0].pieces.forEach(p => { p.commande = true; p.recu = true; });
    const nbAvant = cmds().length;
    post(piece(PN3));
    await dodo(80);
    ok(cmds().length === nbAvant + 1 && cmds()[nbAvant].pieces.length === 1 && cmds()[nbAvant].pieces[0].num === PN3 && cmds()[nbAvant].pieces[0].source === "brp" && machine("m1").pieces.some(p => p.num === PN3 && p.coche === false), "T6 aucune carte ouverte : une NOUVELLE carte est créée (enregistrerCommandePiece, sansListe), et la liste du BT reçoit la ligne une seule fois");
    ok(machine("m1").pieces.filter(p => p.num === PN3).length === 1, "T6 la ligne n'est pas dupliquée dans m.pieces (le 5e paramètre sansListe)");

    // ── T7 : sans cible → soumission, comme avant ──
    repartir();
    A.w.soumNouvelle({ marque: "BRP", modeleId: "brp-gti90", annee: "2021", type: "motomarine", lignes: [] });
    ok(!!A.get("soumCourante"), "T7 (préparation) une soumission est ouverte");
    post(piece(PN1, { ver: "2.4" }));
    await dodo(80);
    const lS = (A.get("soumCourante").lignes || []).filter(l => l.type === "art");
    ok(lS.length === 1 && String(lS[0].num) === PN1 && lS[0].qte === 1 && lS[0].prix === 125.5 && A.get("commandes").length === 0 && machine("m1").pieces.length === 0, "T7 sans cible BT : la soumission ouverte reçoit la pièce (comme en v175) ; aucune commande, aucune pièce de bon");
    ok(/ajouté à la soumission/.test(A.toasts().join()), "T7 le toast dit toujours « ajouté à la soumission »");
    // une recherche lancée depuis la soumission remet la cible à null
    ouvrirBon("m1", "carte");
    ok(A.get("brpCibleBT") && A.get("brpCibleBT").machineId === "m1", "T7 (préparation) une cible BT est posée");
    A.get("brpData").liens["brp-gti90|2021"] = [{ chemin: CHEMIN.map(t => ({ t })), label: "GTI 90" }];
    A.w.brpOuvrirCatalogue();
    ok(A.get("brpCibleBT") === null && ouvertures.length === 2 && ouvertures[1].url === URL_ATTENDUE && A.toasts().length === 1, "T7 « 🔩 Catalogue BRP » d'une soumission : cible BT effacée, même URL que d'habitude, un seul toast");
    post(piece(PN2));
    await dodo(80);
    ok((A.get("soumCourante").lignes || []).some(l => String(l.num) === PN2) && A.get("commandes").length === 0, "T7 la pièce suivante va bien à la soumission");

    // ── T8 : cible périmée / bon supprimé : aucune exception ──
    repartir();
    ouvrirBon("m1", "carte");
    A.get("brpCibleBT").le = Date.now() - 3 * 3600000;
    const erreursAvant = A.erreurs.length;
    post(piece(PN1));
    await dodo(80);
    ok(A.get("brpCibleBT") === null && A.get("commandes").length === 0 && machine("m1").pieces.length === 0 && A.erreurs.length === erreursAvant, "T8 cible de plus de 2 h : plus de BT visé, rien d'écrit dans le BT, aucune exception");
    ok(A.toasts().length === 1 && /expir/.test(A.toasts()[0]), "T8 un seul toast : « aucune soumission ouverte » + « la recherche liée à BT-201 a expiré » (« " + A.toasts().join().slice(0, 100) + "… »)");
    repartir();
    ouvrirBon("m1", "carte");
    A.set("machines", A.get("machines").filter(m => m.id !== "m1"));
    post(piece(PN1));
    await dodo(80);
    ok(A.get("brpCibleBT") === null && A.get("commandes").length === 0 && A.erreurs.length === erreursAvant && A.toasts().length === 1 && /n'existe plus/.test(A.toasts()[0]), "T8 bon supprimé : retombe sur la soumission / un toast, aucune exception (« " + A.toasts().join().slice(0, 100) + "… »)");
    repartir();
    ouvrirBon("m1", "carte");
    A.get("brpCibleBT").le = Date.now() - 100 * 60000;
    post(piece(PN1));
    await dodo(80);
    ok(cmds().length === 1 && A.get("brpCibleBT") && A.get("brpCibleBT").le > Date.now() - 60000, "T8 une cible de 100 min est encore bonne ; chaque pièce prolonge sa vie de 2 h");

    // ── T9 : « D'Amours », utilisateur null, bouton de la carte ──
    repartir();
    A.set("commandes", [{ id: "cmd-a", machineId: "m1", numeroBT: "BT-201", machineNom: "2021 BRP GTI 90", technicien: "D'Amours", creeLe: new Date().toISOString(),
      pieces: [{ qte: "1", num: "X1", description: "Bougie", commande: false, dateCommande: null, fournisseur: "", recu: false, dateRecue: null }] }]);
    A.w.ouvrirCommandes();
    const bouton = A.$$("#commandes-liste .pcs-carte-brp")[0];
    ok(!!bouton && /Chercher une pièce BRP/.test(bouton.textContent), "T9 la carte de l'onglet À commander a le bouton « 🔩 Chercher une pièce BRP »");
    ok(bouton && !/Amours/.test(bouton.getAttribute("onclick")) && /brpOuvrirPourMachine\('m1'/.test(bouton.getAttribute("onclick")), "T9 l'attribut onclick ne porte QUE l'identifiant du bon (jamais le nom du technicien)");
    ok(/D'Amours/.test(A.txt("#commandes-liste")), "T9 le technicien « D'Amours » s'affiche sur la carte");
    bouton.click();
    ok(ouvertures.length === 1 && ouvertures[0].url === URL_ATTENDUE, "T9 technicien D'Amours : le bouton de la carte ouvre le catalogue");
    purger();
    A.set("sessionCourante", null);
    ok(A.w.utilisateurCourant() === null, "T9 (préparation) utilisateurCourant() est null");
    A.set("brpCibleBT", null);
    A.w.brpOuvrirPourMachine("m1", "carte");
    ok(ouvertures.length === 2 && A.get("brpCibleBT") && A.get("brpCibleBT").tech === "D'Amours", "T9 utilisateurCourant() null : le catalogue s'ouvre quand même, technicien = celui du bon (« D'Amours »)");
    purger();
    post(piece(PN2));
    await dodo(80);
    ok(cmds().some(c => c.pieces.some(p => p.num === PN2)) && cmds().filter(c => c.id !== "cmd-a").length === 0, "T9 la pièce arrive aussi sans utilisateur connecté (dans la carte du bon)");
    const cartes = A.$$("#commandes-liste .cmd-bt");
    ok(cartes.length === 1 && cartes[0].textContent.includes(PN2), "T9 la modale ouverte est rafraîchie : la pièce s'affiche sur la carte, badge « 🔩 BRP »");
    ok(/🔩 BRP · PDSF 125,5 \$/.test(cartes[0].textContent), "T9 la ligne BRP montre « 🔩 BRP · PDSF 125,5 $ »");
    A.w.fermerCommandes();
    A.set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });

    // ── T10 : sonde du script (15 s en vrai, 250 ms ici) ──
    repartir();
    A.set("brpSondeMs", 250);
    A.w.brpOuvrirPourMachine("m1", "carte"); purger();
    await dodo(450);
    ok(A.toasts().length === 1 && /Aucun signal du script/.test(A.toasts()[0]), "T10 aucun message MTR_ après le délai : toast d'indice (« note le n° de pièce et ajoute-le à la main »)");
    repartir();
    A.set("brpSondeMs", 250);
    A.w.brpOuvrirPourMachine("m1", "carte"); purger();
    post({ type: "MTR_PANIER_DEMANDE", ver: "2.4" });
    await dodo(450);
    ok(A.toasts().length === 0 && A.get("brpScriptConnu") === true, "T10 le script a répondu : aucun avertissement");
    A.w.brpOuvrirPourMachine("m1", "carte"); purger();
    await dodo(450);
    ok(A.toasts().length === 0, "T10 après une première utilisation réussie, une 2e ouverture sans nouveau message n'avertit pas à tort");
    repartir();
    A.set("brpSondeMs", 250);
    A.w.brpOuvrirPourMachine("m1", "live"); purger();
    A.w.fermerLive();
    await dodo(450);
    ok(A.toasts().length === 0, "T10 la recherche a pris fin (cible effacée) : pas de toast d'indice hors sujet");

    // ── T11 : fermerLive ──
    repartir();
    ouvrirBon("m1", "live");
    A.w.fermerLive();
    ok(A.get("brpCibleBT") === null && A.w.sessionStorage.getItem("mtr_brp_cible") === null, "T11 fermerLive : une cible d'origine « live » est remise à null (aussi dans sessionStorage)");
    ouvrirBon("m1", "carte");
    A.w.fermerLive();
    ok(A.get("brpCibleBT") && A.get("brpCibleBT").origine === "carte", "T11 fermerLive ne touche pas une cible venue de la carte");
    ouvrirBon("m1", "commandes");
    A.w.fermerLive();
    ok(A.get("brpCibleBT") && A.get("brpCibleBT").origine === "commandes", "T11 …ni une cible venue de « Recherche de pièce BRP »");
    ok(/typeof brpCibleBT !== "undefined"/.test(A.w.fermerLive.toString()), "T11 la ligne de fermerLive est protégée par typeof (la variable est déclarée plus loin dans le fichier)");

    // ── T12 : bouton 🔩 du BT live ──
    repartir();
    A.set("liveId", "m1");
    A.w.document.getElementById("live-page").classList.add("ouvert");
    A.w.liveRendre();
    const bl = A.$$("#live-corps button").find(b => /brpOuvrirPourMachine/.test(b.getAttribute("onclick") || ""));
    ok(!!bl && /'m1'/.test(bl.getAttribute("onclick")) && /'live'/.test(bl.getAttribute("onclick")) && /surtout depuis l'ordinateur/.test(A.txt("#live-corps")), "T12 le BT live a un bouton 🔩 (identifiant seulement, origine « live ») et l'aide « surtout depuis l'ordinateur »");
    bl.click();
    ok(ouvertures.length === 1 && A.get("brpCibleBT").origine === "live", "T12 le bouton du live ouvre le catalogue, cible d'origine « live »");
    A.w.fermerLive();
    ok(A.get("brpCibleBT") === null, "T12 fermer le live termine la recherche");
    ok(typeof A.w.bonDeTravail === "function" && String(A.w.bonDeTravail).length > 1000 && !/brpOuvrirPourMachine|Chercher une pièce BRP|brpCibleBT/.test(String(A.w.bonDeTravail)), "T12 rien dans le bon imprimé (fenêtre séparée, pop-up bloqué)");

    // ── T13 : modale de choix du bon ──
    repartir();
    const gros = bonsDeBase();
    for (let i = 0; i < 50; i++) gros.push({ id: "g" + i, numeroBT: "BT-" + (300 + i), nom: "GTX " + i, marque: "BRP", modeleId: "brp-gti90", annee: "2021", client: "Client " + i, statut: i % 5 === 0 ? "avenir" : "reparation", pieces: [] });
    gros.push({ id: "gf", numeroBT: "BT-900", nom: "Facturé", marque: "BRP", client: "Zoé", statut: "prete", pieces: [] }, { id: "gp", numeroBT: "BT-901", nom: "Prêt", marque: "BRP", client: "Yan", statut: "afacturer", pieces: [] },
      { id: "gl", numeroBT: "BT-100", nom: "En live", marque: "BRP", modeleId: "brp-gti90", annee: "2021", client: "Léa Live", statut: "reparation", chrono: [{ tech: "Gwendal", debut: new Date().toISOString(), fin: null, pauses: [] }], pieces: [] });
    A.set("machines", gros);
    A.w.ouvrirCommandes();
    const entete = A.$("#voile-commandes h2 .pcs-brp-btn");
    ok(!!entete && /Recherche de pièce BRP/.test(entete.textContent) && /cmdBrpChoisir\(\)/.test(entete.getAttribute("onclick")) && !entete.classList.contains("gestion-seul") && !entete.closest(".gestion-seul"), "T13 en-tête de Pièces à commander : « 🔩 Recherche de pièce BRP » → cmdBrpChoisir(), sans gestion-seul");
    A.w.cmdBrpChoisir();
    const modale = A.$("#voile-cmd-brp");
    ok(!!modale && modale.classList.contains("ouvert"), "T13 la modale #voile-cmd-brp s'ouvre");
    const lignes13 = A.$$("#voile-cmd-brp .pcs-bon");
    ok(lignes13.length === 40, "T13 40 bons au plus (53 BRP actifs en tout) : " + lignes13.length);
    ok(/BT-100/.test(lignes13[0].textContent) && /en cours/.test(lignes13[0].textContent), "T13 le bon en live passe en premier (🔴 en cours)");
    ok(!lignes13.some(b => /BT-900|BT-901/.test(b.textContent)) && !A.$$("#voile-cmd-brp .pcs-bon").some(b => /BT-202/.test(b.textContent)), "T13 « Prêt à facturer » et « Facturé » exclus par défaut ; les bons non BRP (Yamaha) aussi");
    ok(/autres? bons?/.test(A.txt("#voile-cmd-brp")), "T13 mention des bons non affichés (« précise la recherche »)");
    const champ = A.$("#pcs-recherche"); champ.value = "léa live"; champ.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    ok(A.$$("#voile-cmd-brp .pcs-bon").length === 1 && /BT-100/.test(A.$$("#voile-cmd-brp .pcs-bon")[0].textContent), "T13 recherche par client (sans accents ni majuscules) : « léa live » → BT-100");
    champ.value = "bt-203"; champ.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    ok(A.$$("#voile-cmd-brp .pcs-bon").length === 1, "T13 recherche par n° de BT");
    champ.value = "trixx"; champ.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    ok(A.$$("#voile-cmd-brp .pcs-bon").length === 1 && /BT-203/.test(A.txt("#voile-cmd-brp .pcs-bon")), "T13 recherche par machine");
    champ.value = "zoé"; champ.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    ok(A.$$("#voile-cmd-brp .pcs-bon").length === 0, "T13 un bon facturé n'apparaît pas tant que la case n'est pas cochée");
    const caseTout = A.$("#pcs-tout"); caseTout.checked = true; caseTout.dispatchEvent(new A.w.Event("change", { bubbles: true }));
    ok(A.$$("#voile-cmd-brp .pcs-bon").length === 1 && /BT-900/.test(A.txt("#voile-cmd-brp .pcs-bon")), "T13 « Montrer aussi les bons prêts à facturer et facturés » les ajoute");
    champ.value = "BT-201"; champ.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    const choix = A.$$("#voile-cmd-brp .pcs-bon")[0];
    purger();
    choix.click();
    ok(!A.$("#voile-cmd-brp").classList.contains("ouvert") && ouvertures.length === 1 && ouvertures[0].url === URL_ATTENDUE && A.get("brpCibleBT").origine === "commandes" && A.get("brpCibleBT").machineId === "m1", "T13 le clic sur un bon ferme la modale ET ouvre BRP dans le même tick (window.open synchrone), origine « commandes »");
    ok(A.toasts().length === 1, "T13 un seul toast");
    A.w.fermerCommandes();

    // ── T14 : rôle Réception : le bouton reste visible ──
    repartir();
    A.set("sessionCourante", { nom: "Marie", quand: new Date().toISOString() });
    A.w.appliquerDroits();
    A.w.ouvrirCommandes();
    const vis = (el) => { const cs = A.w.getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden"; };
    const bRecep = A.$("#voile-commandes h2 .pcs-brp-btn"), bDelais = A.$("#voile-commandes h2 .gestion-seul");
    ok(A.w.document.body.classList.contains("sans-gestion"), "T14 (préparation) Marie est en réception : classe « sans-gestion »");
    ok(bRecep && vis(bRecep) && bDelais && !vis(bDelais), "T14 Réception : « 🔩 Recherche de pièce BRP » est visible, « ⏱️ Délais de commande » reste masqué");
    A.set("sessionCourante", { nom: "Jason", quand: new Date().toISOString() });
    A.w.appliquerDroits();
    A.w.fermerCommandes();

    // ── T15 : rétrocompatibilité de enregistrerCommandePiece, du script 2.3 et du script 2.4 ──
    repartir();
    A.w.enregistrerCommandePiece("m1", "BT-201", "Gwendal", [{ qte: "2", num: "ZZ1", description: "Joint" }]);
    ok(cmds().length === 1 && cmds()[0].pieces[0].qte === "2" && !("source" in cmds()[0].pieces[0]) && !("prixBRP" in cmds()[0].pieces[0]) && machine("m1").pieces.length === 1 && machine("m1").pieces[0].coche === false, "T15 enregistrerCommandePiece à 4 paramètres (bon imprimé, live) : comme avant, la liste du BT reçoit la ligne, aucun champ « source » ajouté");
    A.w.enregistrerCommandePiece("m1", "BT-201", "Gwendal", [{ qte: "1", num: "ZZ2", description: "Vis" }], true);
    ok(cmds().length === 2 && machine("m1").pieces.length === 1, "T15 avec sansListe = true : la commande est créée, la liste du BT n'est pas touchée");
    repartir();
    ouvrirBon("m1", "carte");
    purger();
    post(piece(PN1, { ver: undefined }));
    await dodo(80);
    ok(cmds().length === 1 && machine("m1").pieces.length === 1, "T15 l'app v178 avec le script 2.3 (message sans « ver ») : la pièce va bien au BT");
    ok(A.toasts().length === 1 && /ajouté aux pièces à commander de BT-201/.test(A.toasts()[0]) && /script MTR pas à jour/.test(A.toasts()[0]), "T15 …et UN toast avertit que le script n'est pas à jour (« " + A.toasts()[0].slice(-80) + " »)");
    ok(A.get("brpScriptVer") === "", "T15 version du script inconnue pour l'app (message sans ver)");
    purger();
    post(piece(PN2, { ver: "2.4" }));
    await dodo(80);
    ok(A.get("brpScriptVer") === "2.4" && !/pas à jour/.test(A.toasts().join()), "T15 message avec ver « 2.4 » : version retenue, pas d'avertissement");
    // panier en mode soumission : champ « cible » ajouté, rien d'autre ne change
    repartir();
    A.w.soumNouvelle({ marque: "BRP", modeleId: "brp-gti90", annee: "2021", type: "motomarine", lignes: [] });
    const fS = fenetre(); A.set("brpFenetre", fS);
    A.w.brpEnvoyerPanier(fS);
    ok(fS.posts.length === 1 && fS.posts[0].type === "MTR_PANIER" && Array.isArray(fS.posts[0].lignes) && "numero" in fS.posts[0] && /^soumission/.test(fS.posts[0].cible), "T15 MTR_PANIER d'une soumission : mêmes champs qu'avant (+ cible « soumission … »)");
    post({ type: "MTR_PANIER_DEMANDE" });
    ok(fS.posts.length >= 1, "T15 MTR_PANIER_DEMANDE sans « ver » (script 2.3) répond encore");

    // ── T16 : cible restaurée depuis sessionStorage / valeur illisible ──
    const cibleStock = { machineId: "m1", numeroBT: "BT-201", tech: "Jason", origine: "carte", le: Date.now() };
    const A2 = await L.chargerApp({ sb: S.sb, avant(w) { try { w.sessionStorage.setItem("mtr_brp_cible", JSON.stringify(cibleStock)); } catch (_) {} } });
    ok(A2.get("brpCibleBT") && A2.get("brpCibleBT").machineId === "m1", "T16 après un rechargement de l'onglet, la cible est relue de sessionStorage");
    const A3 = await L.chargerApp({ sb: S.sb, avant(w) { try { w.sessionStorage.setItem("mtr_brp_cible", "{pas du json"); } catch (_) {} } });
    ok(A3.get("brpCibleBT") === null && A3.erreurs.length === 0, "T16 une valeur illisible dans sessionStorage ne casse rien (cible nulle, aucune erreur)");

    // ── T17 : le script Tampermonkey 2.4 ──
    let src = null; try { src = L.fs.readFileSync(FICHIER.replace(/index\.html$/, "") + "mtr-ajouter-brp.user.js", "utf8"); } catch (_) {}   // sabotage.sh ne copie que index.html, tv.html et procedure.html : pas de script à côté
    if (src === null) console.log("ℹ T17 ignoré : le script n'est pas à côté de l'index testé");
    else {
    ok(/@version\s+2\.4\b/.test(src) && /const VERSION = '2\.4';/.test(src), "T17 script : @version et VERSION à 2.4");
    ok(/type: 'MTR_AJOUT_PIECE'[^\n]*ver: VERSION/.test(src) && /type: 'MTR_PANIER_DEMANDE', ver: VERSION/.test(src), "T17 script : MTR_AJOUT_PIECE et MTR_PANIER_DEMANDE portent « ver »");
    ok(/d\.cible/.test(src) && /toast\(ok \? '✓ ' \+ piece\.nom \+ ' → ' \+ dest\(\)/.test(src) && !/→ soumission'/.test(src) && !/lié à la soumission/.test(src), "T17 script : le toast du clic et la pastille affichent la cible reçue (plus de « soumission » en dur)");
    }

    ok(A.erreurs.length === 0, "aucune erreur JavaScript pendant tout le test (" + A.erreurs.length + ")" + (A.erreurs.length ? " : " + A.erreurs.slice(0, 3).join(" | ") : ""));
  } catch (e) {
    ok(false, "exception dans le test : " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" ⏎ ") : e));
  }
  process.exit();
})();
