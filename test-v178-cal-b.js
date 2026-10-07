// v178-CALB — A10 affichage : blocs côte à côte au calendrier, demi-piste quand il reste une place, double-clic pour le 2e
//   rendez-vous, surcharge signalée (⚠️ d'entête, confirm au dépôt), dépôt à la bonne heure (data-hdeb), calVoies pure.
//   Mise en page réelle : ce test se lance dans Chromium (iframe de 1280 × 800 que le test redimensionne à 390 et 768 px).
// node outils-v178/run-in-chromium.js test-v178-cal-b.js ./index.html     (MTR_FAKE_NOW="2026-10-07T10:00:00-04:00" PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers)
const L = require("./outils-v178/test-lib-v178.js");
const { ok, cp, dodo } = L;
const LUN = "2026-10-19", MAR = "2026-10-20", MER = "2026-10-21", JEU = "2026-10-22", VEN = "2026-10-23";   // semaine sans férié
const SEMAINE = [LUN, MAR, MER, JEU, VEN];
// vendredi 8-12 : la grille de la semaine part de 8 h (le lundi n'ouvre qu'à 9 h) → le bogue du +1 h au dépôt
const RDV = { horaire: { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null }, tampon: 15, diner: { actif: true, debut: 12, duree: 60 } };
const J = { nom: "Jason", role: "admin", actif: true }, G = { nom: "Gwendal", role: "technicien", actif: true };
const bon = (id, iso, heure, o) => Object.assign({ id, numeroBT: "BT-" + id, nom: "Spark", client: "Client " + id, statut: "avenir", echeance: iso, heure, dureeEstimee: 60, technicien: "", pieces: [] }, o || {});
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const proche = (a, b, tol = 1.6) => Math.abs(a - b) <= tol;

