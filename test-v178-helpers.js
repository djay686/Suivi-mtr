// v178-S0b — socle : helpers de date d'arrivée et de temps restant (arriveeDe, arriveeJours, resteMinutesDe, dureeTxtLocale).
//   Dans Chromium :  node outils-v178/run-in-chromium.js test-v178-helpers.js ./index.html   (MTR_FAKE_NOW facultatif)
//   Le test fonctionne à n'importe quelle heure : toutes les dates sont construites relativement à « maintenant ».
const L = require("./outils-v178/test-lib-v178.js");
const { ok, dodo } = L;
const FICHIER = process.argv[2] || "./index.html";
const MIN = 60000, H = 3600000, JOUR = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();                 // ms < 0 : dans le passé
// Jour local (décalage en jours, heure, minute) → ISO : « hier à 23 h 50 », « aujourd'hui à 00 h 10 »…
const local = (dj, h, mi) => { const x = new Date(); x.setDate(x.getDate() + dj); x.setHours(h, mi, 0, 0); return x.toISOString(); };
// Une assertion qui ne plante pas le test : une exception est une assertion ratée (sur la base, les fonctions n'existent pas)
const t = (msg, f) => { let r; try { r = f(); } catch (e) { ok(false, msg + " — exception : " + (e && e.message)); return; } ok(!!r, msg); };

