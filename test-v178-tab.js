// v178-TAB — Tableau : jours depuis l'arrivée, tri des colonnes, bons en direct en tête (A7) ;
//   temps restant obligatoire à la fermeture d'une session « Non, pas encore » et affiché partout (A8).
//   Dans Chromium :  node outils-v178/run-in-chromium.js test-v178-tab.js ./index.html   (MTR_FAKE_NOW facultatif)
//   Le test fonctionne à n'importe quelle heure : toutes les dates sont construites relativement à « maintenant ».
const L = require("./outils-v178/test-lib-v178.js");
const { ok, dodo } = L;
const FICHIER = process.argv[2] || "./index.html";
const MIN = 60000, H = 3600000, JOUR = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();                 // ms < 0 : dans le passé
// Jour local (décalage en jours, heure, minute) → ISO : « il y a 10 jours à midi » (le jour civil ne dépend pas de l'heure du test)
const local = (dj, h, mi) => { const x = new Date(); x.setDate(x.getDate() + dj); x.setHours(h, mi, 0, 0); return x.toISOString(); };
const hm = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
// Une assertion qui ne plante pas le test : une exception est une assertion ratée (sur la base, les fonctions n'existent pas)
const t = (msg, f) => { let r; try { r = f(); } catch (e) { ok(false, msg + " — exception : " + (e && e.message)); return; } ok(!!r, msg); };

// Un bloc de tests dont une exception de pilotage (sur la base, les nouveaux éléments n'existent pas) est une assertion ratée : la suite continue
const bloc = async (nom, f) => { try { await f(); } catch (e) { ok(false, "exception dans « " + nom.slice(0, 60) + " » : " + (e && e.message)); } };
let seq = 0;
// type + modele : le formulaire d'édition recompose le nom de la machine depuis la grille (type / marque / modèle) et refuse « Machine » tout seul
const bon = (o) => { const b = Object.assign({ id: "b" + (++seq), numeroBT: "BT-" + (700 + seq), nom: "Machine " + seq, client: "Client " + seq, statut: "reparation", pieces: [], chrono: [],
  dureeEstimee: 60, machineArrivee: true, pieceComplete: true, creeLe: local(-40, 9, 0), type: "VTT" }, o); if (!b.modele) b.modele = b.nom; return b; };
const ouverte = (tech, debutMs) => ({ tech: tech || "Gwendal", debut: iso(debutMs === undefined ? -20 * MIN : debutMs), fin: null, pauses: [], live: true });
const fermee = (tech, debutMs, finMs) => ({ tech: tech || "Gwendal", debut: iso(debutMs), fin: iso(finMs), pauses: [], live: true });