(async () => {
  const S = L.creerSupabase({});
  const A = await L.chargerApp({ sb: S.sb });
  const w = A.w, doc = w.document;
  const cadre = A.dom.frame;                                  // iframe du lanceur Chromium (absent sous jsdom)
  const taille = async (largeur) => { if (cadre) { cadre.style.width = largeur + "px"; await dodo(120); } };
  let retenusDuJour = {};
  const monter = (o = {}) => {
    A.set("rdvConfig", cp(RDV)); A.set("EMPLOYES", cp(o.employes || [J, G])); A.set("dispoOverride", cp(o.dispo || {}));
    A.set("machines", cp(o.machines || [])); A.set("soumissions", []);
    retenusDuJour = o.retenus || {};
    w.__demCreneauxJour = (iso) => (retenusDuJour[iso] || []);
    w.ouvrirCalendrier(); A.set("calAncre", new Date(2026, 9, 21, 12)); w.calVue(o.vue || "travail");
  };
  const piste = (iso) => A.$$("#cal-corps .cal-sem-piste").find(p => (p.getAttribute("ondrop") || "").includes("'" + iso + "'"));
  const blocs = (iso) => [...piste(iso).querySelectorAll(".cal-jbloc")];
  const entete = (iso) => A.$$("#cal-corps .cal-sem-entete")[SEMAINE.indexOf(iso)];
  const tag = (iso) => entete(iso).querySelector(".cal-dispo-tag");
  const R = (el) => el.getBoundingClientRect();
  const grille = () => A.$("#cal-corps .cal-sem-grille");
  const colJour = (nom) => A.$$("#cal-corps .cal-jour-col-tech").find(c => c.querySelector(".cal-jour-tech-entete").textContent.includes(nom));
  const mach = (id) => A.get("machines").find(x => x.id === id);
  const deposer = (colonne, pisteEl, id, y) => {
    const r = R(pisteEl), dt = new w.DataTransfer(); dt.setData("text/plain", id);
    colonne.dispatchEvent(new w.DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: r.top + y }));
  };
  const dbl = (cible, pisteEl, hDeb, heureDec) => {
    const r = R(pisteEl);
    cible.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: r.left + r.width * 0.75, clientY: r.top + (heureDec - hDeb) * 60 + 3 }));
  };
  const sec = (nom, f) => f().catch((e) => ok(false, nom + " : exception " + (e && e.message)));
  const rouge = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c || ""); return !!m && +m[1] >= 150 && +m[2] <= 100 && +m[3] <= 100; };   // #B02B2B (liseré) ou var(--danger) #B3261E
  L.connecter(A, "Jason", [J, G]); A.$("#ecran-connexion").classList.remove("ouvert");   // session ouverte : l'écran de connexion ne recouvre plus rien
  { const st = doc.createElement("style"); st.textContent = ".rap-voile, .voile-aviser { display: none !important; }"; doc.head.appendChild(st); }   // la fenêtre « SMS de confirmation » des bons nouveaux ne doit pas recouvrir le calendrier

  // ══════ 0. Présence ══════
  ok(typeof w.calVoies === "function" && typeof w.rdvAvertirSurcharge === "function" && !!doc.getElementById("v178-CALB"), "calVoies et rdvAvertirSurcharge présentes ; bloc <style> / <script id=v178-CALB> en place");

  // ══════ 1. calVoies : pure, déterministe ══════
  await sec("calVoies", async () => {
    const V = (j, n, p) => w.calVoies(j, n, p);
    const j = (d, f) => ({ debut: d, fin: f });
    ok(eq(V([j(9, 10), j(9, 10)], 2, 0), [{ voie: 0, k: 2 }, { voie: 1, k: 2 }]), "2 rendez-vous simultanés : 2 voies (0 et 1), k = 2");
    ok(eq(V([j(9, 10), j(9, 10), j(9.5, 10.5)], 2, 0).map(x => x.k), [3, 3, 3]), "3 simultanés : k = 3 pour toute la grappe");
    ok(eq(V([j(9, 10)], 1, 1), [{ voie: 0, k: 1 }]), "1 seul rendez-vous, 1 technicien : pleine largeur (k = 1) même s'il reste une place");
    ok(eq(V([j(9, 10)], 2, 1), [{ voie: 0, k: 2 }]), "1 seul, 2 techniciens, 1 place restante : demi-piste (k = 2, voie 0)");
    ok(eq(V([j(9, 10)], 2, 0), [{ voie: 0, k: 1 }]) && eq(V([j(9, 10)], 2), [{ voie: 0, k: 1 }]), "1 seul, 2 techniciens, plus de place (ou places non fournies) : pleine largeur");
    ok(eq(V([j(9, 10)], 3, 2), [{ voie: 0, k: 2 }]), "3 techniciens : k = max(1, min(2, 3)) = 2 (pas 3)");
    ok(eq(V([j(9, 10), j(10, 11)], 1, 0), [{ voie: 0, k: 1 }, { voie: 0, k: 1 }]), "2 consécutifs (le 2e part à la fin du 1er) : deux grappes, pleine largeur chacun");
    ok(eq(V([j(9, 10), j(9.5, 10.5), j(10, 11)], 0, 0), [{ voie: 0, k: 2 }, { voie: 1, k: 2 }, { voie: 0, k: 2 }]), "chaîne A 9-10, B 9:30-10:30, C 10-11 : une grappe de 2 voies, C reprend la voie 0");
    const appels = [];
    V([j(9, 10), j(9.5, 10.5), j(13, 14)], 2, (d, f) => { appels.push([d, f]); return 1; });
    ok(eq(appels, [[13, 14]]), "placesRestantes(debut, fin) n'est demandée que pour une grappe qui n'a pas déjà 2 voies, avec sa plage (" + JSON.stringify(appels) + ")");
    const appels2 = [];
    ok(eq(V([j(9, 10), j(10, 11)], 2, (d, f) => { appels2.push([d, f]); return 1; }), [{ voie: 0, k: 2 }, { voie: 0, k: 2 }]) && eq(appels2, [[9, 10], [10, 11]]),
       "2 consécutifs, 2 techniciens, une place : chaque grappe est jugée séparément (demi-piste chacun ; plages " + JSON.stringify(appels2) + ")");
    ok(eq(V([j(9, 10)], 2, () => { throw new Error("x"); }), [{ voie: 0, k: 1 }]), "placesRestantes qui lève une erreur : pleine largeur, pas d'exception");
    ok(eq(V([{ heure: "09:00", dureeEstimee: 60 }, { heure: "09:30", dureeEstimee: 15 }, { heure: "11:00" }], 0, 0), [{ voie: 0, k: 2 }, { voie: 1, k: 2 }, { voie: 0, k: 1 }]), "accepte aussi { heure, dureeEstimee } (minutes ; 60 par défaut)");
    ok(eq(V([], 2, 1), []) && eq(V(null, 2, 1), []), "liste vide ou absente : []");
    // déterministe, sans effet de bord : machines et jobs intacts
    A.set("rdvConfig", cp(RDV)); A.set("EMPLOYES", cp([J, G]));
    const ms = [bon("a", MAR, "09:00"), bon("b", MAR, "09:00"), bon("c", MAR, "09:30", { dureeEstimee: 90 })];
    A.set("machines", cp(ms));
    const avant = JSON.stringify(A.get("machines")), jobs = A.get("machines").map(m => ({ heure: m.heure, dureeEstimee: m.dureeEstimee, id: m.id })), jobsAvant = JSON.stringify(jobs);
    const r1 = V(jobs, 2, 1), r2 = V(jobs, 2, 1);
    ok(JSON.stringify(r1) === JSON.stringify(r2) && JSON.stringify(A.get("machines")) === avant && JSON.stringify(jobs) === jobsAvant, "calVoies deux fois = même résultat ; machines et jobs non mutés");
    ok(eq(r1.map(x => x.voie), [0, 1, 2]), "(a 9-10, b 9-10, c 9:30-11 : trois voies)");
  });

  // ══════ 2. Semaine : côte à côte ══════
  await taille(1280);
  await sec("Semaine côte à côte", async () => {
    monter({ machines: [bon("a", MAR, "09:00", { technicien: "Jason" }), bon("b", MAR, "09:00", { technicien: "Gwendal" }), bon("s", MER, "09:00")] });
    let p = piste(MAR), bs = blocs(MAR), P = R(p).width;
    ok(bs.length === 2 && R(bs[0]).left !== R(bs[1]).left && (bs[0].getAttribute("style") || "").includes("left") && (bs[1].getAttribute("style") || "").includes("left"),
       "2 bons à 9:00, 2 techniciens : deux .cal-jbloc de left différents (left inline par voie)");
    ok(proche(R(bs[0]).width, (P - 8) / 2) && proche(R(bs[1]).width, (P - 8) / 2) && R(bs[0]).right <= R(bs[1]).left + 0.5, "… chacun d'environ la moitié de la piste, sans se chevaucher (" + R(bs[0]).width.toFixed(1) + " + " + R(bs[1]).width.toFixed(1) + " sur " + P.toFixed(1) + ")");
    ok(bs[0].dataset.k === "2" && bs[0].dataset.voie === "0" && bs[1].dataset.voie === "1", "data-voie / data-k posés (0 et 1 sur 2)");
    ok(proche(R(bs[0]).top, R(bs[1]).top, 0.5), "… à la même hauteur (même heure)");
    // 1 bon, 2 techniciens, une place : demi-piste, l'autre moitié est libre
    let pm = piste(MER), bm = blocs(MER)[0], Pm = R(pm).width;
    ok(blocs(MER).length === 1 && proche(R(bm).width, (Pm - 8) / 2) && bm.dataset.k === "2", "1 bon à 9:00, 2 techniciens, une place : demi-piste (" + R(bm).width.toFixed(1) + " sur " + Pm.toFixed(1) + ")");
    const libre = w.document.elementFromPoint(R(pm).left + R(pm).width * 0.75, R(bm).top + 10);
    ok(libre && libre.closest(".cal-sem-piste") === pm && !libre.closest(".cal-jbloc"), "… la moitié droite est vraiment libre (le point visé est la piste, pas un bloc)");
    // 1 bon, 1 seul technicien : pleine largeur, rendu v177
    monter({ employes: [J], machines: [bon("s", MER, "09:00")] });
    pm = piste(MER); bm = blocs(MER)[0]; Pm = R(pm).width;
    ok(proche(R(bm).width, Pm - 6) && !/(^|;)\s*(left|width)\s*:/.test(bm.getAttribute("style")) && bm.dataset.k === undefined, "1 bon, 1 technicien : pleine largeur, ni left ni width inline (rendu identique à la v177)");
    // 2 techniciens mais une plage couverte par un seul : plus de place → pleine largeur
    monter({ machines: [bon("s", MER, "09:00")], dispo: { [MER]: { Gwendal: [13, 17] } } });
    bm = blocs(MER)[0];
    ok(proche(R(bm).width, R(piste(MER)).width - 6), "2 techniciens mais Gwendal n'arrive qu'à 13 h : à 9:00 il ne reste pas de place, le bloc garde toute la largeur");
    // 1 bon + 1 créneau retenu à 9:00 : côte à côte
    monter({ machines: [bon("s", MER, "09:00")], retenus: { [MER]: [{ heure: "09:00", duree: 60, client: "Retenu Rita", min: 20 }] } });
    bs = blocs(MER);
    const ret = bs.find(b => b.classList.contains("retenu")), reel = bs.find(b => !b.classList.contains("retenu"));
    ok(bs.length === 2 && ret && reel && R(ret).left !== R(reel).left && R(reel).right <= R(ret).left + 0.5 || (ret && R(ret).right <= R(reel).left + 0.5), "1 bon + 1 créneau retenu à 9:00 : deux éléments côte à côte (le retenu n'est plus caché sous le bon)");
    ok(ret && proche(R(ret).width, (R(piste(MER)).width - 8) / 2), "… chacun la moitié de la piste");
    // 2 consécutifs, 1 technicien : pleine largeur
    monter({ employes: [J], machines: [bon("a", MAR, "09:00"), bon("b", MAR, "10:00")] });
    bs = blocs(MAR);
    ok(bs.length === 2 && bs.every(b => proche(R(b).width, R(piste(MAR)).width - 6)), "2 rendez-vous consécutifs (9-10, 10-11), 1 technicien : chacun pleine largeur");
    // un 3e rendez-vous qui chevauche partiellement
    monter({ employes: [J], machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:30", { dureeEstimee: 90 })] });
    bs = blocs(MAR);
    ok(bs.length === 2 && R(bs[0]).left !== R(bs[1]).left && proche(R(bs[0]).width, (R(piste(MAR)).width - 8) / 2), "chevauchement partiel (9-10 et 9:30-11) : côte à côte même avec 1 technicien");
  });

  // ══════ 3. Entête : ⚠️ seulement si simultanés > max(N, 1) ══════
  await sec("entête ⚠️", async () => {
    monter({ machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:00"), bon("c", MAR, "09:30")] });
    ok(/⚠️/.test(tag(MAR).textContent) && /👷 2/.test(tag(MAR).textContent) && tag(MAR).classList.contains("surcharge") && rouge(w.getComputedStyle(tag(MAR)).color),
       "3 simultanés pour 2 techniciens : entête « " + tag(MAR).textContent.trim() + " » rouge avec ⚠️");
    ok(/3 rendez-vous/.test(tag(MAR).title), "… l'info-bulle dit combien (« " + tag(MAR).title + " »)");
    ok(!/⚠️/.test(tag(LUN).textContent) && /👷 2/.test(tag(LUN).textContent), "un jour sans rendez-vous : pastille 👷 2 inchangée, pas de ⚠️");
    monter({ machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:00")] });
    ok(!/⚠️/.test(tag(MAR).textContent), "2 simultanés pour 2 techniciens : pas de ⚠️ (limite : simultanés > N)");
    monter({ employes: [J], machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:00")] });
    ok(/⚠️/.test(tag(MAR).textContent) && /👷 1/.test(tag(MAR).textContent), "2 simultanés pour 1 technicien : ⚠️");
    monter({ machines: [bon("a", MAR, "09:00"), bon("b", MAR, "10:00"), bon("c", MAR, "11:00")] });
    ok(!/⚠️/.test(tag(MAR).textContent), "3 rendez-vous consécutifs : aucun ⚠️");
    monter({ machines: [bon("a", MAR, "09:00")], dispo: { [MAR]: { Jason: false, Gwendal: false } } });
    ok(!/⚠️/.test(tag(MAR).textContent) && /👷 0/.test(tag(MAR).textContent) && tag(MAR).classList.contains("zero"), "un seul rendez-vous un jour sans technicien : « 👷 0 » existant, jamais ⚠️ (« " + tag(MAR).textContent.trim() + " »)");
    monter({ machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:00")], retenus: { [MAR]: [{ heure: "09:00", duree: 60, client: "Retenu", min: 5 }] } });
    ok(!/⚠️/.test(tag(MAR).textContent) && blocs(MAR).length === 3, "un créneau retenu (proposition de 1 h à un client) ne déclenche pas ⚠️ ; il a sa voie (3 voies)");
  });

  // ══════ 4. Largeur minimale de la grille (pixels) et défilement horizontal ══════
  await sec("min-width", async () => {
    monter({});
    ok(parseFloat(grille().style.minWidth) === 48 + 5 * 130, "semaine vide : min-width = 48 + 5 × 130 = " + (48 + 5 * 130) + " px (« " + grille().style.minWidth + " »)");
    monter({ vue: "semaine" });
    ok(parseFloat(grille().style.minWidth) === 48 + 7 * 130, "semaine complète : 48 + 7 × 130 = " + (48 + 7 * 130));
    monter({ machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:00")] });
    ok(parseFloat(grille().style.minWidth) === 48 + 4 * 130 + 144, "un jour à 2 voies : 48 + 4 × 130 + 2 × 72 = " + (48 + 4 * 130 + 144) + " (« " + grille().style.minWidth + " »)");
    monter({ machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:00"), bon("c", MAR, "09:00"), bon("d", JEU, "09:00")] });
    ok(parseFloat(grille().style.minWidth) === 48 + 3 * 130 + 216 + 144, "3 voies mardi, demi-piste jeudi : 48 + 3 × 130 + 216 + 144 = " + (48 + 3 * 130 + 216 + 144) + " (« " + grille().style.minWidth + " »)");
    ok(/minmax\(216px, 1fr\)/.test(grille().style.gridTemplateColumns), "colonne du jour à 3 voies : minmax(216px, 1fr)");
    monter({ employes: [J], machines: [bon("a", MAR, "09:00")] });
    ok(parseFloat(grille().style.minWidth) === 48 + 5 * 130, "1 technicien, 1 bon seul : toujours 130 px par jour");
  });

  // ══════ 5. Voies étroites (< 80 px) : classe etroit, mesurée ══════
  await sec("etroit", async () => {
    const trois = [bon("a", MAR, "09:00", { technicien: "Jason" }), bon("b", MAR, "09:00", { technicien: "Gwendal" }), bon("c", MAR, "09:00", { technicien: "Jason" }), bon("d", JEU, "09:00", { technicien: "Jason" })];
    await taille(1280); monter({ machines: trois });
    const largeur = (iso) => blocs(iso).map(b => R(b).width);
    ok(blocs(MAR).length === 3 && blocs(MAR).some(b => b.classList.contains("etroit")) && largeur(MAR).every(x => x < 80), "1280 px, 3 voies (" + largeur(MAR).map(x => x.toFixed(0)).join("/") + " px) : classe etroit");
    ok(blocs(JEU).length === 1 && !blocs(JEU)[0].classList.contains("etroit") && R(blocs(JEU)[0]).width >= 80, "1280 px, demi-piste (" + R(blocs(JEU)[0]).width.toFixed(0) + " px) : pas etroit, machine et technicien visibles");
    const b3 = blocs(MAR)[0];
    ok(w.getComputedStyle(b3.querySelector(".jb-tech") || b3.querySelector(".jb-sans-soum")).display === "none" || !b3.querySelector(".jb-tech, .jb-sans-soum"), "bloc etroit : la ligne 👷 / « sans soumission » est masquée");
    ok(blocs(JEU)[0].querySelector(".jb-tech") && w.getComputedStyle(blocs(JEU)[0].querySelector(".jb-tech")).display !== "none", "demi-piste large : la ligne 👷 reste");
    await taille(390); await dodo(250);
    ok(blocs(JEU)[0].classList.contains("etroit") && R(blocs(JEU)[0]).width < 80, "390 px, sans nouveau rendu (ResizeObserver) : la demi-piste devient etroit (" + R(blocs(JEU)[0]).width.toFixed(0) + " px)");
    await taille(1280); await dodo(250);
    ok(!blocs(JEU)[0].classList.contains("etroit"), "retour à 1280 px : etroit retiré");
  });

  // ══════ 6. Aucun défilement horizontal de la PAGE ; la grille défile ══════
  await sec("défilement", async () => {
    const charge = [bon("a", MAR, "09:00"), bon("b", MAR, "09:00"), bon("c", MAR, "09:00"), bon("d", MER, "09:00"), bon("e", JEU, "09:00"), bon("f", JEU, "09:00"), bon("g", VEN, "09:00")];
    for (const largeur of [390, 768, 1280]) {
      await taille(largeur);
      for (const vue of ["travail", "semaine", "jour", "mois"]) {
        monter({ machines: charge, vue });
        if (vue === "jour") A.set("calAncre", new Date(2026, 9, 20, 12)), w.calRendre();
        const page = w.document.documentElement.scrollWidth <= w.innerWidth;
        ok(page, largeur + " px, vue " + vue + " : la PAGE ne défile pas (scrollWidth " + w.document.documentElement.scrollWidth + " ≤ " + w.innerWidth + ")");
      }
    }
    await taille(390); monter({ machines: charge });
    const corps = A.$("#cal-corps");
    ok(corps.scrollWidth > corps.clientWidth + 2 && w.getComputedStyle(corps).overflowX === "auto" && grille().offsetWidth >= parseFloat(grille().style.minWidth) - 1,
       "390 px : c'est la grille (#cal-corps) qui défile (" + corps.scrollWidth + " > " + corps.clientWidth + "), largeur ≥ min-width " + grille().style.minWidth);
    await taille(1280); monter({ machines: charge, vue: "semaine" });
    ok(A.$("#cal-corps").scrollWidth <= A.$("#cal-corps").clientWidth + 1, "1280 px, semaine complète : assez large, rien ne défile");
    await taille(1280);
  });

  // ══════ 7. Vue Jour ══════
  await sec("Jour", async () => {
    await taille(1280);
    monter({ vue: "jour", machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:00")] }); A.set("calAncre", new Date(2026, 9, 20, 12)); w.calRendre();
    let col = colJour("Non assigné"), bs = [...col.querySelectorAll(".cal-jbloc")], pj = col.querySelector(".cal-jour-piste");
    ok(bs.length === 2 && R(bs[0]).left !== R(bs[1]).left && bs.every(b => proche(R(b).width, (R(pj).width - 2 - 8) / 2, 2)) && bs.every(b => b.dataset.k === "2"),
       "Jour : 2 non assignés simultanés → colonne « — » à 2 voies (" + bs.map(b => R(b).width.toFixed(0)).join("/") + " px)");
    ok(!bs.some(b => b.classList.contains("double-resa")), "… sans liseré rouge (rien n'est épinglé à un technicien)");
    // un bon par technicien à la même heure : aucune voie
    monter({ vue: "jour", machines: [bon("a", MAR, "09:00", { technicien: "Jason" }), bon("b", MAR, "09:00", { technicien: "Gwendal" })] }); A.set("calAncre", new Date(2026, 9, 20, 12)); w.calRendre();
    const jb = [...colJour("Jason").querySelectorAll(".cal-jbloc")], gb = [...colJour("Gwendal").querySelectorAll(".cal-jbloc")];
    ok(jb.length === 1 && gb.length === 1 && jb[0].dataset.k === undefined && gb[0].dataset.k === undefined && !jb[0].classList.contains("double-resa"),
       "Jour : un bon par technicien à la même heure → colonnes par technicien, pleine largeur, aucun liseré (la vue Jour garde ses colonnes)");
    ok(proche(R(jb[0]).width, R(colJour("Jason").querySelector(".cal-jour-piste")).width - 2 - 6, 2), "… (largeur du bloc = celle de la colonne)");
    // double réservation de Jason
    monter({ vue: "jour", machines: [bon("a", MAR, "09:00", { technicien: "Jason" }), bon("b", MAR, "09:00", { technicien: "Jason" }), bon("c", MAR, "13:00", { technicien: "Gwendal" })] }); A.set("calAncre", new Date(2026, 9, 20, 12)); w.calRendre();
    col = colJour("Jason"); bs = [...col.querySelectorAll(".cal-jbloc")]; pj = col.querySelector(".cal-jour-piste");
    ok(bs.length === 2 && R(bs[0]).left !== R(bs[1]).left && proche(R(bs[0]).width, (R(pj).width - 2 - 8) / 2, 2), "Jour : double réservation de Jason → 2 voies côte à côte");
    const rouges = bs.filter(b => b.classList.contains("double-resa"));
    ok(rouges.length === 1 && rouges[0].dataset.voie === "1" && rouge(w.getComputedStyle(rouges[0]).borderLeftColor) && !rouge(w.getComputedStyle(bs.find(b => b.dataset.voie === "0")).borderTopColor),
       "… liseré rouge sur le bloc de la 2e voie seulement");
    ok(/Double réservation/.test(rouges[0].title) && /Jason/.test(rouges[0].title), "… l'info-bulle explique (« " + rouges[0].title.split("\n").pop() + " »)");
    ok(colJour("Gwendal").querySelectorAll(".cal-jbloc").length === 1 && !colJour("Gwendal").querySelector(".double-resa"), "… Gwendal n'est pas touché");
    ok(col.style.minWidth === "150px" && !colJour("Gwendal").style.minWidth, "colonne à 2 voies : largeur minimale 150 px posée (max(150, 2 × 72)) ; une colonne à 1 voie garde celle du CSS (« " + col.style.minWidth + " »)");
  });

  // ══════ 8. Dépôt à la bonne heure (data-hdeb) ══════
  await sec("dépôt Semaine", async () => {
    await taille(1280);
    monter({ machines: [bon("x", MAR, "14:00", { technicien: "Jason" })] });
    const pl = piste(LUN);
    ok(pl.dataset.hdeb === "8" && piste(VEN).dataset.hdeb === "8", "data-hdeb de la piste = départ de la grille de la semaine (8 : le vendredi ouvre à 8 h) ; lundi ouvre à 9 h : « " + pl.dataset.hdeb + " »");
    const avantApp = S.appels.length;
    deposer(pl, pl, "x", (10 - 8) * 60 + 2);
    ok(mach("x").echeance === LUN && mach("x").heure === "10:00", "dépôt lundi à 10:00 (y = 122 px depuis le haut de la grille) : heure enregistrée « " + mach("x").heure + " » (avant : 11:00, +1 h)");
    ok(mach("x").technicien === "Jason" && A.confirmations.length === 0, "… le technicien est gardé, aucune confirmation (pas de surcharge)");
    const nouvelle = blocs(LUN)[0];
    ok(nouvelle && proche(R(nouvelle).top - R(piste(LUN)).top, 120, 1.5), "… et le bloc est redessiné à 10:00 (" + (nouvelle ? (R(nouvelle).top - R(piste(LUN)).top).toFixed(0) : "?") + " px sous le haut de la grille)");
    deposer(piste(MER), piste(MER), "x", (8.5 - 8) * 60 + 20);   // 8:45 un mercredi (la clinique ouvre à 9 h)
    ok(mach("x").echeance === MER && mach("x").heure === "08:45", "dépôt mercredi à 8:45 : « " + mach("x").heure + " » (avant l'ouverture : permis, jamais bloqué)");
    void avantApp;
  });
  await sec("dépôt Jour", async () => {
    // la plage du jour s'élargit (bon à 7:30) : la grille part de 7 h, pas de 9 h
    monter({ vue: "jour", machines: [bon("t", LUN, "07:30", { technicien: "Jason" }), bon("y", LUN, "14:00", { technicien: "Gwendal" })] }); A.set("calAncre", new Date(2026, 9, 19, 12)); w.calRendre();
    const col = colJour("Gwendal"), pj = col.querySelector(".cal-jour-piste");
    ok(pj.dataset.hdeb === "7", "Jour : data-hdeb = 7 (la plage s'élargit au bon de 7:30) : « " + pj.dataset.hdeb + " »");
    deposer(col, pj, "y", (10 - 7) * 60 + 2);
    ok(mach("y").heure === "10:00" && mach("y").technicien === "Gwendal" && mach("y").echeance === LUN, "dépôt à 10:00 dans la colonne de Gwendal : « " + mach("y").heure + " » (avant : 12:00)");
    deposer(colJour("Jason"), colJour("Jason").querySelector(".cal-jour-piste"), "y", (15 - 7) * 60 + 2);
    ok(mach("y").technicien === "Jason" && mach("y").heure === "15:00", "dépôt à 15:00 dans la colonne de Jason : le bon passe à Jason à 15:00");
  });

  // ══════ 9. Surcharge : confirm non bloquant ══════
  await sec("surcharge", async () => {
    await taille(1280);
    const sc = [bon("a", MER, "09:00"), bon("b", MER, "09:00"), bon("x", JEU, "14:00", { technicien: "Jason" })];
    monter({ machines: sc });
    A.confirmations.length = 0; A.reponseConfirm = false;
    let ecrits = S.appels.length;
    deposer(piste(MER), piste(MER), "x", (9 - 8) * 60 + 3);
    ok(A.confirmations.length === 1 && A.confirmations[0] === "⚠️ À 09:00 il y aurait 3 rendez-vous pour 2 technicien(s). Placer quand même ?", "dépôt à 9:00 sur 2 rendez-vous / 2 techniciens : confirm « " + A.confirmations[0] + " »");
    ok(mach("x").echeance === JEU && mach("x").heure === "14:00" && S.appels.length === ecrits, "refus : aucun déplacement (jeudi 14:00 inchangé) et rien d'écrit");
    A.reponseConfirm = true; A.confirmations.length = 0;
    deposer(piste(MER), piste(MER), "x", (9 - 8) * 60 + 3);
    ok(A.confirmations.length === 1 && mach("x").echeance === MER && mach("x").heure === "09:00", "accepter : « Placer quand même » → le bon est placé à 9:00 le mercredi (jamais bloqué)");
    ok(/⚠️/.test(tag(MER).textContent), "… et l'entête du mercredi passe au rouge ⚠️ (3 simultanés pour 2 techniciens)");
    // pas de surcharge : aucune question
    A.confirmations.length = 0;
    deposer(piste(VEN), piste(VEN), "x", (10 - 8) * 60 + 3);
    ok(A.confirmations.length === 0 && mach("x").echeance === VEN && mach("x").heure === "10:00", "dépôt vendredi 10:00 (2 techniciens libres) : aucune question");
    // déposer un bon sur sa propre place : saufId, pas de surcharge avec lui-même
    monter({ employes: [J], machines: [bon("u", MAR, "09:00")] });
    A.confirmations.length = 0;
    deposer(piste(MAR), piste(MAR), "u", (9 - 8) * 60 + 3);
    ok(A.confirmations.length === 0 && mach("u").heure === "09:00", "1 technicien : redéposer un bon à sa propre heure ne se compte pas deux fois (saufId)");
    // 1 technicien : un 2e rendez-vous à la même heure → confirm « 2 rendez-vous pour 1 technicien(s) »
    monter({ employes: [J], machines: [bon("u", MAR, "09:00"), bon("v", MER, "11:00")] });
    A.confirmations.length = 0; A.reponseConfirm = false;
    deposer(piste(MAR), piste(MAR), "v", (9.25 - 8) * 60 + 2);
    ok(A.confirmations.length === 1 && /9:15|09:15/.test(A.confirmations[0]) && /2 rendez-vous pour 1 technicien/.test(A.confirmations[0]) && mach("v").echeance === MER, "1 technicien, 9:15 pendant le bon de 9:00 : « " + (A.confirmations[0] || "") + " » ; refus : le bon reste au mercredi");
    // un créneau retenu compte dans la capacité
    monter({ machines: [bon("a", MER, "09:00"), bon("x", JEU, "14:00")], retenus: { [MER]: [{ heure: "09:00", duree: 60, client: "Retenu", min: 10 }] } });
    A.confirmations.length = 0; A.reponseConfirm = false;
    deposer(piste(MER), piste(MER), "x", (9 - 8) * 60 + 3);
    ok(A.confirmations.length === 1 && /3 rendez-vous pour 2/.test(A.confirmations[0]), "1 bon + 1 créneau retenu à 9:00 : déposer un 3e demande confirmation (« " + (A.confirmations[0] || "") + " »)");
    // Jour : même question
    monter({ vue: "jour", machines: [bon("a", LUN, "09:00", { technicien: "Jason" }), bon("b", LUN, "09:00", { technicien: "Gwendal" }), bon("x", LUN, "14:00", { technicien: "Gwendal" })] }); A.set("calAncre", new Date(2026, 9, 19, 12)); w.calRendre();
    A.confirmations.length = 0; A.reponseConfirm = false; ecrits = S.appels.length;
    const cg = colJour("Gwendal"), pg = cg.querySelector(".cal-jour-piste"), hd = Number(pg.dataset.hdeb);
    deposer(cg, pg, "x", (9 - hd) * 60 + 3);
    ok(A.confirmations.length === 1 && /À 09:00 il y aurait 3 rendez-vous pour 2/.test(A.confirmations[0]) && mach("x").heure === "14:00" && S.appels.length === ecrits, "Jour : 3e rendez-vous à 9:00 → confirm ; refus : heure et technicien inchangés");
    A.reponseConfirm = true;
    deposer(cg, pg, "x", (9 - hd) * 60 + 3);
    ok(mach("x").heure === "09:00" && mach("x").technicien === "Gwendal", "Jour : accepter → placé à 9:00 chez Gwendal");
    A.reponseConfirm = true;
  });

  // ══════ 10. Double-clic ══════
  await sec("double-clic", async () => {
    await taille(1280);
    const appels = [], vrai = w.calNouveauRdv;
    w.calNouveauRdv = (iso) => appels.push(iso);
    monter({ machines: [bon("a", MAR, "09:00")] });
    let pm = piste(MAR), hd = Number(pm.dataset.hdeb), bm = blocs(MAR)[0];
    const demi = w.document.elementFromPoint(R(pm).left + R(pm).width * 0.75, R(pm).top + (9 - hd) * 60 + 10);
    dbl(demi, pm, hd, 9);
    ok(appels.length === 1 && appels[0] === MAR, "2 techniciens, 1 bon à 9:00 : double-clic à 9:00 sur la demi-piste libre ouvre un 2e rendez-vous (calNouveauRdv(" + appels + "))");
    appels.length = 0;
    dbl(bm, pm, hd, 9);
    ok(appels.length === 1, "… même sur le bloc existant, tant qu'il reste une place à cette heure");
    appels.length = 0;
    dbl(pm, pm, hd, 14);
    ok(appels.length === 1, "double-clic sur une plage vide (14:00) : ouvre toujours un rendez-vous");
    // 1 technicien : le bloc ne réagit pas
    monter({ employes: [J], machines: [bon("a", MAR, "09:00")] });
    pm = piste(MAR); hd = Number(pm.dataset.hdeb); bm = blocs(MAR)[0]; appels.length = 0;
    dbl(bm, pm, hd, 9);
    ok(appels.length === 0, "1 seul technicien : le double-clic sur le bloc ne fait rien (le bloc couvre toute la piste)");
    dbl(pm, pm, hd, 14);
    ok(appels.length === 1, "… mais une plage vide ouvre toujours un rendez-vous");
    // 2 techniciens, 2 bons : plus de place
    monter({ machines: [bon("a", MAR, "09:00"), bon("b", MAR, "09:00")] });
    pm = piste(MAR); hd = Number(pm.dataset.hdeb); appels.length = 0;
    blocs(MAR).forEach(b => dbl(b, pm, hd, 9));
    ok(appels.length === 0, "2 techniciens, 2 bons à 9:00 : plus de place, le double-clic sur un bloc ne fait rien");
    // créneau retenu : compte comme un rendez-vous
    monter({ machines: [bon("a", MAR, "09:00")], retenus: { [MAR]: [{ heure: "09:00", duree: 60, client: "Retenu", min: 10 }] } });
    pm = piste(MAR); hd = Number(pm.dataset.hdeb); appels.length = 0;
    blocs(MAR).forEach(b => dbl(b, pm, hd, 9));
    ok(appels.length === 0, "1 bon + 1 créneau retenu à 9:00, 2 techniciens : plus de place, rien ne s'ouvre");
    // à 9:45, dans le même bloc : une place existe aussi (1 h glissante)
    monter({ machines: [bon("a", MAR, "09:00")] });
    pm = piste(MAR); hd = Number(pm.dataset.hdeb); bm = blocs(MAR)[0]; appels.length = 0;
    dbl(bm, pm, hd, 9.75);
    ok(appels.length === 1, "double-clic à 9:45 sur le bloc de 9:00 (2 techniciens) : ouvre un rendez-vous");
    w.calNouveauRdv = vrai;
    // la vraie fonction : formulaire pré-daté et pré-minuté
    monter({ machines: [bon("a", MAR, "09:00")] });
    pm = piste(MAR); hd = Number(pm.dataset.hdeb);
    dbl(w.document.elementFromPoint(R(pm).left + R(pm).width * 0.75, R(pm).top + (9 - hd) * 60 + 10), pm, hd, 9);
    await dodo(120);
    ok(A.$("#f-echeance").value === MAR && A.$("#f-heure").value === "09:00", "le formulaire d'un nouveau rendez-vous s'ouvre sur " + A.$("#f-echeance").value + " à " + A.$("#f-heure").value);
    try { w.fermerFormulaire && w.fermerFormulaire(); } catch (_) {}
  });

  // ══════ 11. Texte d'aide ══════
  await sec("aide", async () => {
    monter({});
    ok(/rendez-vous simultanés s'affichent côte à côte/.test(A.txt("#cal-corps .cal-info-avenir")) && !/une voie par technicien/i.test(A.txt("#cal-corps .cal-info-avenir")), "texte d'aide : « les rendez-vous simultanés s'affichent côte à côte »");
    w.fermerCalendrier();
  });

  ok(A.erreurs.length === 0, "aucune erreur JavaScript (" + A.erreurs.length + ")" + (A.erreurs.length ? " : " + A.erreurs.slice(0, 3).join(" | ") : ""));
  process.exit();
})();
