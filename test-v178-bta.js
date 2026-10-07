// v178 BTA — « 📑 Bons de travail actifs » : tous les bons sauf les archivés, en consultation (sans ouvrir le live).
//   Dans Chromium :  MTR_FAKE_NOW="2026-10-07T10:00:00-04:00" PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node outils-v178/run-in-chromium.js test-v178-bta.js ./index.html
//   Sabotages :       REPO=$PWD outils-v178/sabotage.sh test-v178-bta.js "<texte unique>" "<remplacement>"
// Le test n'a pas besoin d'un jour précis : toutes les dates sont relatives à « maintenant ».
const L = require("./outils-v178/test-lib-v178.js");
const { ok, dodo, cp } = L;
const FICHIER = process.argv[2] || "./index.html";
const fs = require("fs");
const JOUR = 86400000, H = 3600000, MIN = 60000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();                 // ms < 0 : dans le passé
// Une assertion qui ne plante pas le test : une exception est une assertion ratée (sur la base, les fonctions n'existent pas)
const t = (msg, f) => { let r; try { r = f(); } catch (e) { ok(false, msg + " — exception : " + (e && e.message)); return; } ok(!!r, msg); };

const principal = async () => {
  const S = L.creerSupabase({ tableau: [{ id: 1, donnees: [] }, { id: 4, donnees: L.cp(L.EMP) }] });
  const A = await L.chargerApp({ sb: S.sb });
  const w = A.w, $ = A.$, $$ = A.$$;
  const P = (o) => w.JSON.parse(JSON.stringify(o));                          // objets du monde de la page
  const EMPL = [
    { nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true },
    { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true },
    { nom: "Arno", nomFamille: "Roy", role: "technicien", actif: true, droits: { calendrier: false } },        // e.droits SANS la clé bonsActifs : suit le rôle
    { nom: "Zoe", nomFamille: "Pelletier", role: "technicien", actif: true, droits: { bonsActifs: false } },   // refusé exprès
    { nom: "Yan", nomFamille: "Morin", role: "technicien", actif: true, droits: { live: false } },             // peut consulter, pas ouvrir le live
    { nom: "Luc", nomFamille: "Gagnon", role: "tache", actif: true },
    { nom: "Lou", nomFamille: "Tache", role: "tache", actif: true, droits: { bonsActifs: true } },            // accordé par l'administration
    { nom: "Marie", nomFamille: "Lavoie", role: "reception", actif: true },
  ];
  const aujourdhui = () => A.get("ajd")();
  const punche = (...noms) => A.set("pointages", noms.map(n => ({ nom: n, jour: aujourdhui(), arrivee: new Date().toISOString(), depart: null, pauses: [] })));
  const connecter = (nom) => {
    A.set("EMPLOYES", P(EMPL)); A.set("sessionCourante", { nom, quand: new Date().toISOString() });
    const cx = $("#ecran-connexion"); if (cx) cx.classList.remove("ouvert");
    w.appliquerDroits();
  };
  const page = () => $("#bta-page") || { classList: { contains: () => false }, style: {}, scrollTop: 0, scrollWidth: 0, clientWidth: 0 };
  const ouvert = () => page().classList.contains("ouvert");
  const lignes = () => $$("#bta-liste .bta-ligne");
  const bts = () => lignes().map(l => A.txt(l.querySelector(".bta-bt")));
  const ligne = (id) => lignes().find(l => l.dataset.id === id);
  const tete = (id) => ligne(id) && ligne(id).querySelector(".bta-tete");
  const clic = (el) => { if (el) el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); };
  const touche = (el, key) => { if (el) el.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); };
  const saisir = (txt) => { const c = $("#bta-recherche"); if (c) { c.value = txt; c.dispatchEvent(new w.Event("input", { bubbles: true })); } };
  const choisirTri = (v) => { const s = $("#bta-tri"); if (s) { s.value = v; s.dispatchEvent(new w.Event("change", { bubbles: true })); } };
  const sur = (nom, ...a) => { try { return w[nom](...a); } catch (e) { return undefined; } };            // fonction de BTA : sur la base elle n'existe pas
  const ouvrirB = () => sur("ouvrirBonsActifs"), fermerB = () => sur("fermerBonsActifs"), rendreB = () => sur("btaRendre");
  const chip = (f) => $$("#bta-chips .bta-chip").find(c => c.dataset.f === f);
  const nChip = (f) => { const c = chip(f); return c ? +A.txt(c.querySelector(".n")) : null; };
  const etat = () => A.get("btaEtat");
  const snap = () => w.JSON.stringify(A.get("machines"));
  const appels = { live: [], sauv: 0, edit: [], bon: [] };                  // espions : ouvrirLive, sauvegarder, ouvrirEdition, bonDeTravail
  w.ouvrirLive = (id) => { appels.live.push(id); };
  w.sauvegarder = () => { appels.sauv++; };
  w.ouvrirEdition = (id) => { appels.edit.push(id); };
  w.bonDeTravail = (id) => { appels.bon.push(id); };
  const M = (o) => Object.assign({ id: o.id, nom: "Machine " + o.id, client: "Client " + o.id, tel: "", travaux: "", statut: "reparation", pieces: [], chrono: [], creeLe: iso(-3 * JOUR) }, o);
  const deplier = (id) => { const h = tete(id); if (h && h.getAttribute("aria-expanded") !== "true") clic(h); };
  const ouvrirComme = (nom, ...punches) => { connecter(nom); punche(...punches); ouvrirB(); };

  // ── Données : 12 bons actifs + 1 archivé ──────────────────────────────────────────────────────────────────────
  const GEL = M({ id: "g", numeroBT: "BT-042", nom: "Maverick X3", annee: "2021", client: "Marc Gélinas", tel: "819-555-0142", statut: "reparation", arriveeLe: iso(-10 * JOUR),
    numeroMachine: "4471", reference: "SN-AAA111", numModele: "X3-DPS", travaux: "Vidange et changement des freins", technicien: "Gwendal", kilometrage: "1200", lieu: "Garage", place: "baie 2",
    echeance: L.jourIso(2), heure: "09:30", dureeEstimee: 240,
    chrono: [{ tech: "Gwendal", debut: iso(-2 * H), fin: null, pauses: [], live: true }],
    pieces: [{ qte: "2", nom: "Filtre à huile", num: "HF-148", coche: true, utilise: true }, { qte: "1", nom: "Plaquettes de frein", num: "BR-77", coche: false }],
    notesLive: [{ texte: "Freins avant faits", tech: "Gwendal", quand: iso(-1 * H) }, { texte: "⏳ Reste à faire : Purger les freins", tech: "Gwendal", quand: iso(-1 * H) }],
    resteAFaire: { texte: "Purger les freins", tech: "Gwendal", quand: iso(-1 * H), minutes: 150 } });   // 150 min saisies il y a 1 h, session live depuis 2 h : 60 min punchées depuis → il reste 1 h 30
  const base = () => cp([
    GEL,
    M({ id: "b2", numeroBT: "BT-102", nom: "Sportsman 570", client: "Julie Bouchard", tel: "514-555-0001", statut: "reparation", arriveeLe: iso(-4 * JOUR) }),
    M({ id: "b3", numeroBT: "BT-103", nom: "Renegade", client: "Paul Tremblay", tel: "(514) 555-0177", statut: "attente", arriveeLe: iso(-3 * JOUR) }),
    M({ id: "b4", numeroBT: "BT-104", nom: "Spark", client: "Sylvie Côté", statut: "sansrdv", creeLe: iso(-20 * JOUR) }),
    M({ id: "b5", numeroBT: "BT-105", nom: "Grizzly", client: "Denis Roy", statut: "avenir", machineArrivee: false, echeance: L.jourIso(3), heure: "09:00" }),
    M({ id: "b6", numeroBT: "BT-106", nom: "Outlander", client: "Luc Fortin", statut: "avenir", machineArrivee: true, arriveeLe: iso(-1 * JOUR) }),
    M({ id: "b7", numeroBT: "BT-107", nom: "Ski-Doo MXZ", client: "Anne Lapointe", statut: "afacturer", pretAFacturerLe: iso(-2 * JOUR),
        coutAchat: 7391.25, prixVente: 4567.8, cadeau: { montant: 3210.55, par: "Jason", le: iso(-JOUR) },
        facturation: { total: 9876.54, sousTotal: 8590.5, qbo: { id: "77", doc: "7788", total: 9876.54, realm: "prod" } },
        pieces: [{ qte: "1", nom: "Courroie", num: "CR-1", coche: true, utilise: true, coutAchat: 7391.25, prixVente: 4567.8 }] }),
    M({ id: "b8", numeroBT: "BT-108", nom: "Wave Runner", client: "Éric Mailloux", statut: "prete", echeance: L.jourIso(-1) }),
    M({ id: "b9", numeroBT: "BT-109", nom: "Ranger", client: "Hélène Vachon", statut: "assurance" }),
    M({ id: "b10", numeroBT: "BT-110", nom: "Pièce seulement", client: "Gabriel Nadeau", statut: "commande" }),
    M({ id: "b11", numeroBT: "BT-111", nom: "Commander", client: "Rémi Cyr", statut: "reparation", arriveeLe: iso(-6 * JOUR), notesTech: "• Remplacé la courroie\n• Test routier OK" }),   // notesTech SEUL : notesLive reste undefined
    M({ id: "b12", numeroBT: "BT-112", nom: "Tracker", client: "Zoé Beaulieu", statut: "sansrdv" }),
    M({ id: "arch", numeroBT: "BT-090", nom: "Machine archivée", client: "Zéphyrin Archivé", statut: "archive", livreLe: "2026-09-01", travaux: "Travail terminé jadis" }),
  ]);
  const NB_ACTIFS = 12;
  A.set("machines", base());
  A.set("rdvConfig", { horaire: { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null }, tampon: 15, diner: { actif: true, debut: 12, duree: 60 } });
  A.set("dispoOverride", {}); A.set("commandes", []); A.set("soumissions", []);

  // ── 0. Source : ancres, crochets, un seul écouteur ────────────────────────────────────────────────────────────
  console.log("— source : ancres et crochets");
  const src = fs.readFileSync(FICHIER, "utf8");
  const lignesSrc = src.split("\n");
  const apres = (ancre, n = 1) => { const i = lignesSrc.findIndex(l => l.trim() === ancre); return i < 0 ? "" : lignesSrc.slice(i + 1, i + 1 + n).map(l => l.trim()).join(" | "); };
  t("ancre rafraichir : la ligne btaRafraichir() est juste dessous, en try/catch", () => /^try \{ if \(typeof btaRafraichir === "function"\) btaRafraichir\(\); \} catch \(_\) \{\}/.test(apres("//@@v178-A12 rafraichir")));
  t("ancre deconnecter A12 : fermerBonsActifs() puis remise à zéro, juste avant appliquerDroits()", () => /^try \{ fermerBonsActifs\(\); btaVider\(\); \} catch \(_\) \{\}[^|]*\| appliquerDroits\(\);$/.test(apres("//@@v178-A12 deconnecter", 2)));
  t("l'ancre SON de deconnecter reste en tête de la fonction (jamais celle de BTA)", () => { const i = lignesSrc.findIndex(l => l.startsWith("async function deconnecter()")); return i > 0 && lignesSrc[i + 1].trim() === "//@@v178-SON deconnecter"; });
  t("la clé bonsActifs est EN TÊTE des trois objets de DROITS_DEFAUT (la queue de l'objet reste intacte pour test-v176)", () => {
    const D = A.get("DROITS_DEFAUT"); return ["technicien", "tache", "reception"].every(r => Object.keys(D[r])[0] === "bonsActifs") && src.includes("rappels: true, marketing: false, demandes: true, communications: true,\n                voirCouts: false, gestion: false },\n};");
  });
  const bloc = (() => { const a = src.indexOf("//@@v178-A12 bloc"), b = src.indexOf("// v74 — COMPTES ET DROITS"); return a > 0 && b > a ? src.slice(a, b).replace(/\/\/.*$/gm, "") : ""; })();
  t("le bloc JS de BTA existe sous l'ancre, dans le script principal", () => bloc.length > 3000 && /function ouvrirBonsActifs\(/.test(bloc));
  t("UN seul addEventListener dans tout le bloc (délégation sur #bta-liste), aucun onclick par id de bon", () => (bloc.match(/addEventListener\(/g) || []).length === 1 && !/onclick="[^"]*\$\{(id|m\.id)\}/.test(bloc));
  t("le bloc n'appelle jamais sauvegarder( ni liveNotes( (qui mute le bon) et n'appelle ouvrirLive( que dans btaOuvrirLive", () => !/sauvegarder\s*\(/.test(bloc) && !/liveNotes\s*\(/.test(bloc) && (bloc.match(/ouvrirLive\s*\(/g) || []).length === 1);
  t("la page est posée après #ordre-page et avant le commentaire v167", () => { const a = src.indexOf('id="ordre-page"'), b = src.indexOf('id="bta-page" data-section="bonsActifs"'), c = src.indexOf("<!-- v167 : procédure de travail (créée par Claude) — fenêtre"); return a > 0 && b > a && c > b && /class="cal-page bta-page"/.test(src); });

  // ── 1. Registre, droits, menu, verrou de punch, tuiles ─────────────────────────────────────────────────────────
  console.log("— registre et droits");
  t("SECTIONS : « Bons de travail actifs » 📑 / ouvrirBonsActifs juste après « ordre »", () => {
    const S2 = A.get("SECTIONS"), i = S2.findIndex(s => s.id === "ordre"), s = S2[i + 1];
    return s && s.id === "bonsActifs" && s.label === "Bons de travail actifs" && s.ico === "📑" && s.ouvrir === "ouvrirBonsActifs";
  });
  t("droitDe : vrai pour administration, technicien ET réception ; faux pour tâches", () => {
    const e = (n) => P(EMPL.find(x => x.nom === n));
    return w.droitDe(e("Jason"), "bonsActifs") === true && w.droitDe(e("Gwendal"), "bonsActifs") === true && w.droitDe(e("Marie"), "bonsActifs") === true && w.droitDe(e("Luc"), "bonsActifs") === false;
  });
  t("DROITS_DEFAUT : technicien true, tache false, reception true (valeur présente pour chaque rôle)", () => {
    const D = A.get("DROITS_DEFAUT"); return D.technicien.bonsActifs === true && D.tache.bonsActifs === false && D.reception.bonsActifs === true && D.admin.bonsActifs === true
      && ["technicien", "tache", "reception"].every(r => Object.prototype.hasOwnProperty.call(D[r], "bonsActifs"));
  });
  t("un e.droits enregistré SANS la clé suit le rôle (technicien → oui, tâches → non)", () => w.droitDe(P(EMPL[2]), "bonsActifs") === true && w.droitDe({ nom: "X", role: "tache", droits: { punch: true } }, "bonsActifs") === false);
  t("e.droits.bonsActifs = true accordé à un homme à tout faire : oui ; = false chez un technicien : non", () => w.droitDe(P(EMPL[6]), "bonsActifs") === true && w.droitDe(P(EMPL[3]), "bonsActifs") === false);
  t("le dossier employé génère la case « 📑 Bons de travail actifs » toute seule", () => { $("#emp-role").value = "technicien"; w.empRendreDroits(null); return !!$('#emp-droits input[data-section="bonsActifs"]') && /Bons de travail actifs/.test(A.txt("#emp-droits")); });

  console.log("— menu, refus, verrou de punch");
  const menuBtn = () => $('#menu-lateral .menu-item[data-section="bonsActifs"]');
  const visible = (el) => !!el && el.style.display !== "none";
  t("bouton de menu juste après « Ordre de travail », avec le bon appel", () => { const m = menuBtn(), o = $('#menu-lateral .menu-item[data-section="ordre"]'); return m && o && o.nextElementSibling === m && /menuAller\('ouvrirBonsActifs'\)/.test(m.getAttribute("onclick")) && /Bons de travail actifs/.test(m.textContent); });
  ["Jason", "Gwendal", "Marie"].forEach(n => { connecter(n); t("bouton de menu visible pour " + n, () => visible(menuBtn())); });
  connecter("Luc"); t("bouton de menu MASQUÉ pour un employé « tâches » ; la page elle-même est masquée aussi", () => !visible(menuBtn()) && page().style.display === "none");
  connecter("Zoe"); t("bouton de menu masqué quand e.droits.bonsActifs = false", () => !visible(menuBtn()));
  connecter("Jason"); t("la page n'est plus masquée pour qui a le droit", () => page().style.display !== "none");

  connecter("Zoe"); punche("Zoe"); ouvrirB();
  t("e.droits.bonsActifs = false : la page ne s'ouvre pas, un toast dit que la section n'est pas ouverte", () => !ouvert() && A.toasts().some(x => /Bons de travail actifs/.test(x) && /pas ouverte pour toi/.test(x)));
  connecter("Luc"); punche("Luc"); ouvrirB();
  t("un employé « tâches » est refusé aussi (toast)", () => !ouvert() && A.toasts().some(x => /Bons de travail actifs/.test(x)));
  connecter("Gwendal"); A.set("pointages", []); ouvrirB();
  t("technicien NON punché : « Veuillez vous puncher », la page reste fermée", () => !ouvert() && A.toasts().some(x => /Veuillez vous puncher/.test(x)));
  punche("Gwendal"); ouvrirB();
  t("technicien punché : la page s'ouvre", () => ouvert());
  fermerB();
  connecter("Marie"); A.set("pointages", []); ouvrirB();
  t("la réception n'est pas soumise au verrou de punch", () => ouvert());
  fermerB();

  console.log("— tuile de Mon écran et « Mon poste »");
  connecter("Gwendal"); punche("Gwendal"); w.ouvrirEcranTech();
  const tuile = () => $$("#tech-tuiles .tech-tuile").find(b => /techOuvrir\('bonsActifs'\)/.test(b.getAttribute("onclick") || ""));
  t("Mon écran (technicien) : tuile « 📑 Bons de travail actifs » avec le sous-titre « Tous les bons, sans ouvrir le live »", () => { const b = tuile(); return b && /📑/.test(b.textContent) && /Bons de travail actifs/.test(b.textContent) && /Tous les bons, sans ouvrir le live/.test(b.textContent); });
  clic(tuile());
  t("toucher la tuile ouvre la page", () => ouvert());
  fermerB(); w.fermerEcranTech();
  connecter("Luc"); punche("Luc"); w.ouvrirEcranTech();
  t("Mon écran d'un employé « tâches » : pas de tuile", () => !tuile());
  w.fermerEcranTech();
  connecter("Marie"); A.set("pointages", []); w.ouvrirEcranTech(); await dodo(60);
  const btnPoste = () => $$("#tech-tuiles .po-sections button").find(b => /Bons de travail actifs/.test(b.textContent));
  t("Mon poste (réception) : « 📑 Bons de travail actifs » apparaît dans « le reste des sections »", () => { const b = btnPoste(); return b && /📑/.test(b.textContent); });
  t("… et le bouton ouvre la page", () => { clic(btnPoste()); return ouvert(); });
  fermerB(); w.fermerEcranTech();

  // ── 2. Liste : archivés, compteurs, pastilles ──────────────────────────────────────────────────────────────────
  console.log("— liste, archivés, compteurs, pastilles");
  A.set("machines", base());
  ouvrirComme("Jason"); await dodo(20);   // la pile des fenêtres (v71) pose le z-index juste après (MutationObserver)
  t("la page s'ouvre par-dessus (pile des fenêtres) et le menu est fermé", () => ouvert() && +page().style.zIndex > 1000 && !$("#menu-lateral").classList.contains("ouvert"));
  t("tous les bons non archivés sont listés : " + NB_ACTIFS + " lignes", () => lignes().length === NB_ACTIFS);
  t("le bon archivé (BT-090, « Zéphyrin Archivé ») n'apparaît NI dans la liste NI dans les compteurs", () => !bts().includes("BT-090") && !/Zéphyrin|Machine archivée/.test(A.txt("#bta-liste")) && nChip("tous") === NB_ACTIFS && /12 bons actifs/.test(A.txt("#bta-resume")));
  t("compteurs : tous 12, live 1, réparation 3, attente 1, sans RDV 2, à venir 2, à facturer 1, facturé 1, assurance 1, commande 1", () =>
    [["tous", 12], ["live", 1], ["reparation", 3], ["attente", 1], ["sansrdv", 2], ["avenir", 2], ["afacturer", 1], ["prete", 1], ["assurance", 1], ["commande", 1]].every(([f, n]) => nChip(f) === n));
  t("libellés courts : « Sans RDV », « Attente pièce », « En réparation », « 🔴 En live »", () => ["Sans RDV", "Attente pièce", "En réparation", "🔴 En live"].every(s => $$("#bta-chips .bta-chip").some(c => A.txt(c).startsWith(s))));
  t("pas de pastille « Autre » quand tous les statuts sont connus", () => !chip("autre"));
  t("le bon archivé reste dans les Archives (ouvrirArchives)", () => { w.ouvrirArchives(); const r = /Zéphyrin Archivé/.test(A.txt("#liste-archives")); w.fermerArchives(); return r; });
  t("aucun focus automatique : le champ de recherche n'a pas le focus à l'ouverture", () => w.document.activeElement !== $("#bta-recherche"));
  clic(chip("reparation"));
  t("filtre « En réparation » : seulement les 3 bons en réparation, pastille active", () => lignes().length === 3 && lignes().every(l => /En réparation/.test(l.querySelector(".bta-statut").textContent)) && chip("reparation").classList.contains("actif") && chip("reparation").getAttribute("aria-pressed") === "true");
  t("un bouton « ✕ Effacer » apparaît quand un filtre est actif", () => !!$("#bta-resume .bta-effacer") && /✕ Effacer/.test(A.txt("#bta-resume")) && /3 bons sur 12/.test(A.txt("#bta-resume")));
  clic(chip("live"));
  t("filtre « 🔴 En live » : seulement le bon qui a un punch ouvert (BT-042)", () => JSON.stringify(bts()) === '["BT-042"]');
  clic(chip("tous"));
  t("sans filtre, pas de bouton « ✕ Effacer »", () => !$("#bta-resume .bta-effacer") && lignes().length === NB_ACTIFS);
  saisir("gelinas");
  t("pastille à 0 grisée : avec « gelinas », attente = 0 et la pastille est grisée (zero) ; réparation = 1 ; tous = 1", () => nChip("attente") === 0 && chip("attente").classList.contains("zero") && nChip("reparation") === 1 && !chip("reparation").classList.contains("zero") && nChip("tous") === 1);
  { const c = chip("attente"); clic(c); }
  t("un filtre à 0 donne une liste vide avec un message, jamais d'exception", () => lignes().length === 0 && /Aucun bon ne correspond/.test(A.txt("#bta-liste")));
  clic($("#bta-resume .bta-effacer"));
  t("« ✕ Effacer » remet « Tous », vide la recherche ET le champ", () => etat().filtre === "tous" && etat().q === "" && $("#bta-recherche").value === "" && lignes().length === NB_ACTIFS && !$("#bta-resume .bta-effacer"));
  // pastille « Autre »
  { const m = A.get("machines"); m.push(P(M({ id: "zz", numeroBT: "BT-199", nom: "Statut bizarre", statut: "zzz" }))); rendreB(); }
  t("un statut inconnu : pastille « Autre » (1), total 13, et le filtre « Autre » ne montre que ce bon", () => { const c = chip("autre"); if (!c || nChip("autre") !== 1 || nChip("tous") !== 13) return false; clic(c); const r = JSON.stringify(bts()) === '["BT-199"]'; clic(chip("tous")); return r; });
  { const m = A.get("machines"); m.splice(m.findIndex(x => x.id === "zz"), 1); rendreB(); }
  t("la pastille « Autre » disparaît quand plus aucun bon n'est hors liste", () => !chip("autre") && nChip("tous") === NB_ACTIFS);
  fermerB();

  // ── 3. Ouverture : rien n'est mémorisé sauf le tri ─────────────────────────────────────────────────────────────
  console.log("— remise à zéro à l'ouverture, tri mémorisé");
  w.localStorage.removeItem("mtr_bta_prefs");
  ouvrirB(); clic(chip("reparation")); saisir("maverick");
  fermerB();
  t("fermer ne change rien aux bons ni ne laisse la page ouverte", () => !ouvert());
  ouvrirB();
  t("à la réouverture : filtre « Tous », recherche vide (état ET champ), toutes les lignes", () => etat().filtre === "tous" && etat().q === "" && $("#bta-recherche").value === "" && lignes().length === NB_ACTIFS);
  t("le tri n'est pas écrit tant qu'on ne le change pas ; filtre et recherche ne sont JAMAIS écrits", () => { const p = w.localStorage.getItem("mtr_bta_prefs"); return p === null && !/reparation|maverick/i.test(JSON.stringify(Object.keys(w.localStorage).map(k => w.localStorage.getItem(k)).filter(v => /bta/i.test(v || "")))); });
  choisirTri("bt");
  t("changer le tri le mémorise (localStorage mtr_bta_prefs = {tri:\"bt\"}) et seulement lui", () => { const p = JSON.parse(w.localStorage.getItem("mtr_bta_prefs")); return p && p.tri === "bt" && Object.keys(p).length === 1; });
  clic(chip("reparation")); saisir("x");
  fermerB(); ouvrirB();
  t("à la réouverture : tri « n° BT » conservé (liste et menu déroulant), filtre et recherche remis à zéro", () => $("#bta-tri").value === "bt" && etat().tri === "bt" && etat().filtre === "tous" && etat().q === "" && lignes().length === NB_ACTIFS);
  choisirTri("statut");
  t("revenir au tri « statut » le mémorise aussi", () => JSON.parse(w.localStorage.getItem("mtr_bta_prefs")).tri === "statut");
  t("localStorage inaccessible : la page s'ouvre quand même (try/catch)", () => {
    const orig = Object.getOwnPropertyDescriptor(w, "localStorage");
    const sp = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
    try { Object.defineProperty(w, "localStorage", { configurable: true, get() { return sp; } }); } catch (_) { return true; }   // impossible à simuler : on ne bloque pas le test
    try { fermerB(); ouvrirB(); choisirTri("bt"); return ouvert() && lignes().length === NB_ACTIFS; }
    finally { if (orig) Object.defineProperty(w, "localStorage", orig); else delete w.localStorage; }
  });
  choisirTri("statut");

  // ── 4. Recherche ───────────────────────────────────────────────────────────────────────────────────────────────
  console.log("— recherche");
  const cherche = (q) => { saisir(q); return bts(); };
  t("« bt-042 » trouve le BT-042 (et lui seul)", () => JSON.stringify(cherche("bt-042")) === '["BT-042"]');
  t("« BT-042 » en majuscules : même résultat", () => JSON.stringify(cherche("BT-042")) === '["BT-042"]');
  t("« gelinas » (sans accent) trouve « Gélinas »", () => JSON.stringify(cherche("gelinas")) === '["BT-042"]');
  t("« GÉLINAS » (avec accent, majuscules) aussi", () => JSON.stringify(cherche("GÉLINAS")) === '["BT-042"]');
  t("téléphone : « 819 » trouve le bon au 819-555-0142", () => JSON.stringify(cherche("819")) === '["BT-042"]');
  t("téléphone en chiffres collés « 8195550142 » et « (819) 555 » trouvent aussi", () => JSON.stringify(cherche("8195550142")) === '["BT-042"]' && JSON.stringify(cherche("(819) 555")) === '["BT-042"]');
  t("téléphone saisi « (514) 555-0177 » : trouvé par « 514555 » (chiffres seuls)", () => JSON.stringify(cherche("5145550177")) === '["BT-103"]');
  t("n° de carton « 4471 » ; n° de série « sn-aaa111 » ; modèle « x3-dps »", () => JSON.stringify(cherche("4471")) === '["BT-042"]' && JSON.stringify(cherche("sn-aaa111")) === '["BT-042"]' && JSON.stringify(cherche("x3-dps")) === '["BT-042"]');
  t("machine « maverick » ; travaux « freins »", () => JSON.stringify(cherche("maverick")) === '["BT-042"]' && JSON.stringify(cherche("freins")) === '["BT-042"]');
  t("plusieurs mots (tous requis) : « marc freins » oui, « marc ski-doo » non", () => JSON.stringify(cherche("marc freins")) === '["BT-042"]' && cherche("marc ski-doo").length === 0);
  t("la recherche ne trouve pas un bon archivé (« Zéphyrin », « archivée », « BT-090 »)", () => cherche("zephyrin").length === 0 && cherche("bt-090").length === 0 && cherche("jadis").length === 0);
  t("les compteurs suivent la recherche (« bt-042 » : tous = 1, réparation = 1, sans RDV = 0) et le résumé dit « 1 bon sur 12 »", () => { cherche("bt-042"); return nChip("tous") === 1 && nChip("reparation") === 1 && nChip("sansrdv") === 0 && /1 bon sur 12/.test(A.txt("#bta-resume")); });
  t("une recherche sans résultat : message, aucun plantage ; le champ garde son texte (il n'est pas redessiné)", () => { const c = $("#bta-recherche"); const r = cherche("zzzzqq").length === 0 && /Aucun bon ne correspond/.test(A.txt("#bta-liste")) && c.value === "zzzzqq" && $("#bta-recherche") === c; return r; });
  saisir("");

  // ── 5. Tri ─────────────────────────────────────────────────────────────────────────────────────────────────────
  console.log("— tri");
  const CREE_S = iso(-30 * JOUR);
  A.set("machines", cp([
    M({ id: "tl1", numeroBT: "BT-210", statut: "reparation", arriveeLe: iso(-5 * JOUR), chrono: [{ tech: "Gwendal", debut: iso(-1 * H), fin: null, pauses: [], live: true }] }),
    M({ id: "tr1", numeroBT: "BT-211", statut: "reparation", arriveeLe: iso(-10 * JOUR) }),
    M({ id: "tr2", numeroBT: "BT-212", statut: "reparation", arriveeLe: iso(-2 * JOUR) }),
    M({ id: "tr3", numeroBT: "BT-213", statut: "reparation", creeLe: iso(-1 * JOUR), chrono: [{ tech: "Arno", debut: iso(-15 * JOUR), fin: iso(-15 * JOUR + H), pauses: [] }] }),   // arrivée = premier punch (-15 j), pas creeLe
    M({ id: "ta1", numeroBT: "BT-214", statut: "attente", arriveeLe: iso(-3 * JOUR) }),
    M({ id: "ta2", numeroBT: "BT-215", statut: "attente", arriveeLe: iso(-8 * JOUR) }),
    M({ id: "ts1", numeroBT: "BT-261", statut: "sansrdv", creeLe: CREE_S }),
    M({ id: "ts3", numeroBT: "BT-260", statut: "sansrdv", creeLe: CREE_S }),                                   // même arrivée que BT-261 : le n° BT départage
    M({ id: "ts2", numeroBT: "BT-216", statut: "sansrdv", creeLe: iso(-1 * JOUR) }),
    M({ id: "tv1", numeroBT: "BT-217", statut: "avenir", machineArrivee: false, echeance: L.jourIso(5), heure: "09:00" }),
    M({ id: "tv2", numeroBT: "BT-218", statut: "avenir", machineArrivee: false, echeance: L.jourIso(2), heure: "09:00" }),
    M({ id: "tc", numeroBT: "BT-222", statut: "commande" }),
    M({ id: "tas", numeroBT: "BT-221", statut: "assurance" }),
    M({ id: "tp", numeroBT: "BT-220", statut: "prete" }),
    M({ id: "tf", numeroBT: "BT-219", statut: "afacturer" }),
  ]));
  rendreB();
  t("tri « statut » : live d'abord, puis réparation, attente, sans RDV, à venir, à facturer, facturé, assurance, commande ; dans le groupe le plus ancien ARRIVÉ d'abord (arrivée, punch, création), puis RDV, puis n° BT", () => {
    const att = ["BT-210", "BT-213", "BT-211", "BT-212", "BT-215", "BT-214", "BT-260", "BT-261", "BT-216", "BT-218", "BT-217", "BT-219", "BT-220", "BT-221", "BT-222"];
    return JSON.stringify(bts()) === JSON.stringify(att);
  });
  t("le bon en live (arrivé depuis 5 j) passe avant le bon en réparation arrivé depuis 15 j", () => bts()[0] === "BT-210" && bts().indexOf("BT-213") === 1);
  choisirTri("bt");
  t("tri « n° BT » : décroissant", () => JSON.stringify(bts()) === JSON.stringify(["BT-261", "BT-260", "BT-222", "BT-221", "BT-220", "BT-219", "BT-218", "BT-217", "BT-216", "BT-215", "BT-214", "BT-213", "BT-212", "BT-211", "BT-210"]));
  A.set("machines", cp([M({ id: "n1", numeroBT: "BT-99" }), M({ id: "n2", numeroBT: "BT-100" }), M({ id: "n3", numeroBT: "BT-1000" }), M({ id: "n4", numeroBT: "BT-042" }), M({ id: "n5", numeroBT: "" })]));
  rendreB();
  t("tri « n° BT » NUMÉRIQUE : BT-1000, BT-100 avant BT-99, puis BT-042 ; le bon sans numéro est dernier", () => JSON.stringify(bts()) === JSON.stringify(["BT-1000", "BT-100", "BT-99", "BT-042", "—"].map(x => x === "—" ? "sans n°" : x)));
  choisirTri("statut");
  w.localStorage.removeItem("mtr_bta_prefs");

  // ── 6. Clic : déplier seulement ────────────────────────────────────────────────────────────────────────────────
  console.log("— clic = déplier, jamais de live ni de sauvegarde");
  A.set("machines", base());
  rendreB();
  const avant = snap();
  const nbSessions = () => A.get("machines").reduce((t2, m) => t2 + (m.chrono || []).length, 0);
  const s0 = nbSessions();
  appels.live.length = 0; appels.sauv = 0; appels.edit.length = 0; appels.bon.length = 0;
  t("une ligne est un role=button focalisable, repliée au départ (aria-expanded=false), sans détail construit", () => { const h = tete("b11"); return h.getAttribute("role") === "button" && h.tabIndex === 0 && h.getAttribute("aria-expanded") === "false" && !ligne("b11").querySelector(".bta-detail"); });
  clic(tete("b11"));
  t("clic sur la ligne : aria-expanded=true et le détail est construit", () => tete("b11").getAttribute("aria-expanded") === "true" && !!ligne("b11").querySelector(".bta-detail"));
  t("un bon avec notesTech SEUL : ses notes s'affichent, mais le bon n'est pas muté (notesLive reste undefined)", () => /Remplacé la courroie/.test(A.txt(ligne("b11"))) && /Test routier OK/.test(A.txt(ligne("b11"))) && A.get("machines").find(m => m.id === "b11").notesLive === undefined);
  t("JSON.stringify(machines) identique avant / après le clic ; aucune session chrono créée", () => snap() === avant && nbSessions() === s0);
  t("le clic n'a appelé NI ouvrirLive, NI sauvegarder, NI ouvrirEdition, NI bonDeTravail", () => appels.live.length === 0 && appels.sauv === 0 && appels.edit.length === 0 && appels.bon.length === 0);
  clic(ligne("b11").querySelector(".bta-detail .bta-champ"));
  t("cliquer dans le détail (texte à copier, lien) ne replie pas la ligne", () => tete("b11").getAttribute("aria-expanded") === "true");
  clic(tete("b11"));
  t("un second clic sur la ligne la replie (aria-expanded=false, détail retiré)", () => tete("b11").getAttribute("aria-expanded") === "false" && !ligne("b11").querySelector(".bta-detail"));
  touche(tete("b11"), "Enter");
  t("clavier : Entrée sur la ligne la déplie", () => tete("b11").getAttribute("aria-expanded") === "true");
  touche(tete("b11"), " ");
  t("clavier : Espace la replie", () => tete("b11").getAttribute("aria-expanded") === "false");
  lignes().forEach(l => clic(l.querySelector(".bta-tete")));
  t("déplier les 12 bons : aucun bon muté, aucune écriture, aucun live, aucune erreur", () => lignes().every(l => l.querySelector(".bta-tete").getAttribute("aria-expanded") === "true") && snap() === avant && appels.sauv === 0 && appels.live.length === 0 && A.erreurs.length === 0);
  t("btaNotes est pure : sur notesTech seul elle rend les lignes sans toucher le bon ; le « ⏳ Reste à faire » est masqué seulement quand le reste est affiché à part", () => {
    const seul = P(M({ id: "p1", notesTech: "• Une\n• Deux" })), avantP = w.JSON.stringify(seul);
    const r = w.btaNotes(seul);
    const avecReste = P(M({ id: "p2", resteAFaire: { texte: "Finir", tech: "G", quand: iso(-H), minutes: 30 }, notesLive: [{ texte: "⏳ Reste à faire : Finir" }, { texte: "Autre" }] }));
    const sansReste = P(M({ id: "p3", notesLive: [{ texte: "⏳ Reste à faire : Finir" }, { texte: "Autre" }] }));
    return r.length === 2 && r[0].texte === "Une" && w.JSON.stringify(seul) === avantP && seul.notesLive === undefined && w.btaNotes(avecReste).length === 1 && w.btaNotes(avecReste)[0].texte === "Autre" && w.btaNotes(sansReste).length === 2 && w.btaNotes(null).length === 0;
  });
  lignes().forEach(l => clic(l.querySelector(".bta-tete")));
  t("tout replier : le détail disparaît des 12 lignes", () => $$("#bta-liste .bta-detail").length === 0);

  // ── 7. Contenu du détail ───────────────────────────────────────────────────────────────────────────────────────
  console.log("— détail : champs, pièces, notes, temps, reste, montants");
  clic(tete("g"));
  const dg = () => A.txt(ligne("g").querySelector(".bta-detail"));
  t("client (avec lien tel: aux chiffres seulement), machine, série, modèle, carton, km, emplacement", () => {
    const a = ligne("g").querySelector("a.bta-tel");
    return /Marc Gélinas/.test(dg()) && a && a.getAttribute("href") === "tel:8195550142" && /2021 Maverick X3/.test(dg()) && /SN-AAA111/.test(dg()) && /X3-DPS/.test(dg()) && /4471/.test(dg()) && /1200 km/.test(dg()) && /Garage · baie 2/.test(dg());
  });
  t("rendez-vous / échéance, durée estimée (dureeTxtLocale), technicien, travaux complets", () => /09:30/.test(dg()) && /4 h/.test(dg()) && /Gwendal/.test(dg()) && /Vidange et changement des freins/.test(dg()));
  t("pièces : qté, nom, n°, ✓ reçue, 🔧 utilisée ; une pièce non reçue le dit ; compteur 1/2", () => /2 ×/.test(dg()) && /Filtre à huile/.test(dg()) && /n° HF-148/.test(dg()) && /✓ reçue/.test(dg()) && /🔧 utilisée/.test(dg()) && /Plaquettes de frein/.test(dg()) && /pas encore reçue/.test(dg()) && /1\/2 reçues/.test(dg()));
  t("notes d'atelier avec technicien et heure ; la note « ⏳ Reste à faire » n'est PAS dans les notes (affichée à part)", () => {
    const n = A.txt(ligne("g").querySelector(".bta-notes"));
    return /Freins avant faits/.test(n) && /Gwendal/.test(n) && !/Reste à faire/.test(n) && ligne("g").querySelector(".bta-notes").querySelectorAll("li").length === 1;
  });
  t("reste à faire affiché à part : texte, technicien, « environ 1 h 30 » (resteMinutesDe) et l'heure de saisie", () => /Reste à faire/.test(dg()) && /Purger les freins/.test(dg()) && /environ 1 h (29|30)/.test(dg()) && /estimation saisie à \d+ h \d\d/.test(dg()));
  t("temps : « Temps punché » (dureeTxtLocale) et « Durée estimée » (4 h)", () => /Temps punché\s*(1 h 5\d|2 h|1 h 59|2 h 0\d)/.test(dg()) && /Durée estimée\s*4 h/.test(dg()));
  t("la pastille compacte montre le reste « ⏳ ~… », le live « 🔴 Gwendal », l'arrivée « il y a 10 j » (vieux) et 📦 1/2", () => {
    const l2 = A.txt(ligne("g").querySelector(".bta-l2"));
    return /⏳ ~1 h (29|30)/.test(l2) && /🔴 Gwendal/.test(l2) && /arrivée il y a 10 j/.test(l2) && ligne("g").querySelector(".bta-pastille.vieux") && /📦 1\/2/.test(l2);
  });
  clic(tete("b7"));
  const d7 = () => A.txt(ligne("b7"));
  t("AUCUN montant : coutAchat, prixVente, facturation, cadeau absents du détail (aucun « $ », aucun chiffre d'argent)", () => !/\$|7391|4567|3210|9876|8590|7788/.test(d7()) && !/\$|7391|4567|3210|9876|8590|7788/.test(A.txt("#bta-page")));
  t("aucune mention de paiement, de cadeau, de facturation ni de prix dans la page ; le statut « Prêt à facturer » reste le nom de la colonne", () => !/cadeau|comptant|pay[ée]|facturation|prix|coût|coutant|QuickBooks|total/i.test(A.txt("#bta-liste").replace(/Prêt à facturer/g, "")) && /Prêt à facturer/.test(A.txt(ligne("b7"))));
  t("la pièce du bon facturé n'affiche que qté / nom / n° / reçue / utilisée", () => /1 ×/.test(d7()) && /Courroie/.test(d7()) && /CR-1/.test(d7()) && /✓ reçue/.test(d7()) && /🔧 utilisée/.test(d7()));

  // champs vides
  A.set("machines", cp([{ id: "vide", statut: "sansrdv", creeLe: iso(-JOUR) }, { id: "vide2", statut: "reparation" }, { id: "vide3" }]));
  rendreB();
  t("des bons presque vides se rendent (liste de 3 lignes) sans exception", () => lignes().length === 3);
  ["vide", "vide2", "vide3"].forEach(id => clic(tete(id)));
  t("champs vides → « — », jamais « undefined », « null » ou « NaN »", () => ["vide", "vide2", "vide3"].every(id => { const d = ligne(id).querySelector(".bta-detail"); return d && /—/.test(d.textContent) && !/undefined|null|NaN|\[object/.test(d.textContent); }));
  t("un bon sans statut est rangé avec le libellé « Sans statut » et compté dans « Autre »", () => /Sans statut/.test(A.txt(ligne("vide3"))) && nChip("autre") === 1);
  t("bons presque vides : ni erreur JS ni session ni écriture", () => A.erreurs.length === 0 && appels.sauv === 0);

  // XSS
  A.set("machines", cp([M({ id: "x", numeroBT: "BT-666", nom: "<b>gras</b>", client: "<img src=x onerror=alert(1)>", tel: "\"><img src=x onerror=alert(2)>", travaux: "<img src=x onerror=alert(1)> et <script>alert(3)</script>",
    resteAFaire: { texte: "<svg onload=alert(4)>", tech: "<i>t</i>", quand: iso(-H), minutes: 60 }, notesLive: [{ texte: "<script>alert(5)</script>", tech: "<u>x</u>", quand: iso(-H) }],
    pieces: [{ qte: "<b>1</b>", nom: "<svg onload=alert(6)>", num: "<img src=x onerror=alert(7)>", coche: true }], technicien: "<s>t</s>", lieu: "<marquee>x</marquee>", reference: "\"><script>alert(8)</script>" })]));
  rendreB(); clic(tete("x"));
  t("XSS : travaux, client, notes, pièces, tél. restent du TEXTE (aucun <img>, <script>, <svg>, <b> injecté, aucune alerte)", () => {
    const l = ligne("x");
    return !l.querySelector("img, script, svg, i, u, s, marquee") && [...l.querySelectorAll("b")].every(b => !b.children.length) && A.alertes.length === 0
      && /<img src=x onerror=alert\(1\)> et <script>alert\(3\)<\/script>/.test(l.textContent) && /<svg onload=alert\(4\)>/.test(l.textContent) && /<script>alert\(5\)<\/script>/.test(l.textContent);
  });
  t("XSS : le lien tel: ne contient que des chiffres et des + (jamais de guillemet ni de balise)", () => $$("#bta-liste a.bta-tel").every(a => /^tel:[\d+]*$/.test(a.getAttribute("href"))));
  t("XSS : data-id et attributs ne s'échappent pas (un id piégé ne casse pas la ligne)", () => {
    A.set("machines", cp([M({ id: "a\"b'><i>c", numeroBT: "BT-667" })])); rendreB(); const l = lignes()[0]; clic(l.querySelector(".bta-tete"));
    return lignes().length === 1 && l.dataset.id === "a\"b'><i>c" || (lignes().length === 1 && $$("#bta-liste .bta-ligne i").length === 0);
  });

  // bon type serveur
  const srv = { id: "srv-1", creeLe: iso(-6 * JOUR), nom: "Yamaha Grizzly", client: "Client Web", tel: "+1 (819) 555-0199", travaux: "Entretien annuel", statut: "avenir", echeance: L.jourIso(4), heure: "09:00", dureeEstimee: 120 };
  A.set("machines", cp([srv])); rendreB(); const nbErr = A.erreurs.length;
  clic(tete("srv-1"));
  t("bon type serveur (id, creeLe, nom, client, tel, travaux, avenir, echeance, heure, dureeEstimee) : rendu et déplié sans erreur", () => A.erreurs.length === nbErr && lignes().length === 1 && /Yamaha Grizzly/.test(A.txt(ligne("srv-1"))) && /Entretien annuel/.test(A.txt(ligne("srv-1"))) && /2 h/.test(A.txt(ligne("srv-1"))) && /09:00/.test(A.txt(ligne("srv-1"))));
  t("tel: « +1 (819) 555-0199 » → href « tel:+18195550199 »", () => ligne("srv-1").querySelector("a.bta-tel").getAttribute("href") === "tel:+18195550199");
  t("bon à venir non arrivé : pas de pastille d'arrivée (jamais creeLe)", () => !/arrivée/.test(A.txt(ligne("srv-1").querySelector(".bta-l2"))));

  // ── 8. Actions ─────────────────────────────────────────────────────────────────────────────────────────────────
  console.log("— actions : live (avec confirmation), bon imprimable, modifier");
  A.set("machines", base()); connecter("Jason"); rendreB();
  const actBtn = (id, act) => ligne(id) && ligne(id).querySelector('[data-bta-act="' + act + '"]');
  ["g", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "b10"].forEach(id => clic(tete(id)));
  t("« 🔴 Ouvrir en live » présent (droit live) sauf pour Assurance et Commande", () => ["g", "b2", "b3", "b4", "b5", "b6", "b7", "b8"].every(id => !!actBtn(id, "live")) && !actBtn("b9", "live") && !actBtn("b10", "live"));
  t("« 🖨️ Bon imprimable » partout ; « ✏️ Modifier » pour l'administration seulement", () => ["g", "b9", "b10"].every(id => !!actBtn(id, "bon")) && !!actBtn("g", "edit") && /✏️ Modifier/.test(actBtn("g", "edit").textContent));
  A.confirmations.length = 0; appels.live.length = 0;
  clic(actBtn("b2", "live"));
  t("bon en réparation : ouvre le live sans confirmation", () => appels.live.join() === "b2" && A.confirmations.length === 0);
  A.reponseConfirm = false; appels.live.length = 0;
  clic(actBtn("b7", "live"));
  t("Prêt à facturer : confirm() « remet le bon en Réparation en cours et démarre ton punch » ; refusé → le live ne s'ouvre pas", () => A.confirmations.length === 1 && /Réparation en cours/.test(A.confirmations[0]) && /punch/.test(A.confirmations[0]) && appels.live.length === 0);
  A.reponseConfirm = true;
  clic(actBtn("b7", "live"));
  t("Prêt à facturer : confirmé → ouvrirLive(id)", () => appels.live.join() === "b7" && A.confirmations.length === 2);
  appels.live.length = 0; A.confirmations.length = 0;
  clic(actBtn("b8", "live"));
  t("Facturé : confirm() puis ouvrirLive", () => A.confirmations.length === 1 && appels.live.join() === "b8");
  appels.live.length = 0; A.confirmations.length = 0;
  clic(actBtn("b5", "live"));
  t("À venir non arrivé : confirm() puis ouvrirLive", () => A.confirmations.length === 1 && appels.live.join() === "b5");
  appels.live.length = 0; A.confirmations.length = 0;
  clic(actBtn("b6", "live"));
  t("À venir arrivé, sans RDV, en attente : pas de confirmation", () => A.confirmations.length === 0 && appels.live.join() === "b6" && (clic(actBtn("b4", "live")), clic(actBtn("b3", "live")), A.confirmations.length === 0 && appels.live.join() === "b6,b4,b3"));
  appels.bon.length = 0; clic(actBtn("g", "bon"));
  t("Bon imprimable : bonDeTravail(id)", () => appels.bon.join() === "g");
  clic(actBtn("g", "edit"));
  t("Modifier : ouvrirEdition(id)", () => appels.edit.join() === "g");
  t("btaActionsExtra(m) retourne '' (point d'extension)", () => w.btaActionsExtra({}) === "");
  // un bon supprimé entre-temps
  { const m = A.get("machines"); m.splice(m.findIndex(x => x.id === "b2"), 1); }
  appels.live.length = 0; const b2btn = actBtn("b2", "live"); clic(b2btn);
  t("action sur un bon qui n'existe plus : toast « n'existe plus », rien ne s'ouvre, pas d'exception", () => appels.live.length === 0 && A.toasts().some(x => /n'existe plus/.test(x)) && !ligne("b2"));
  // sans droit live / pas administrateur
  A.set("machines", base()); connecter("Yan"); punche("Yan"); rendreB(); deplier("b2"); deplier("b7");
  t("technicien SANS le droit « live » : bouton 🔴 caché (réparation et facturé) ; bon imprimable présent ; pas de ✏️ Modifier", () => !actBtn("b2", "live") && !actBtn("b7", "live") && !!actBtn("b2", "bon") && !actBtn("b2", "edit"));
  connecter("Gwendal"); punche("Gwendal"); rendreB(); deplier("b2");
  t("technicien avec le droit « live » : 🔴 présent, ✏️ Modifier absent (administration seulement)", () => !!actBtn("b2", "live") && !actBtn("b2", "edit") && !!actBtn("b2", "bon"));
  A.reponseConfirm = true;

  // ── 9. Synchronisation (appliquerLigne1) ───────────────────────────────────────────────────────────────────────
  console.log("— synchro : un autre poste enregistre pendant que la page est ouverte");
  connecter("Jason"); fermerB();
  const gros = Array.from({ length: 40 }, (_, i) => M({ id: "s" + i, numeroBT: "BT-" + (300 + i), nom: "Machine " + (300 + i), statut: i % 2 ? "reparation" : "sansrdv", creeLe: iso(-(i + 1) * JOUR), travaux: "Travaux numéro " + i }));
  A.set("machines", cp(gros));
  const timers = []; const siOrig = w.setInterval.bind(w), ciOrig = w.clearInterval.bind(w); const cleared = [];
  w.setInterval = (f, ms, ...r) => { const id = siOrig(f, ms, ...r); timers.push({ f, ms, id }); return id; };
  w.clearInterval = (id) => { cleared.push(id); return ciOrig(id); };
  ouvrirB();
  choisirTri("bt");
  clic(tete("s5")); clic(tete("s20")); clic(tete("s33"));
  page().scrollTop = 500; const haut0 = page().scrollTop;
  t("la page défile (liste assez longue pour tester la position)", () => haut0 > 300);
  const ordreAvant = bts();
  const nouvelle = cp(A.get("machines"));
  nouvelle.find(m => m.id === "s5").statut = "afacturer";          // un autre poste a changé le statut
  nouvelle.find(m => m.id === "s33").statut = "archive";           // …et archivé celui-là (il était déplié)
  nouvelle.find(m => m.id === "s33").livreLe = "2026-10-01";
  nouvelle.push(M({ id: "sNeuf", numeroBT: "BT-399", statut: "attente" }));
  w.appliquerLigne1(P(nouvelle));
  t("synchro : les bons dépliés (s5, s20) le restent après le redessin", () => tete("s5").getAttribute("aria-expanded") === "true" && tete("s20").getAttribute("aria-expanded") === "true" && !!ligne("s20").querySelector(".bta-detail"));
  t("synchro : le tri choisi est conservé (n° BT décroissant) et le nouveau bon s'y range", () => $("#bta-tri").value === "bt" && etat().tri === "bt" && bts()[0] === "BT-399" && bts().indexOf("BT-339") < bts().indexOf("BT-338"));
  t("synchro : la position de défilement est conservée", () => Math.abs(page().scrollTop - haut0) <= 3);
  t("synchro : le statut mis à jour par l'autre poste est affiché (BT-305 → Prêt à facturer)", () => /Prêt à facturer/.test(A.txt(ligne("s5").querySelector(".bta-statut"))));
  t("synchro : un bon archivé ailleurs disparaît de la liste, des compteurs et des lignes dépliées", () => !ligne("s33") && !etat().ouverts.has("s33") && nChip("tous") === 40 && !bts().includes("BT-333"));
  t("synchro : aucun bon n'a été muté par le redessin, aucune erreur JS", () => A.erreurs.length === 0 && ordreAvant.length === 40);
  t("minuterie : un setInterval de 60 s est posé tant que la page est ouverte", () => timers.some(x => x.ms === 60000));
  { const tm = timers.find(x => x.ms === 60000); const m = A.get("machines"); m.push(P(M({ id: "sMin", numeroBT: "BT-400", statut: "reparation" }))); tm.f(); }
  t("minuterie : le tic de 60 s redessine la liste (nouveau bon visible) en gardant les lignes dépliées", () => bts()[0] === "BT-400" && tete("s20").getAttribute("aria-expanded") === "true");
  fermerB();
  t("fermer la page arrête la minuterie", () => etat().timer === null && cleared.length > 0 && !ouvert());
  w.setInterval = siOrig; w.clearInterval = ciOrig;
  let rendus = 0; const btaRendreOrig = w.btaRendre; w.btaRendre = () => { rendus++; return btaRendreOrig && btaRendreOrig(); };
  w.rafraichirVues();
  t("page fermée : rafraichirVues ne redessine pas la liste (pas de travail pour rien)", () => rendus === 0);
  ouvrirB(); const rendusOuverture = rendus; w.rafraichirVues();
  t("page ouverte : rafraichirVues (synchro, punch, enregistrement) redessine la liste", () => rendusOuverture >= 1 && rendus === rendusOuverture + 1);
  w.btaRendre = btaRendreOrig;
  t("à la réouverture : les bons archivés ailleurs ne reviennent pas", () => !ligne("s33") && lignes().length === 41);
  fermerB();

  // ── 10. Pagination : 600 bons ──────────────────────────────────────────────────────────────────────────────────
  console.log("— pagination (600 bons)");
  A.set("machines", cp(Array.from({ length: 600 }, (_, i) => M({ id: "p" + i, numeroBT: "BT-" + (1000 + i), nom: "Machine " + i, statut: i % 3 ? "reparation" : "sansrdv", creeLe: iso(-i * 3600000) }))));
  const t0 = Date.now(); ouvrirB(); const dt = Date.now() - t0;
  t("600 bons : 100 lignes seulement et un bouton « Afficher les 500 autres »", () => lignes().length === 100 && /Afficher les 500 autres/.test(A.txt($("#bta-liste .bta-plus"))) && nChip("tous") === 600);
  t("l'ouverture de 600 bons reste rapide (< 1,5 s)", () => dt < 1500);
  t("les 100 premières sont les premières du tri (live → réparation → … , le plus ancien arrivé d'abord)", () => bts().length === 100 && new Set(bts()).size === 100);
  clic($("#bta-liste .bta-plus"));
  t("« Afficher les 500 autres » montre les 600 lignes et le bouton disparaît", () => lignes().length === 600 && !$("#bta-liste .bta-plus"));
  saisir("BT-1005");
  t("changer la recherche remet la pagination à 100 (ici 1 résultat)", () => etat().limite === 100 && JSON.stringify(bts()) === '["BT-1005"]');
  saisir(""); clic(chip("sansrdv"));
  t("filtre sur 600 bons : 200 « Sans RDV » → 100 lignes + « Afficher les 100 autres »", () => lignes().length === 100 && /Afficher les 100 autres/.test(A.txt($("#bta-liste .bta-plus"))));
  clic(chip("tous")); fermerB();

  // ── 11. Déconnexion ────────────────────────────────────────────────────────────────────────────────────────────
  console.log("— déconnexion");
  A.set("machines", base()); connecter("Jason"); ouvrirB(); clic(tete("g")); clic(chip("reparation")); saisir("maverick");
  await w.deconnecter();
  t("deconnecter : la page se ferme et la minuterie s'arrête", () => !ouvert() && etat().timer === null);
  t("deconnecter : recherche, filtre, lignes dépliées et liste remis à zéro (le technicien suivant ne voit rien du précédent)", () => etat().q === "" && etat().filtre === "tous" && etat().ouverts.size === 0 && $("#bta-recherche").value === "" && lignes().length === 0);

  // ── 12. Mise en page : 390 px, mode sombre ─────────────────────────────────────────────────────────────────────
  console.log("— mise en page (390 px sans défilement horizontal, champs à 16 px, mode sombre)");
  const LONG = M({ id: "long", numeroBT: "BT-777", nom: "Machine au nom très très très long qui devrait passer à la ligne sans jamais déborder de l'écran", client: "Client-au-nom-interminable-sans-espaces-pour-tester-le-debordement-horizontal-du-telephone",
    travaux: "Un_très_long_mot_sans_espace_qui_pourrait_faire_déborder_la_page_horizontalement_sur_un_cellulaire_de_390_pixels_de_large " + "texte ".repeat(40), tel: "+1 (819) 555-0142", reference: "SN-0123456789012345678901234567890123456789",
    notesLive: [{ texte: "Une_note_très_longue_sans_espace_" + "x".repeat(120), tech: "Gwendal", quand: iso(-H) }], pieces: [{ qte: "1", nom: "Pièce_au_nom_très_long_" + "y".repeat(80), num: "Z".repeat(50), coche: true }] });
  A.set("machines", base());
  connecter("Jason");
  const cadre = A.dom && A.dom.frame;
  if (cadre) {
    cadre.style.width = "390px"; await dodo(150);
    ouvrirB(); lignes().forEach(l => deplier(l.dataset.id)); await dodo(50);
    const doc = w.document.documentElement;
    t("390 px : la fenêtre de l'iframe fait bien 390 px de large", () => w.innerWidth === 390);
    t("390 px, 12 bons dépliés : aucun défilement horizontal, ni dans la page ni dans le document [" + [doc.scrollWidth, page().scrollWidth, page().clientWidth, w.innerWidth].join("/") + "]", () => doc.scrollWidth <= w.innerWidth && page().scrollWidth <= page().clientWidth && w.document.body.scrollWidth <= w.innerWidth);
    A.set("machines", cp(base().concat([LONG]))); rendreB(); deplier("long"); await dodo(50);
    // (le tableau de bord derrière la page, lui, peut déborder avec un nom sans espace : ce n'est pas notre page, qui défile dans son propre cadre)
    t("390 px, textes interminables sans espace (nom, client, travaux, série, note, pièce) : la page ne défile pas horizontalement [" + [page().scrollWidth, page().clientWidth].join("/") + "]", () => page().scrollWidth <= page().clientWidth);
    t("390 px : aucune ligne ni zone de la page ne dépasse la largeur de l'écran", () => [...page().querySelectorAll(".bta-ligne, .bta-detail, .bta-chip, .bta-tete, .bta-bloc, .bta-champ, .bta-texte, .bta-pieces, .bta-notes")].every(e => e.getBoundingClientRect().right <= w.innerWidth + 1));
    A.set("machines", cp(gros)); rendreB(); deplier("s5"); page().scrollTop = 600; const hautMobile = page().scrollTop;
    const nouvelleM = cp(gros); nouvelleM.find(m => m.id === "s7").statut = "afacturer"; w.appliquerLigne1(P(nouvelleM));
    t("390 px : c'est la PAGE qui défile (et non un second cadre) ; une synchro redessine sans bouger la position [" + [hautMobile, page().scrollTop, page().scrollHeight, page().clientHeight].join("/") + "]", () => page().scrollHeight > page().clientHeight && hautMobile > 300 && Math.abs(page().scrollTop - hautMobile) <= 3 && tete("s5").getAttribute("aria-expanded") === "true" && w.getComputedStyle($(".bta-corps")).overflowY === "visible");
    page().scrollTop = 0; A.set("machines", cp(base())); rendreB(); lignes().slice(0, 3).forEach(l => deplier(l.dataset.id));
    t("champ de recherche et tri à 16 px (pas de zoom automatique sur iPhone), cibles tactiles ≥ 44 px", () => w.getComputedStyle($("#bta-recherche")).fontSize === "16px" && w.getComputedStyle($("#bta-tri")).fontSize === "16px"
      && $("#bta-recherche").offsetHeight >= 44 && $("#bta-tri").offsetHeight >= 44 && lignes().every(l => l.querySelector(".bta-tete").offsetHeight >= 44) && $$("#bta-chips .bta-chip").every(c => c.offsetHeight >= 44) && $$("#bta-liste .bta-btn").every(b => b.offsetHeight >= 44));
    t("390 px : la recherche et le tri passent sur leur propre ligne, pleine largeur", () => $("#bta-recherche").getBoundingClientRect().width > 330 && $("#bta-tri").getBoundingClientRect().width > 330);
    const fondClair = w.getComputedStyle(lignes()[0]).backgroundColor, texteClair = w.getComputedStyle(lignes()[0].querySelector(".bta-nom")).color;
    w.document.documentElement.setAttribute("data-theme", "nuit"); w.document.body.setAttribute("data-theme", "nuit"); await dodo(300);
    const fondSombre = w.getComputedStyle(lignes()[0]).backgroundColor, texteSombre = w.getComputedStyle(lignes()[0].querySelector(".bta-nom")).color;
    const rgb = (c) => c.match(/\d+/g).map(Number);
    t("mode sombre : fond de ligne foncé et texte clair (mêmes variables que le reste de l'app), pas de blanc éclatant", () => fondClair !== fondSombre && texteClair !== texteSombre && rgb(fondSombre).slice(0, 3).every(x => x < 80) && rgb(texteSombre).slice(0, 3).every(x => x > 150));
    t("mode sombre : champ de recherche et détail dépliés sombres, pastille de filtre active lisible, aucun défilement horizontal", () => rgb(w.getComputedStyle($("#bta-recherche")).backgroundColor).slice(0, 3).every(x => x < 80) && rgb(w.getComputedStyle($(".bta-detail")).backgroundColor).slice(0, 3).every(x => x < 90)
      && rgb(w.getComputedStyle(chip("tous")).color).join() !== rgb(w.getComputedStyle(chip("tous")).backgroundColor).join() && page().scrollWidth <= page().clientWidth);
    w.document.documentElement.setAttribute("data-theme", "jour"); w.document.body.setAttribute("data-theme", "jour");
    cadre.style.width = "1280px"; await dodo(150);
    t("1280 px : pas de défilement horizontal non plus ; l'entête reste collée en haut pendant le défilement", () => page().scrollWidth <= page().clientWidth && w.getComputedStyle($(".bta-entete")).position === "sticky");
    fermerB();
  } else {
    ok(true, "(mise en page non vérifiable hors Chromium : pas de cadre redimensionnable)");
  }

  L.fin(A);
};
principal().catch((e) => { ok(false, "exception inattendue : " + ((e && e.stack) || e)); process.exit(1); });   // sur la base : un ❌ lisible plutôt qu'un blocage
