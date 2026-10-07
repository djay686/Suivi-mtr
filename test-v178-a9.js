// v178-CAL9 — Demandes de service > fiche > 📅 Proposer des créneaux : le calendrier de la semaine et la charge d'ouvrage
//   à côté des créneaux proposés (mini-calendrier en lecture seule, plages libres cliquables, % de charge sur les tuiles),
//   et le rafraîchissement temps réel qui ne referme plus le sélecteur.
// Horloge figée : mercredi 7 octobre 2026, 10 h (le lundi 12 est l'Action de grâce, férié).
// node outils-v178/run-in-chromium.js test-v178-a9.js ./index.html     (Chromium : les mesures de mise en page exigent un vrai moteur)
// NOTE (CALA) : tant que CALA n'est pas fusionné, demHeures garde sa règle de la v177 (places = techniciens − bons qui
//   chevauchent, rôles lus bruts) ; le cas « 2 techniciens et un bon à 9 h » est écrit avec la capacité réelle de demHeures et
//   passe aussi bien avant qu'après CALA. Le maître d'œuvre le rejoue après la fusion.
const L = require("./outils-v178/test-lib-v178.js");
const { ok, cp, dodo } = L;

const CLE = "mtr-dem-cal-v1";
const MER = "2026-10-07", JEU = "2026-10-08", VEN = "2026-10-09", LUN5 = "2026-10-05", FERIE = "2026-10-12", MAR13 = "2026-10-13";
const RDV = { horaire: { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null }, tampon: 15, diner: { actif: true, debut: 12, duree: 60 } };
const J = { nom: "Jason", role: "admin", actif: true }, G = { nom: "Gwendal", role: "technicien", actif: true };
const bon = (id, iso, heure, o) => Object.assign({ id, numeroBT: "BT-" + id, nom: "Spark", client: "Client " + id, statut: "avenir", echeance: iso, heure, dureeEstimee: 60, pieces: [] }, o || {});
const ilYa = new Date(Date.now() - 3600000).toISOString();
const dem = (id, o) => Object.assign({ id, nom: "Marie " + id, tel: "819-555-1234", courriel: "marie@exemple.ca", canal_prefere: "sms", statut: "nouvelle", lu: true, cree_le: ilYa,
  source: "wix", marque: "BRP", modele: "Spark", annee: "2022", type_machine: "Motomarine", duree_min: 60 }, o || {});
const retenue = (demande_id, iso, heure, duree, o) => Object.assign({ demande_id, no: 1, iso, heure, duree_min: duree, client: "Client retenu", minutes_restantes: 40 }, o || {});