(async () => {
  const S = L.creerSupabase({ tableau: [{ id: 1, donnees: [] }, { id: 4, donnees: L.cp(L.EMP) }] });
  // Minuterie : on note les setInterval de 60 s posés par l'app pour pouvoir les déclencher à la main
  const minuteries = [];
  const A = await L.chargerApp({ sb: S.sb, avant: (w) => { const si = w.setInterval.bind(w); w.setInterval = (f, ms, ...r) => { if (ms === 60000) minuteries.push(f); return si(f, ms, ...r); }; } });
  const P = (o) => A.w.JSON.parse(JSON.stringify(o));                        // objets du monde de la page, comme les vraies données
  const EMP3 = [{ nom: "Jason", nomFamille: "Blouin", role: "admin", actif: true }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien", actif: true }];
  L.connecter(A, "Jason", EMP3);
  await A.w.demarrerDonnees();                                               // la connexion réelle l'appelle ; le test la fait à la main (pose la minuterie de changement de jour)
  let nSauv = 0; { const s0 = A.w.sauvegarder; A.w.sauvegarder = function () { nSauv++; return s0.apply(this, arguments); }; }   // compte les écritures
  const mets = (liste) => { A.set("machines", P(liste)); A.$("#recherche").value = ""; A.w.afficher(); };
  const colonne = (s) => A.$(`section.colonne[data-statut="${s}"]`);
  const cartes = (s) => [...colonne(s).querySelectorAll("article.carte")];
  const nomCarte = (c) => (/Machine (\w+)/.exec(c.querySelector(".carte-nom").textContent) || [])[1];
  const ordre = (s) => cartes(s).map(nomCarte).join("");
  const carteDe = (s, lettre) => cartes(s).find(c => nomCarte(c) === lettre);
  const M = (id) => A.get("machines").find(x => x.id === id);
  const txt = (el) => (el ? el.textContent : "").replace(/\s+/g, " ").trim();

  // ── 0. Les symboles et le CSS existent ─────────────────────────────────────────────────────────────────────
  console.log("— symboles, CSS, modale");
  t("arriveeTrier, arriveeBadgeHTML, resteBadgeHTML, arriveePoser, liveFinMinChoisir/Autre/Saisie/Lire/Reset existent", () => ["arriveeTrier", "arriveeBadgeHTML", "resteBadgeHTML", "arriveePoser", "liveFinMinChoisir", "liveFinMinAutre", "liveFinMinSaisie", "liveFinMinLire", "liveFinMinReset"].every(n => typeof A.w[n] === "function"));
  const html = L.fs.readFileSync(FICHIER, "utf8");
  t("le CSS neuf est dans <style id=\"v178-TAB\"> avec des sélecteurs de deux classes (.badge.badge-arrivee et .badge.badge-arrivee.vieux)", () => {
    const m = /<style id="v178-TAB">([\s\S]*?)<\/style>/.exec(html);
    return m && /\.badge\.badge-arrivee\s*\{/.test(m[1]) && /\.badge\.badge-arrivee\.vieux\s*\{/.test(m[1]) && /\.badge\.badge-arrivee\.approx\s*\{/.test(m[1]);
  });

  // ── 1. A7-1 : tri de la colonne Réparation ─────────────────────────────────────────────────────────────────
  console.log("— A7-1 : tri de « Réparation en cours » (bons en direct en tête, puis le plus ancien en haut)");
  const rep = () => [
    bon({ id: "rA", nom: "Machine A", arriveeLe: local(-10, 12, 0) }),
    bon({ id: "rB", nom: "Machine B", arriveeLe: local(-2, 12, 0), chrono: [ouverte("Gwendal")] }),
    bon({ id: "rC", nom: "Machine C", arriveeLe: local(-20, 12, 0) }),
    bon({ id: "rD", nom: "Machine D", creeLe: undefined }),                  // aucune date : en bas
    bon({ id: "rE", nom: "Machine E", arriveeLe: local(-30, 12, 0), chrono: [ouverte("Arno", -90 * MIN)] }),
  ];
  mets(rep());
  t("A (−10 j), B (−2 j en direct), C (−20 j), D (sans date), E (−30 j en direct) → E, B, C, A, D", () => ordre("reparation") === "EBCAD");
  t("compteur de la colonne = 5", () => txt(colonne("reparation").querySelector(".colonne-nb")) === "5");
  { const m = rep(); m[4].chrono = [fermee("Arno", -90 * MIN, -30 * MIN)]; mets(m); }
  t("la session de E fermée (celle de B reste ouverte) : B seul en tête, E rentre dans l'ordre d'ancienneté → B, E, C, A, D", () => ordre("reparation") === "BECAD");
  { const m = rep(); m[4].chrono = []; m[1].chrono = []; mets(m); }
  t("plus aucune session ouverte : ordre d'ancienneté pur → E, C, A, B, D", () => ordre("reparation") === "ECABD");
  mets(rep());
  A.$("#recherche").value = "client"; A.w.afficher();
  t("recherche « client » : les 5 restent, mêmes positions, compteur 5", () => ordre("reparation") === "EBCAD" && txt(colonne("reparation").querySelector(".colonne-nb")) === "5");
  { const m = rep(); m[0].client = "Marie Tremblay"; m[4].client = "Marie Dubé"; mets(m); A.$("#recherche").value = "marie"; A.w.afficher(); }
  t("recherche « marie » : seuls E et A, E (en direct, −30 j) avant A, compteur 2", () => ordre("reparation") === "EA" && txt(colonne("reparation").querySelector(".colonne-nb")) === "2");
  A.$("#recherche").value = ""; A.w.afficher();
  t("deux bons de même ancienneté gardent leur ordre d'origine (tri stable)", () => { const j = local(-5, 12, 0); mets([bon({ id: "q1", nom: "Machine P", arriveeLe: j }), bon({ id: "q2", nom: "Machine Q", arriveeLe: j }), bon({ id: "q3", nom: "Machine R", arriveeLe: j })]); return ordre("reparation") === "PQR"; });
  t("deux bons sans date aucune : ordre d'origine, en bas (après ceux qui en ont une)", () => { mets([bon({ id: "n1", nom: "Machine X", creeLe: undefined }), bon({ id: "n2", nom: "Machine Y", arriveeLe: local(-1, 12, 0) }), bon({ id: "n3", nom: "Machine Z", creeLe: undefined })]); return ordre("reparation") === "YXZ"; });
  t("dates dans deux fuseaux : comparées en temps réel, pas en texte", () => {
    // 2026-10-05T23:00-04:00 = 03:00Z le 6 ; 01:00Z le 6 est plus tôt, même si le texte « 2026-10-05… » vient avant
    mets([bon({ id: "f1", nom: "Machine F", arriveeLe: "2026-10-05T23:00:00-04:00" }), bon({ id: "f2", nom: "Machine G", arriveeLe: "2026-10-06T01:00:00Z" })]);
    return ordre("reparation") === "GF";
  });

  // ── 2. Sans rendez-vous et En attente : le plus ancien en haut ; les autres colonnes inchangées ───────────
  console.log("— A7-1 : Sans rendez-vous / En attente (plus ancien en haut) ; À venir, À facturer, Facturé, Assurance, Commande inchangées");
  const sr = (statut) => [
    bon({ id: statut + "1", statut, nom: "Machine A", arriveeLe: local(-3, 12, 0) }),
    bon({ id: statut + "2", statut, nom: "Machine B", arriveeLe: local(-9, 12, 0), chrono: [ouverte("Gwendal")] }),   // en direct : AUCUN passe-droit hors de Réparation
    bon({ id: statut + "3", statut, nom: "Machine C", creeLe: local(-20, 12, 0) }),                                    // repli sur la création du bon
    bon({ id: statut + "4", statut, nom: "Machine D", creeLe: undefined }),
    bon({ id: statut + "5", statut, nom: "Machine E", arriveeLe: local(-1, 12, 0) }),
  ];
  mets([...sr("sansrdv"), ...sr("attente")]);
  t("Sans rendez-vous : C (créé il y a 20 j), B (−9 j, en direct mais sans passe-droit), A (−3 j), E (−1 j), D (sans date) → C, B, A, E, D", () => ordre("sansrdv") === "CBAED");
  t("En attente de pièce : même règle → C, B, A, E, D", () => ordre("attente") === "CBAED");
  t("avant la v178 ces deux colonnes gardaient l'ordre de création : A, B, C, D, E ne sort plus", () => ordre("sansrdv") !== "ABCDE" && ordre("attente") !== "ABCDE");
  {
    const ouvrables = [L.jourOuvrableIso(0), L.jourOuvrableIso(1), L.jourOuvrableIso(2)];
    const avenir = [
      bon({ id: "v1", statut: "avenir", nom: "Machine A", echeance: ouvrables[2], heure: "09:00", machineArrivee: true, arriveeLe: local(-20, 12, 0) }),   // arrivée la plus ancienne mais rendez-vous le plus tardif
      bon({ id: "v2", statut: "avenir", nom: "Machine B", echeance: ouvrables[0], heure: "14:00", machineArrivee: false }),
      bon({ id: "v3", statut: "avenir", nom: "Machine C", echeance: ouvrables[1], heure: "10:00", machineArrivee: false }),
    ];
    const autres = ["afacturer", "prete", "assurance", "commande"].map((s, k) => [
      bon({ id: s + "1", statut: s, nom: "Machine A", arriveeLe: local(-1, 12, 0) }), bon({ id: s + "2", statut: s, nom: "Machine B", arriveeLe: local(-30, 12, 0) }), bon({ id: s + "3", statut: s, nom: "Machine C", arriveeLe: local(-10, 12, 0) })]);
    mets([...avenir, ...autres.flat()]);
    t("À venir : tri par rendez-vous inchangé (B, C, A) malgré une arrivée plus ancienne pour A", () => ordre("avenir") === "BCA");
    t("À venir : les paquets (« prochains jours ouvrables ») sont toujours là", () => /jours ouvrables/.test(txt(colonne("avenir"))));
    t("À facturer, Facturé, Assurance, Commande : ordre d'origine (A, B, C) et aucun badge d'arrivée", () => ["afacturer", "prete", "assurance", "commande"].every(s => ordre(s) === "ABC" && colonne(s).querySelectorAll(".badge-arrivee").length === 0));
  }

  // ── 3. A7-2 : badges ───────────────────────────────────────────────────────────────────────────────────────
  console.log("— A7-2 : badge « 🚜 Arrivée depuis N jours »");
  const badgeDe = (s, l) => { const c = carteDe(s, l); return c ? c.querySelector(".badge-arrivee") : null; };
  mets([
    bon({ id: "j0", nom: "Machine A", statut: "sansrdv", arriveeLe: local(0, 0, 5) }),
    bon({ id: "j1", nom: "Machine B", statut: "sansrdv", arriveeLe: local(-1, 23, 55) }),
    bon({ id: "j6", nom: "Machine C", statut: "sansrdv", arriveeLe: local(-6, 12, 0) }),
    bon({ id: "j7", nom: "Machine D", statut: "sansrdv", arriveeLe: local(-7, 12, 0) }),
    bon({ id: "j12", nom: "Machine E", statut: "sansrdv", arriveeLe: local(-12, 12, 0) }),
    bon({ id: "cr", nom: "Machine F", statut: "sansrdv", creeLe: local(-12, 12, 0) }),                 // pas de date d'arrivée : repli sur la création
    bon({ id: "cr0", nom: "Machine G", statut: "sansrdv", creeLe: local(0, 8, 0) }),
    bon({ id: "pu", nom: "Machine H", statut: "sansrdv", chrono: [fermee("Gwendal", -9 * JOUR, -9 * JOUR + H)], creeLe: local(-40, 9, 0) }),
    bon({ id: "pu2", nom: "Machine I", statut: "sansrdv" }),
  ]);
  t("arrivée aujourd'hui → « 🚜 Arrivée aujourd'hui »", () => txt(badgeDe("sansrdv", "A")) === "🚜 Arrivée aujourd'hui" && !badgeDe("sansrdv", "A").classList.contains("vieux"));
  t("arrivée hier à 23 h 55 (jour civil) → « 🚜 Arrivée depuis 1 jour » (singulier)", () => txt(badgeDe("sansrdv", "B")) === "🚜 Arrivée depuis 1 jour");
  t("6 jours → « Arrivée depuis 6 jours » sans la classe vieux", () => txt(badgeDe("sansrdv", "C")) === "🚜 Arrivée depuis 6 jours" && !badgeDe("sansrdv", "C").classList.contains("vieux"));
  t("7 jours avec date sûre → classe vieux", () => txt(badgeDe("sansrdv", "D")) === "🚜 Arrivée depuis 7 jours" && badgeDe("sansrdv", "D").classList.contains("vieux"));
  t("12 jours avec date sûre → vieux", () => badgeDe("sansrdv", "E").classList.contains("vieux") && /12 jours/.test(txt(badgeDe("sansrdv", "E"))));
  t("source creeLe → « 🚜 ≈ 12 jours », classe approx, JAMAIS vieux", () => { const b = badgeDe("sansrdv", "F"); return txt(b) === "🚜 ≈ 12 jours" && b.classList.contains("approx") && !b.classList.contains("vieux"); });
  t("source creeLe créé aujourd'hui → « 🚜 ≈ aujourd'hui »", () => txt(badgeDe("sansrdv", "G")) === "🚜 ≈ aujourd'hui");
  t("punch il y a 9 jours mais bon créé il y a 40 jours → la création du bon prime : « 🚜 ≈ 40 jours », approx, jamais vieux", () => { const b = badgeDe("sansrdv", "H"); return txt(b) === "🚜 ≈ 40 jours" && b.classList.contains("approx") && !b.classList.contains("vieux"); });
  t("« 🚜 Machine sur place » est remplacé par le badge quand une date existe (aucune carte n'a les deux)", () => cartes("sansrdv").every(c => !(c.querySelector(".badge-arrivee") && /Machine sur place/.test(c.textContent))));
  t("carte Sans rendez-vous sans aucune date : « 🚜 Machine sur place » comme avant (creeLe retiré)", () => { mets([bon({ id: "z", nom: "Machine A", statut: "sansrdv", creeLe: undefined })]); const c = carteDe("sansrdv", "A"); return /🚜 Machine sur place/.test(c.textContent) && !c.querySelector(".badge-arrivee"); });
  {
    mets([bon({ id: "pa", nom: "Machine A", statut: "attente", arriveeLe: local(-8, 12, 0), pieceComplete: false }), bon({ id: "pb", nom: "Machine B", statut: "reparation", arriveeLe: local(-8, 12, 0), pieceComplete: false }),
      bon({ id: "pc", nom: "Machine C", statut: "reparation", creeLe: local(-30, 12, 0), pieceComplete: false })]);
    t("En attente de pièce et Réparation en cours : le badge est aussi là (8 jours → vieux)", () => badgeDe("attente", "A").classList.contains("vieux") && badgeDe("reparation", "B").classList.contains("vieux"));
    t("Réparation : date approximative (creeLe il y a 30 jours) → « ≈ 30 jours » gris, jamais vieux", () => { const b = badgeDe("reparation", "C"); return /≈ 30 jours/.test(txt(b)) && b.classList.contains("approx") && !b.classList.contains("vieux"); });
    // couleurs réelles : le « vieux » de l'arrivée = le rouge de « À facturer vieux » ; le « ≈ » n'est jamais ce rouge
    const sonde = A.w.document.createElement("span"); sonde.className = "badge badge-afact vieux"; sonde.textContent = "x"; carteDe("reparation", "B").appendChild(sonde);
    const cs = (el) => { const c = A.w.getComputedStyle(el); return c.color + "|" + c.backgroundColor; };
    const rouge = cs(sonde); sonde.remove();
    t("couleur : le badge vieux (≥ 7 jours, date sûre) est rouge, comme « À facturer » vieux (spécificité de deux classes suffisante)", () => cs(badgeDe("reparation", "B")) === rouge);
    t("couleur : le badge « ≈ » (creeLe, 30 jours) n'est JAMAIS rouge, même très ancien", () => cs(badgeDe("reparation", "C")) !== rouge);
    t("couleur : un badge d'arrivée récent (3 jours) n'est pas rouge non plus", () => { mets([bon({ id: "pr", nom: "Machine A", statut: "reparation", arriveeLe: local(-3, 12, 0) })]); return cs(badgeDe("reparation", "A")) !== rouge; });
  }
  {
    const o = ouvrables0();
    function ouvrables0() { return L.jourOuvrableIso(1); }
    mets([bon({ id: "a1", nom: "Machine A", statut: "avenir", echeance: o, machineArrivee: false }),
      bon({ id: "a2", nom: "Machine B", statut: "avenir", echeance: o, machineArrivee: true, arriveeLe: local(-3, 12, 0) }),
      bon({ id: "a3", nom: "Machine C", statut: "avenir", echeance: o, machineArrivee: true })]);        // arrivée mais sans date ni punch : pas de badge (jamais creeLe)
    t("À venir : machine pas arrivée → aucun badge d'arrivée ni « Machine sur place »", () => !carteDe("avenir", "A").querySelector(".badge-arrivee") && !/Machine sur place/.test(carteDe("avenir", "A").textContent));
    t("À venir : machine arrivée avec date → « 🚜 Arrivée depuis 3 jours » (une ligne .badges de plus)", () => txt(badgeDe("avenir", "B")) === "🚜 Arrivée depuis 3 jours" && badgeDe("avenir", "B").parentElement.classList.contains("badges"));
    t("À venir : arrivée sans date ni punch → aucun badge (creeLe est la date de prise du rendez-vous)", () => !carteDe("avenir", "C").querySelector(".badge-arrivee"));
  }

  // ── 4. A7-3 : poser arriveeLe ──────────────────────────────────────────────────────────────────────────────
  console.log("— A7-3 : arriveeLe posé par deplacer et par le formulaire d'édition");
  const proche = (iso_) => iso_ && Math.abs(Date.parse(iso_) - Date.now()) < 10000;
  const editer = (id, statut) => { A.w.ouvrirEdition(id); A.$("#f-statut").value = statut; A.w.valider(); };
  const jourV = L.jourOuvrableIso(1);
  mets([bon({ id: "e1", statut: "avenir", nom: "Machine A", echeance: jourV, machineArrivee: false, creeLe: local(-5, 9, 0) }),
    bon({ id: "e2", statut: "avenir", nom: "Machine B", echeance: jourV, machineArrivee: false, creeLe: local(-5, 9, 0) }),
    bon({ id: "e3", statut: "avenir", nom: "Machine C", echeance: jourV, machineArrivee: true, creeLe: local(-5, 9, 0) }),                           // ancien bon arrivé, sans date
    bon({ id: "e4", statut: "avenir", nom: "Machine D", echeance: jourV, machineArrivee: true, arriveeLe: local(-4, 12, 0), creeLe: local(-5, 9, 0) }),  // arrivée notée il y a 4 jours
    bon({ id: "e5", statut: "avenir", nom: "Machine E", echeance: jourV, machineArrivee: false, creeLe: local(-5, 9, 0) }),
    bon({ id: "e6", statut: "sansrdv", nom: "Machine F", creeLe: local(-5, 9, 0) })]);
  editer("e1", "sansrdv");
  t("formulaire : À venir → Sans rendez-vous (machine pas arrivée) : arriveeLe posé = maintenant", () => M("e1").statut === "sansrdv" && proche(M("e1").arriveeLe));
  t("… la carte affiche « Arrivée aujourd'hui » (pas « ≈ 5 jours »)", () => txt(badgeDe("sansrdv", "A")) === "🚜 Arrivée aujourd'hui");
  editer("e2", "reparation");
  t("formulaire : À venir → Réparation en cours : arriveeLe posé", () => M("e2").statut === "reparation" && proche(M("e2").arriveeLe));
  editer("e5", "attente");
  t("formulaire : À venir → En attente de pièce : arriveeLe posé", () => M("e5").statut === "attente" && proche(M("e5").arriveeLe));
  editer("e3", "sansrdv");
  t("formulaire : un ancien bon DÉJÀ arrivé (machineArrivee) sans arriveeLe : rien n'est posé (pas de remise à zéro)", () => M("e3").statut === "sansrdv" && !M("e3").arriveeLe);
  const av4 = M("e4").arriveeLe;
  editer("e4", "sansrdv");
  t("formulaire : un bon dont l'arrivée est déjà notée garde sa date", () => M("e4").arriveeLe === av4);
  editer("e6", "reparation");
  t("formulaire : un bon déjà dans l'atelier (Sans rendez-vous → Réparation) ne reçoit pas de date", () => M("e6").statut === "reparation" && !M("e6").arriveeLe);
  { const m = P(bon({ id: "e7", statut: "avenir", nom: "Machine G", echeance: jourV, machineArrivee: false })); A.set("machines", [m]); A.w.afficher(); editer("e7", "avenir"); }
  t("formulaire : un bon qui reste « À venir » ne reçoit pas de date d'arrivée", () => !M("e7").arriveeLe);
  mets([bon({ id: "d1", statut: "avenir", nom: "Machine A", echeance: jourV, machineArrivee: false, creeLe: local(-5, 9, 0) }),
    bon({ id: "d2", statut: "avenir", nom: "Machine B", echeance: jourV, machineArrivee: false, creeLe: local(-5, 9, 0) }),
    bon({ id: "d3", statut: "avenir", nom: "Machine C", echeance: jourV, machineArrivee: true, creeLe: local(-5, 9, 0) }),
    bon({ id: "d4", statut: "sansrdv", nom: "Machine D", creeLe: local(-5, 9, 0) })]);
  A.reponseConfirm = true;
  A.w.deplacer("d1", "sansrdv");
  t("deplacer : À venir → Sans rendez-vous (machine pas arrivée) : arriveeLe posé = maintenant", () => M("d1").statut === "sansrdv" && proche(M("d1").arriveeLe));
  A.alertes.length = 0; A.w.deplacer("d2", "attente");
  t("deplacer : À venir (pas arrivée) → En attente de pièce : refusé comme avant (alerte), statut inchangé, aucune date", () => M("d2").statut === "avenir" && !M("d2").arriveeLe && A.alertes.some(a => /Machine arrivée/.test(a)));
  A.w.deplacer("d3", "sansrdv");
  t("deplacer : un ancien bon DÉJÀ arrivé : aucune date posée", () => M("d3").statut === "sansrdv" && !M("d3").arriveeLe);
  A.w.deplacer("d4", "attente");
  t("deplacer : Sans rendez-vous → En attente : aucune date posée", () => M("d4").statut === "attente" && !M("d4").arriveeLe);
  {
    const av = local(-10, 12, 0);
    mets([bon({ id: "pk", statut: "reparation", nom: "Machine A", arriveeLe: av })]);
    const avant = txt(badgeDe("reparation", "A"));
    M("pk").chrono.push({ tech: "Gwendal", debut: iso(-5 * MIN), fin: null, pauses: [], live: true });
    A.w.afficher();
    t("un ancien bon arrivé garde son compteur après un punch : « Arrivée depuis 10 jours » avant ET après (aucune remise à zéro)", () => avant === "🚜 Arrivée depuis 10 jours" && txt(badgeDe("reparation", "A")) === avant && M("pk").arriveeLe === av);
  }
  t("rien n'est écrit par liveConnecterFinal ni basculer (grep : aucune mention d'arriveeLe dans ces fonctions)", () => {
    const f = (nom) => { const i = html.indexOf("function " + nom + "("); return i < 0 ? "" : html.slice(i, html.indexOf("\n}\n", i)); };
    const a = f("liveConnecterFinal"), b = f("basculer");
    return a.length > 50 && b.length > 50 && !/arriveeLe|arriveePoser/.test(a) && !/arriveeLe|arriveePoser/.test(b);
  });

  const unBon = (o) => bon(Object.assign({ id: "m1", nom: "Machine A", statut: "reparation", numeroBT: "BT-801", dureeEstimee: 120, chrono: [ouverte("Gwendal", -45 * MIN)] }, o || {}));
  const pastilles = () => [...A.$$("#live-fin-mins .live-fin-min")];
  const ouvrirFin = (id) => { A.set("liveId", id || "m1"); A.w.liveFinOuvrir(); A.w.liveFinNon(); };
  // ── 5. A7-4 : minuterie de changement de jour ──────────────────────────────────────────────────────────────
  await bloc("— A7-4 : minuterie de 60 s, un seul afficher() au changement de jour", async () => {
  console.log("— A7-4 : minuterie de 60 s, un seul afficher() au changement de jour");
  {
    const tic = minuteries.filter(f => /isoLocal/.test(String(f)));
    t("l'app a posé une minuterie de 60 s sous l'ancre demarrerDonnees (une seule)", () => tic.length === 1);
    const D0 = A.w.Date;
    let appels = 0; const afficher0 = A.w.afficher; A.w.afficher = function () { appels++; return afficher0.apply(this, arguments); };
    let decal = 0;
    A.w.Date = class extends D0 { constructor(...a) { if (a.length === 0) super(D0.now() + decal); else super(...a); } static now() { return D0.now() + decal; } };
    try {
      for (let i = 0; i < 5; i++) tic[0]();
      t("5 déclenchements le même jour : aucun re-rendu (jamais chaque minute : il casserait le glisser-déposer)", () => appels === 0);
      decal = JOUR + 2 * H; tic[0]();
      t("le lendemain : un seul afficher()", () => appels === 1);
      for (let i = 0; i < 4; i++) tic[0]();
      t("encore le même jour : toujours un seul afficher() au total", () => appels === 1);
      decal = 2 * JOUR + 3 * H; tic[0]();
      t("le surlendemain : un deuxième afficher()", () => appels === 2);
    } finally { A.w.Date = D0; A.w.afficher = afficher0; }
    const tableau = A.$("#colonnes").innerHTML;
    t("la minuterie n'efface rien : le tableau est toujours dessiné", () => tableau.length > 100);
  }
  t("sans ancre perdue : //@@v178-TAB demarrerDonnees est toujours là, une seule fois, avec la minuterie dessous", () => { const i = html.indexOf("//@@v178-TAB demarrerDonnees"); return html.split("//@@v178-TAB demarrerDonnees").length === 2 && /isoLocal\(new Date\(\)\)/.test(html.slice(i, i + 600)); });

  });
  // ── 6. A8 : fenêtre « Les travaux sont-ils terminés ? → Non, pas encore » ───────────────────────────────────
  await bloc("— A8-1 / A8-2 : pastilles de temps restant, refus sans minutes, stockage", async () => {
  console.log("— A8-1 / A8-2 : pastilles de temps restant, refus sans minutes, stockage");
  L.connecter(A, "Gwendal", EMP3);
  mets([unBon()]);
  ouvrirFin();
  t("la fenêtre « Non, pas encore » s'ouvre : #live-fin ouvert, étape du reste visible", () => A.$("#live-fin").classList.contains("ouvert") && A.w.getComputedStyle(A.$("#live-fin-reste")).display !== "none");
  t("libellé « Temps approximatif restant, pour tout le bon * »", () => txt(A.$("#live-fin-min-lbl")) === "Temps approximatif restant, pour tout le bon *");
  t("sept boutons : 15 min, 30 min, 1 h, 2 h, 4 h, Journée, Autre…", () => pastilles().map(b => txt(b)).join("|") === "15 min|30 min|1 h|2 h|4 h|Journée|Autre…");
  t("valeurs : 15, 30, 60, 120, 240, 480 (Journée), autre", () => pastilles().map(b => b.getAttribute("data-min")).join(",") === "15,30,60,120,240,480,autre");
  t("cibles de 44 px au moins (hauteur réelle affichée)", () => pastilles().every(b => b.getBoundingClientRect().height >= 43.5));
  t("aucune pastille présélectionnée (aucune classe actif, aria-pressed faux) et liveFinMin = 0", () => pastilles().every(b => !b.classList.contains("actif") && b.getAttribute("aria-pressed") === "false") && A.get("liveFinMin") === 0);
  t("les pastilles sont AVANT le texte (le clavier de l'iPad masquerait des pastilles placées dessous)", () => !!(A.$("#live-fin-mins").compareDocumentPosition(A.$("#live-fin-texte")) & 4) && !!(A.$("#live-fin-min-lbl").compareDocumentPosition(A.$("#live-fin-mins")) & 4));
  t("pas de bouton « Je ne sais pas » ni de choix par défaut", () => !/ne sais pas/i.test(txt(A.$("#live-fin-reste"))));
  t("le champ « Autre… » : type number, inputmode numeric, min 5, step 5, caché au départ", () => { const c = A.$("#live-fin-min-autre"); return c.type === "number" && c.getAttribute("inputmode") === "numeric" && c.min === "5" && c.step === "5" && A.w.getComputedStyle(A.$("#live-fin-autre")).display === "none"; });
  t("pas de focus automatique sur le texte (le clavier cacherait les pastilles)", () => A.w.document.activeElement !== A.$("#live-fin-texte"));

  A.$("#live-fin-texte").value = "Remplacer le joint de culasse";
  A.alertes.length = 0; const n0 = nSauv, snap0 = JSON.stringify(M("m1"));
  A.w.liveFinValider();
  t("sans pastille : alerte « Indique le temps approximatif… »", () => A.alertes.length === 1 && /^Indique le temps approximatif/.test(A.alertes[0]));
  t("… la session reste OUVERTE, rien n'est écrit (ni resteAFaire, ni note, ni sauvegarde)", () => M("m1").chrono[0].fin === null && !M("m1").resteAFaire && !M("m1").resteHisto && JSON.stringify(M("m1")) === snap0 && nSauv === n0);
  t("… et la fenêtre reste ouverte", () => A.$("#live-fin").classList.contains("ouvert"));

  pastilles()[2].click();
  t("toucher « 1 h » : liveFinMin = 60, la pastille est active (aria-pressed), les autres non", () => A.get("liveFinMin") === 60 && pastilles().map(b => b.classList.contains("actif") ? 1 : 0).join("") === "0010000" && pastilles()[2].getAttribute("aria-pressed") === "true");
  pastilles()[5].click();
  t("toucher « Journée » : liveFinMin = 480, une seule pastille active", () => A.get("liveFinMin") === 480 && pastilles().map(b => b.classList.contains("actif") ? 1 : 0).join("") === "0000010");
  pastilles()[6].click();
  t("« Autre… » : le champ s'affiche, rien n'est encore choisi (liveFinMin = 0), la pastille Autre est active", () => A.w.getComputedStyle(A.$("#live-fin-autre")).display !== "none" && A.get("liveFinMin") === 0 && pastilles()[6].classList.contains("actif") && !pastilles()[5].classList.contains("actif"));
  t("« Autre… » vide puis enregistrer : refusé", () => { A.alertes.length = 0; A.w.liveFinValider(); return A.alertes.length === 1 && M("m1").chrono[0].fin === null; });
  const c = A.$("#live-fin-min-autre");
  const saisie = (v) => { A.w.liveFinMinSaisie(v); return A.w.liveFinMinLire(); };
  t("saisie : « 7,6 » → 8 (virgule décimale, minutes entières), « 45 » → 45, « 5 » → 5", () => saisie("7,6") === 8 && saisie("45") === 45 && saisie("5") === 5 && saisie("7.4") === 7);
  t("saisie invalide : « 4 », « 0 », « -30 », « abc », « », « 1e999 », null → refusé (0)", () => ["4", "0", "-30", "abc", "", "1e999", null, undefined].every(v => saisie(v) === 0));
  t("plafond de 9 999 minutes", () => saisie("123456") === 9999);
  c.value = "35"; c.dispatchEvent(new A.w.Event("input", { bubbles: true }));
  t("taper 35 dans le champ (événement input) : liveFinMin = 35", () => A.get("liveFinMin") === 35 && A.w.liveFinMinLire() === 35);
  t("revenir sur une pastille masque le champ « Autre… »", () => { pastilles()[1].click(); return A.w.getComputedStyle(A.$("#live-fin-autre")).display === "none" && A.get("liveFinMin") === 30; });

  // Annuler et Retour n'écrivent rien
  A.$("#live-fin-texte").value = "Un texte"; pastilles()[0].click();
  const n1 = nSauv, snap1 = JSON.stringify(M("m1"));
  A.w.liveFinRetour();
  t("« ‹ Retour » : on revient aux deux gros boutons, rien n'est écrit, la session reste ouverte", () => A.w.getComputedStyle(A.$("#live-fin-choix")).display !== "none" && JSON.stringify(M("m1")) === snap1 && nSauv === n1 && M("m1").chrono[0].fin === null);
  A.w.liveFinAnnuler();
  t("« Annuler — je continue » : la fenêtre se ferme, rien n'est écrit, la session reste ouverte", () => !A.$("#live-fin").classList.contains("ouvert") && JSON.stringify(M("m1")) === snap1 && nSauv === n1 && M("m1").chrono[0].fin === null);
  ouvrirFin();
  t("rouvrir la fenêtre : aucune pastille présélectionnée, liveFinMin remis à 0, champ « Autre… » caché et vide", () => A.get("liveFinMin") === 0 && pastilles().every(b => !b.classList.contains("actif")) && A.$("#live-fin-min-autre").value === "" && A.w.getComputedStyle(A.$("#live-fin-autre")).display === "none");
  t("liveFinMinReset(prefill) pose liveFinMin ; 90 → « Autre… » active avec 90 dans le champ ; 60 → la pastille « 1 h »", () => {
    A.w.liveFinMinReset(90); const a = A.get("liveFinMin") === 90 && pastilles()[6].classList.contains("actif") && A.$("#live-fin-min-autre").value === "90";
    A.w.liveFinMinReset(60); const b = A.get("liveFinMin") === 60 && pastilles()[2].classList.contains("actif") && !pastilles()[6].classList.contains("actif");
    A.w.liveFinMinReset(0); return a && b && A.get("liveFinMin") === 0;
  });

  // Enregistrement
  A.$("#live-fin-texte").value = "Remplacer le joint de culasse";
  pastilles()[1].click(); A.w.liveFinMinAutre(); A.$("#live-fin-min-autre").value = "45"; A.$("#live-fin-min-autre").dispatchEvent(new A.w.Event("input", { bubbles: true }));
  const avantValider = Date.now(); A.alertes.length = 0;
  A.w.liveFinValider();
  const m1 = M("m1"), r = m1.resteAFaire || {};
  t("minutes = 45 : aucune alerte, la fenêtre est fermée", () => A.alertes.length === 0 && !A.$("#live-fin").classList.contains("ouvert"));
  t("la session est fermée (fin posée) AVANT la saisie du temps restant", () => !!m1.chrono[0].fin && Date.parse(m1.chrono[0].fin) <= Date.parse(r.quand));
  t("m.resteAFaire = { texte, tech, quand (ISO), minutes: 45 }", () => r.texte === "Remplacer le joint de culasse" && r.tech === "Gwendal" && r.minutes === 45 && typeof r.minutes === "number" && Math.abs(Date.parse(r.quand) - avantValider) < 15000 && new Date(r.quand).toISOString() === r.quand);
  t("m.resteHisto a 1 entrée { minutes: 45, tech, quand } (la même heure que resteAFaire)", () => Array.isArray(m1.resteHisto) && m1.resteHisto.length === 1 && m1.resteHisto[0].minutes === 45 && m1.resteHisto[0].tech === "Gwendal" && m1.resteHisto[0].quand === r.quand);
  t("travauxTermines reste faux ; pas de champ « travaille » ni « min » stocké", () => !m1.travauxTermines && !("travaille" in r) && !("min" in r) && !("travaille" in m1));
  t("note ajoutée : « ⏳ Reste à faire : … (≈ 45 min restant) » par Gwendal", () => { const n = (m1.notesLive || []).filter(x => /^⏳ Reste à faire/.test(x.texte)); return n.length === 1 && n[0].texte === "⏳ Reste à faire : Remplacer le joint de culasse (≈ 45 min restant)" && n[0].tech === "Gwendal"; });
  t("notesTech reflète la note", () => /≈ 45 min restant/.test(m1.notesTech || ""));
  t("toast : session fermée, reste noté (≈ 45 min)", () => A.toasts().some(x => /Session de Gwendal fermée/.test(x) && /45 min/.test(x)));
  await dodo(80);
  t("sauvegarde : le bon est écrit au serveur (resteAFaire.minutes = 45) et dans la copie locale", () => S.ecrits("tableau", "upsert").some(a => JSON.stringify(a.vals || "").includes('"minutes":45')) && /"minutes":45/.test(A.w.localStorage.getItem("garage-machines-v1") || ""));
  t("resteMinutesDe(m) = 45 tout de suite après (la session fermée n'est pas recomptée)", () => A.w.resteMinutesDe(P(m1)) === 45);
  t("la fenêtre « live » est fermée et liveId remis à null (fermerLive)", () => A.get("liveId") === null);

  // 1 h 30 : durée affichée dans la note
  mets([unBon({ id: "m2", numeroBT: "BT-802" })]); ouvrirFin("m2"); A.$("#live-fin-texte").value = "x"; pastilles()[2].click(); A.w.liveFinValider();
  t("« 1 h » : note « (≈ 1 h restant) »", () => /\(≈ 1 h restant\)$/.test((M("m2").notesLive || []).slice(-1)[0].texte) && M("m2").resteAFaire.minutes === 60);
  mets([unBon({ id: "m3", numeroBT: "BT-803" })]); ouvrirFin("m3"); A.$("#live-fin-texte").value = "x"; A.w.liveFinMinSaisie("90"); A.w.liveFinValider();
  t("90 minutes (saisie libre) : note « (≈ 1 h 30 restant) »", () => /\(≈ 1 h 30 restant\)$/.test((M("m3").notesLive || []).slice(-1)[0].texte) && M("m3").resteAFaire.minutes === 90);
  mets([unBon({ id: "m4", numeroBT: "BT-804" })]); ouvrirFin("m4"); A.$("#live-fin-texte").value = "x"; pastilles()[5].click(); A.w.liveFinValider();
  t("« Journée » : 480 minutes enregistrées (note « ≈ 8 h restant »)", () => M("m4").resteAFaire.minutes === 480 && /\(≈ 8 h restant\)$/.test((M("m4").notesLive || []).slice(-1)[0].texte));
  // texte vide : refusé (comme avant), session ouverte
  mets([unBon({ id: "m5", numeroBT: "BT-805" })]); ouvrirFin("m5"); A.$("#live-fin-texte").value = "   "; pastilles()[0].click(); A.alertes.length = 0; A.w.liveFinValider();
  t("minutes choisies mais texte vide : alerte « Écris ce qu'il reste à faire », session ouverte, rien d'écrit", () => A.alertes.length === 1 && /Écris ce qu'il reste à faire/.test(A.alertes[0]) && M("m5").chrono[0].fin === null && !M("m5").resteAFaire);
  // le garde liveMaSession : pas de session ouverte pour moi -> la fenêtre se ferme sans rien écrire
  mets([unBon({ id: "m6", numeroBT: "BT-806", chrono: [ouverte("Arno", -30 * MIN)] })]); A.w.liveFinAnnuler(); A.set("liveId", "m6"); A.w.liveFinOuvrir();
  t("liveFinOuvrir sans punch à moi : la fenêtre ne s'ouvre pas (garde liveMaSession conservé)", () => !A.$("#live-fin").classList.contains("ouvert"));
  A.w.liveFinValider();
  t("liveFinValider sans session à moi : rien d'écrit (le garde renvoie à liveFinAnnuler)", () => !M("m6").resteAFaire && M("m6").chrono[0].fin === null);

  // Plafond de 30 entrées dans resteHisto
  mets([unBon({ id: "h1", numeroBT: "BT-810", chrono: [] })]);
  for (let i = 0; i < 33; i++) { M("h1").chrono.push(ouverte("Gwendal", -10 * MIN)); ouvrirFin("h1"); A.$("#live-fin-texte").value = "tour " + i; A.w.liveFinMinSaisie(String(5 + i)); A.w.liveFinValider(); }
  t("resteHisto plafonné à 30 entrées : on garde les 30 plus récentes (35 à 5… tour 3 à 32)", () => { const h = M("h1").resteHisto; return h.length === 30 && h[0].minutes === 8 && h[29].minutes === 37 && M("h1").resteAFaire.minutes === 37; });

  });
  await bloc("— « Oui, terminés », « ✕ Quitter » et « 👤 Changer de technicien » ne demandent rien", async () => {
  console.log("— « Oui, terminés », « ✕ Quitter » et « 👤 Changer de technicien » ne demandent rien");
  mets([unBon({ id: "o1", numeroBT: "BT-820", resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-2 * H), minutes: 90 }, resteHisto: [{ minutes: 90, tech: "Gwendal", quand: iso(-2 * H) }] })]);
  A.set("liveId", "o1"); A.w.liveFinOuvrir(); A.w.liveFinOui();
  t("« Oui, terminés » efface resteAFaire (donc l'estimation) et garde resteHisto", () => M("o1").travauxTermines === true && !M("o1").resteAFaire && M("o1").resteHisto.length === 1 && M("o1").resteHisto[0].minutes === 90);
  t("… et ne demande aucun temps restant (aucune alerte)", () => !A.alertes.some(a => /temps approximatif/.test(a)));
  mets([unBon({ id: "q1", numeroBT: "BT-821", resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-2 * H), minutes: 90 } })]);
  A.alertes.length = 0; A.confirmations.length = 0; A.set("liveId", "q1"); A.w.fermerLive();
  t("« ✕ Quitter » (fermerLive) : le punch reste ouvert, aucune fenêtre ni question", () => M("q1").chrono[0].fin === null && !A.$("#live-fin").classList.contains("ouvert") && A.alertes.length === 0 && A.confirmations.length === 0);
  mets([unBon({ id: "q2", numeroBT: "BT-822", resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-2 * H), minutes: 90 } })]);
  A.alertes.length = 0; A.confirmations.length = 0; A.set("liveId", "q2"); A.w.liveChangerTech();
  t("« 👤 Changer de technicien » : seulement la confirmation d'avant ; aucune fenêtre de temps restant, resteAFaire intact", () => !A.$("#live-fin").classList.contains("ouvert") && A.alertes.length === 0 && A.confirmations.length === 1 && /Fermer la session de Gwendal/.test(A.confirmations[0]) && M("q2").resteAFaire.minutes === 90 && !!M("q2").chrono[0].fin);
  A.w.document.getElementById("live-login").classList.remove("ouvert"); A.set("liveId", null);

  });
  // ── 7. A8-3 : ordreResteAuto et odp-duree ───────────────────────────────────────────────────────────────────
  await bloc("— A8-3 : ordreResteAuto (estimation du technicien), formule v164 sans estimation, champ odp-duree", async () => {
  console.log("— A8-3 : ordreResteAuto (estimation du technicien), formule v164 sans estimation, champ odp-duree");
  {
    const bonO = (o) => P(bon(Object.assign({ id: "or1", dureeEstimee: 120, statut: "reparation", chrono: [fermee("Gwendal", -3 * H, -2 * H - 30 * MIN)] }, o)));   // 30 min travaillées
    t("sans estimation : formule v164 → 120 − 30 = 90", () => A.w.ordreResteAuto(bonO()) === 90);
    t("estimation de 60 min saisie à l'instant : ordreResteAuto = 60 (et non 90)", () => A.w.ordreResteAuto(bonO({ resteAFaire: { texte: "x", tech: "G", quand: iso(-MIN), minutes: 60 } })) === 60);
    t("estimation de 62 min : arrondie au pas de 5 min → 65 ; de 5 min : plancher de 15", () => A.w.ordreResteAuto(bonO({ resteAFaire: { texte: "x", tech: "G", quand: iso(0), minutes: 62 } })) === 65 && A.w.ordreResteAuto(bonO({ resteAFaire: { texte: "x", tech: "G", quand: iso(0), minutes: 5 } })) === 15);
    t("estimation de 180 min : 180 (même au-dessus de la durée de la fiche)", () => A.w.ordreResteAuto(bonO({ resteAFaire: { texte: "x", tech: "G", quand: iso(0), minutes: 180 } })) === 180);
    t("estimation épuisée (30 min saisies, 45 min punchées depuis) : retour à la formule v164", () => A.w.ordreResteAuto(bonO({ resteAFaire: { texte: "x", tech: "G", quand: iso(-50 * MIN), minutes: 30 }, chrono: [fermee("Gwendal", -3 * H, -2 * H - 30 * MIN), fermee("Gwendal", -45 * MIN, -MIN)] })) === Math.max(15, Math.ceil((120 - A.w.ordreTravailleMin(bonO({ chrono: [fermee("Gwendal", -3 * H, -2 * H - 30 * MIN), fermee("Gwendal", -45 * MIN, -MIN)] }))) / 5) * 5));
    t("travaux terminés : l'estimation est ignorée (formule v164)", () => A.w.ordreResteAuto(bonO({ travauxTermines: true, resteAFaire: { texte: "x", tech: "G", quand: iso(-MIN), minutes: 60 } })) === 90);
    t("estimation sans date de saisie (quand absent) : ignorée, formule v164", () => A.w.ordreResteAuto(bonO({ resteAFaire: { texte: "x", tech: "G", minutes: 60 } })) === 90);
    t("bon sans resteAFaire ni chrono ni durée : 60 (défaut v164)", () => A.w.ordreResteAuto(P({ id: "z", statut: "reparation" })) === 60);
    t("ordreResteAuto ne lève jamais (machine absente de l'estimation, objet vide)", () => { try { return typeof A.w.ordreResteAuto(P({})) === "number"; } catch (e) { return false; } });
    // odp-duree : le champ d'horaire fixé à la main est prérempli avec l'estimation
    mets([bonO({ id: "pl1", numeroBT: "BT-830", chrono: [], resteAFaire: { texte: "x", tech: "Gwendal", quand: iso(-MIN), minutes: 60 } }), bonO({ id: "pl2", numeroBT: "BT-831", chrono: [] })]);
    L.connecter(A, "Jason", EMP3);
    A.w.ordrePlanifOuvrir("pl1");
    const vPl1 = A.$("#odp-duree").value; A.w.ordrePlanifFermer();
    A.w.ordrePlanifOuvrir("pl2");
    const vPl2 = A.$("#odp-duree").value; A.w.ordrePlanifFermer();
    t("ordrePlanifOuvrir : le champ odp-duree vaut 60 avec l'estimation de 60 min (la fiche dit 120)", () => vPl1 === "60");
    t("… et 120 (durée de la fiche) pour un bon sans estimation, comme avant", () => vPl2 === "120");
  }

  });
  // ── 8. A7-5 : carte « ⏳ Reste ~1 h 30 (noté 16:40) : texte » et repli « (estimé) » ───────────────────────────
  await bloc("— A7-5 / Q24 : ligne « Reste » de la carte (un seul endroit), repli gris « (estimé) » sur les cartes en direct", async () => {
  console.log("— A7-5 / Q24 : ligne « Reste » de la carte (un seul endroit), repli gris « (estimé) » sur les cartes en direct");
  {
    const q = new Date(Date.now() - 5 * MIN); const quand = q.toDateString() === new Date().toDateString() ? q : new Date();
    const resteBon = (o) => bon(Object.assign({ statut: "attente", nom: "Machine A", pieceComplete: false, resteAFaire: { texte: "Attendre le <b>joint</b> & l'essai", tech: "Gwendal", quand: quand.toISOString(), minutes: 90 } }, o || {}));
    mets([resteBon()]);
    const c = carteDe("attente", "A");
    t("fixture {resteAFaire:{minutes, quand}} : « ⏳ Reste ~1 h 30 (noté " + hm(quand) + ") : … »", () => new RegExp("⏳ Reste ~1 h 30 \\(noté " + hm(quand) + "\\) : Attendre le").test(txt(c)));
    t("« Reste ~ » apparaît UNE seule fois sur la carte (un seul badge-reste, pas de doublon)", () => c.querySelectorAll(".badge-reste").length === 1 && (txt(c).match(/Reste ~/g) || []).length === 1 && (txt(c).match(/noté/g) || []).length === 1);
    t("le texte du technicien est échappé (aucun <b> réel dans la carte, « &amp; » rendu)", () => !c.querySelector(".badge-reste b") && /<b>joint<\/b> & l'essai/.test(c.querySelector(".badge-reste").textContent) && /&lt;b&gt;joint/.test(c.querySelector(".badge-reste").innerHTML));
    t("l'heure de saisie est dans le texte visible (pas seulement dans un title)", () => /\(noté \d\d:\d\d\)/.test(c.querySelector(".badge-reste").textContent));
    t("le badge est un .badge.badge-reste (même présentation que l'ancien ⏳)", () => c.querySelector(".badge-reste").classList.contains("badge"));
    mets([resteBon({ resteAFaire: { texte: "Seulement du texte", tech: "Gwendal", quand: quand.toISOString() } })]);
    const c2 = carteDe("attente", "A");
    t("sans minutes : la carte est comme avant « ⏳ Reste : Seulement du texte » (ni « ~ » ni « noté »)", () => txt(c2.querySelector(".badge-reste")) === "⏳ Reste : Seulement du texte" && !/noté|~/.test(txt(c2)));
    mets([resteBon({ resteAFaire: { tech: "Gwendal", quand: quand.toISOString(), minutes: 45 } })]);
    t("fixture sans texte {minutes, quand} : « ⏳ Reste ~45 min (noté …) » sans « : »", () => { const b = carteDe("attente", "A").querySelector(".badge-reste"); return b && /^⏳ Reste ~45 min \(noté \d\d:\d\d\)$/.test(txt(b)); });
    mets([resteBon({ resteAFaire: { texte: "Fini", tech: "Gwendal", quand: iso(-3 * H), minutes: 90 }, chrono: [fermee("Gwendal", -2 * H, -30 * MIN)] })]);
    t("estimation épuisée (90 min saisies, 90 min punchées depuis) : retour à « ⏳ Reste : Fini » sans « ~ »", () => txt(carteDe("attente", "A").querySelector(".badge-reste")) === "⏳ Reste : Fini");
    mets([resteBon({ resteAFaire: { texte: "Fini", tech: "Gwendal", quand: iso(-3 * H), minutes: 90 }, travauxTermines: true, travauxTerminesPar: "Gwendal" })]);
    t("travaux terminés : « ✅ Travaux terminés » seulement, aucun « Reste »", () => /Travaux terminés/.test(txt(carteDe("attente", "A"))) && !/Reste/.test(txt(carteDe("attente", "A"))));
    mets([resteBon({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: local(-1, 14, 30), minutes: 120 } })]);
    t("noté hier : « (noté hier HH:MM) » (une seule fois)", () => /\(noté hier \d\d:\d\d\)/.test(txt(carteDe("attente", "A"))));
    mets([resteBon({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: local(-3, 9, 0), minutes: 4000 } })]);
    t("noté il y a plus de deux jours : « (noté JJ/MM HH:MM) »", () => /\(noté \d\d\/\d\d \d\d:\d\d\)/.test(txt(carteDe("attente", "A"))));

    // Q24 : repli « ⏱ ~X (estimé) » sur les cartes en direct sans estimation
    const live = (o) => bon(Object.assign({ statut: "reparation", nom: "Machine A", dureeEstimee: 120, chrono: [ouverte("Gwendal", -30 * MIN)] }, o || {}));
    mets([live()]);
    const cl = carteDe("reparation", "A"), est = cl.querySelector(".badge-estime");
    t("carte en direct sans estimation : « ⏱ ~1 h 30 (estimé) » (120 − 30 min punchées)", () => est && /^⏱ ~(1 h 30|1 h 25|1 h 35) \(estimé\)$/.test(txt(est)));
    t("… gris : jamais la classe vieux, jamais le rouge de l'alerte", () => {
      const sonde = A.w.document.createElement("span"); sonde.className = "badge badge-afact vieux"; sonde.textContent = "x"; cl.appendChild(sonde);
      const cs = (el) => { const k = A.w.getComputedStyle(el); return k.color + "|" + k.backgroundColor; }; const rouge = cs(sonde); sonde.remove();
      return !est.classList.contains("vieux") && cs(est) !== rouge;
    });
    t("… et le badge « 🔴 Gwendal en direct » est toujours là, sans doublon (un seul « en direct »)", () => (txt(cl).match(/en direct/g) || []).length === 1);
    mets([live({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-10 * MIN), minutes: 120 } })]);
    t("en direct AVEC estimation : « ⏳ Reste ~ » seulement, pas de « (estimé) » en plus", () => { const k = carteDe("reparation", "A"); return !k.querySelector(".badge-estime") && /Reste ~/.test(txt(k)) && !/estimé/.test(txt(k)); });
    mets([live({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-3 * H), minutes: 30 }, chrono: [ouverte("Gwendal", -2 * H)] })]);
    t("en direct, estimation épuisée : pas de « (estimé) » non plus (le technicien avait noté un temps)", () => !carteDe("reparation", "A").querySelector(".badge-estime"));
    mets([live({ resteAFaire: { texte: "Vieille note sans minutes", tech: "Gwendal", quand: iso(-3 * H) } })]);
    t("en direct avec un vieux « reste » sans minutes : « ⏳ Reste : texte » ET « (estimé) » dans la même ligne", () => { const k = carteDe("reparation", "A"); return /⏳ Reste : Vieille note/.test(txt(k)) && !!k.querySelector(".badge-estime") && k.querySelector(".badge-estime").parentElement === k.querySelector(".badge-reste").parentElement; });
    mets([live({ chrono: [fermee("Gwendal", -2 * H, -H)] })]);
    t("Réparation SANS session ouverte : aucun « (estimé) »", () => !carteDe("reparation", "A").querySelector(".badge-estime"));
    mets([live({ statut: "attente", pieceComplete: false }), live({ id: "x2", nom: "Machine B", statut: "sansrdv" }), live({ id: "x3", nom: "Machine C", statut: "avenir", echeance: L.jourOuvrableIso(1), machineArrivee: true })]);
    t("jamais sur les autres colonnes (En attente, Sans rendez-vous, À venir), même avec une session ouverte", () => !A.$$(".badge-estime").length);
    mets([live({ statut: "afacturer" }), live({ id: "x4", nom: "Machine B", statut: "prete" }), live({ id: "x5", nom: "Machine C", statut: "assurance" })]);
    t("… ni À facturer, Facturé, Assurance", () => !A.$$(".badge-estime").length);
    mets([live({ dureeEstimee: undefined, chrono: [ouverte("Gwendal", -10 * MIN)] })]);
    t("sans durée estimée sur la fiche : 60 − 10 → « ⏱ ~50 min (estimé) »", () => /^⏱ ~(50|45|55) min \(estimé\)$/.test(txt(carteDe("reparation", "A").querySelector(".badge-estime"))));
  }
  { // sans la formule de l'ordre de travail (premier rendu) : aucune exception, pas de repli
    const w = A.w, o0 = w.ordreResteAuto;
    try { w.ordreResteAuto = undefined; mets([bon({ statut: "reparation", nom: "Machine A", chrono: [ouverte("Gwendal", -30 * MIN)] })]);
      t("ordreResteAuto absent (premier rendu avant le script d'ordre) : la carte se dessine, sans « (estimé) » ni exception", () => !!carteDe("reparation", "A") && !A.$$(".badge-estime").length && A.erreurs.length === 0); }
    finally { w.ordreResteAuto = o0; }
  }

  });
  // ── 9. A8-4 : page live et écran du technicien ─────────────────────────────────────────────────────────────
  await bloc("— A8-4 : la page « live » et l'écran du technicien montrent le restant", async () => {
  console.log("— A8-4 : la page « live » et l'écran du technicien montrent le restant");
  {
    mets([bon({ id: "lv1", numeroBT: "BT-840", statut: "reparation", nom: "Machine A", chrono: [ouverte("Gwendal", -10 * MIN)], resteAFaire: { texte: "Faire l'essai routier", tech: "Arno", quand: iso(-30 * MIN), minutes: 90 } })]);
    A.set("liveId", "lv1"); let live = ""; A.$("#live-page").classList.add("ouvert");
    try { A.w.liveRendre(); live = txt(A.$("#live-corps")); } catch (e) { live = "EXC " + e.message; }
    t("page live : « ⏳ Reste à faire (Arno) : Faire l'essai routier — ≈ 1 h 30 restant » (restant = 90 − 10 min punchées depuis la saisie)", () => /⏳ Reste à faire \(Arno\) : Faire l'essai routier — ≈ 1 h (20|30) restant/.test(live));
    A.set("liveId", null); A.w.document.getElementById("live-page").classList.remove("ouvert");
    mets([bon({ id: "lv2", numeroBT: "BT-841", statut: "reparation", nom: "Machine A", resteAFaire: { texte: "Sans minutes", tech: "Arno", quand: iso(-30 * MIN) } })]);
    A.set("liveId", "lv2"); let live2 = ""; A.$("#live-page").classList.add("ouvert"); try { A.w.liveRendre(); live2 = txt(A.$("#live-corps")); } catch (e) { live2 = "EXC " + e.message; }
    t("page live sans minutes : comme avant, aucun « restant »", () => /Reste à faire \(Arno\) : Sans minutes/.test(live2) && !/restant/.test(live2.replace(/Temps restant/gi, "")));
    A.set("liveId", null); A.w.document.getElementById("live-page").classList.remove("ouvert");
    // écran du technicien
    L.connecter(A, "Jason", EMP3);
    mets([bon({ id: "te1", numeroBT: "BT-842", statut: "reparation", nom: "Machine A", resteAFaire: { texte: "Essai routier", tech: "Gwendal", quand: iso(-MIN), minutes: 60 } })]);
    let tech = ""; try { A.w.ouvrirEcranTech(); A.w.rendreEcranTech(); tech = txt(A.$("#tech-machines")); } catch (e) { tech = "EXC " + e.message; }
    t("écran du technicien : « ⏳ ~1 h · Essai routier » sur la carte du bon", () => /⏳ ~1 h · Essai routier/.test(tech));
    try { A.w.fermerEcranTech(); } catch (_) {}
    L.connecter(A, "Jason", EMP3);
  }

  });
  // ── 10. Premier afficher() : avant le chargement des blocs suivants ────────────────────────────────────────
  await bloc("— premier afficher() (mode non configuré : avant le script d'ordre et le bloc v178-TAB)", async () => {
  console.log("— premier afficher() (mode non configuré : avant le script d'ordre et le bloc v178-TAB)");
  {
    const donnees = [bon({ id: "p1", statut: "reparation", nom: "Machine A", arriveeLe: local(-10, 12, 0) }), bon({ id: "p2", statut: "reparation", nom: "Machine B", arriveeLe: local(-3, 12, 0), chrono: [ouverte("Gwendal", -20 * MIN)] }),
      bon({ id: "p3", statut: "reparation", nom: "Machine C", arriveeLe: local(-20, 12, 0), resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-30 * MIN), minutes: 120 } }), bon({ id: "p4", statut: "sansrdv", nom: "Machine D", creeLe: local(-6, 12, 0) })];
    const brut = html.replace(/const SUPABASE_URL = "[^"]*";/, 'const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";');   // non configuré : charger() revient sans réseau, afficher() passe tout de suite
    const i0 = brut.indexOf("\nfunction afficher() {"), iFin = brut.indexOf("</script>", i0) + "</script>".length;                                  // fin du script principal
    const sonde = '<script>window.__avant = { ordre: typeof ordreResteAuto, tab: typeof liveFinMinLire, colonnes: document.getElementById("colonnes").innerHTML };</script>';
    const virtuel = brut.slice(0, iFin) + sonde + brut.slice(iFin);
    const lu = L.fs.readFileSync, nom = "./__premier-rendu-v178.html";
    L.fs.readFileSync = function (p, e) { return p === nom ? virtuel : lu.call(L.fs, p, e); };
    let B = null;
    try { B = await L.chargerApp({ sb: L.creerSupabase({ tableau: [{ id: 1, donnees: [] }] }).sb, fichier: nom, avant: (w) => { w.localStorage.setItem("garage-machines-v1", JSON.stringify(donnees)); } }); }
    catch (e) { ok(false, "chargement de l'app en mode non configuré : " + e.message); }
    finally { L.fs.readFileSync = lu; }
    if (B) {
      const av = B.w.__avant || {};
      t("situation du premier rendu : ni ordreResteAuto ni le bloc v178-TAB n'étaient encore chargés", () => av.ordre === "undefined" && av.tab === "undefined");
      const tmp = B.w.document.createElement("div"); tmp.innerHTML = av.colonnes || "";
      const col = (s) => [...tmp.querySelectorAll(`section.colonne[data-statut="${s}"] article.carte`)];
      t("premier rendu : aucune exception, 3 cartes en Réparation, 1 en Sans rendez-vous", () => B.erreurs.length === 0 && col("reparation").length === 3 && col("sansrdv").length === 1);
      t("premier rendu : tri juste (C −20 j en direct non, B en direct d'abord → B, C, A)", () => col("reparation").map(nomCarte).join("") === "BCA");
      t("premier rendu : badges d'arrivée justes (vieux à 20 et 10 jours, « ≈ 6 jours » gris)", () => /Arrivée depuis 20 jours/.test(col("reparation")[1].textContent) && col("reparation")[1].querySelector(".vieux") && /≈ 6 jours/.test(col("sansrdv")[0].textContent) && !col("sansrdv")[0].querySelector(".vieux"));
      t("premier rendu : « ⏳ Reste ~ » déjà là (en direct : sans le repli « estimé », qui dépend du script d'ordre)", () => /⏳ Reste ~(1 h|2 h)/.test(col("reparation")[1].textContent) && /\(noté (hier )?\d\d:\d\d\)/.test(col("reparation")[1].textContent) && !tmp.querySelector(".badge-estime"));
      t("après le chargement complet de la page : aucune erreur JavaScript", () => B.erreurs.length === 0);
      try { B.w.localStorage.removeItem("garage-machines-v1"); } catch (_) {}
    }
  }

  });
  // ── 11. A8-4 : la TV du lift (tv.html) ──────────────────────────────────────────────────────────────────────
  await bloc("— A8-4 : TV du lift (tv.html) : le restant est affiché, calculé en MINUTES (duree() de la TV rend des millisecondes)", async () => {
  console.log("— A8-4 : TV du lift (tv.html) : le restant est affiché, calculé en MINUTES (duree() de la TV rend des millisecondes)");
  {
    const htmlTv = L.fs.readFileSync(FICHIER.replace(/index\.html$/, "tv.html"), "utf8");
    const CDN = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^>]*><\/script>/;
    const bonTv = (o) => Object.assign({ id: "bt-1", numeroBT: "BT-900", nom: "Maverick", client: "Client TV", statut: "reparation", dureeEstimee: 120, chrono: [] }, o);
    const T = L.creerSupabase({ tableau: [{ id: 1, donnees: [bonTv()] }, { id: 4, donnees: L.cp(L.EMP) }], ecrans: [{ id: "lift", nom: "Lift 2 colonnes", mode: "bt", etape: 0, tech: "Gwendal", bt_id: "bt-1" }] });
    const dom = new L.JSDOM(htmlTv.replace(CDN, ""), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/tv.html?ecran=lift",
      beforeParse(w) { w.supabase = { createClient: () => T.sb }; w.__TV_ECRAN = "lift"; } });
    const w = dom.window, erreursTv = []; w.addEventListener("error", (e) => erreursTv.push(e.message));
    const ecranTv = () => ((w.document.querySelector("#ecran") || {}).textContent || "").replace(/\s+/g, " ");
    const afficherTv = async (machine) => { T.db.tableau[0].donnees = [L.cp(machine)]; T.pousser("tableau", T.db.tableau[0], "UPDATE"); await dodo(60); };
    await L.attendre(() => /BT-900/.test(ecranTv()), 6000);
    t("la TV affiche le bon (BT-900) du technicien suivi", () => /BT-900/.test(ecranTv()));
    const reste = (o) => bonTv(Object.assign({ resteAFaire: { texte: "Refaire l'essai <i>routier</i>", tech: "Gwendal", quand: iso(-30 * MIN), minutes: 90 } }, o));
    await afficherTv(reste());
    t("sans punch depuis la saisie : « ⏳ Reste à faire : … · ≈ 1 h 30 restant » (90 minutes, pas des millisecondes)", () => /⏳ Reste à faire : Refaire l'essai <i>routier<\/i> · ≈ 1 h 30 restant/.test(ecranTv()));
    t("le texte du technicien reste échappé sur la TV (aucun <i> réel)", () => !w.document.querySelector("#ecran .reste i") && /&lt;i&gt;/.test(w.document.querySelector("#ecran .reste").innerHTML));
    await afficherTv(reste({ chrono: [ouverte("Gwendal", -30 * MIN)] }));
    t("30 min punchées depuis la saisie : 90 − 30 → « ≈ 1 h restant »", () => /≈ 1 h restant/.test(ecranTv()));
    await afficherTv(reste({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-3 * H), minutes: 120 }, chrono: [fermee("Gwendal", -5 * H, -4 * H), fermee("Gwendal", -2 * H, -2 * H + 10 * MIN)] }));
    t("seul le travail DEPUIS la saisie compte (1 h avant la saisie ignorée, 10 min après) : 120 − 10 → « ≈ 1 h 50 restant »", () => /≈ 1 h 50 restant/.test(ecranTv()));
    await afficherTv(reste({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-2 * H), minutes: 90 }, chrono: [{ tech: "Gwendal", debut: iso(-2 * H), fin: iso(-30 * MIN), pauses: [{ p: iso(-90 * MIN), r: iso(-60 * MIN) }] }] }));
    t("session de 90 min dont 30 de pause : 60 min travaillées sur 90 → « ≈ 30 min restant » (unités en minutes)", () => /≈ 30 min restant/.test(ecranTv()));
    // parité : la copie locale de la TV donne le même restant que resteMinutesDe d'index.html
    const cas = [
      reste({ resteAFaire: { texte: "a", tech: "G", quand: iso(-50 * MIN), minutes: 240 }, chrono: [ouverte("Gwendal", -50 * MIN)] }),
      reste({ resteAFaire: { texte: "a", tech: "G", quand: iso(-5 * H), minutes: 480 }, chrono: [fermee("Gwendal", -9 * H, -4 * H), fermee("Gwendal", -3 * H, -H)] }),
      reste({ resteAFaire: { texte: "a", tech: "G", quand: iso(-40 * MIN), minutes: 45 }, chrono: [{ tech: "Gwendal", debut: iso(-40 * MIN), fin: null, pauses: [{ p: iso(-20 * MIN), r: null }] }] }),
      reste({ resteAFaire: { texte: "a", tech: "G", quand: iso(-10 * MIN), minutes: 15 }, chrono: [fermee("Gwendal", -90 * MIN, -MIN)] }),
    ];
    for (let i = 0; i < cas.length; i++) {
      await afficherTv(cas[i]);
      const r = A.w.resteMinutesDe(P(cas[i])), attendu = r ? "≈ " + A.w.dureeTxtLocale(r) + " restant" : null;
      t("parité TV / carte, cas " + (i + 1) + " : " + (attendu || "aucun restant"), () => attendu ? ecranTv().includes(attendu) : !/restant/.test(ecranTv()));
    }
    await afficherTv(reste({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-3 * H), minutes: 90 }, chrono: [fermee("Gwendal", -3 * H, -H)] }));
    t("estimation épuisée (2 h travaillées pour 90 min) : « Reste à faire » sans temps restant", () => /⏳ Reste à faire : Joint/.test(ecranTv()) && !/restant/.test(ecranTv()));
    await afficherTv(reste({ travauxTermines: true }));
    t("travaux terminés : aucun temps restant", () => !/restant/.test(ecranTv()));
    await afficherTv(reste({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-MIN), minutes: 0 } }));
    t("minutes = 0 : aucun temps restant, le texte reste affiché", () => /Reste à faire : Joint/.test(ecranTv()) && !/restant/.test(ecranTv()));
    await afficherTv(reste({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-MIN) } }));
    t("ancien « reste à faire » sans minutes : comme avant, aucun temps restant", () => /Reste à faire : Joint/.test(ecranTv()) && !/restant/.test(ecranTv()));
    await afficherTv(reste({ resteAFaire: { texte: "Joint", tech: "Gwendal", minutes: 60 } }));
    t("minutes sans date de saisie : inexploitable, pas d'affichage (comme resteMinutesDe)", () => /Reste à faire : Joint/.test(ecranTv()) && !/restant/.test(ecranTv()));
    await afficherTv(reste({ resteAFaire: { texte: "Joint", tech: "Gwendal", quand: iso(-MIN), minutes: "75" } }));
    t("minutes en chaîne (« 75 ») : lues comme un nombre → « ≈ 1 h 15 restant »", () => /≈ 1 h 15 restant/.test(ecranTv()));
    await afficherTv(reste());
    t("la TV et la carte du tableau donnent le même restant (copie locale cohérente avec resteMinutesDe)", () => {
      const m = P(reste({ chrono: [fermee("Gwendal", -20 * MIN, -10 * MIN)] })); const attendu = A.w.dureeTxtLocale(A.w.resteMinutesDe(m));
      return attendu === "1 h 20" && true;
    });
    await afficherTv(reste({ chrono: [fermee("Gwendal", -20 * MIN, -10 * MIN)] }));
    t("… (TV : 90 − 10 min de travail = « ≈ 1 h 20 restant »)", () => /≈ 1 h 20 restant/.test(ecranTv()));
    t("TV : aucune erreur JavaScript (" + erreursTv.length + ")", () => erreursTv.length === 0);
  }

  });
  L.fin(A);
})().catch((e) => { ok(false, "exception non prévue : " + (e && e.stack || e)); process.exit(); });
