// test-v178-com.js — v178, lot COM : note d'appel → BT / note d'atelier (A3) et confirmation SMS côté application (A1).
//   liveVoir, btAjouterNoteAtelier, bloc « Bons de travail du client » (note d'appel, fil, popup d'appel Linkus),
//   {adresse} des gabarits, garde du popup de confirmation, « Renvoyer », carte de la demande, trace du texto manuel.
// node outils-v178/run-in-chromium.js test-v178-com.js ./index.html   (ou, avec jsdom : NODE_PATH=…/node_modules node test-v178-com.js ./index.html)
const L = require("./outils-v178/test-lib-v178.js");
const { ok, dodo, attendre, cp } = L;
const FICHIER = process.argv[2] || "./index.html";
const HTML = L.fs.readFileSync(FICHIER, "utf8");
const T = "8195550101", TJ = "8195550202", TX = "8195550404";
const iso = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();
const XSS = "<img src=x onerror=alert(1)>";

const MACH = () => [
  { id: "bt-a", numeroBT: "BT-101", nom: "2021 Maverick X3", client: "Marc Tremblay", clientId: "cl-1", tel: "819-555-0101", statut: "reparation", machineArrivee: true, chrono: [], pieces: [] },
  { id: "bt-b", numeroBT: "BT-102", nom: "Spark 90", client: "Marc Tremblay", clientId: "cl-1", tel: "819-555-0101", statut: "avenir", echeance: L.jourIso(3), heure: "09:00", chrono: [], pieces: [] },
  { id: "bt-c", numeroBT: "BT-103", nom: "Pièce Ranger", client: "Marc Tremblay", clientId: "cl-1", tel: "819-555-0101", statut: "commande", chrono: [], pieces: [] },
  { id: "bt-d", numeroBT: "BT-090", nom: "Vieille RZR", client: "Marc Tremblay", clientId: "cl-1", tel: "819-555-0101", statut: "archive", chrono: [] },
  { id: "bt-e", numeroBT: "BT-201", nom: "Summit 850", client: "Julie Roy", clientId: "cl-2", tel: "819-555-0202", statut: "reparation", machineArrivee: true, chrono: [], pieces: [] },
];
const CLIENTS = () => [
  { id: "cl-1", nom: "Marc Tremblay", tel: "819-555-0101", machines: [] },
  { id: "cl-2", nom: "Julie Roy", tel: "819-555-0202", machines: [] },
  { id: "cl-x", nom: XSS, tel: "819-555-0404", machines: [] },
];
const EMPX = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true, droits: { live: false, communications: true } },
  { nom: "Marie", nomFamille: "Roy", role: "reception", actif: true }];