// Horloge de la page : décalage constant (comme MTR_FAKE_NOW du lanceur, qu'elle recouvre sans le gêner)
function figer(w, quand) {
  const D = w.Date, off = new D(quand).getTime() - D.now();
  function F(...a) { if (!(this instanceof F)) return new D(D.now() + off).toString(); if (a.length === 0) return new D(D.now() + off); return new D(...a); }
  F.prototype = D.prototype; F.now = () => D.now() + off; F.UTC = D.UTC; F.parse = D.parse; Object.setPrototypeOf(F, D); w.Date = F;
}
const charger = async (o = {}) => {
  const S = L.creerSupabase({ demandes_service: cp(o.demandes || [dem("D1"), dem("D2")]), sms_recus: [], creneaux_actifs: cp(o.retenus || []), demandes_journal: [], creneaux_reserves: [], tableau: [] });
  const A = await L.chargerApp({ sb: S.sb, fetch: async (u) => (/smart-api/.test(u) ? { status: 200, data: { ok: true } } : null),
    avant: (w) => { figer(w, o.quand || (MER + "T10:00:00")); if (o.avant) o.avant(w); } });
  L.connecter(A, "Jason", [cp(J), cp(G)]);
  const x = A.$("#ecran-connexion"); if (x) x.classList.remove("ouvert");
  prep(A, o);
  return { A, S };
};
const prep = (A, o = {}) => {
  A.set("rdvConfig", cp(o.rdv || RDV)); A.set("EMPLOYES", cp(o.employes || [J, G])); A.set("dispoOverride", cp(o.dispo || {})); A.set("machines", cp(o.machines || []));
};
const ouvrir = async (A, id = "D1", picker = true) => {
  await A.w.ouvrirDemandes("archives"); await dodo(150);
  await A.w.__dem.ouvrirFiche(id); await dodo(40);
  if (picker) { A.$("#dem-proposer").click(); await dodo(40); }
};
const pk = (A) => A.w.__dem.picker();
const cellule = (A, iso, h) => A.$('.dmc-libre[data-iso="' + iso + '"][data-h="' + h + '"]');
const cellules = (A, iso) => A.$$('.dmc-libre[data-iso="' + iso + '"]').map((x) => x.dataset.h);
const piste = (A, iso) => A.$('.dmc-pistes[data-iso="' + iso + '"]');
const entete = (A, iso) => { const p = piste(A, iso); return p ? p.parentElement.querySelector(".dmc-ent") : null; };
// clic sur la colonne d'un jour à l'heure décimale t (comme un doigt sur la grille, en dehors de toute plage verte)
const clicHeure = (A, iso, t) => {
  const p = piste(A, iso), r = p.getBoundingClientRect();
  p.dispatchEvent(new A.w.MouseEvent("click", { bubbles: true, clientX: r.left + 6, clientY: r.top + p.clientTop + (t - Number(p.dataset.t0)) * 2 * Number(p.dataset.demi) }));
};
const viderToasts = (A) => { [...A.w.document.body.children].filter((x) => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).forEach((x) => x.remove()); };
const larg = (A, px) => { if (A.dom.frame) A.dom.frame.style.width = px + "px"; };
const R = (el) => el.getBoundingClientRect();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const sec = async (nom, f) => { try { await f(); } catch (e) { ok(false, "exception (" + nom + ") : " + String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")); } };

(async () => {
  const { A, S } = await charger();
  const w = A.w;
  const C = (iso, saufDemande) => w.__demChargeJour(iso, saufDemande);
    await sec("0. Présence", async () => {
    ok(typeof w.__demChargeJour === "function" && typeof w.__demCalRafraichir === "function", "demChargeJour et __demCalRafraichir sont exposés");
    prep(A); await ouvrir(A);
    ok(!!A.$("#dem-cal-btn") && !!A.$("#dem-cal") && !!A.$("#dem-duree"), "le sélecteur de créneaux a son bouton #dem-cal-btn et son volet #dem-cal");

    });
    await sec("1. Charge d'ouvrage (fonction pure)", async () => {
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 120 })] });
    let c = C(JEU);
    ok(c.cap === 7 && c.reserve === 2 && c.pct === 29 && c.niveau === 1 && c.libelle === "29 % chargé", "1 technicien 9-17 avec dîner = 7 h ; bon de 2 h → 29 % chargé, niveau n1 (cap " + c.cap + ", " + c.pct + " %)");
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 360 })] });
    c = C(JEU);
    ok(c.pct === 86 && c.niveau === 3, "6 h sur 7 h → 86 % : niveau n3 (rouge)");
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 270 })] });
    c = C(JEU);
    ok(c.pct === 64 && c.niveau === 2, "4 h 30 sur 7 h → 64 % : niveau n2 (orange)");
    prep(A, { employes: [J, G], machines: [bon("a", JEU, "09:00", { dureeEstimee: 120 })] });
    c = C(JEU);
    ok(c.cap === 14 && c.techs === 2 && c.pct === 14, "2 techniciens → 14 h de capacité (2 h = 14 %)");
    prep(A, { employes: [J], machines: [] });
    ok(C(VEN).cap === 4, "vendredi 8-12 : le dîner (12-13) ne croise pas la journée, rien n'est retiré (4 h)");
    prep(A, { employes: [J], dispo: { [VEN]: { Jason: false } }, machines: [bon("a", VEN, "09:00")] });
    c = C(VEN);
    ok(c.cap === 0 && c.niveau === 0 && c.libelle === "aucun technicien" && c.pct === 0 && !/0 %/.test(c.libelle), "jour sans technicien : niveau 0 et « aucun technicien » (jamais « 0 % chargé »)");
    prep(A, { employes: [J], machines: [bon("p", JEU, "09:00", { statut: "prete", dureeEstimee: 120 }), bon("f", JEU, "14:00", { statut: "afacturer", dureeEstimee: 60 }), bon("x", JEU, "15:00", { statut: "archive", dureeEstimee: 240 })] });
    c = C(JEU);
    ok(c.reserve === 3 && c.pct === 43, "un bon prete ou afacturer daté d'un jour futur compte (3 h), un bon archivé non (reserve " + c.reserve + ")");
    prep(A, { employes: [J], machines: [bon("s", JEU, "", { dureeEstimee: 300 })] });
    c = C(JEU);
    ok(c.reserve === 1 && c.sansHeure === 1 && c.pct === 14, "un bon sans heure compte 60 min et est signalé (sansHeure = 1)");
    // retenues : celle d'une AUTRE demande compte, celle de la demande ouverte non
    S.db.creneaux_actifs.push(retenue("D2", JEU, "13:00", 120), retenue("D1", JEU, "15:00", 60));
    await w.__dem.charger(); prep(A, { employes: [J] });
    ok(C(JEU, "D1").retenu === 2 && C(JEU, "D1").pct === 29, "retenue d'une AUTRE demande : comptée (2 h) ; celle de la demande ouverte : pas comptée");
    ok(C(JEU).retenu === 3, "sans saufDemande, toutes les retenues comptent (3 h)");
    S.db.creneaux_actifs.length = 0; await w.__dem.charger();

    });
    await sec("2. Charge dans l'interface : tuiles de l'étape 2 et en-têtes du calendrier", async () => {
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 120 }), bon("b", VEN, "08:00", { dureeEstimee: 60 })], dispo: { [VEN]: { Jason: false } } });
    await ouvrir(A);
    const tuile = (iso) => A.$('.dem-jour[data-j="' + iso + '"]');
    const pb = tuile(JEU) && tuile(JEU).querySelector("i.dem-pb");
    ok(!!pb && pb.classList.contains("n1") && /29 %/.test(pb.textContent), "tuile du jeudi : indicateur <i class=dem-pb n1> « 29 % chargé »");
    ok(!!pb && A.w.getComputedStyle(pb).borderBottomWidth === "0px" && !A.$$(".dem-jour").some((t) => t.querySelector(".dem-pb") && /border-bottom/.test(t.getAttribute("style") || "")), "l'indicateur n'est pas une bordure (border-bottom 0) : .voulu, .on et .ferie gardent les leurs");
    const pbV = tuile(VEN) && tuile(VEN).querySelector("i.dem-pb");
    ok(!!pbV && pbV.classList.contains("n0") && /aucun technicien/.test(pbV.textContent) && !/\b0 %/.test(pbV.textContent), "tuile du vendredi sans technicien : « aucun technicien » (pas « 0 % »)");
    ok(/29 %/.test(entete(A, JEU).textContent) && !!entete(A, JEU).querySelector(".dmc-bar.n1"), "en-tête du calendrier : barre de charge n1 et « 29 % chargé »");
    ok(/aucun technicien/.test(entete(A, VEN).textContent) && !entete(A, VEN).querySelector(".dmc-bar") && !/0 %/.test(entete(A, VEN).textContent), "en-tête du vendredi : « aucun technicien », pas de barre ni de « 0 % »");
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 360 }), bon("s", JEU, "", {})] });
    w.__demCalRafraichir(); await dodo(20);
    ok(entete(A, JEU).querySelector(".dmc-bar.n3") && /sans heure/.test(entete(A, JEU).textContent) && tuile(JEU).querySelector("i.dem-pb.n3"), "6 h + un bon sans heure (60 min) : rouge n3 partout, « dont 1 sans heure » signalé");

    });
    await sec("3. Colonnes du calendrier (mercredi 7 octobre)", async () => {
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 60, client: "Paul" })] });
    await ouvrir(A);
    const cols = A.$$(".dmc-col");
    const noms = cols.map((x) => x.querySelector(".dmc-ent b").textContent.trim());
    ok(cols.length === 5 && eq(noms, ["lun. 5", "mar. 6", "mer. 7", "jeu. 8", "ven. 9"]), "5 jours ouvrés, lundi au vendredi, week-end absent (" + noms.join(" | ") + ")");
    ok(cellules(A, LUN5).length === 0 && cellules(A, "2026-10-06").length === 0 && cellules(A, MER).length === 0 && cellules(A, JEU).length > 0, "jours passés et aujourd'hui : aucune plage verte ; jeudi : des plages");
    let n0 = pk(A).choix.length; viderToasts(A); clicHeure(A, LUN5, 10);
    ok(pk(A).choix.length === n0 && A.toasts().some((t) => /passée/.test(t)), "clic sur un jour passé : rien d'ajouté, toast « Cette journée est passée. »");
    viderToasts(A); clicHeure(A, MER, 10);
    ok(pk(A).choix.length === n0 && A.toasts().some((t) => /à partir de demain/.test(t)), "clic sur aujourd'hui : rien d'ajouté, toast « à partir de demain »");
    ok(A.$("#dmc-prec").disabled && A.$("#dmc-auj").disabled, "‹ est borné : il n'ira jamais avant « cette semaine » (le lundi 5)");
    A.$("#dmc-suiv").click(); await dodo(30);
    const colsB = A.$$(".dmc-col"), entF = entete(A, FERIE);
    ok(colsB.length === 5 && /Action de grâce/.test(entF.textContent) && entF.classList.contains("ferie") && cellules(A, FERIE).length === 0 && cellules(A, MAR13).length > 0, "semaine du 12 : le lundi férié (Action de grâce) est fermé, sans plage ; mardi a des plages");
    n0 = pk(A).choix.length; viderToasts(A); clicHeure(A, FERIE, 10);
    ok(pk(A).choix.length === n0 && A.toasts().some((t) => /Férié : Action de grâce/.test(t)), "clic sur le jour férié : rien d'ajouté, toast « Férié : Action de grâce »");
    ok(!A.$("#dmc-prec").disabled && !A.$("#dmc-auj").disabled, "‹ et « Cette semaine » s'activent une fois sur la semaine suivante");
    A.$("#dmc-prec").click(); await dodo(30);
    ok(entete(A, JEU) && A.$("#dmc-prec").disabled, "‹ ramène à la semaine du 5, puis se désactive");
    A.$("#dmc-suiv").click(); await dodo(20); A.$("#dmc-auj").click(); await dodo(30);
    ok(!!entete(A, JEU), "« Cette semaine » revient à la semaine courante");

    });
    await sec("4. Un vendredi (et un samedi), « Cette semaine » est la semaine à venir", async () => {
    const V = await charger({ quand: "2026-10-16T10:00:00" });
    prep(V.A, { employes: [J] }); await ouvrir(V.A);
    const nomsV = V.A.$$(".dmc-col .dmc-ent b").map((x) => x.textContent.trim());
    ok(nomsV[0] === "lun. 19" && nomsV.length === 5 && V.A.$("#dmc-prec").disabled && V.A.$("#dmc-auj").disabled, "vendredi 16 : « Cette semaine » = la semaine à venir (lundi 19), pas la semaine qui se termine (" + nomsV.join(" | ") + ")");
    ok(cellules(V.A, "2026-10-19").length > 0 && cellules(V.A, "2026-10-16").length === 0, "… avec des plages le lundi 19 et aucune aujourd'hui (vendredi 16)");
    const Sa = await charger({ quand: "2026-10-17T10:00:00" });
    prep(Sa.A, { employes: [J] }); await ouvrir(Sa.A);
    ok(Sa.A.$$(".dmc-col .dmc-ent b")[0].textContent.trim() === "lun. 19", "samedi 17 : la semaine à venir aussi (le lundi de demain serait passé)");

    });
    await sec("5. Clics : plage verte, 3 choix, re-clic, plages refusées", async () => {
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 60 })] });
    await ouvrir(A);
    ok(cellules(A, JEU).every((h) => h >= "10:15") && cellules(A, JEU).includes("10:15") && !cellule(A, JEU, "09:00"), "plage occupée (bon de 9:00 à 10:00) : pas de cellule à 9:00");
    ok(eq(cellules(A, JEU).filter((h) => h < "12:00"), ["10:15", "10:30", "11:00"]), "départs hors grille : cellules 10:15, 10:30 et 11:00 (tampon de 15 min après le bon) — pas de 10:00");
    clicHeure(A, JEU, 10 + 20 / 60);
    ok(eq(pk(A).choix.map((x) => x.heure), ["10:15"]), "clic à 10:20 : le dernier départ ≤ au clic = 10:15");
    clicHeure(A, JEU, 10 + 35 / 60);
    ok(eq(pk(A).choix.map((x) => x.heure), ["10:15", "10:30"]), "clic à 10:35 : 10:30 (départ hors grille 10:15 gardé séparé)");
    // la même liste que l'étape 3 : jeudi est la journée choisie
    ok(A.$$(".dem-h.on").map((x) => x.dataset.h).join() === "10:15,10:30" && /1\)[\s\S]*2\)/.test(A.txt(".dem-b .dem-choix")), "les choix du calendrier sont ceux de l'étape 3 (cases cochées et liste « 1) 2) »)");
    ok(A.$$(".dmc-choix").length === 2 && /①/.test(A.$$(".dmc-choix")[0].textContent) && /②/.test(A.$$(".dmc-choix")[1].textContent), "les choix sont numérotés ① ② dans le calendrier");
    A.$('.dem-h[data-h="11:00"]').click(); await dodo(30);
    ok(pk(A).choix.length === 3 && A.$$(".dmc-choix").length === 3 && /③/.test(A.$$(".dmc-choix")[2].textContent), "cocher une heure à l'étape 3 : elle apparaît ③ dans le calendrier");
    A.alertes.length = 0;
    cellule(A, JEU, "13:00").click(); await dodo(30);
    ok(pk(A).choix.length === 3 && A.alertes.some((a) => /Trois choix au maximum/.test(a)), "le 4e choix : alert « Trois choix au maximum » et rien d'ajouté");
    A.$$(".dmc-choix")[1].click(); await dodo(30);
    ok(eq(pk(A).choix.map((x) => x.heure), ["10:15", "11:00"]) && A.$$(".dmc-choix").length === 2, "clic sur un choix numéroté : il est retiré");
    cellule(A, JEU, "11:00").click(); await dodo(30);
    ok(eq(pk(A).choix.map((x) => x.heure), ["10:15"]), "re-clic sur la plage verte d'un choix : il est retiré");
    pk(A).choix.length = 0; await ouvrir(A);
    // plage occupée, hors ouverture, dîner, dépassement : rien d'ajouté et un toast qui dit pourquoi
    const essai = (t, re, lib) => { const n = pk(A).choix.length; viderToasts(A); clicHeure(A, JEU, t); ok(pk(A).choix.length === n && A.toasts().some((x) => re.test(x)), lib); };
    essai(9.5, /occupée/, "clic sur la plage occupée (9:30) : rien d'ajouté, toast « déjà occupée »");
    essai(8.5, /Hors des heures d'ouverture/, "clic hors ouverture (8:30, l'atelier ouvre à 9 h le jeudi) : rien d'ajouté, toast");
    essai(12.5, /dîner/, "clic sur le dîner (12:30) : rien d'ajouté, toast « C'est l'heure du dîner »");
    essai(11.7, /déborde sur l'heure du dîner/, "clic à 11:40 pour 1 h : déborde sur le dîner → rien d'ajouté, toast");
    essai(16.75, /fermeture/, "clic à 16:45 pour 1 h : ne tient pas avant la fermeture → rien d'ajouté, toast");
    ok(!!A.$('.dmc-pistes[data-iso="' + JEU + '"] .dmc-diner') && !A.$('.dmc-pistes[data-iso="' + VEN + '"] .dmc-diner'), "bande « dîner » le jeudi (9-17), pas le vendredi (8-12 : elle ne croise pas les heures d'ouverture)");

    });
    await sec("6. 2 techniciens et un bon à 9 h : la plage 9:00 reste visible et cliquable (« 1 pl. ») au-dessus du bloc", async () => {
    prep(A, { employes: [J, G], machines: [bon("a", JEU, "09:00", { dureeEstimee: 60, technicien: "Jason" })] });
    await ouvrir(A);
    const c9 = cellule(A, JEU, "09:00");
    ok(!!c9 && /1 pl\./.test(c9.textContent), "2 techniciens et un bon à 9 h : la plage 9:00 est là, avec « 1 pl. »");
    const bloc = A.$('.dmc-pistes[data-iso="' + JEU + '"] .dmc-bloc');
    c9.scrollIntoView({ block: "center" });
    const r9 = R(c9), sur = w.document.elementFromPoint(r9.left + r9.width / 2, r9.top + r9.height / 2);
    ok(!!bloc && w.getComputedStyle(bloc).pointerEvents === "none" && Number(w.getComputedStyle(c9).zIndex) > Number(w.getComputedStyle(bloc).zIndex), "le bloc du rendez-vous est sous la plage (z-index inférieur, pointer-events none)");
    ok(!!sur && c9.contains(sur), "au centre de la plage 9:00, l'élément touché est la plage verte, pas le bloc client");
    c9.click(); await dodo(30);
    ok(eq(pk(A).choix.map((x) => x.heure), ["09:00"]), "clic sur la plage 9:00 « 1 pl. » : elle est ajoutée aux choix");
    // demHeures donne aussi la plage 9:00 dans la liste de l'étape 3
    ok(!!A.$('.dem-h[data-h="09:00"].on') && /1 pl\./.test(A.$('.dem-h[data-h="09:00"]').textContent) === false, "… et cochée à l'étape 3 (une seule place, pas de mention)");

    });
    await sec("6b. Blocs simultanés côte à côte", async () => {
    prep(A, { employes: [J, G], machines: [bon("a", JEU, "09:00", { dureeEstimee: 60, technicien: "Jason" }), bon("b", JEU, "09:00", { dureeEstimee: 90, technicien: "Gwendal" }), bon("c", JEU, "13:00", { dureeEstimee: 60 })] });
    await ouvrir(A);
    const bs = A.$$('.dmc-pistes[data-iso="' + JEU + '"] .dmc-bloc').map((b) => ({ g: b.style.left, l: b.style.width }));
    ok(bs.length === 3 && eq(bs.slice(0, 2).map((x) => x.l), ["50%", "50%"]) && eq(bs.slice(0, 2).map((x) => x.g).sort(), ["0%", "50%"]) && bs[2].l === "100%", "deux rendez-vous simultanés : côte à côte (50 % chacun) ; un bloc seul garde toute la largeur");
    ok(cellules(A, JEU).includes("09:30") === false && !cellule(A, JEU, "09:00"), "2 techniciens, 2 bons à 9 h : plus de plage à 9:00 (0 place) — le calendrier suit demHeures");
    });
    await sec("7. Blocs, info-bulles, retenues, XSS", async () => {
    const XSS = "<img src=x onerror=alert(1)>";
    S.db.creneaux_actifs.push(retenue("D2", JEU, "14:00", 60, { client: XSS }), retenue("D1", VEN, "09:00", 60, { client: "Mon client" }));
    await w.__dem.charger();
    prep(A, { employes: [J], machines: [bon("x", JEU, "10:00", { dureeEstimee: 60, client: XSS }), bon("y", VEN, "10:00", { dureeEstimee: 60, client: "Paul" })] });
    A.alertes.length = 0; await ouvrir(A);
    const blocs = A.$$(".dmc-bloc");
    ok(blocs.length === 4 && !A.$("#dem-cal img") && !A.$("#dem-cal script"), "4 blocs dessinés (2 bons, 2 plages retenues) et aucun élément injecté par un nom de client");
    ok(blocs.some((b) => b.querySelector(".dmc-tip").textContent.includes(XSS)), "le nom de client <img src=x onerror=alert(1)> reste du texte dans le bloc");
    ok(blocs.some((b) => (b.querySelector(".dmc-tip").getAttribute("title") || "").includes(XSS)) && !A.alertes.length, "… et dans l'info-bulle (calEvtInfo) ; alert(1) n'a jamais été appelée");
    ok(A.$$(".dmc-ret").length === 2 && A.$$(".dmc-ret.dmc-moi").length === 1 && /Mon client|retenue/.test(A.$(".dmc-ret.dmc-moi").textContent), "plages retenues hachurées ; celle de la demande ouverte est dessinée à part (.dmc-moi)");
    ok(C(VEN, "D1").retenu === 0 && C(VEN).retenu === 1, "… et pas comptée dans la charge de la demande ouverte");
    ok(/BT-x/.test(A.$$(".dmc-bloc .dmc-tip").map((x) => x.title).join(" ")) || A.$$(".dmc-bloc .dmc-tip").some((x) => /BT-/.test(x.title)), "l'info-bulle d'un bloc est celle du calendrier (calEvtInfo : numéro de BT, machine, technicien)");
    S.db.creneaux_actifs.length = 0; await w.__dem.charger();

    });
    await sec("8. Temps réel", async () => {
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 60 })] });
    await ouvrir(A);
    cellule(A, JEU, "10:15").click(); cellule(A, JEU, "11:00").click(); await dodo(30);
    const boite = A.$("#dem-boite");
    ok(boite.scrollHeight > boite.clientHeight + 150, "la fenêtre défile (" + boite.scrollHeight + " px de contenu pour " + boite.clientHeight + ")");
    boite.scrollTop = 140; const haut0 = boite.scrollTop;
    // une autre demande retient une plage : l'événement arrive pendant que le sélecteur est ouvert
    const ligne = retenue("D2", JEU, "13:00", 60, { client: "Un autre" }); S.db.creneaux_actifs.push(ligne); S.pousser("creneaux_reserves", ligne, "INSERT");
    await dodo(250);
    ok(!!A.$("#dem-duree") && eq(pk(A).choix.map((x) => x.heure), ["10:15", "11:00"]) && A.$$(".dmc-choix").length === 2, "événement temps réel, sélecteur ouvert : il reste affiché, avec ses deux choix");
    ok(A.$$(".dmc-ret").length === 1 && /Un autre/.test(A.$(".dmc-ret").textContent) && !cellule(A, JEU, "13:00"), "… et la nouvelle plage retenue y apparaît (la donnée est bien rafraîchie)");
    ok(Math.abs(boite.scrollTop - haut0) <= 2 && haut0 > 0, "… la position de défilement est conservée (" + haut0 + " → " + boite.scrollTop + ")");
    // deux appels sans changement : aucun nœud remplacé
    const marques = [A.$("#dem-duree"), A.$("#dem-cal"), A.$(".dmc-col"), cellule(A, JEU, "10:30"), A.$(".dem-jour")];
    marques.forEach((x) => { x.__marque = 7; });
    w.__demCalRafraichir(); w.__demCalRafraichir(); await dodo(20);
    const rowD1 = S.db.demandes_service.find((x) => x.id === "D1"); S.pousser("demandes_service", rowD1, "UPDATE"); await dodo(200);
    S.pousser("demandes_service", rowD1, "UPDATE"); await dodo(200);
    ok(marques.every((x) => x.__marque === 7) && marques[0] === A.$("#dem-duree") && marques[3] === cellule(A, JEU, "10:30"), "deux rafraîchissements sans changement de données (ou événements identiques) : aucun nœud DOM remplacé");
    // Renseignements ouvert : l'événement ne le remplace pas
    await ouvrir(A, "D1", false);
    A.$("#dem-infos").click(); await dodo(30);
    A.$("#dem-txt").value = "Texte en cours de frappe"; A.$("#dem-txt").__marque = 9;
    S.pousser("demandes_service", rowD1, "UPDATE"); await dodo(220);
    ok(!!A.$("#dem-txt") && A.$("#dem-txt").__marque === 9 && A.$("#dem-txt").value === "Texte en cours de frappe" && !A.$("#dem-duree"), "formulaire « Renseignements » ouvert puis événement : non remplacé (texte intact) et le sélecteur ne réapparaît pas par-dessus");
    S.pousser("creneaux_reserves", ligne, "UPDATE"); await dodo(220);
    ok(!!A.$("#dem-txt") && A.$("#dem-txt").__marque === 9 && !A.$("#dem-duree"), "… idem pour l'événement des plages retenues");
    // Corriger (coordonnées) ouvert
    await ouvrir(A, "D1", false);
    A.$("#dem-coord").click(); await dodo(30);
    A.$("#dem-c-tel").value = "819-555-9999"; A.$("#dem-c-tel").__marque = 5;
    S.pousser("demandes_service", rowD1, "UPDATE"); await dodo(220);
    ok(A.$("#dem-c-tel") && A.$("#dem-c-tel").__marque === 5 && A.$("#dem-c-tel").value === "819-555-9999" && !A.$("#dem-duree"), "formulaire « Corriger » ouvert puis événement : non remplacé non plus");
    // la fiche seule (aucun formulaire, aucun sélecteur) se redessine avec la demande fraîche
    await ouvrir(A, "D1", false);
    rowD1.note_interne = "Note arrivée par le temps réel"; S.pousser("demandes_service", rowD1, "UPDATE"); await dodo(220);
    ok(/Note arrivée par le temps réel/.test(A.txt("#dem-contenu")) && !A.$("#dem-duree"), "fiche sans sélecteur : redessinée avec la demande relue (pas l'ancien objet)");
    delete rowD1.note_interne;
    // demande devenue confirmée pendant que le sélecteur est ouvert : pas rouvert, avec un toast
    await ouvrir(A, "D1");
    cellule(A, JEU, "10:15").click(); await dodo(30);
    ok(!!A.$("#dem-duree") && pk(A).choix.length === 1, "avant l'événement : sélecteur ouvert, un choix");
    viderToasts(A); rowD1.statut = "confirmee"; S.pousser("demandes_service", rowD1, "UPDATE"); await dodo(250);
    ok(!A.$("#dem-duree") && !A.$("#dem-cal") && A.toasts().some((t) => /Cette demande vient de changer/.test(t)) && /confirmée/.test(A.txt("#dem-contenu")), "demande devenue confirmée : sélecteur non rouvert, toast « Cette demande vient de changer », la fiche montre « confirmée »");
    ok(!A.$("#dem-boite").classList.contains("dem-large"), "… et la fenêtre reprend sa largeur normale (dem-large retirée)");
    rowD1.statut = "nouvelle";
    // demande supprimée par un autre poste pendant que le sélecteur est ouvert
    S.db.demandes_service.push(dem("D3")); await w.__dem.charger();
    await ouvrir(A, "D3");
    S.db.demandes_service.splice(S.db.demandes_service.findIndex((x) => x.id === "D3"), 1); viderToasts(A); S.pousser("demandes_service", { id: "D3" }, "DELETE"); await dodo(250);
    ok(!A.$("#dem-duree") && !!A.$("#dem-contenu .dem-carte, #dem-contenu .rap-muted") && A.toasts().some((t) => /Cette demande vient de changer/.test(t)), "demande supprimée ailleurs : retour à la liste, avec le toast");
    // la liste (aucune fiche) est toujours redessinée
    S.db.demandes_service.push(dem("D4", { nom: "Nouvelle venue" })); S.pousser("demandes_service", S.db.demandes_service[S.db.demandes_service.length - 1], "INSERT"); await dodo(250);
    ok(/Nouvelle venue/.test(A.txt("#dem-contenu")), "liste des demandes : une nouvelle demande apparaît (rafraîchissement inchangé)");
    // le filet de 120 s et rafraichirVues passent par le même point d'entrée
    await ouvrir(A, "D1");
    prep(A, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 60 }), bon("n", VEN, "08:30", { dureeEstimee: 60, client: "Arrivé" })] });
    const nBlocs = A.$$(".dmc-bloc").length; w.rafraichirVues(); await dodo(60);
    ok(A.$$(".dmc-bloc").length === nBlocs + 1 && !!A.$("#dem-duree"), "rafraichirVues (les bons changent) : un nouveau bon apparaît dans le calendrier sans fermer le sélecteur");

    });
    await sec("9. demEnvoyerCreneaux : inchangé, et il ne rouvre pas le sélecteur", async () => {
    S.db.demandes_service.find((x) => x.id === "D1").statut = "nouvelle"; S.db.creneaux_actifs.length = 0; await w.__dem.charger();
    prep(A, { employes: [J], machines: [] });
    await ouvrir(A, "D1");
    cellule(A, JEU, "10:00").click(); cellule(A, JEU, "14:00").click(); await dodo(30);
    A.appelsFetch.length = 0;
    viderToasts(A); A.$("#dem-env-sms").click(); await dodo(400);
    const ins = S.ecrits("creneaux_reserves", "insert");
    ok(ins.length === 1 && ins[0].vals.length === 2 && ins[0].vals[0].iso === JEU && ins[0].vals[0].heure === "10:00" && ins[0].vals[1].heure === "14:00" && ins[0].vals[0].duree_min === 60, "envoi par SMS : les 2 plages choisies au calendrier sont retenues (iso, heure, durée) comme avant");
    const maj = S.ecrits("demandes_service", "update").filter((a) => a.vals && a.vals.statut === "creneaux_envoyes").pop();
    ok(!!maj && maj.vals.creneaux.length === 2 && maj.vals.creneaux[0].no === 1 && maj.vals.creneaux[0].duree === 60, "la demande passe à « creneaux_envoyes » avec ses 2 créneaux");
    ok(A.appelsFetch.some((f) => /smart-api/.test(f.url) && f.body && /Réponds|Répondez/.test(f.body.message || "")), "le texto part par smart-api avec « Répondez 1, 2… »");
    ok(!A.$("#dem-duree") && !A.$("#dem-cal") && pk(A).choix.length === 0, "après l'envoi : le sélecteur n'est pas rouvert et les choix sont vidés");
    ok(A.toasts().some((t) => /Créneaux envoyés/.test(t)), "toast « Créneaux envoyés et retenus »");

    });
    await sec("10. jsdom sans matchMedia ; demi-heure de 30 px sur écran tactile", async () => {
    const mm = w.matchMedia;
    S.db.demandes_service.find((x) => x.id === "D1").statut = "nouvelle"; await w.__dem.charger();
    w.matchMedia = undefined;
    A.erreurs.length = 0; prep(A, { employes: [J] }); await ouvrir(A);
    ok(!!A.$("#dem-cal") && A.$$(".dmc-pistes").length === 5 && A.$(".dmc-pistes").dataset.demi === "22" && A.erreurs.length === 0, "sans matchMedia (jsdom) : le calendrier se dessine, demi-heure de 22 px, aucune erreur");
    w.matchMedia = () => { throw new Error("matchMedia indisponible"); };
    await ouvrir(A);
    ok(A.$$(".dmc-pistes").length === 5 && A.$(".dmc-pistes").dataset.demi === "22", "matchMedia qui lance une exception : repli sur 22 px, le calendrier se dessine");
    w.matchMedia = (q) => ({ matches: /coarse/.test(q), addListener() {}, addEventListener() {} });
    await ouvrir(A);
    const c30 = cellule(A, JEU, "09:00");
    ok(A.$(".dmc-pistes").dataset.demi === "30" && c30 && Math.round(R(c30).height) === 30, "écran tactile (pointer: coarse) : une demi-heure = 30 px (cellule de 30 px)");
    w.matchMedia = mm;
    });

  // ══════ 11. Préférence, largeur de la fenêtre et mise en page : 1280, 1180, 820 et 390 px ══════
  try {
    const { A: P } = await charger();
    prep(P, { employes: [J], machines: [bon("a", JEU, "09:00", { dureeEstimee: 60 })] });
    const pw = P.w; pw.localStorage.removeItem(CLE);
    const etat = async (px) => {
      larg(P, px); await dodo(60); await ouvrir(P);
      const cal = P.$("#dem-cal"), bt = P.$("#dem-boite"), a = P.$(".dem-a"), z = P.$(".dem-b");
      const visible = !!cal && !cal.hidden && pw.getComputedStyle(cal).display !== "none";
      return { cal, bt, a, z, visible, large: bt.classList.contains("dem-large"), hscroll: bt.scrollWidth > bt.clientWidth + 1 || pw.document.documentElement.scrollWidth > pw.innerWidth + 1 };
    };
    let e = await etat(1280);
    ok(e.visible && e.large, "1280 px : #dem-cal affiché par défaut et #dem-boite a la classe dem-large");
    ok(R(e.cal).left >= R(e.a).right - 1 && R(e.cal).left >= R(e.z).right - 1 && Math.abs(R(e.cal).top - R(e.a).top) < 40, "1280 px : calendrier à droite des étapes 1-2 et 3 (côte à côte, .dem-duo)");
    ok(R(e.bt).width > 1100 && !e.hscroll, "1280 px : la fenêtre est élargie (" + Math.round(R(e.bt).width) + " px) sans défilement horizontal");
    ok(R(P.$(".dmc-corps")).width > 520, "1280 px : le calendrier a la place de ses 5 jours (" + Math.round(R(P.$(".dmc-corps")).width) + " px)");
    ok(R(P.$("#dem-cal-btn")).height >= 30 && /Masquer/.test(P.$("#dem-cal-btn").textContent), "le bouton dit « Masquer le calendrier » quand il est affiché");
    e = await etat(1180);
    ok(e.visible && e.large && R(e.cal).left >= R(e.a).right - 1 && !e.hscroll, "1180 px (iPad en paysage) : affiché par défaut, côte à côte, sans défilement horizontal");
    e = await etat(820);
    ok(!e.visible && !e.large && !e.hscroll, "820 px : masqué par défaut (pas de dem-large), sans défilement horizontal");
    ok(/Voir le calendrier/.test(P.$("#dem-cal-btn").textContent), "le bouton dit « 🗓️ Voir le calendrier »");
    e = await etat(390);
    ok(!e.visible && !e.large && !e.hscroll && !P.$$(".dmc-col").length, "390 px : #dem-cal masqué par défaut (rien de dessiné), sans défilement horizontal");
    ok(P.erreurs.length === 0, "aucune erreur JavaScript jusqu'ici (" + P.erreurs.length + ")");
    ok(pw.localStorage.getItem(CLE) === null, "rien n'est écrit en localStorage tant qu'on ne touche pas au bouton");
    P.$("#dem-cal-btn").click(); await dodo(60);
    let cal = P.$("#dem-cal"), bt = P.$("#dem-boite");
    ok(!cal.hidden && pw.getComputedStyle(cal).display !== "none" && pw.localStorage.getItem(CLE) === "1" && bt.classList.contains("dem-large"), "bouton : le calendrier s'affiche et la préférence est écrite (« 1 ») dans localStorage mtr-dem-cal-v1");
    let a = P.$(".dem-a"), z = P.$(".dem-b");
    ok(R(a).bottom <= R(cal).top + 1 && R(cal).bottom <= R(z).top + 1, "390 px : le calendrier est empilé entre l'étape 2 et l'étape 3");
    ok(bt.scrollWidth <= bt.clientWidth + 1 && pw.document.documentElement.scrollWidth <= pw.innerWidth + 1 && R(cal).right <= pw.innerWidth + 1, "390 px, calendrier affiché : aucun défilement horizontal (colonnes " + Math.round(R(P.$(".dmc-col")).width) + " px)");
    ok(P.$$(".dmc-libre").length > 0 && P.$$(".dmc-libre").every((x) => R(x).width > 20 && R(x).height >= 8), "390 px : les plages vertes restent visibles et touchables");
    larg(P, 820); await dodo(60); await ouvrir(P);
    cal = P.$("#dem-cal"); a = P.$(".dem-a"); z = P.$(".dem-b");
    ok(!cal.hidden && R(a).bottom <= R(cal).top + 1 && R(cal).bottom <= R(z).top + 1 && P.$("#dem-boite").scrollWidth <= P.$("#dem-boite").clientWidth + 1, "820 px, préférence « affiché » : empilé entre l'étape 2 et l'étape 3, sans défilement horizontal");
    larg(P, 1180); await dodo(60); await ouvrir(P);
    ok(R(P.$("#dem-cal")).left >= R(P.$(".dem-a")).right - 1, "1180 px, préférence « affiché » : côte à côte");
    P.$("#dem-cal-btn").click(); await dodo(60);
    ok(P.$("#dem-cal").hidden && pw.localStorage.getItem(CLE) === "0" && !P.$("#dem-boite").classList.contains("dem-large"), "re-clic : masqué, préférence « 0 », dem-large retirée");
    larg(P, 1280); await dodo(60); await ouvrir(P);
    ok(P.$("#dem-cal").hidden, "1280 px avec la préférence « masqué » : elle est respectée");
    ok(P.erreurs.length === 0, "aucune erreur JavaScript dans la fumée de mise en page (" + P.erreurs.length + ")");
    pw.localStorage.removeItem(CLE);
  } catch (e) { ok(false, "exception (mise en page) : " + (e && e.stack || e)); }

  // ══════ 12. localStorage qui lance une exception : l'app ne plante pas ══════
  try {
    const { A: Q } = await charger({ avant: (w) => {
      const g = w.Storage.prototype.getItem, s = w.Storage.prototype.setItem;
      w.Storage.prototype.getItem = function (k) { if (k === CLE) throw new Error("accès refusé"); return g.apply(this, arguments); };
      w.Storage.prototype.setItem = function (k, v) { if (k === CLE) throw new Error("quota dépassé"); return s.apply(this, arguments); };
    } });
    prep(Q, { employes: [J] });
    await ouvrir(Q);
    ok(!!Q.$("#dem-cal") && !Q.$("#dem-cal").hidden, "localStorage illisible : le calendrier s'affiche quand même (défaut selon la largeur)");
    Q.$("#dem-cal-btn").click(); await dodo(60);
    ok(Q.$("#dem-cal").hidden, "localStorage qui refuse l'écriture : le bouton masque quand même le calendrier (préférence gardée en mémoire)");
    Q.$("#dem-cal-btn").click(); await dodo(60);
    ok(!Q.$("#dem-cal").hidden && Q.erreurs.length === 0, "… et le réaffiche ; aucune erreur JavaScript (" + Q.erreurs.length + ")");
  } catch (e) { ok(false, "exception (localStorage) : " + (e && e.stack || e)); }

  ok(A.erreurs.length === 0, "aucune erreur JavaScript sur toute la durée du test principal (" + A.erreurs.length + ")" + (A.erreurs.length ? " : " + A.erreurs.slice(0, 3).join(" | ") : ""));
  process.exit();
})();