(async () => {
  const S = L.creerSupabase({ tableau: [{ id: 1, donnees: [] }, { id: 4, donnees: L.cp(L.EMP) }] });
  const A = await L.chargerApp({ sb: S.sb });
  L.connecter(A, "Jason");
  const P = (o) => A.w.JSON.parse(JSON.stringify(o));                        // objets du monde de la page, comme les vraies données
  const arrDe = (m) => A.w.arriveeDe(P(m));
  const arrJ = (m) => A.w.arriveeJours(P(m));
  const reste = (m) => A.w.resteMinutesDe(P(m));
  const src = (m) => { const r = arrDe(m); return r ? r.source : null; };
  const bon = (o) => Object.assign({ id: "b1", nom: "2021 Maverick", client: "Marc", statut: "reparation", creeLe: iso(-20 * JOUR) }, o);
  const punch = (debutMs, finMs, pauses, tech) => ({ tech: tech || "Gwendal", debut: iso(debutMs), fin: finMs === null ? null : iso(finMs), pauses: pauses || [], live: true });
  const pause = (pMs, rMs) => ({ p: iso(pMs), r: rMs === null ? null : iso(rMs) });
  // bon avec une estimation « minutes » saisie à `quandMs` (relatif à maintenant)
  const avecReste = (minutes, quandMs, chrono, o) => bon(Object.assign({ resteAFaire: { texte: "Finir le montage", tech: "Gwendal", quand: iso(quandMs), minutes }, chrono: chrono || [] }, o || {}));

  // ── 0. Les symboles existent ; constantes ────────────────────────────────────────────────────────────────────
  console.log("— symboles et constantes");
  t("arriveeDe, arriveeJours, resteMinutesDe, dureeTxtLocale sont des fonctions", () => ["arriveeDe", "arriveeJours", "resteMinutesDe", "dureeTxtLocale"].every(n => typeof A.w[n] === "function"));
  t("ARRIVEE_STATUTS = avenir, sansrdv, attente, reparation (dans cet ordre)", () => JSON.stringify(A.get("ARRIVEE_STATUTS")) === JSON.stringify(["avenir", "sansrdv", "attente", "reparation"]));
  t("ARRIVEE_JOURS_VIEUX vaut 7", () => A.get("ARRIVEE_JOURS_VIEUX") === 7);

  // ── 1. arriveeDe : règles de statut et de source ─────────────────────────────────────────────────────────────
  console.log("— arriveeDe");
  t("statut hors liste (commande, afacturer, prete, archive, absent) → null même avec arriveeLe", () => ["commande", "afacturer", "prete", "archive", "", undefined].every(s => arrDe(bon({ statut: s, arriveeLe: iso(-JOUR) })) === null));
  t("machine absente / pas un objet → null, sans exception", () => [null, undefined, 42, "texte", []].every(m => A.w.arriveeDe(m) === null));
  t("avenir SANS machineArrivee → null (même avec creeLe)", () => arrDe(bon({ statut: "avenir", creeLe: iso(-5 * JOUR) })) === null);
  t("avenir sans machineArrivee mais avec arriveeLe et un punch → null (la machine n'est pas là)", () => arrDe(bon({ statut: "avenir", arriveeLe: iso(-2 * JOUR), chrono: [punch(-3 * H, -2 * H)] })) === null);
  t("avenir AVEC machineArrivee, sans arriveeLe ni punch → null : jamais creeLe (date de prise du rendez-vous)", () => arrDe(bon({ statut: "avenir", machineArrivee: true, creeLe: iso(-10 * JOUR) })) === null);
  t("avenir avec machineArrivee et arriveeLe → source arriveeLe, date = arriveeLe", () => { const a = iso(-2 * JOUR); const r = arrDe(bon({ statut: "avenir", machineArrivee: true, arriveeLe: a })); return r && r.source === "arriveeLe" && r.date === a; });
  t("avenir avec machineArrivee et un punch, sans arriveeLe → source punch", () => { const d = iso(-3 * H); const r = arrDe(bon({ statut: "avenir", machineArrivee: true, chrono: [punch(-3 * H, -2 * H)] })); return r && r.source === "punch" && Math.abs(Date.parse(r.date) - Date.parse(d)) < 2000; });
  t("sansrdv sans arriveeLe ni punch → source creeLe, date = creeLe", () => { const c = iso(-3 * JOUR); const r = arrDe(bon({ statut: "sansrdv", creeLe: c })); return r && r.source === "creeLe" && r.date === c; });
  t("sansrdv avec arriveeLe (et creeLe, et un punch) → arriveeLe l'emporte", () => src(bon({ statut: "sansrdv", arriveeLe: iso(-JOUR), chrono: [punch(-2 * H, -H)] })) === "arriveeLe");
  t("attente : arriveeLe", () => src(bon({ statut: "attente", arriveeLe: iso(-JOUR) })) === "arriveeLe");
  t("attente : sans arriveeLe, un punch → punch", () => src(bon({ statut: "attente", chrono: [punch(-2 * H, -H)] })) === "punch");
  t("attente : ni l'un ni l'autre → creeLe", () => src(bon({ statut: "attente" })) === "creeLe");
  t("reparation avec punch et sans arriveeLe → source punch (le punch passe avant creeLe)", () => src(bon({ statut: "reparation", chrono: [punch(-2 * H, -H)] })) === "punch");
  t("reparation avec arriveeLe → arriveeLe", () => src(bon({ statut: "reparation", arriveeLe: iso(-4 * JOUR) })) === "arriveeLe");
  t("reparation sans arriveeLe, sans punch → creeLe", () => src(bon({ statut: "reparation" })) === "creeLe");
  t("reparation sans aucune source (ni creeLe) → null", () => arrDe({ id: "x", statut: "reparation" }) === null);
  t("le premier punch est le plus ancien, quel que soit l'ordre du tableau", () => {
    const vieux = iso(-5 * JOUR);
    const r = arrDe(bon({ statut: "reparation", chrono: [punch(-2 * JOUR, -2 * JOUR + H), { tech: "A", debut: vieux, fin: iso(-5 * JOUR + H), pauses: [] }, punch(-3 * JOUR, -3 * JOUR + H)] }));
    return r && r.source === "punch" && r.date === vieux;
  });
  t("le premier punch se compare en temps réel, pas en texte (deux fuseaux horaires)", () => {
    // 23:00-04:00 le 5 = 03:00Z le 6 ; 01:00Z le 6 est plus tôt, même si le texte « 2026-10-05… » vient avant
    const r = arrDe({ id: "z", statut: "reparation", chrono: [{ tech: "A", debut: "2026-10-05T23:00:00-04:00", fin: "2026-10-06T00:00:00-04:00" }, { tech: "B", debut: "2026-10-06T01:00:00Z", fin: "2026-10-06T02:00:00Z" }] });
    return r && r.source === "punch" && r.date === "2026-10-06T01:00:00Z";
  });

  // ── 2. arriveeDe : données invalides ou incomplètes ─────────────────────────────────────────────────────────
  console.log("— arriveeDe : dates invalides, chrono absent, bon type serveur");
  t("arriveeLe illisible (« pas une date », vide, nombre, objet) : ignorée, on retombe sur creeLe", () => ["pas une date", "", 12345, {}, "2026-13-45"].every(v => { const r = arrDe(bon({ statut: "sansrdv", arriveeLe: v })); return r && r.source === "creeLe"; }));
  t("toutes les dates illisibles → null, sans exception", () => arrDe({ id: "x", statut: "sansrdv", arriveeLe: "bidon", creeLe: "bidon", chrono: [{ debut: "bidon" }] }) === null && arrDe({ id: "x", statut: "reparation", arriveeLe: "bidon", creeLe: "bidon", chrono: [{ debut: "bidon" }] }) === null);
  t("un punch à date illisible est ignoré, le suivant sert", () => { const bon1 = arrDe(bon({ statut: "reparation", chrono: [{ tech: "A", debut: "bidon" }, punch(-3 * H, -2 * H)] })); return bon1 && bon1.source === "punch"; });
  t("chrono contenant null / texte / nombre / objet vide → ignorés (repli sur creeLe)", () => src(bon({ statut: "reparation", chrono: [null, undefined, "x", 5, {}] })) === "creeLe");
  t("chrono absent, null, objet ou texte → pas d'exception, repli sur creeLe", () => [undefined, null, {}, "abc", 7].every(c => src(bon({ statut: "reparation", chrono: c })) === "creeLe"));
  t("avenir avec machineArrivee et chrono absent → null, sans exception", () => arrDe(bon({ statut: "avenir", machineArrivee: true, chrono: undefined })) === null);
  // Bon créé par le serveur (Edge) : id, creeLe, nom, statut avenir, echeance, heure, dureeEstimee — rien d'autre
  const serveur = () => ({ id: "srv-1", creeLe: local(-6, 14, 0), nom: "Yamaha Grizzly", statut: "avenir", echeance: "2026-10-12", heure: "09:00", dureeEstimee: 120 });
  t("bon du serveur : arriveeDe, arriveeJours, resteMinutesDe → null, sans exception", () => arrDe(serveur()) === null && arrJ(serveur()) === null && reste(serveur()) === null);
  t("même bon du serveur passé en « sans rendez-vous » (sans chrono ni machineArrivee) : creeLe, 6 jours, restant null", () => { const m = Object.assign(serveur(), { statut: "sansrdv" }); const r = arrDe(m); return r && r.source === "creeLe" && arrJ(m) === 6 && reste(m) === null; });

  // ── 3. arriveeJours : jours CIVILS ───────────────────────────────────────────────────────────────────────────
  console.log("— arriveeJours");
  t("arrivée hier à 23 h 50 → 1 jour (pas 0 : on compte des jours civils, pas des tranches de 24 h)", () => arrJ(bon({ arriveeLe: local(-1, 23, 50) })) === 1);
  t("arrivée aujourd'hui à 00 h 10 → 0", () => arrJ(bon({ arriveeLe: local(0, 0, 10) })) === 0);
  t("arrivée hier à 00 h 05 → 1 ; avant-hier à 23 h 59 → 2 ; il y a 10 jours à 08 h → 10", () => arrJ(bon({ arriveeLe: local(-1, 0, 5) })) === 1 && arrJ(bon({ arriveeLe: local(-2, 23, 59) })) === 2 && arrJ(bon({ arriveeLe: local(-10, 8, 0) })) === 10);
  t("arrivée il y a 4 jours à 23 h 59 → 4 (jamais 3 : l'heure du jour ne compte pas)", () => arrJ(bon({ arriveeLe: local(-4, 23, 59) })) === 4 && arrJ(bon({ arriveeLe: local(-4, 0, 1) })) === 4);
  t("arrivée dans le futur (horloge décalée) → plancher à 0", () => arrJ(bon({ arriveeLe: local(2, 9, 0) })) === 0);
  t("la date de repli compte aussi : sansrdv créé il y a 3 jours → 3 ; punch d'il y a 2 jours → 2", () => arrJ(bon({ statut: "sansrdv", creeLe: local(-3, 14, 0) })) === 3 && arrJ(bon({ statut: "reparation", chrono: [{ tech: "A", debut: local(-2, 9, 0), fin: local(-2, 10, 0), pauses: [] }] })) === 2);
  t("pas d'arrivée connue → null (avenir sans machineArrivee, statut archive, rien, date illisible, machine absente)", () => arrJ(serveur()) === null && arrJ(bon({ statut: "archive", arriveeLe: iso(-JOUR) })) === null && arrJ({ id: "x", statut: "reparation" }) === null && arrJ({ id: "x", statut: "reparation", arriveeLe: "bidon" }) === null && A.w.arriveeJours(null) === null);
  t("un nombre entier, jamais décimal ni négatif", () => { const j = arrJ(bon({ arriveeLe: iso(-36 * H) })); return Number.isInteger(j) && j >= 0; });
  t("le jour civil ne dépend pas de joursDepuis (23 h 50 hier : joursDepuis dit 0, arriveeJours dit 1) quand il est passé 00 h 10 et avant 23 h 50", () => {
    const maint = new Date(); const mins = maint.getHours() * 60 + maint.getMinutes();
    if (mins < 15 || mins > 23 * 60 + 40) return true;     // aux heures limites la comparaison perd son sens : on ne la fait pas
    const a = local(-1, 23, 50);
    return A.w.joursDepuis(a) === 0 && arrJ(bon({ arriveeLe: a })) === 1;
  });

  // ── 4. resteMinutesDe ────────────────────────────────────────────────────────────────────────────────────────
  console.log("— resteMinutesDe");
  t("90 minutes saisies à l'instant T → 90 à T", () => reste(avecReste(90, 0)) === 90);
  t("90 minutes saisies il y a 30 min, session de 30 min encore ouverte → 60", () => reste(avecReste(90, -30 * MIN, [punch(-30 * MIN, null)])) === 60);
  t("même chose avec une session fermée (35 → 5 min avant) → 60", () => reste(avecReste(90, -40 * MIN, [punch(-35 * MIN, -5 * MIN)])) === 60);
  t("après 90 minutes punchées → null (estimation épuisée)", () => reste(avecReste(90, -100 * MIN, [punch(-95 * MIN, -5 * MIN)])) === null);
  t("juste avant l'épuisement (89 min punchées) → 1 ; après 120 min punchées → null", () => reste(avecReste(90, -100 * MIN, [punch(-95 * MIN, -6 * MIN)])) === 1 && reste(avecReste(90, -130 * MIN, [punch(-125 * MIN, -5 * MIN)])) === null);
  t("travauxTermines → null, même avec une estimation encore positive", () => reste(avecReste(90, -30 * MIN, [punch(-30 * MIN, -20 * MIN)], { travauxTermines: true })) === null && reste(avecReste(90, 0, [], { travauxTermines: true })) === null);
  t("travauxTermines à false n'empêche rien", () => reste(avecReste(90, 0, [], { travauxTermines: false })) === 90);
  t("sessions terminées AVANT la saisie : ne comptent pas (180 → 120 min avant, saisie il y a 60 min → 90)", () => reste(avecReste(90, -60 * MIN, [punch(-180 * MIN, -120 * MIN)])) === 90);
  t("session à cheval sur la saisie : seule la partie après « quand » compte (60 → 10 min avant, saisie il y a 40 min → 60)", () => reste(avecReste(90, -40 * MIN, [punch(-60 * MIN, -10 * MIN)])) === 60);
  t("session déjà ouverte avant la saisie et toujours ouverte : seule la partie après « quand » compte", () => reste(avecReste(90, -20 * MIN, [punch(-5 * H, null)])) === 70);
  t("deux techniciens en même temps : les durées s'additionnent (2 × 30 min → 30)", () => reste(avecReste(90, -30 * MIN, [punch(-30 * MIN, null, [], "Gwendal"), punch(-30 * MIN, null, [], "Arno")])) === 30);
  t("pause fermée retranchée : session de 50 min dont 10 min de pause → 50 restantes", () => reste(avecReste(90, -50 * MIN, [punch(-50 * MIN, null, [pause(-40 * MIN, -30 * MIN)])])) === 50);
  t("pause encore ouverte retranchée jusqu'à maintenant : 50 min de session, pause depuis 20 min → 60", () => reste(avecReste(90, -50 * MIN, [punch(-50 * MIN, null, [pause(-20 * MIN, null)])])) === 60);
  t("pause à cheval sur la saisie : seule sa partie après « quand » est retranchée (→ 70)", () => reste(avecReste(90, -30 * MIN, [punch(-60 * MIN, null, [pause(-40 * MIN, -20 * MIN)])])) === 70);
  t("pause entièrement avant la saisie : sans effet (→ 60)", () => reste(avecReste(90, -30 * MIN, [punch(-60 * MIN, null, [pause(-50 * MIN, -40 * MIN)])])) === 60);
  t("deux pauses dans une session (5 + 15 min sur 40 min) → 90 − 20 = 70", () => reste(avecReste(90, -40 * MIN, [punch(-40 * MIN, null, [pause(-35 * MIN, -30 * MIN), pause(-20 * MIN, -5 * MIN)])])) === 70);
  t("résultat entier même quand le travail ne tombe pas sur une minute (29,6 min punchées → 60)", () => { const r = reste(avecReste(90, -40 * MIN, [{ tech: "A", debut: iso(-35 * MIN), fin: iso(-35 * MIN + 29.6 * MIN), pauses: [] }])); return Number.isInteger(r) && r === 60; });
  t("minutes en texte (« 90 ») acceptées", () => reste(avecReste("90", 0)) === 90);

  console.log("— resteMinutesDe : pas d'estimation, données invalides");
  t("pas de resteAFaire → null", () => reste(bon({ dureeEstimee: 240, chrono: [punch(-2 * H, -H)] })) === null);
  t("resteAFaire avec texte seulement (ancien bon, sans minutes) → null : AUCUN repli sur dureeEstimee − punché", () => reste(bon({ dureeEstimee: 240, chrono: [punch(-2 * H, -H)], resteAFaire: { texte: "Finir", tech: "G", quand: iso(-3 * H) } })) === null);
  t("minutes à 0, négatives, NaN, texte, null, Infinity → null", () => [0, -30, NaN, "abc", null, undefined, Infinity, "", true, {}, []].every(v => reste(avecReste(v, -10 * MIN)) === null));
  t("quand absent ou illisible → null (estimation non datée : inexploitable)", () => reste(bon({ resteAFaire: { texte: "x", minutes: 90 } })) === null && reste(bon({ resteAFaire: { texte: "x", minutes: 90, quand: "bidon" } })) === null);
  t("resteAFaire null, texte ou tableau → null", () => [null, "Finir", [], 5, true].every(v => reste(bon({ resteAFaire: v })) === null));
  t("quand dans le futur (horloge décalée) : rien n'est compté → estimation entière", () => reste(avecReste(90, 2 * H, [punch(-30 * MIN, null)])) === 90);
  t("chrono absent / null / objet / texte : restant = estimation entière, sans exception", () => [undefined, null, {}, "abc"].every(c => reste(avecReste(90, -30 * MIN, c)) === 90));
  t("sessions illisibles ignorées (debut bidon, fin bidon, null, pauses non tableau) ; les bonnes comptent", () => reste(avecReste(90, -60 * MIN, [null, { tech: "A", debut: "bidon", fin: null }, { tech: "B", debut: iso(-50 * MIN), fin: "bidon" }, { tech: "C", debut: iso(-30 * MIN), fin: null, pauses: "x" }, { tech: "D", debut: iso(-20 * MIN), fin: iso(-10 * MIN), pauses: [null, { p: "bidon" }] }])) === 50);
  t("session sans durée (fin avant le début) → 0, jamais négative", () => reste(avecReste(90, -60 * MIN, [{ tech: "A", debut: iso(-10 * MIN), fin: iso(-30 * MIN), pauses: [] }])) === 90);

  console.log("— resteMinutesDe : session tronquée par nettoyerPunchsOublies (fin = début + 8 h)");
  t("session tronquée à 8 h : 600 min saisies il y a 30 h, 480 min punchées → 120 (et jamais plus que le total)", () => {
    const m = avecReste(600, -30 * H, [{ tech: "A", debut: iso(-20 * H), fin: iso(-12 * H), pauses: [], fermeAuto: true }]);
    return reste(m) === 120;
  });
  t("session tronquée à 8 h et estimation de 90 min → null", () => reste(avecReste(90, -30 * H, [{ tech: "A", debut: iso(-20 * H), fin: iso(-12 * H), pauses: [], fermeAuto: true }])) === null);
  t("vrai nettoyerPunchsOublies : punch oublié depuis 20 h → fermé à 8 h ; le restant d'une estimation de 600 min vaut 120", () => {
    const m = P(avecReste(600, -22 * H, [punch(-20 * H, null)]));
    A.set("machines", [m]);
    A.w.nettoyerPunchsOublies();
    const apres = A.get("machines")[0];
    const s = apres.chrono[0];
    return s.fermeAuto === true && Math.abs(Date.parse(s.fin) - Date.parse(s.debut) - 8 * H) < 1000 && A.w.resteMinutesDe(apres) === 120;
  });
  t("pause ouverte dans un punch oublié : nettoyerPunchsOublies la ferme à 0 min (r = p) ; le restant se calcule sur les 8 h gardées", () => {
    const m = P(avecReste(600, -22 * H, [punch(-20 * H, null, [pause(-19 * H, null)])]));
    A.set("machines", [m]);
    A.w.nettoyerPunchsOublies();
    const apres = A.get("machines")[0];
    return apres.chrono[0].pauses[0].r === apres.chrono[0].pauses[0].p && A.w.resteMinutesDe(apres) === 120;   // pause ramenée à 0 min : 8 h travaillées
  });
  A.set("machines", []);

  console.log("— resteMinutesDe : jamais au-delà du total, et conforme à un calcul indépendant (300 cas pseudo-aléatoires)");
  {
    // Calcul de référence indépendant : minute par minute. Tous les instants sont des minutes entières AVANT « maintenant »
    // (sessions et pauses fermées), donc le résultat est exact.
    let graine = 12345; const alea = (n) => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
    const base = Date.now() - 2 * MIN;                                    // les instants sont fixés par rapport à une base figée
    const au = (k) => new Date(base - k * MIN).toISOString();             // k minutes avant la base
    let nBorne = 0, nExact = 0, nNull = 0, premier = null; const n = 300;
    for (let i = 0; i < n; i++) {
      const total = 1 + alea(600), quand = 1 + alea(1500);
      const chrono = [], tranches = [];
      for (let j = alea(4); j >= 0; j--) {
        const dk = 1 + alea(1500), duree = 1 + alea(700), trunc = alea(4) === 0;               // une session sur 4 « fermée automatiquement » à 8 h
        const lr = Math.min(duree, trunc ? 480 : duree, dk), fk = dk - lr;                      // minutes réellement travaillées ; fin = fk minutes avant la base
        const pauses = [], trous = [];
        if (alea(2) && lr > 6) { const a = alea(lr - 3), l = 1 + alea(Math.min(30, lr - a - 1)); pauses.push({ p: au(dk - a), r: au(dk - a - l) }); trous.push([dk - a - l, dk - a]); }
        chrono.push({ tech: "T" + j, debut: au(dk), fin: au(fk), pauses, fermeAuto: trunc || undefined });
        tranches.push({ dk, fk, trous });
      }
      // Oracle : minute k = (k−1, k] minutes avant la base ; comptée si dans une session, après la saisie, hors pause
      let fait = 0;
      for (let k = 1; k <= quand; k++) for (const s of tranches) if (k <= s.dk && k > s.fk && !s.trous.some(([a, b]) => k > a && k <= b)) fait++;
      const attendu = total - fait > 0 ? total - fait : null;
      let r; try { r = reste(bon({ resteAFaire: { texte: "x", tech: "T", quand: au(quand), minutes: total }, chrono })); } catch (e) { r = "exception"; }
      if (r === null || (Number.isInteger(r) && r > 0 && r <= total)) nBorne++;
      if (r === attendu) nExact++; else if (!premier) premier = { total, quand, fait, attendu, r, chrono };
      if (r === null) nNull++;
    }
    if (premier) console.log("   (premier écart : " + JSON.stringify(premier).slice(0, 300) + ")");
    t("300 cas : le restant est toujours null ou un entier entre 1 et le total", () => nBorne === n);
    t("300 cas : le résultat est exactement celui du calcul minute par minute (sessions, pauses, troncature)", () => nExact === n);
    t("300 cas : le jeu de test couvre à la fois des estimations épuisées et des restants positifs", () => nNull > 20 && nNull < n - 20);
  }

  // ── 5. Aucune écriture ───────────────────────────────────────────────────────────────────────────────────────
  console.log("— aucune écriture de données");
  t("les quatre fonctions ne modifient ni le bon, ni son chrono, ni son estimation, et n'écrivent rien", () => {
    const m = P(avecReste(90, -50 * MIN, [punch(-50 * MIN, null, [pause(-20 * MIN, null)]), punch(-40 * MIN, -30 * MIN)], { arriveeLe: iso(-3 * JOUR), machineArrivee: true }));
    A.set("machines", [m]);
    const avant = JSON.stringify(A.get("machines")), nAppels = S.appels.length, ls = JSON.stringify(Object.assign({}, A.w.localStorage));
    A.w.arriveeDe(m); A.w.arriveeJours(m); A.w.resteMinutesDe(m); A.w.dureeTxtLocale(90);
    const ok1 = JSON.stringify(A.get("machines")) === avant && JSON.stringify(m) === avant.slice(1, -1) && S.appels.length === nAppels && JSON.stringify(Object.assign({}, A.w.localStorage)) === ls;
    A.set("machines", []);
    return ok1;
  });

  // ── 6. dureeTxtLocale ────────────────────────────────────────────────────────────────────────────────────────
  console.log("— dureeTxtLocale");
  t("45 → « 45 min », 59 → « 59 min », 0 → « 0 min »", () => A.w.dureeTxtLocale(45) === "45 min" && A.w.dureeTxtLocale(59) === "59 min" && A.w.dureeTxtLocale(0) === "0 min");
  t("60 → « 1 h », 120 → « 2 h »", () => A.w.dureeTxtLocale(60) === "1 h" && A.w.dureeTxtLocale(120) === "2 h");
  t("90 → « 1 h 30 », 125 → « 2 h 05 », 75 → « 1 h 15 »", () => A.w.dureeTxtLocale(90) === "1 h 30" && A.w.dureeTxtLocale(125) === "2 h 05" && A.w.dureeTxtLocale(75) === "1 h 15");
  t("même format que le texte de durée de l'ordre de travail (comparaison sur 0 à 600 min)", () => { for (let k = 0; k <= 600; k++) if (A.w.dureeTxtLocale(k) !== A.w.ordreDureeTxt(k)) return false; return true; });
  t("entrée décimale arrondie ; illisible → null", () => A.w.dureeTxtLocale(89.6) === "1 h 30" && [NaN, undefined, null, "abc", -5, "", Infinity].every(v => A.w.dureeTxtLocale(v) === null));

  // ── 7. Aucune dépendance au script d'ordre de travail ────────────────────────────────────────────────────────
  console.log("— indépendance du script d'ordre de travail / premier rendu");
  const html = L.fs.readFileSync(FICHIER, "utf8");
  const i0 = html.indexOf("//@@v178-S0b helpers"), i1 = html.indexOf("// v178 S0b : fin des helpers");
  const bloc = i0 >= 0 && i1 > i0 ? html.slice(i0, i1) : "";
  t("les helpers (ancre → fin des helpers) existent dans index.html", () => bloc.length > 800 && /function arriveeDe\(/.test(bloc) && /function arriveeJours\(/.test(bloc) && /function resteMinutesDe\(/.test(bloc) && /function dureeTxtLocale\(/.test(bloc));
  t("grep : aucune mention de ordreDureeTxt ni de ordreTravailleMin dans les helpers (ni aucun appel ordre*)", () => bloc.length > 0 && !/ordreDureeTxt/.test(bloc) && !/ordreTravailleMin/.test(bloc) && !/\bordre[A-Z]\w*\s*\(/.test(bloc));
  t("chaque fonction des helpers est dans un try/catch qui rend null", () => ["arriveeDe", "arriveeJours", "resteMinutesDe", "dureeTxtLocale"].every(n => { const d = bloc.indexOf("function " + n + "("); const f = bloc.indexOf("\nfunction ", d + 5); const corps = bloc.slice(d, f < 0 ? bloc.length : f); return /try \{/.test(corps) && /catch \(_\) \{ return null; \}/.test(corps); }));
  t("les helpers sont dans le script PRINCIPAL (le bloc qui contient afficher et liveDuree) et pas dans celui de l'ordre de travail", () => {
    const ds = html.lastIndexOf("<script", i0), fs_ = html.indexOf("</script>", i0);
    const bs = html.slice(ds, fs_);
    return /\nfunction afficher\(/.test(bs) && /\nfunction liveDuree\(/.test(bs) && /\nfunction arriveeDe\(/.test(bs) && /\nfunction resteMinutesDe\(/.test(bs) && !/function ordreDureeTxt\(/.test(bs) && !/function ordreTravailleMin\(/.test(bs);
  });
  t("l'ancre //@@v178-S0b helpers est toujours en place, une seule fois (les lots suivants s'y fient)", () => html.split("//@@v178-S0b helpers").length === 2);
  t("avec ordreDureeTxt et ordreTravailleMin retirés du monde de la page : mêmes résultats", () => {
    const w = A.w, d0 = w.ordreDureeTxt, t0 = w.ordreTravailleMin;
    try {
      w.ordreDureeTxt = undefined; w.ordreTravailleMin = undefined;
      const ex = typeof w.ordreDureeTxt === "undefined" && typeof w.ordreTravailleMin === "undefined";
      const a = reste(avecReste(90, -30 * MIN, [punch(-30 * MIN, null)])) === 60 && arrJ(bon({ arriveeLe: local(-1, 23, 50) })) === 1 && src(bon({ statut: "sansrdv" })) === "creeLe" && w.dureeTxtLocale(90) === "1 h 30";
      return ex && a;
    } finally { w.ordreDureeTxt = d0; w.ordreTravailleMin = t0; }
  });
  t("avec ordreDureeTxt retiré : afficher() avec une machine qui a resteAFaire.minutes ne lève rien", () => {
    const w = A.w, d0 = w.ordreDureeTxt, t0 = w.ordreTravailleMin;
    try {
      w.ordreDureeTxt = undefined; w.ordreTravailleMin = undefined;
      A.set("machines", [P(avecReste(90, -30 * MIN, [punch(-30 * MIN, null)], { numeroBT: "BT-501", statut: "reparation" })), P(serveur())]);
      w.afficher();
      return A.$$("article.carte").length >= 1;
    } finally { w.ordreDureeTxt = d0; w.ordreTravailleMin = t0; A.set("machines", []); w.afficher(); }
  });

  // Une 2e copie de l'app SANS le script d'ordre de travail : c'est la situation du tout premier afficher()
  {
    const iO = html.indexOf("function ordreDureeTxt("), dS = html.lastIndexOf("<script", iO), fS = html.indexOf("</script>", iO) + "</script>".length;
    const sansOrdre = html.slice(0, dS) + html.slice(fS);
    const lu = L.fs.readFileSync, nom = "./__sans-ordre-v178.html";
    L.fs.readFileSync = function (p, e) { return p === nom ? sansOrdre : lu.call(L.fs, p, e); };
    let B = null;
    try { B = await L.chargerApp({ sb: L.creerSupabase({ tableau: [{ id: 1, donnees: [] }, { id: 4, donnees: L.cp(L.EMP) }] }).sb, fichier: nom }); } catch (e) { ok(false, "chargement de l'app sans le script d'ordre : " + e.message); }
    finally { L.fs.readFileSync = lu; }
    if (B) {
      const PB = (o) => B.w.JSON.parse(JSON.stringify(o));
      t("copie sans le script d'ordre : ordreDureeTxt et ordreTravailleMin n'existent pas, les helpers si", () => typeof B.w.ordreDureeTxt === "undefined" && typeof B.w.ordreTravailleMin === "undefined" && typeof B.w.resteMinutesDe === "function" && typeof B.w.arriveeDe === "function");
      t("copie sans le script d'ordre : resteMinutesDe, arriveeJours, arriveeDe, dureeTxtLocale répondent", () => B.w.resteMinutesDe(PB(avecReste(90, -30 * MIN, [punch(-30 * MIN, null)]))) === 60 && B.w.arriveeJours(PB(bon({ arriveeLe: local(-1, 23, 50) }))) === 1 && B.w.arriveeDe(PB(bon({ statut: "sansrdv" }))).source === "creeLe" && B.w.dureeTxtLocale(150) === "2 h 30");
      L.connecter(B, "Jason");
      t("copie sans le script d'ordre : afficher() avec des machines qui ont resteAFaire.minutes ne lève rien et dessine le tableau", () => {
        B.set("machines", [PB(avecReste(90, -30 * MIN, [punch(-30 * MIN, null)], { numeroBT: "BT-502", statut: "reparation" })), PB(bon({ id: "b2", numeroBT: "BT-503", statut: "attente", resteAFaire: { texte: "x", quand: iso(-H), minutes: 45 } })), PB(serveur())]);
        B.w.afficher();
        return B.$$("article.carte").length >= 2;
      });
    }
  }

  L.fin(A);
})().catch((e) => { ok(false, "exception non prévue : " + (e && e.stack || e)); process.exit(); });