(async () => {
  const db = {
    tableau: [{ id: 1, donnees: MACH() }, { id: 4, donnees: cp(EMPX) }],
    communications: [], telephonie_config: [], rappels_envoyes: [], demandes_journal: [], sms_recus: [], creneaux_actifs: [], creneaux_reserves: [],
    rappels_config: [{ id: "rc-1", type: "confirmation", nom: "Confirmation", actif: true, ordre: 0, gabarit: "Bonjour {prenom}, rendez-vous le {date} à {heure}. Adresse : {adresse}. {shop}" }],
    demandes_service: [],
  };
  const S = L.creerSupabase(db);
  // délai artificiel sur la ligne 1 (« tableau ») pour rendre la course « dialogue fermé pendant l'attente » reproductible
  let retardTableau = 0;
  { const orig = S.sb.from.bind(S.sb);
    S.sb.from = (nom) => { const ch = orig(nom); if (nom !== "tableau") return ch;
      const w = new Proxy({}, { get(_, k) { if (k === "then") return (res, rej) => dodo(retardTableau).then(() => ch.then(res, rej)); return (...a) => { const r = ch[k](...a); return r === ch ? w : r; }; } });
      return w; }; }
  const rejets = [];   // promesses rejetées non gérées dans l'application (un rendreNote() sur une note fermée lèverait ici)
  const A = await L.chargerApp({ sb: S.sb, fetch: async (u, init) => /smart-api/.test(u) ? { status: 200, data: { ok: true, sid: "SM-test" } } : null,
    avant: (w) => w.addEventListener("unhandledrejection", (e) => rejets.push(String((e.reason && e.reason.message) || e.reason))) });
  const { $, $$, w } = A;
  const poser = (m) => { S.db.tableau.find(r => r.id === 1).donnees = cp(m); A.set("machines", cp(m)); };
  const machines = () => A.get("machines");
  const bon = (id) => machines().find(m => m.id === id);
  const txt = (s) => A.txt(s);
  const voileOuvert = (id) => $("#" + id) && $("#" + id).classList.contains("ouvert");
  const live = () => voileOuvert("live-page");
  const comms = () => S.db.communications;
  const upserts1 = () => S.appels.filter(a => a.table === "tableau" && a.op === "upsert").length;
  const rien = async () => { await dodo(60); };
  const etat = (m) => JSON.stringify({ chrono: m.chrono, statut: m.statut, arr: m.machineArrivee || null, tech: m.technicien || null, fini: m.travauxTermines || null, pret: m.pretAFacturerLe || null });
  const viderToasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).forEach(x => x.remove());
  const fermerTout = () => {
    viderToasts();
    try { w.fermerLive(); } catch (_) {}
    ["comm-voile", "comm-voile2", "rap-voile", "rap-voile-conf", "dem-voile"].forEach(id => { const e = $("#" + id); if (e) e.classList.remove("ouvert"); });
    $$(".comm-propo").forEach(e => e.remove());
    try { A.set("noteCourante", null); } catch (_) {}
  };
  let n = 0; const idPopup = () => "pp-" + (++n);
  const ouvrirNote = async (tel, opts) => { await w.commNoteAppel(tel, opts || { manuel: true }); await rien(); return $("#comm-boite2"); };
  const btns = (sel) => $$("#comm-boite2 " + sel);

  const groupe = async (nom, f) => { try { await f(); } catch (e) { ok(false, nom + " : exception " + (e && e.message)); try { fermerTout(); } catch (_) {} } };
  L.connecter(A, "Jason", EMPX);
  A.set("clients", CLIENTS()); poser(MACH());
  await dodo(700);                         // laisse les minuteries d'initialisation (module Rappels, Communications) passer

  // ════════ 0. Structure et contrats ════════
  await groupe("0. Structure et contrats", async () => {
  ok((HTML.match(/function liveVoir\(/g) || []).length === 1, "liveVoir : exactement UNE définition dans index.html");
  ok(["//@@v178-A3 liveVoir", "//@@v178-A3 notes", "//@@v178-A11 proposerNote"].every(a => HTML.split(a).length === 2), "les ancres A3 / A11 sont intactes (une occurrence chacune)");
  { const i = HTML.indexOf("//@@v178-A11 proposerNote"); const apres = HTML.slice(i, i + 200).split("\n");
    ok(/^\s*\}\s*$/.test(apres[1]) && /if \(bcAppel\) bcAppel\.onmessage/.test(apres[2]), "l'ancre A11 reste la dernière ligne du corps de proposerNote (SON y ajoute sa ligne)"); }
  ok(typeof w.commNoteAppel === "function" && w.__comm.note === w.commNoteAppel && typeof w.__comm.comms === "function" && typeof w.__comm.rappelAction === "function" && typeof w.ouvrirCommunications === "function",
     "contrats avec « Mon poste » (v177) : commNoteAppel, __comm.note / comms / rappelAction, ouvrirCommunications");
  ok(typeof w.liveVoir === "function" && typeof w.btAjouterNoteAtelier === "function", "liveVoir et btAjouterNoteAtelier existent");
  });

  // ════════ 1. liveVoir : l'écran du bon, sans punch ════════
  await groupe("1. liveVoir : l'écran du bon, sans punch", async () => {
  { const m0 = etat(bon("bt-b")), u0 = upserts1();
    const r = w.liveVoir("bt-b");
    ok(r === true && live() && A.get("liveId") === "bt-b", "liveVoir : #live-page ouvert sur le bon demandé");
    ok(etat(bon("bt-b")) === m0 && JSON.stringify(bon("bt-b").chrono) === "[]" && bon("bt-b").statut === "avenir" && !bon("bt-b").machineArrivee, "liveVoir : m.chrono, statut (à venir) et machineArrivee inchangés — aucun punch");
    ok(upserts1() === u0 && A.toasts().every(t => !/punch démarré/.test(t)), "liveVoir : rien d'écrit, aucun toast « punch démarré »");
    ok(/BT-102/.test(txt("#live-titre")) && /Aucun technicien connecté/.test(txt("#live-chronos")) && /Ajouter mon temps/.test(txt("#live-btn-pause")), "l'écran montre le BT-102, aucun technicien connecté, « ▶ Ajouter mon temps » reste actif (ce n'est pas une lecture seule)");
    fermerTout();
    ok(w.liveVoir("bt-introuvable") === false && !live() && A.toasts().some(t => /n'existe plus/.test(t)), "liveVoir : bon introuvable → toast, aucun écran");
    L.connecter(A, "Gwendal", EMPX);
    ok(w.liveVoir("bt-a") === false && !live() && A.toasts().some(t => /n'est pas ouverte pour toi/.test(t)), "liveVoir : sans le droit « live », refusé avec le message habituel");
    L.connecter(A, "Marie", EMPX);
    ok(w.liveVoir("bt-a") === true && live(), "liveVoir : la réception (aucun verrou de punch) peut ouvrir le bon");
    fermerTout(); L.connecter(A, "Jason", EMPX); }
  });

  // ════════ 2. surPlace / btsClient ════════
  await groupe("2. surPlace / btsClient", async () => { const { surPlace, btsClient, machinesEnAtelier } = w.__comm;
    ok(surPlace({ statut: "reparation" }) && surPlace({ statut: "attente" }) && surPlace({ statut: "afacturer" }) && surPlace({ statut: "prete" }) && surPlace({ statut: "sansrdv" }), "surPlace : réparation, attente de pièce, prêt à facturer, facturé, sans rdv = sur place");
    ok(!surPlace({ statut: "archive" }) && !surPlace({ statut: "commande" }) && !surPlace({ statut: "avenir" }) && surPlace({ statut: "avenir", machineArrivee: true }) && !surPlace(null), "surPlace : archivé, commande de pièce, à venir non arrivé = non ; à venir ARRIVÉ = oui");
    const l = btsClient("819 555-0101", { id: "cl-1" }).map(m => m.id);
    ok(JSON.stringify(l) === '["bt-a","bt-b","bt-c"]', "btsClient : bons non livrés du client, sur place d'abord (" + l + ")");
    ok(JSON.stringify(machinesEnAtelier(T).map(m => m.id)) === '["bt-a"]', "machinesEnAtelier = les bons sur place seulement");
    const m = machines(); m.push({ id: "bt-g", numeroBT: "BT-150", nom: "Autre machine", client: "M. Tremblay", clientId: "cl-1", tel: "819-555-9999", statut: "attente", chrono: [] }); A.set("machines", m);
    ok(JSON.stringify(btsClient("", { id: "cl-1" }).map(x => x.id)) === '["bt-a","bt-g","bt-b","bt-c"]', "btsClient : retrouve aussi les bons de la même fiche client avec un autre numéro (et sans téléphone)");
    ok(JSON.stringify(btsClient("", null)) === "[]" && JSON.stringify(btsClient("819-555-0202", null).map(x => x.id)) === '["bt-e"]', "btsClient : sans numéro ni client = rien ; par numéro seul = les bons de ce numéro");
    poser(MACH()); });

  // ════════ 3. Note d'appel : le bloc « Bons de travail du client » ════════
  await groupe("3. Note d'appel : le bloc « Bons de travail du client »", async () => { await ouvrirNote(T);
    const rows = btns(".comm-bts .comm-bt");
    ok(rows.length === 3 && /Bons de travail du client/.test(txt("#comm-boite2 .comm-bts")), "note d'appel : bloc « Bons de travail du client » avec 3 bons (BT-101, 102, 103 ; le bon livré est exclu)");
    ok(/BT-101/.test(rows[0].textContent) && /🔧/.test(rows[0].textContent) && /📅/.test(rows[1].textContent) && /📦/.test(rows[2].textContent), "icônes : 🔧 sur place d'abord, 📅 à venir, 📦 commande de pièce");
    ok(/Réparation en cours/.test(rows[0].textContent) && /À venir/.test(rows[1].textContent) && /Commande de pièce/.test(rows[2].textContent), "statuts libellés avec libelle() (« Réparation en cours », « À venir »…)");
    ok(btns("[data-bt-ouvrir]").length === 3 && btns("[data-bt-note]").length === 3 && /📋 Ouvrir le BT/.test(btns("[data-bt-ouvrir]")[0].textContent) && /📝 Note d'atelier/.test(btns("[data-bt-note]")[0].textContent), "chaque bon a « 📋 Ouvrir le BT » et « 📝 Note d'atelier »");
    ok(!/🔧 En atelier :/.test(txt("#comm-boite2")), "l'ancien texte vert « 🔧 En atelier : … » est remplacé par le bloc");
    ok($("#comm-boite2 .comm-bts").compareDocumentPosition($("#cn-rdv")) & 4, "le bloc est placé avant les raccourcis (rendez-vous / soumission)");
    ok(btns(".past button").some(b => /Maverick/.test(b.textContent)) && btns(".past button").some(b => /Spark 90/.test(b.textContent)), "pastilles « Machine » : tous les bons non livrés du client y sont toujours");
    fermerTout();
    await ouvrirNote("819-555-7777");
    ok(!$("#comm-boite2 .comm-bts"), "numéro sans bon : aucun bloc");
    fermerTout();
    // plus de 5 bons : 5 lignes puis « … et N autre(s) »
    const m = machines(); for (let i = 0; i < 4; i++) m.push({ id: "bt-x" + i, numeroBT: "BT-5" + i, nom: "Machine " + i, client: "Marc Tremblay", clientId: "cl-1", tel: "819-555-0101", statut: "reparation", machineArrivee: true, chrono: [] }); A.set("machines", m);
    await ouvrirNote(T);
    ok(btns(".comm-bts .comm-bt").length === 5 && /… et 2 autre\(s\)/.test(txt("#comm-boite2 .comm-bts")), "7 bons : 5 lignes puis « … et 2 autre(s) »");
    fermerTout(); poser(MACH());
    // sans le droit « live » : seulement la note d'atelier
    L.connecter(A, "Gwendal", EMPX);
    await ouvrirNote(T);
    ok(btns("[data-bt-ouvrir]").length === 0 && btns("[data-bt-note]").length === 3, "sans le droit « live » : pas de « Ouvrir le BT », la note d'atelier reste");
    fermerTout(); L.connecter(A, "Jason", EMPX); });

  // ════════ 4. « Ouvrir le BT » depuis la note d'appel ════════
  await groupe("4. « Ouvrir le BT » depuis la note d'appel", async () => { fermerTout(); await ouvrirNote(T);
    const n0 = comms().length, avant = etat(bon("bt-a")), sess0 = JSON.stringify(A.get("sessionCourante"));
    btns('[data-bt-ouvrir="bt-a"]')[0].click(); await dodo(300);
    ok(live() && A.get("liveId") === "bt-a", "« Ouvrir le BT » : #live-page ouvert sur le bon cliqué");
    ok(etat(bon("bt-a")) === avant && bon("bt-a").chrono.length === 0 && JSON.stringify(A.get("sessionCourante")) === sess0, "m.chrono, statut, machineArrivee inchangés ; aucune session ouverte");
    ok(!voileOuvert("comm-voile") && !voileOuvert("comm-voile2"), "les voiles Communications sont fermés");
    ok(comms().length === n0, "sans rien de saisi : aucune ligne vide créée dans Communications");
    fermerTout();
    // avec du texte : la note est gardée d'abord
    await ouvrirNote(T); $("#cn-texte").value = "Veut savoir si la courroie est arrivée";
    btns('[data-bt-ouvrir="bt-a"]')[0].click(); await dodo(300);
    const l = comms().find(c => /courroie/.test(c.contenu || ""));
    ok(live() && l && l.tel === T && l.meta && l.meta.note === "Veut savoir si la courroie est arrivée" && l.statut === "traite", "avec du texte : la note est enregistrée (réglée) puis le bon s'ouvre");
    ok(comms().filter(c => /courroie/.test(c.contenu || "")).length === 1, "une seule ligne pour la note");
    fermerTout();
    // deux clics synchrones : une seule ouverture / une seule ligne
    await ouvrirNote(T); $("#cn-texte").value = "Double clic";
    { const b = btns('[data-bt-ouvrir="bt-a"]')[0]; b.click(); b.click(); }
    await dodo(300);
    ok(comms().filter(c => /Double clic/.test(c.contenu || "")).length === 1, "deux clics synchrones sur « Ouvrir le BT » : une seule ligne enregistrée");
    fermerTout(); });

  // ════════ 5. « Note d'atelier » depuis la note d'appel ════════
  await groupe("5. « Note d'atelier » depuis la note d'appel", async () => { fermerTout(); poser(MACH()); comms().length = 0; S.appels.length = 0;
    await ouvrirNote(T);
    // refus : texte vide
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(120);
    ok(!bon("bt-a").notesLive && comms().length === 0 && A.toasts().some(t => /Écris d'abord la note/.test(t)), "texte vide : refusé (toast), aucune note, aucune ligne");
    // texte multi-ligne et long : aplati, plafonné à 300
    const long = "Le client dit :\nla machine  chauffe\r\net il veut la récupérer vendredi. " + "x".repeat(400);
    $("#cn-texte").value = long;
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(500);
    const nl = (bon("bt-a").notesLive || []);
    const e = nl[nl.length - 1] || {};
    ok(nl.length === 1 && /^📞 Appel : Le client dit : la machine chauffe et il veut la récupérer vendredi\. x+$/.test(e.texte), "note d'atelier : préfixe « 📞 Appel : » sans nom du client, retours à la ligne aplatis");
    ok(e.texte.length === "📞 Appel : ".length + 300, "la remarque est plafonnée à 300 caractères (" + (e.texte || "").length + ")");
    ok(e.src === "appel" && e.tech === "Jason" && !isNaN(new Date(e.quand)), "entrée {texte, tech, quand, src:'appel'} (tech = l'employé connecté, quand = ISO)");
    ok(bon("bt-a").notesTech === "• " + e.texte, "m.notesTech reçoit la note (écran live, TV du lift, bon imprimé)");
    ok(S.db.tableau.find(r => r.id === 1).donnees.find(m => m.id === "bt-a").notesLive.length === 1, "la ligne 1 du serveur contient la note (sauvegarder() a écrit)");
    ok(A.toasts().some(t => /Note d'atelier ajoutée au BT-101/.test(t)), "toast de succès « Note d'atelier ajoutée au BT-101 »");
    const lc = comms()[0];
    ok(comms().length === 1 && lc.ref_bt === "bt-a" && Array.isArray(lc.meta.noteAtelier) && lc.meta.noteAtelier.length === 1 && lc.meta.noteAtelier[0].id === "bt-a", "la note d'appel porte ref_bt = le bon et meta.noteAtelier [{id, texte}]");
    ok(/✔ note ajoutée/.test(txt('#comm-boite2 [data-bt="bt-a"]')) && !/✔ note ajoutée/.test(txt('#comm-boite2 [data-bt="bt-b"]')), "le dialogue se redessine : « ✔ note ajoutée » sur le bon concerné seulement");
    ok($("#cn-texte").value === long.replace(/\r\n/g, "\n"), "le texte de la note d'appel est conservé dans le dialogue");
    // doublon exact refusé
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(250);
    ok(bon("bt-a").notesLive.length === 1 && A.toasts().some(t => /déjà sur le BT-101/.test(t)), "même texte, même bon : refusé (toast « déjà sur le BT-101 »)");
    // une 2e remarque différente : permise
    $("#cn-texte").value = "Il passe finalement jeudi";
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(500);
    ok(bon("bt-a").notesLive.length === 2 && bon("bt-a").notesLive[1].texte === "📞 Appel : Il passe finalement jeudi" && comms()[0].meta.noteAtelier.length === 2 && comms().length === 1, "une 2e remarque différente est ajoutée (la même ligne de Communications, 2 entrées de noteAtelier)");
    // le même texte sur un AUTRE bon : permis
    btns('[data-bt-note="bt-b"]')[0].click(); await dodo(500);
    ok((bon("bt-b").notesLive || []).length === 1 && comms()[0].meta.noteAtelier.length === 3, "le même texte sur un autre bon du client : permis");
    fermerTout();

    // deux clics synchrones : une seule note
    poser(MACH()); comms().length = 0;
    await ouvrirNote(T); $("#cn-texte").value = "Rappeler avant midi";
    { const b = btns('[data-bt-note="bt-a"]')[0]; b.click(); b.click(); b.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); }
    await dodo(600);
    ok((bon("bt-a").notesLive || []).length === 1, "trois clics synchrones sur « Note d'atelier » : une seule note");
    ok(comms().length === 1, "… et une seule ligne dans Communications");
    fermerTout();

    // réouverture de la note (✎ Note) : meta repart de l'ancien (noteAtelier gardé, doublon toujours refusé)
    await w.__comm.charger();
    const ligne = comms()[0];
    await w.commNoteAppel(T, { existant: ligne }); await rien();
    ok(/✔ note ajoutée/.test(txt('#comm-boite2 [data-bt="bt-a"]')), "rouvrir la note : le bon qui a déjà reçu la remarque est marqué");
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(250);
    ok((bon("bt-a").notesLive || []).length === 1, "rouvrir la note : le même texte n'est pas renvoyé au bon");
    $("#cn-texte").value = "Rappeler avant midi (précision)"; $("#cn-texte").dispatchEvent(new w.Event("change")); await dodo(250);
    ok(comms()[0].meta.noteAtelier && comms()[0].meta.noteAtelier.length === 1 && comms()[0].ref_bt === "bt-a" && comms()[0].meta.note === "Rappeler avant midi (précision)", "sauverNote repart de l'ancien meta : noteAtelier et ref_bt survivent à une modification de la note");
    fermerTout();

    // meta d'un appel manqué (existant) : les autres clés du meta sont gardées
    comms().push({ id: 900, cree_le: iso(-5), tel: T, canal: "appel_manque", direction: "in", statut: "a_traiter", contenu: "Appel manqué", meta: { sms: "envoyé", conversation: 120 } });
    await w.__comm.charger();
    await w.commNoteAppel(T, { existant: comms().find(c => c.id === 900) }); await rien();
    $("#cn-texte").value = "Rappelé, tout va bien"; $("#cn-texte").dispatchEvent(new w.Event("change")); await dodo(250);
    ok(comms().find(c => c.id === 900).meta.sms === "envoyé" && comms().find(c => c.id === 900).meta.conversation === 120 && comms().find(c => c.id === 900).meta.note === "Rappelé, tout va bien", "modifier une ligne existante : les clés d'origine du meta ne sont plus effacées");
    fermerTout(); comms().length = 0; });

  // ════════ 6. Synchro : le tableau des bons est remplacé pendant que la note est ouverte ════════
  await groupe("6. Synchro : le tableau des bons est remplacé pendant que la note est ouverte", async () => { fermerTout(); poser(MACH()); comms().length = 0;
    await ouvrirNote(T); $("#cn-texte").value = "Note après remplacement";
    const ancien = bon("bt-a");
    // un autre poste a sauvegardé : le serveur a de NOUVEAUX objets (et une note déjà posée là-bas)
    const frais = MACH(); frais[0].notesLive = [{ texte: "Note d'un autre poste", tech: "Gwendal", quand: iso(-3) }]; frais[0].notesTech = "• Note d'un autre poste";
    S.db.tableau.find(r => r.id === 1).donnees = cp(frais);
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(700);
    const nouveau = bon("bt-a");
    ok(nouveau !== ancien && (nouveau.notesLive || []).length === 2 && nouveau.notesLive[0].texte === "Note d'un autre poste" && nouveau.notesLive[1].texte === "📞 Appel : Note après remplacement", "synchro : le tableau a été relu, la note est sur l'objet FRAIS (la note de l'autre poste est gardée)");
    ok(!(ancien.notesLive || []).some(x => /après remplacement/.test(x.texte)), "synchro : l'ancien objet n'a pas été modifié dans le vide");
    ok(S.db.tableau.find(r => r.id === 1).donnees.find(m => m.id === "bt-a").notesLive.length === 2, "synchro : le serveur a les 2 notes");
    fermerTout();
    // tableau remplacé localement (A.set) sans relecture possible : retrouvé par id au moment d'écrire
    poser(MACH()); await ouvrirNote(T); $("#cn-texte").value = "Remplacé en local";
    const sauve = JSON.stringify(MACH());
    A.set("machines", cp(MACH()));      // nouveaux objets, même contenu
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(600);
    ok((bon("bt-a").notesLive || []).length === 1 && bon("bt-a").notesLive[0].texte === "📞 Appel : Remplacé en local", "objets remplacés entre l'ouverture et le clic : la note est sur l'objet courant");
    fermerTout();
    // le bon a disparu
    poser(MACH()); comms().length = 0; await ouvrirNote(T); $("#cn-texte").value = "Bon disparu";
    poser(MACH().filter(m => m.id !== "bt-a"));
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(500);
    ok(A.toasts().some(t => /n'existe plus au tableau/.test(t)) && comms().length === 0 && (A.get("machines").every(m => !m.notesLive)), "bon disparu : toast, aucune note, aucune ligne Communications");
    fermerTout();
    // dialogue fermé pendant l'attente : il ne se rouvre pas
    poser(MACH()); comms().length = 0;
    await ouvrirNote(T); $("#cn-texte").value = "Fermé pendant l'attente";
    const zoneAvant = $("#cn-texte");
    retardTableau = 250;
    btns('[data-bt-note="bt-a"]')[0].click();
    await dodo(30); $("#cn-fermer").click();                       // ✕ pendant l'await
    await dodo(1500); retardTableau = 0;
    ok(!voileOuvert("comm-voile2") && $("#cn-texte") === zoneAvant && rejets.length === 0, "dialogue fermé pendant l'attente : il ne se rouvre pas (et aucune exception en retour : " + rejets.join(" | ") + ")");
    ok((bon("bt-a").notesLive || []).some(x => /Fermé pendant l'attente/.test(x.texte)), "… mais la note est bien arrivée sur le bon");
    fermerTout();
    // une AUTRE note (Julie) s'ouvre pendant l'attente : elle n'est pas écrasée par le redessin de la première
    poser(MACH()); comms().length = 0;
    await ouvrirNote(T); $("#cn-texte").value = "Pour Marc pendant que Julie appelle";
    retardTableau = 250;
    btns('[data-bt-note="bt-a"]')[0].click();
    await dodo(30); $("#cn-fermer").click(); await ouvrirNote(TJ);
    const zoneJulie = $("#cn-texte");
    await dodo(1500); retardTableau = 0;
    ok(voileOuvert("comm-voile2") && /Julie Roy/.test(txt("#comm-boite2")) && !/Marc Tremblay/.test(txt("#comm-boite2")) && $("#cn-texte") === zoneJulie && rejets.length === 0, "note d'un autre client ouverte pendant l'attente : son dialogue reste intact (rien n'est redessiné par la note précédente)");
    ok((bon("bt-a").notesLive || []).some(x => /pendant que Julie appelle/.test(x.texte)), "… et la note de Marc est bien arrivée sur son bon");
    fermerTout();
    // réseau injoignable : la note reste sur l'appareil et le toast le dit
    poser(MACH()); comms().length = 0;
    await ouvrirNote(T); $("#cn-texte").value = "Hors réseau";
    S.pannes["tableau:upsert"] = "réseau coupé";
    btns('[data-bt-note="bt-a"]')[0].click(); await dodo(700);
    ok(A.get("ligne1EnAttente") === true && A.toasts().some(t => /gardée sur cet appareil/.test(t)) && !A.toasts().some(t => /Note d'atelier ajoutée/.test(t)), "réseau injoignable : toast « note gardée sur cet appareil », pas de faux succès");
    ok((bon("bt-a").notesLive || []).length === 1, "… la note est bien sur le bon, en local");
    delete S.pannes["tableau:upsert"]; A.set("ligne1EnAttente", false);
    fermerTout(); poser(MACH()); comms().length = 0; });

  // ════════ 7. Popup d'appel Linkus ════════
  await groupe("7. Popup d'appel Linkus", async () => { fermerTout(); poser(MACH()); comms().length = 0;
    // un seul bon sur place (Julie) : le bouton est là
    let id = idPopup(); w.__commProposerNote("819-555-0202", "2026-10-07T10:00:00Z", id); await rien();
    let p = $(".comm-propo");
    ok(p && $('.comm-propo [data-a="bt"]') && /📋 Ouvrir le BT-201/.test($('.comm-propo [data-a="bt"]').textContent) && /machine en atelier/.test(p.textContent), "popup d'appel : un seul bon sur place → « 📋 Ouvrir le BT-201 »");
    ok(p.classList.contains("comm-propo-bt") && $$(".comm-propo [data-a]").length === 3, "le popup garde « 📝 Ouvrir la note » et « Non merci » à côté");
    // clic : ligne appel_repondu avec ref_bt, popup fermé, bon ouvert ; double clic = une seule ligne
    { const b = $('.comm-propo [data-a="bt"]'); b.click(); b.click(); }
    await dodo(400);
    const lr = comms().filter(c => c.canal === "appel_repondu");
    ok(lr.length === 1 && lr[0].ref_bt === "bt-e" && lr[0].tel === TJ && lr[0].direction === "in" && lr[0].statut === "traite" && lr[0].meta.origine === "linkus", "clic : UNE ligne appel_repondu (ref_bt = le bon, direction in, réglée), même après un double clic");
    ok(!$(".comm-propo") && live() && A.get("liveId") === "bt-e" && bon("bt-e").chrono.length === 0, "le popup se ferme et le bon s'ouvre sans punch");
    fermerTout();
    // Marc : un bon sur place (bt-a) + à venir + commande → exactement un sur place
    id = idPopup(); w.__commProposerNote(T, "", id); await rien();
    ok($('.comm-propo [data-a="bt"]') && /BT-101/.test($('.comm-propo [data-a="bt"]').textContent), "un bon sur place + un « à venir » + une commande de pièce : le bouton vise le bon sur place (BT-101)");
    fermerTout();
    // deux sur place : pas de bouton
    { const m = machines(); m.push({ id: "bt-g", numeroBT: "BT-150", nom: "Autre", client: "Marc Tremblay", clientId: "cl-1", tel: "819-555-0101", statut: "attente", chrono: [] }); A.set("machines", m); }
    id = idPopup(); w.__commProposerNote(T, "", id); await rien();
    ok($(".comm-propo") && !$('.comm-propo [data-a="bt"]') && $$(".comm-propo [data-a]").length === 2, "2 bons sur place : pas de bouton BT");
    fermerTout(); poser(MACH());
    // aucun bon
    id = idPopup(); w.__commProposerNote("819-555-7777", "", id); await rien();
    ok($(".comm-propo") && !$('.comm-propo [data-a="bt"]'), "aucun bon : pas de bouton BT");
    fermerTout();
    // sans le droit « live »
    L.connecter(A, "Gwendal", EMPX);
    id = idPopup(); w.__commProposerNote("819-555-0202", "", id); await rien();
    ok($(".comm-propo") && !$('.comm-propo [data-a="bt"]'), "sans le droit « live » : pas de bouton BT");
    fermerTout(); L.connecter(A, "Jason", EMPX);
    // « 📝 Ouvrir la note » : comportement habituel inchangé
    comms().length = 0;
    id = idPopup(); w.__commProposerNote("819-555-0202", "2026-10-07T10:00:00Z", id); await rien();
    $('.comm-propo [data-a="oui"]').click(); await dodo(400);
    ok(!$(".comm-propo") && $("#cn-texte") && comms().filter(c => c.canal === "appel_repondu").length === 1 && !comms()[0].ref_bt, "« 📝 Ouvrir la note » : la note s'ouvre comme avant (ligne appel_repondu sans ref_bt)");
    ok(/Bons de travail du client/.test(txt("#comm-boite2")), "… et la note d'un appel Linkus montre le bloc des bons");
    fermerTout(); comms().length = 0;
    // popups empilés : le 2e ne recouvre pas le 1er (bouton BT sur le 1er)
    w.__commProposerNote("819-555-0202", "", idPopup()); w.__commProposerNote("819-555-0101", "", idPopup()); await rien();
    { const ps = $$(".comm-propo"); const r1 = ps[0].getBoundingClientRect(), r2 = ps[1].getBoundingClientRect();
      ok(ps.length === 2 && (r2.bottom <= r1.top + 1 || r1.bottom <= r2.top + 1), "2 popups empilés (le 1er avec le bouton BT, plus haut) : aucun chevauchement"); }
    w.__commProposerNote("819-555-0999", "", idPopup()); await rien();
    { const rs = $$(".comm-propo").map(e => e.getBoundingClientRect()); let chev = false;
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (!(rs[i].bottom <= rs[j].top + 1 || rs[j].bottom <= rs[i].top + 1)) chev = true;
      ok(rs.length === 3 && !chev && rs.every(r => r.top >= 0), "3 popups empilés : aucun chevauchement, tous dans l'écran"); }
    $$(".comm-propo")[0].remove(); await dodo(450);
    { const rs = $$(".comm-propo").map(e => e.getBoundingClientRect()); ok(rs.length === 2 && Math.abs((w.innerHeight - rs[0].bottom) - 18) < 3, "un popup retiré : les autres redescendent (le 1er revient à 18 px du bas)"); }
    fermerTout(); });

  // ════════ 8. Fil de Communications ════════
  await groupe("8. Fil de Communications", async () => { fermerTout(); poser(MACH()); comms().length = 0; S.appels.length = 0;
    comms().push(
      { id: 1, cree_le: iso(-300), tel: T, canal: "appel_repondu", direction: "in", statut: "traite", contenu: "Appel répondu", ref_bt: "bt-a", meta: { origine: "linkus" } },
      { id: 2, cree_le: iso(-200), tel: T, canal: "note", direction: "interne", statut: "rappel", rappel_le: iso(600), contenu: "⏰ Rappeler — Spark 90 · BT-102 — pièce", meta: { origine: "rappel", machine_id: "bt-b", machine: "Spark 90 · BT-102", note: "pièce" } },
      { id: 3, cree_le: iso(-150), tel: T, canal: "note", direction: "interne", statut: "traite", contenu: "BT supprimé", ref_bt: "bt-supprime", meta: {} },
      { id: 4, cree_le: iso(-100), tel: T, canal: "note", direction: "interne", statut: "traite", contenu: "BT livré", ref_bt: "bt-d", meta: {} },
      { id: 5, cree_le: iso(-50), tel: T, canal: "note", direction: "interne", statut: "rappel", rappel_le: iso(900), contenu: "⏰ Rappeler — vieille", meta: { origine: "rappel", machine_id: "bt-d" } });
    await w.__comm.charger(); await w.ouvrirCommunications(T); await rien();
    const rows = $$("#comm-fil .comm-bts .comm-bt");
    ok(rows.length === 3 && /BT-101/.test(rows[0].textContent) && rows[0].querySelector("[data-bt-ouvrir]") && rows[0].querySelector("[data-bt-note]"), "fil : un bloc par bon (3 bons non livrés), chacun avec « Ouvrir le BT » et « Note d'atelier »");
    ok(!/🔧 En atelier :/.test(txt("#comm-fil")), "fil : l'ancienne ligne verte « 🔧 En atelier : … » est remplacée");
    const chips = (cls) => $$("#comm-fil .comm-ev .comm-chip" + (cls || ""));
    const chipsBt = $$("#comm-fil .comm-ev .comm-chip-bt");
    ok(chipsBt.length === 2 && chipsBt[0].tagName === "BUTTON" && /📋 BT-101/.test(chipsBt[0].textContent) && /📋 BT-102/.test(chipsBt[1].textContent), "chip BT : bouton « 📋 BT-101 » (ref_bt) et « 📋 BT-102 » (rappel v166 avec meta.machine_id)");
    ok(chips().filter(c => c.tagName === "SPAN" && c.textContent === "BT").length === 2, "ref_bt vers un bon supprimé ou livré : l'ancien chip texte « BT » (non cliquable)");
    ok(!$$("#comm-fil .comm-ev .comm-chip-bt").some(b => /BT-090/.test(b.textContent)), "un rappel pointant un bon livré (archivé) n'a pas de bouton");
    // les boutons d'action habituels fonctionnent toujours (✓ Traité)
    $$("#comm-fil .comm-ev .meta button[data-a]").find(b => b.dataset.a === "traite" && b.dataset.id === "2").click(); await dodo(250);
    ok(comms().find(c => c.id === 2).statut === "traite", "« ✓ Traité » du fil fonctionne toujours (le chip BT n'a pas pris le clic)");
    // clic sur le chip → le bon s'ouvre, voile fermé
    await w.ouvrirCommunications(T); await rien();
    $$("#comm-fil .comm-chip-bt")[0].click(); await dodo(150);
    ok(live() && A.get("liveId") === "bt-a" && !voileOuvert("comm-voile") && bon("bt-a").chrono.length === 0, "clic sur le chip « 📋 BT-101 » : le bon s'ouvre sans punch, Communications se ferme");
    fermerTout();
    // « Ouvrir le BT » d'un bloc du fil (bon à venir non arrivé)
    await w.ouvrirCommunications(T); await rien();
    $('#comm-fil [data-bt-ouvrir="bt-b"]').click(); await dodo(150);
    ok(live() && A.get("liveId") === "bt-b" && bon("bt-b").statut === "avenir" && !bon("bt-b").machineArrivee, "fil : « Ouvrir le BT » d'un bon « à venir » : statut et arrivée inchangés");
    fermerTout();
    // note d'atelier par prompt()
    await w.ouvrirCommunications(T); await rien();
    const nc = comms().length, np = A.prompts.length;
    A.reponsePrompt = "Client passe\nvendredi";
    $('#comm-fil [data-bt-note="bt-a"]').click(); await dodo(600);
    ok(A.prompts.length === np + 1 && /BT-101/.test(A.prompts[A.prompts.length - 1]), "fil : « Note d'atelier » demande la note par prompt()");
    ok((bon("bt-a").notesLive || []).length === 1 && bon("bt-a").notesLive[0].texte === "📞 Appel : Client passe vendredi" && bon("bt-a").notesLive[0].src === "appel", "fil : la note (aplatie) est sur le bon");
    ok(comms().length === nc, "fil : aucune nouvelle ligne dans Communications");
    A.reponsePrompt = null;
    $('#comm-fil [data-bt-note="bt-a"]').click(); await dodo(300);
    A.reponsePrompt = "   ";
    $('#comm-fil [data-bt-note="bt-a"]').click(); await dodo(300);
    ok((bon("bt-a").notesLive || []).length === 1, "fil : prompt annulé ou vide → rien d'ajouté");
    A.reponsePrompt = "";
    // sans droit « live » : pas de chip cliquable ni de bouton Ouvrir, mais l'ancien chip texte
    fermerTout(); L.connecter(A, "Gwendal", EMPX);
    await w.ouvrirCommunications(T); await rien();
    ok($$("#comm-fil [data-bt-ouvrir]").length === 0 && $$("#comm-fil [data-bt-note]").length === 3 && chips().some(c => c.tagName === "SPAN" && c.textContent === "BT"), "fil sans le droit « live » : ni « Ouvrir le BT » ni chip cliquable (chip texte « BT »), notes d'atelier possibles");
    fermerTout(); L.connecter(A, "Jason", EMPX); comms().length = 0; poser(MACH()); });

  // ════════ 9. XSS : nom de client, de machine, n° de BT et id piégés ════════
  await groupe("9. XSS : nom de client, de machine, n° de BT et id piégés", async () => { fermerTout(); const ID = 'bt-x"><img src=x onerror=alert(3)>';
    poser([...MACH(), { id: ID, numeroBT: '"><img src=x onerror=alert(2)>', nom: XSS, client: XSS, clientId: "cl-x", tel: "819-555-0404", statut: "reparation", machineArrivee: true, chrono: [], pieces: [] }]);
    comms().push({ id: 77, cree_le: iso(-5), tel: TX, client_nom: XSS, canal: "appel_repondu", direction: "in", statut: "traite", contenu: XSS, ref_bt: ID, meta: {} });
    await w.__comm.charger();
    await ouvrirNote(TX);
    ok($$("#comm-boite2 img").length === 0 && /Bons de travail du client/.test(txt("#comm-boite2")) && A.alertes.length === 0, "XSS : note d'appel d'un client « <img onerror> » : aucune balise injectée, aucune alerte");
    const b = btns("[data-bt-ouvrir]")[0]; ok(!!b && b.getAttribute("data-bt-ouvrir") === ID, "l'id piégé est correctement échappé dans l'attribut");
    b.click(); await dodo(250);
    ok(live() && A.get("liveId") === ID && A.alertes.length === 0, "… et le clic ouvre bien ce bon");
    fermerTout();
    await w.ouvrirCommunications(TX); await rien();
    ok($$("#comm-fil img, #comm-boite img").length === 0 && A.alertes.length === 0 && $$("#comm-fil .comm-chip-bt").length === 1, "XSS : fil du même client : aucune balise injectée, chip BT présent");
    fermerTout();
    w.__commProposerNote(TX, "", idPopup()); await rien();
    ok($$(".comm-propo img").length === 0 && $('.comm-propo [data-a="bt"]') && A.alertes.length === 0, "XSS : popup d'appel : aucune balise injectée");
    fermerTout(); poser(MACH()); comms().length = 0; });

  // ════════ 10. A1 côté application : {adresse}, garde du popup, « Renvoyer », fiche du bon ════════
  await groupe("10. A1 côté application : {adresse}, garde du popup, « Renvoyer », fiche du bon", async () => { fermerTout(); poser(MACH()); S.db.rappels_envoyes.length = 0;
    const AD = "1856 Jérôme-Hamel, Trois-Rivières";
    // aide + aperçu du gabarit dans les réglages
    await w.ouvrirRappels("reglages"); await rien();
    ok(/\{adresse\}/.test(txt("#rap-contenu")) && new RegExp("Aperçu : .*Adresse : " + AD.replace(/[-.]/g, "\\$&")).test(txt("#rap-contenu")), "réglages des rappels : {adresse} dans l'aide des variables et dans l'aperçu (ENTREPRISE.lignes[0])");
    fermerTout();
    // « 📲 Confirmer » → le popup contient l'adresse
    await w.ouvrirRappels("avenir"); await rien();
    ok($('[data-conf="bt-b"]') && /Confirmer/.test($('[data-conf="bt-b"]').textContent), "🔔 RDV à venir : « 📲 Confirmer » quand rien n'est parti");
    $('[data-conf="bt-b"]').click();
    await attendre(() => voileOuvert("rap-voile-conf"), 2000);
    ok(voileOuvert("rap-voile-conf") && $("#rap-conf-msg").value.includes("Adresse : " + AD + "."), "popup de confirmation : {adresse} remplacé par « " + AD + " »");
    fermerTout();

    // garde du popup (déclenché par un nouveau rendez-vous, comme dans l'atelier)
    const nouveauRdv = async (idBt, tel) => {
      fermerTout(); const m = machines(); m.push({ id: idBt, numeroBT: "BT-9" + idBt.slice(-1), nom: "Nouvelle machine", client: "Client " + idBt, tel, statut: "avenir", echeance: L.jourIso(4), heure: "10:00", chrono: [], pieces: [] });
      A.set("machines", m); w.sauvegarder(); await dodo(700); };
    S.db.rappels_envoyes.push({ id: "r1", bt_id: "bt-n1", type: "confirmation", statut: "envoye", rappel_id: null });
    await nouveauRdv("bt-n1", "819-555-1111");
    ok(!voileOuvert("rap-voile-conf") && A.toasts().some(t => /confirmation est déjà partie/.test(t)), "nouveau rendez-vous dont la confirmation est déjà partie (ligne « envoye ») : pas de popup, toast « déjà partie »");
    S.db.rappels_envoyes.push({ id: "r2", bt_id: "bt-n2", type: "confirmation", statut: "erreur", erreur: "Twilio", rappel_id: null });
    await nouveauRdv("bt-n2", "819-555-1112");
    ok(voileOuvert("rap-voile-conf"), "ligne « erreur » seulement : le popup s'ouvre (on peut renvoyer)");
    S.db.rappels_envoyes.push({ id: "r3", bt_id: "bt-n3", type: "confirmation", statut: "en_cours", rappel_id: null });
    await nouveauRdv("bt-n3", "819-555-1113");
    ok(voileOuvert("rap-voile-conf"), "ligne « en_cours » seulement : le popup s'ouvre (jamais bloqué par un envoi inachevé)");
    S.db.rappels_envoyes.push({ id: "r4", bt_id: "bt-n4", type: "rappel", statut: "envoye", rappel_id: "rc-9" });
    await nouveauRdv("bt-n4", "819-555-1114");
    ok(voileOuvert("rap-voile-conf"), "une ligne « envoye » d'un RAPPEL (pas une confirmation) ne bloque pas le popup");
    S.pannes["rappels_envoyes:select"] = "lecture impossible";
    S.db.rappels_envoyes.push({ id: "r5", bt_id: "bt-n5", type: "confirmation", statut: "envoye", rappel_id: null });
    await nouveauRdv("bt-n5", "819-555-1115");
    ok(voileOuvert("rap-voile-conf"), "erreur de lecture de rappels_envoyes : le popup s'ouvre comme avant");
    delete S.pannes["rappels_envoyes:select"];
    await nouveauRdv("bt-n6", "819-555-1116");
    ok(voileOuvert("rap-voile-conf"), "aucune ligne : le popup s'ouvre comme avant");
    fermerTout();

    // 🔔 RDV à venir : « Renvoyer » après un échec, badge vert après un renvoi réussi
    poser(MACH()); S.db.rappels_envoyes.length = 0;
    S.db.rappels_envoyes.push({ id: "e1", bt_id: "bt-b", type: "confirmation", statut: "erreur", erreur: "Twilio", destinataire: "+18195550101", envoye_le: iso(-60) });
    await w.ouvrirRappels("avenir"); await rien();
    const ligneRap = () => $$("#rap-contenu tr").find(tr => /Spark 90/.test(tr.textContent));
    ok(ligneRap() && ligneRap().querySelector('[data-conf="bt-b"]') && /Renvoyer/.test(ligneRap().querySelector('[data-conf="bt-b"]').textContent) && ligneRap().querySelector(".rap-badge.err"), "RDV à venir : confirmation en échec → badge rouge et bouton « 📲 Renvoyer »");
    S.db.rappels_envoyes.push({ id: "e2", bt_id: "bt-b", type: "confirmation", statut: "envoye", destinataire: "+18195550101", envoye_le: iso(-5) });
    await w.ouvrirRappels("avenir"); await rien();
    ok(!ligneRap().querySelector("[data-conf]") && ligneRap().querySelector(".rap-badge.ok") && !/rap-badge err/.test(ligneRap().innerHTML.split("Confirmation")[0] + ligneRap().querySelector(".rap-badge").outerHTML), "après un renvoi réussi (lignes « erreur » puis « envoye ») : badge VERT, plus de bouton — la ligne « envoye » est préférée");
    fermerTout();
    // la fiche du bon (rfRendreHistorique)
    const histo = async (id) => { w.ouvrirEdition(id); await attendre(() => !/Chargement/.test(txt("#f-rappels-histo-corps")), 2000); return txt("#f-rappels-histo-corps"); };
    S.db.rappels_envoyes.length = 0; S.db.rappels_envoyes.push({ id: "f1", bt_id: "bt-b", type: "confirmation", statut: "erreur", erreur: "x", message: "m", envoye_le: iso(-60) });
    ok(/Confirmation de rendez-vous.*échec/.test(await histo("bt-b")), "fiche du bon : une confirmation en échec s'affiche « ✗ échec »");
    S.db.rappels_envoyes.push({ id: "f2", bt_id: "bt-b", type: "confirmation", statut: "envoye", message: "m", envoye_le: iso(-5) });
    { const t = await histo("bt-b"); ok(/Confirmation de rendez-vous.*✓ envoyé/.test(t) && !/échec/.test(t), "fiche du bon : après un renvoi réussi, « ✓ envoyé » (la ligne « envoye » est préférée à l'ancien échec)"); }
    S.db.rappels_envoyes.length = 0;
    ok(/pas envoyée/.test(await histo("bt-b")), "fiche du bon : sans ligne, « pas envoyée »");
    fermerTout(); try { w.fermerFormulaire && w.fermerFormulaire(); } catch (_) {} });

  // ════════ 11. A1 : la carte de la demande et demConfirmerSms ════════
  await groupe("11. A1 : la carte de la demande et demConfirmerSms", async () => { fermerTout(); poser(MACH()); S.db.rappels_envoyes.length = 0; S.appels.length = 0;
    const creneau = [{ no: 1, iso: L.jourIso(5), heure: "09:00", duree: 60 }];
    const dem = (o) => Object.assign({ statut: "confirmee", choix: 1, lu: true, cree_le: iso(-5000), confirme_le: iso(-4000), soum_id: "so-x", creneaux: creneau, nom: "Marc Tremblay", tel: "819-555-0101", marque: "BRP", modele: "Spark", annee: "2022" }, o);
    S.db.demandes_service.push(
      dem({ id: "D-env", bt_id: "bt-a", confirmation_envoyee_le: iso(-3500) }),
      dem({ id: "D-non", bt_id: "bt-b" }),
      dem({ id: "D-trace", bt_id: "bt-c" }),
      dem({ id: "D-nouv", statut: "creneaux_envoyes", bt_id: null, confirme_le: null }));
    S.db.demandes_journal.push({ id: "j1", demande_id: "D-env", evenement: "confirmation_renvoyee", quand: iso(-3400), par: "Jason", detail: {} });
    await w.ouvrirDemandes(); await w.__dem.charger(); await dodo(60);
    await w.__dem.ouvrirFiche("D-env"); await dodo(250);
    const fiche = () => txt("#dem-voile");
    ok(/✅ Confirmation envoyée le/.test(fiche()) && $(".dem-conf-ok") && /166534|rgb\(22, 101, 52\)/.test(w.getComputedStyle($(".dem-conf-ok")).color.replace(/\s/g, "") + $(".dem-conf-ok").getAttribute("style")), "carte de la demande : ligne verte « ✅ Confirmation envoyée le … » quand confirmation_envoyee_le existe");
    ok(/Renvoyer la confirmation/.test(fiche()) && /Confirmation renvoyée par SMS/.test(fiche()), "bouton « Renvoyer la confirmation » ; historique : « Confirmation renvoyée par SMS » (libellé connu, plus le code brut)");
    await w.__dem.ouvrirFiche("D-non"); await dodo(250);
    ok(!/Confirmation envoyée le/.test(fiche()) && !$(".dem-conf-ok") && /Envoyer la confirmation/.test(fiche()), "sans confirmation_envoyee_le (toutes les demandes d'avant la v178) : aucune ligne verte, « Envoyer la confirmation »");
    ok(!/pas envoyée|⚠️ Confirmation|non envoyée/i.test(fiche()) && !$$("#dem-voile .dem-bon-perdu, #dem-voile .dem-manque").some(e => /onfirmation/.test(e.textContent)), "… et AUCUN avertissement rouge au sujet de la confirmation");
    fermerTout();

    // demConfirmerSms : prévient dans confirm() et laisse une trace
    const dem1 = () => w.__dem.liste().find(d => d.id === "D-env"), dem2 = () => w.__dem.liste().find(d => d.id === "D-non"), dem3 = () => w.__dem.liste().find(d => d.id === "D-trace");
    A.confirmations.length = 0; A.appelsFetch.length = 0;
    await w.__dem.confirmerSms(dem1()); await dodo(200);
    ok(A.confirmations.length === 1 && /Une confirmation est déjà partie le/.test(A.confirmations[0]) && /Envoyer au 819-555-0101/.test(A.confirmations[0]), "demConfirmerSms : si une confirmation est déjà partie, le confirm() le dit (avec la date)");
    ok(A.appelsFetch.filter(f => /smart-api/.test(f.url)).length === 1, "… puis l'envoi manuel part (1 appel à smart-api)");
    { const r = S.db.rappels_envoyes.filter(x => x.bt_id === "bt-a");
      ok(r.length === 1 && r[0].type === "confirmation" && r[0].statut === "envoye" && r[0].rappel_id === null && r[0].canal === "sms" && /819/.test(r[0].destinataire) && /confirme/.test(r[0].message) && r[0].twilio_sid === "SM-test", "après un envoi manuel réussi : ligne rappels_envoyes {bt_id, rappel_id null, type confirmation, statut envoye}"); }
    A.confirmations.length = 0;
    await w.__dem.confirmerSms(dem2()); await dodo(200);
    ok(A.confirmations.length === 1 && !/déjà partie/.test(A.confirmations[0]), "aucune confirmation partie : le confirm() ne prévient pas");
    ok(S.db.rappels_envoyes.some(x => x.bt_id === "bt-b" && x.statut === "envoye"), "… et la trace est écrite aussi");
    // trace déjà dans rappels_envoyes (envoi automatique du serveur) mais la colonne de la demande n'est pas posée
    S.db.rappels_envoyes.push({ id: "srv1", bt_id: "bt-c", type: "confirmation", statut: "envoye", rappel_id: null, envoye_le: iso(-200) });
    A.confirmations.length = 0;
    await w.__dem.confirmerSms(dem3()); await dodo(200);
    ok(A.confirmations.length === 1 && /déjà partie/.test(A.confirmations[0]), "trace du serveur dans rappels_envoyes (colonne de la demande vide) : le confirm() prévient aussi");
    // annuler le confirm() : rien n'est envoyé ni écrit
    A.reponseConfirm = false; A.confirmations.length = 0; A.appelsFetch.length = 0; const nTr = S.db.rappels_envoyes.length;
    await w.__dem.confirmerSms(dem1()); await dodo(150);
    ok(A.appelsFetch.filter(f => /smart-api/.test(f.url)).length === 0 && S.db.rappels_envoyes.length === nTr, "confirm() refusé : rien n'est envoyé, rien n'est écrit");
    A.reponseConfirm = true;
    // l'écriture de la trace échoue : l'envoi reste un succès
    S.pannes["rappels_envoyes:insert"] = "refusé";
    await w.__dem.confirmerSms(dem2()); await dodo(250);
    ok(A.toasts().some(t => /Confirmation envoyée à/.test(t)) && A.alertes.length === 0, "échec d'écriture de la trace : silencieux, l'envoi est quand même confirmé à l'écran");
    delete S.pannes["rappels_envoyes:insert"];
    // l'envoi échoue : pas de trace
    A.appelsFetch.length = 0; const nTr2 = S.db.rappels_envoyes.length;
    { const fetchOrig = w.fetch; w.fetch = async (u, i) => ({ ok: false, status: 500, json: async () => ({ error: "Twilio HS" }), text: async () => "" });
      await w.__dem.confirmerSms(dem1()); await dodo(200); w.fetch = fetchOrig; }
    ok(A.alertes.some(a => /L'envoi a échoué/.test(a)) && S.db.rappels_envoyes.length === nTr2, "envoi en échec : alerte, aucune trace « envoye » écrite");
    fermerTout(); A.alertes.length = 0; });

  ok(rejets.length === 0, "aucune promesse rejetée non gérée (" + rejets.length + ")" + (rejets.length ? " : " + rejets.slice(0, 3).join(" | ") : ""));
  L.fin(A);
})();
