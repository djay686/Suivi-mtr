// test-v178-son.js — lot SON (A11) : sons d'alerte plus forts et distincts, réglables.
// Lancer : PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node outils-v178/run-in-chromium.js test-v178-son.js ./index.html
// Faux AudioContext détaillé (notes, gains, resume() comptés) installé par-dessus celui du socle ; la mesure RMS, elle, utilise un
// vrai OfflineAudioContext de Chromium (le vrai jouerSon() de l'app y est rendu).
const L = require("./outils-v178/test-lib-v178.js");
const fs = require("fs");
const { ok, dodo, attendre } = L;

// ── faux AudioContext : un journal J par instance d'app ──
function journal(opts) { return Object.assign({ ctxs: [], osc: [], resumes: 0, etatInitial: "running", autoriser: true, constructeurLeve: false }, opts || {}); }
function installerFauxAudio(w, J) {
  w.AudioContext = w.webkitAudioContext = class {
    constructor() {
      if (J.constructeurLeve) throw new Error("AudioContext interdit");
      J.ctxs.push(this); this.state = J.etatInitial; this.currentTime = 0; this.destination = { nom: "sortie" }; this.gains = [];
    }
    resume() { J.resumes++; if (J.autoriser) this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    createOscillator() {
      const o = { type: "", f: 0, debut: null, fin: null, dest: null, connect(x) { o.dest = x; return x; }, start(t) { o.debut = t; }, stop(t) { o.fin = t; } };
      Object.defineProperty(o, "frequency", { value: { set value(v) { o.f = v; }, get value() { return o.f; } } });
      J.osc.push(o); return o;
    }
    createGain() {
      const g = { ev: [], dest: null, connect(x) { g.dest = x; return x; },
        gain: { value: 1, setValueAtTime(v, t) { g.ev.push(["set", v, t]); }, exponentialRampToValueAtTime(v, t) { g.ev.push(["exp", v, t]); } } };
      this.gains.push(g); return g;
    }
  };
}
// serviceWorker : "ready" ne se résout jamais (pas de /sw.js) ou se résout (pour tester pushRendre)
function installerSW(w, resolu) {
  const reg = { pushManager: { getSubscription: async () => null } };
  const sw = { ready: resolu ? Promise.resolve(reg) : new Promise(() => {}), register: resolu ? async () => reg : () => new Promise(() => {}), addEventListener() {} };
  try { Object.defineProperty(w.navigator, "serviceWorker", { configurable: true, value: sw }); } catch (_) {}
  if (!w.PushManager) w.PushManager = function PushManager() {};
}
const BDD = () => ({ tableau: [{ id: 1, donnees: [] }, { id: 4, donnees: L.cp(L.EMP) }], communications: [], demandes_service: [] });
const RECEPTION = { nom: "Marie", nomFamille: "Tremblay", role: "reception", actif: true };

async function nouvelleApp(opts) {
  opts = opts || {};
  const J = journal(opts.J);
  const S = L.creerSupabase(BDD());
  const A = await L.chargerApp({ sb: S.sb, avant: (w) => { installerFauxAudio(w, J); installerSW(w, !!opts.swResolu); if (opts.audioSession) { try { Object.defineProperty(w.navigator, "audioSession", { configurable: true, value: opts.audioSession }); } catch (_) {} } } });
  try { A.w.localStorage.removeItem("mtr-sons-v1"); } catch (_) {}
  return { A, J, S };
}
const evt = (A, nom, cible) => (cible || A.w.document).dispatchEvent(new A.w.Event(nom, { bubbles: true }));
const jouer = (A, t, o) => { try { return A.w.jouerSon(t, o); } catch (e) { return "EXC " + e.message; } };
const prefs = (A, p) => A.w.localStorage.setItem("mtr-sons-v1", typeof p === "string" ? p : JSON.stringify(p));
const maitre = (J) => { const c = J.ctxs[J.ctxs.length - 1]; return c && c.gains.find((g) => g.dest === c.destination); };
const pic = (o) => { const e = o.dest && o.dest.ev.find((x) => x[0] === "exp" && x[1] > 0.001); return e ? e[1] : null; };
const lire = (A, expr) => { try { return A.w.eval(expr); } catch (_) { return undefined; } };

(async () => {
  // ═══ 1. Table SONS : 9 types, motifs distincts, plage 1000-2000 Hz, gain ≤ 0,9, notes sans chevauchement ═══
  const { A, J, S } = await nouvelleApp();
  const TYPES = ["chat", "demande", "sms", "appel", "appelEntrant", "rappel", "piece", "acceptation", "session"];
  const SONS = lire(A, "JSON.parse(JSON.stringify(SONS))") || {};
  ok(TYPES.every((t) => SONS[t] && Array.isArray(SONS[t].notes) && SONS[t].notes.length > 0) && Object.keys(SONS).length === 9, "la table SONS a les 9 types (chat, demande, sms, appel, appelEntrant, rappel, piece, acceptation, session)");
  const sig = (t) => JSON.stringify([SONS[t].onde, SONS[t].notes]);
  const doublons = []; TYPES.forEach((a, i) => TYPES.slice(i + 1).forEach((b) => { if (SONS[a] && SONS[b] && sig(a) === sig(b)) doublons.push(a + "=" + b); }));
  ok(doublons.length === 0 && TYPES.every((t) => SONS[t]), "les 9 motifs sont deux à deux différents (onde + notes)" + (doublons.length ? " : " + doublons : ""));
  const freqsSeules = (t) => JSON.stringify(SONS[t].notes.map((n) => n[0]));
  const memeFreqs = []; TYPES.forEach((a, i) => TYPES.slice(i + 1).forEach((b) => { if (SONS[a] && SONS[b] && freqsSeules(a) === freqsSeules(b)) memeFreqs.push(a + "=" + b); }));
  ok(memeFreqs.length === 0, "… et aussi différents par les seules fréquences (pas le même chant à un autre rythme)" + (memeFreqs.length ? " : " + memeFreqs : ""));
  ok(TYPES.every((t) => SONS[t] && SONS[t].notes.every((n) => n[0] >= 1000 && n[0] <= 2000)), "toutes les notes sont entre 1000 et 2000 Hz");
  ok(TYPES.every((t) => SONS[t] && SONS[t].gain > 0 && SONS[t].gain <= 0.9), "gain de crête ≤ 0,9 pour chaque type (pas d'écrêtage à volume 100)");
  const seq = (t) => SONS[t] && SONS[t].notes.every((n, i, a) => i === 0 || n[1] >= a[i - 1][1] + a[i - 1][2] - 1e-9);
  ok(TYPES.every(seq), "dans chaque son, les notes se suivent sans chevauchement");
  ok(["demande", "sms", "appel", "appelEntrant"].every((t) => SONS[t] && /^(square|sawtooth)$/.test(SONS[t].onde)) && ["chat", "rappel", "piece", "acceptation", "session"].every((t) => SONS[t] && SONS[t].onde === "triangle"), "ondes carrée / dent de scie pour les alertes critiques, triangle pour les autres");

  // ═══ 2. iPad jamais touché : aucun contexte, aucune planification (pas de rafale au premier toucher) ═══
  L.connecter(A, "Jason");
  ok(lire(A, "sonCtx") === null && J.ctxs.length === 0, "au chargement : aucun AudioContext (il naît au premier geste)");
  TYPES.concat(TYPES).forEach((t) => jouer(A, t));
  ok(J.osc.length === 0 && jouer(A, "demande") === false, "avant tout geste : jouerSon retourne faux et ne planifie AUCUN oscillateur (pas de sons empilés)");

  // ═══ 3. Déblocage : écouteurs persistants sur click / touchend / pointerup / keydown / visibilitychange ═══
  J.etatInitial = "suspended"; J.autoriser = false;       // contexte qui reste suspendu : on compte les resume()
  evt(A, "click", A.w.document.body);
  ok(J.ctxs.length === 1 && J.resumes === 1, "un premier click crée le contexte et appelle resume() (créé : " + J.ctxs.length + ", resume : " + J.resumes + ")");
  evt(A, "click", A.w.document.body);
  ok(J.resumes === 2, "un 2e click rappelle resume() (écouteur persistant, pas {once:true}) : " + J.resumes);
  evt(A, "touchend", A.w.document.body);
  ok(J.resumes === 3, "touchend rappelle resume() : " + J.resumes);
  evt(A, "pointerup", A.w.document.body);
  ok(J.resumes === 4, "pointerup rappelle resume() : " + J.resumes);
  A.w.document.body.dispatchEvent(new A.w.KeyboardEvent("keydown", { key: "a", bubbles: true }));
  ok(J.resumes === 5, "keydown rappelle resume() : " + J.resumes);
  evt(A, "visibilitychange");
  ok(J.resumes === 6, "visibilitychange (retour d'arrière-plan, contexte « interrupted ») rappelle resume() : " + J.resumes);
  evt(A, "pointerdown", A.w.document.body); evt(A, "touchstart", A.w.document.body);
  ok(J.resumes === 6, "pointerdown / touchstart seuls ne comptent pas comme gestes de déblocage (WebKit les ignore) : " + J.resumes);
  ok(J.ctxs.length === 1, "toujours un seul AudioContext après tous ces gestes");
  TYPES.forEach((t) => jouer(A, t));
  ok(J.osc.length === 0 && TYPES.every((t) => jouer(A, t) === false), "contexte 'suspended' : aucun oscillateur planifié, jouerSon retourne faux pour les 9 types");
  J.ctxs[0].state = "interrupted";
  ok(jouer(A, "chat") === false && J.osc.length === 0, "contexte 'interrupted' (iOS, arrière-plan) : rien n'est planifié non plus");
  J.autoriser = true;
  evt(A, "click", A.w.document.body);
  ok(J.ctxs[0].state === "running", "le geste suivant relance le contexte (état : " + J.ctxs[0].state + ")");
  J.ctxs[0].state = "closed"; J.etatInitial = "running";
  evt(A, "click", A.w.document.body);
  ok(J.ctxs.length === 2 && lire(A, "sonCtx") === J.ctxs[1] && J.ctxs[1].state === "running", "un contexte fermé est remplacé par un neuf au geste suivant");
  ok(jouer(A, "rappel") === true && J.osc.length === SONS.rappel.notes.length && maitre(J) && maitre(J).dest === J.ctxs[1].destination, "… et le son passe par la chaîne du NOUVEAU contexte (gain maître → sortie)");
  J.osc.length = 0;

  // ═══ 4. Moteur : notes, ondes, gains, volume, muet, type inconnu, session ═══
  const resultats = {};
  for (const t of TYPES) {
    const avant = J.osc.length; const r = jouer(A, t); const os = J.osc.slice(avant); resultats[t] = os;
    ok(r === true && os.length === SONS[t].notes.length, t + " : jouerSon retourne vrai, " + os.length + " oscillateur(s) (attendu " + SONS[t].notes.length + ")");
  }
  ok(TYPES.every((t) => resultats[t].every((o, i) => o.type === SONS[t].onde && Math.round(o.f) === SONS[t].notes[i][0])), "chaque oscillateur a la bonne onde et la bonne fréquence");
  ok(TYPES.every((t) => resultats[t].every((o) => pic(o) !== null && pic(o) <= 0.9 + 1e-9 && pic(o) >= 0.5)), "volume de pointe de chaque note entre 0,5 et 0,9 (v177 : 0,25 / 0,3 / 0,14)");
  ok(TYPES.every((t) => resultats[t].every((o, i, a) => i === 0 || o.debut >= a[i - 1].fin - 0.02 - 1e-6)), "les oscillateurs planifiés ne se chevauchent pas (début de la note n+1 ≥ fin de la note n)");
  const sigsReelles = TYPES.map((t) => JSON.stringify(resultats[t].map((o) => [o.type, Math.round(o.f), +(o.debut - resultats[t][0].debut).toFixed(3), +(o.fin - o.debut).toFixed(3)])));
  ok(new Set(sigsReelles).size === 9, "ce qui est réellement planifié est différent pour les 9 types");
  J.osc.length = 0;

  prefs(A, { volume: 100, muet: false }); jouer(A, "chat");
  ok(maitre(J) && Math.abs(maitre(J).gain.value - 1) < 1e-9, "volume 100 → gain maître 1 (" + (maitre(J) && maitre(J).gain.value) + ")");
  prefs(A, { volume: 40, muet: false }); jouer(A, "chat");
  ok(Math.abs(maitre(J).gain.value - 0.4) < 1e-9, "volume 40 → gain maître 0,4 (" + maitre(J).gain.value + ")");
  prefs(A, { volume: 5, muet: false }); jouer(A, "chat");
  ok(Math.abs(maitre(J).gain.value - 0.2) < 1e-9, "volume 5 → plancher 0,2 (" + maitre(J).gain.value + ")");
  prefs(A, { volume: 900, muet: false }); jouer(A, "chat");
  ok(Math.abs(maitre(J).gain.value - 1) < 1e-9, "volume 900 → plafond 1");
  prefs(A, "{pas du json");
  ok(jouer(A, "chat") === true && Math.abs(maitre(J).gain.value - 1) < 1e-9 && lire(A, "sonPrefs().muet") === false, "préférences corrompues → défauts (volume 100, pas muet), sans exception");
  A.w.localStorage.removeItem("mtr-sons-v1");
  ok(lire(A, "sonPrefs().volume") === 100 && lire(A, "sonPrefs().muet") === false, "sans préférences : volume 100, pas muet");
  lire(A, "sonPrefsSauver({ volume: 55, muet: true })");
  const stocke = JSON.parse(A.w.localStorage.getItem("mtr-sons-v1") || "{}");
  ok(stocke.volume === 55 && stocke.muet === true, "sonPrefsSauver écrit {volume, muet} dans mtr-sons-v1 : " + JSON.stringify(stocke));
  J.osc.length = 0;

  // muet
  prefs(A, { volume: 100, muet: true });
  ok(jouer(A, "sms") === false && J.osc.length === 0, "muet : aucun oscillateur pour jouerSon('sms')");
  TYPES.forEach((t) => jouer(A, t));
  ok(J.osc.length === 0, "muet : aucun des 9 types ne sonne");
  ok(jouer(A, "sms", { test: true }) === true && J.osc.length === SONS.sms.notes.length, "muet : jouerSon('sms', {test:true}) joue quand même (" + J.osc.length + " oscillateurs)");
  J.osc.length = 0; prefs(A, { volume: 100, muet: false });

  // inconnu
  let exc = null; let rInc;
  try { rInc = [jouer(A, "zzz"), jouer(A), jouer(A, null), jouer(A, "constructor"), jouer(A, "__proto__"), jouer(A, "toString"), jouer(A, 42), jouer(A, "zzz", { test: true })]; } catch (e) { exc = e; }
  ok(!exc && rInc.every((x) => x === false) && J.osc.length === 0, "type inconnu / absent / piégé (constructor, __proto__) : faux, aucune exception, aucun son : " + JSON.stringify(rInc));

  // session
  const sess = lire(A, "sessionCourante"); A.set("sessionCourante", null);
  ok(jouer(A, "demande") === false && jouer(A, "chat") === false && J.osc.length === 0, "sans session (écran de connexion) : aucun son");
  ok(jouer(A, "demande", { test: true }) === true && J.osc.length > 0, "… sauf l'essai explicite {test:true}");
  J.osc.length = 0; A.set("sessionCourante", sess);

  // vibration
  A.vibrations.length = 0; jouer(A, "demande"); jouer(A, "chat");
  ok(A.vibrations.length === 2 && JSON.stringify(A.vibrations[0]) === "[200,100,200,100,200,100,400]" && JSON.stringify(A.vibrations[1]) === "[120,60,120]", "la vibration des téléphones suit : demande [200,100,…] et chat [120,60,120]");
  J.osc.length = 0;

  // ═══ 5. Enveloppes conservées ═══
  const n0 = J.ctxs.length;
  A.w.sonNotification();
  ok(J.osc.length === SONS.chat.notes.length && J.osc[0].type === "triangle", "sonNotification() reste définie et joue le son « chat »");
  J.osc.length = 0;
  A.w.__dem.sonnerie();
  ok(J.osc.length === SONS.demande.notes.length && J.osc[0].type === "sawtooth", "window.__dem.sonnerie / demSonnerie() reste définie et joue le son « demande »");
  J.osc.length = 0;
  A.w.sonAcceptation();
  ok(J.osc.length === SONS.acceptation.notes.length && J.ctxs.length === n0, "sonAcceptation() joue « acceptation » sans créer de nouvel AudioContext");
  J.osc.length = 0;

  // ═══ 6. Temps réel : demande (un seul son, ni bandeau ni répétition) ═══
  await attendre(() => S.canaux.some((c) => c.nom === "demandes-live") && S.canaux.some((c) => c.nom === "comm-live"), 6000);
  ok(S.canaux.some((c) => c.nom === "demandes-live") && S.canaux.some((c) => c.nom === "comm-live"), "les canaux demandes-live et comm-live sont abonnés");
  const dem = { id: 501, nom: "Luc Gagnon", type_machine: "VTT", statut: "nouvelle", lu: false, cree_le: new Date().toISOString() };
  S.db.demandes_service.push(dem); S.pousser("demandes_service", dem, "INSERT");
  await attendre(() => J.osc.length > 0, 3000);
  ok(J.osc.length === SONS.demande.notes.length && J.osc[0].type === "sawtooth" && Math.round(J.osc[0].f) === SONS.demande.notes[0][0], "INSERT demandes_service → un son « demande » (" + J.osc.length + " oscillateurs)");
  await dodo(1500);
  ok(J.osc.length === SONS.demande.notes.length, "… et pas de répétition (toujours " + J.osc.length + " oscillateurs 1,5 s plus tard)");
  ok(!A.$("#alerte-bandeau") && A.toasts().some((x) => /Nouvelle demande/.test(x)), "pas de bandeau d'alerte ; le toast « Nouvelle demande » reste");
  J.osc.length = 0;
  S.pousser("demandes_service", Object.assign({}, dem, { lu: true }), "UPDATE"); await dodo(300);
  ok(J.osc.length === 0, "un UPDATE de la demande (ouverture de la fiche par un autre poste) ne fait aucun son");
  const dem2 = { id: 502, nom: "Éve", statut: "nouvelle", lu: false, cree_le: new Date().toISOString() };
  S.db.demandes_service.push(dem2); S.pousser("demandes_service", dem2, "INSERT"); await attendre(() => J.osc.length > 0, 3000); await dodo(200);
  ok(J.osc.length === SONS.demande.notes.length, "une 2e demande = un 2e son (un seul par INSERT)");
  J.osc.length = 0;

  // ═══ 7. Temps réel : communications ═══
  // (a) texto « a_traiter » que l'Edge passe à « traite » en moins de 2 s : aucun son ; INSERT sms_out / traite (test-v173) : aucun son
  const t0 = Date.now();
  const iso = () => new Date().toISOString();
  const a1 = { id: 701, canal: "sms_in", direction: "in", statut: "a_traiter", tel: "8195550001", client_nom: "Réponse OUI", contenu: "OUI", cree_le: iso() };
  S.db.communications.push(a1); S.pousser("communications", a1, "INSERT");
  const sortant = { id: 702, canal: "sms_out", direction: "out", statut: "traite", par: "automatique", tel: "8195550001", contenu: "Bien reçu", cree_le: iso() };
  S.db.communications.push(sortant); S.pousser("communications", sortant, "INSERT");
  const dejaTraite = { id: 703, canal: "sms_in", direction: "in", statut: "traite", tel: "8195550003", contenu: "STOP", cree_le: iso() };
  S.db.communications.push(dejaTraite); S.pousser("communications", dejaTraite, "INSERT");
  await dodo(150);
  S.db.communications.find((x) => x.id === 701).statut = "traite"; S.pousser("communications", S.db.communications.find((x) => x.id === 701), "UPDATE");   // l'Edge a répondu
  await dodo(2600 - (Date.now() - t0));
  ok(J.osc.length === 0, "texto reçu « à traiter » puis passé à « traité » en < 2 s (réponse automatique) : AUCUN son ; sms_out / traité : aucun son (" + J.osc.length + ")");
  // (b) texto qui reste à traiter : un son « sms », pas avant ~2 s
  const t1 = Date.now();
  const b1 = { id: 710, canal: "sms_in", direction: "in", statut: "a_traiter", tel: "8195550002", client_nom: "Jean", contenu: "Mon VTT ne démarre pas", cree_le: iso() };
  S.db.communications.push(b1); S.pousser("communications", b1, "INSERT");
  await dodo(1200);
  const tot = J.osc.length;
  await attendre(() => J.osc.length > 0, 3500);
  const delai = Date.now() - t1;
  ok(tot === 0 && J.osc.length === SONS.sms.notes.length && J.osc[0].type === "square", "texto qui reste « à traiter » : un son « sms » (carré), jamais avant le délai (à 1,2 s : " + tot + " ; ensuite : " + J.osc.length + ")");
  ok(delai >= 1800 && delai < 3500, "… environ 2 s après l'arrivée (" + delai + " ms)");
  await dodo(600);
  ok(J.osc.length === SONS.sms.notes.length, "… une seule fois");
  J.osc.length = 0;
  // (c) appel manqué : son « appel » tout de suite
  const c1 = { id: 720, canal: "appel_manque", direction: "in", statut: "a_traiter", tel: "8195550004", client_nom: "Rita", cree_le: iso() };
  S.db.communications.push(c1); S.pousser("communications", c1, "INSERT");
  await attendre(() => J.osc.length > 0, 2000);
  ok(J.osc.length === SONS.appel.notes.length && J.osc[0].type === "sawtooth" && Math.round(J.osc[0].f) === SONS.appel.notes[0][0], "appel manqué → son « appel » immédiat (" + J.osc.length + " oscillateurs)");
  J.osc.length = 0;
  // (d) sans session : rien (les canaux démarrent avant la connexion)
  A.set("sessionCourante", null);
  const d1 = { id: 730, canal: "appel_manque", direction: "in", statut: "a_traiter", tel: "8195550005", cree_le: iso() };
  const d2 = { id: 731, canal: "sms_in", direction: "in", statut: "a_traiter", tel: "8195550006", contenu: "allo", cree_le: iso() };
  const d3 = { id: 503, nom: "Sans session", statut: "nouvelle", lu: false, cree_le: iso() };
  S.db.communications.push(d1, d2); S.db.demandes_service.push(d3);
  S.pousser("communications", d1, "INSERT"); S.pousser("communications", d2, "INSERT"); S.pousser("demandes_service", d3, "INSERT");
  await dodo(2700);
  ok(J.osc.length === 0, "sans session (écran de connexion) : ni demande, ni texto, ni appel manqué ne sonnent (" + J.osc.length + ")");
  A.set("sessionCourante", sess);

  // ═══ 8. Appel entrant, rappel, pièce, acceptation, session, chat : une seule fois chacun ═══
  A.w.__commProposerNote("8195559999", "", "appel-1");
  ok(J.osc.length === SONS.appelEntrant.notes.length && J.osc[0].type === "square", "appel entrant (popup de note d'appel) → son « appelEntrant »");
  A.w.__commProposerNote("8195559999", "", "appel-1");
  ok(J.osc.length === SONS.appelEntrant.notes.length, "… le même appel proposé deux fois ne sonne qu'une fois");
  J.osc.length = 0;

  A.w.localStorage.removeItem("mtr_rappels_avises");
  const dans = (ms) => new Date(Date.now() + ms).toISOString();
  S.db.communications.push({ id: 740, canal: "appel_manque", direction: "in", statut: "rappel", rappel_le: dans(-60000), tel: "8195550007", client_nom: "Paul", cree_le: iso() });
  await A.w.__comm.charger();
  A.w.__comm.verifierRappels();
  ok(J.osc.length === SONS.rappel.notes.length && J.osc[0].type === "triangle", "rappel arrivé à échéance → son « rappel » (" + J.osc.length + ")");
  A.w.__comm.verifierRappels(); A.w.__comm.verifierRappels();
  ok(J.osc.length === SONS.rappel.notes.length, "… une seule fois par rappel (CLE_AVISES) : toujours " + J.osc.length);
  J.osc.length = 0;

  A.w.localStorage.removeItem("mtr_cmd_retards_avises");
  A.set("commandes", [{ id: "cmd-1", machineId: "bt-1", numeroBT: "BT-100", pieces: [{ num: "A-1", description: "Courroie", qte: "1", commande: true, recu: false, fournisseur: "Napa", dateCommande: dans(-5 * 86400000), attenduLe: dans(-2 * 86400000) }] }]);
  A.w.cmdAlarmesRendre();
  ok(J.osc.length === SONS.piece.notes.length && J.osc[0].type === "triangle", "pièce commandée en retard → son « piece » (" + J.osc.length + ")");
  A.w.cmdAlarmesRendre(); A.w.cmdAlarmesRendre(true);
  ok(J.osc.length === SONS.piece.notes.length, "… une seule fois (CMD_AVISES) : toujours " + J.osc.length);
  J.osc.length = 0; A.set("commandes", []);

  const nc = J.ctxs.length;
  A.w.annoncerAcceptation({ client: "Marc", numero: "S-77" });
  ok(J.osc.length === SONS.acceptation.notes.length && J.ctxs.length === nc, "soumission acceptée → son « acceptation » une seule fois, sans nouvel AudioContext");
  J.osc.length = 0;

  A.w.sessionAvertOuvrir(); A.w.sessionAvertOuvrir(); A.w.sessionAvertOuvrir();
  ok(J.osc.length === SONS.session.notes.length && J.osc[0].type === "triangle", "avertissement de fin de session → son « session » UNE fois à l'ouverture (3 appels : " + J.osc.length + " oscillateurs)");
  A.w.sessionAvertFermer(); J.osc.length = 0;

  A.set("chat", []); A.w.chatAlerteNouveaux();
  A.set("chat", [{ id: "m1", de: "Gwendal", a: "tous", texte: "Allo", quand: iso(), lu: [] }]); A.w.chatAlerteNouveaux();
  ok(J.osc.length === SONS.chat.notes.length, "nouveau message du chat → son « chat » (" + J.osc.length + ")");
  A.w.chatAlerteNouveaux();
  ok(J.osc.length === SONS.chat.notes.length, "… pas de nouveau son tant qu'aucun nouveau message n'arrive");
  J.osc.length = 0;

  // ═══ 9. Réglages : #son-boite synchrone, même si serviceWorker.ready ne se résout jamais ═══
  const pv = A.w.pushOuvrirReglages();      // volontairement NON attendu : pushRendre attend serviceWorker.ready, qui ne revient jamais ici
  const boite = A.$("#son-boite"), pbx = A.$("#push-boite");
  ok(!!boite && !!A.$("#push-voile.ouvert"), "#son-boite est là tout de suite à l'ouverture du panneau (avant l'await de pushRendre)");
  ok(pbx && pbx.textContent.trim() === "" && boite && !pbx.contains(boite) && boite.parentNode === pbx.parentNode, "… alors que #push-boite est encore vide (serviceWorker.ready ne se résout pas) et que #son-boite en est distinct");
  const vol = A.$("#son-volume"), muetCase = A.$("#son-muet");
  ok(!!vol && vol.type === "range" && vol.min === "20" && vol.max === "100" && vol.value === "100", "curseur de volume 20-100, à 100 par défaut");
  ok(!!muetCase && /Couper les sons de cet appareil/.test(A.txt("#son-boite")), "case « Couper les sons de cet appareil »");
  ok(A.$$("#son-boite .son-test").length === 9 && A.$$("#son-boite .son-test").every((b) => /▶ Tester/.test(b.textContent)), "une ligne « ▶ Tester » par type (9)");
  vol.value = "40"; vol.dispatchEvent(new A.w.Event("input", { bubbles: true }));
  ok(JSON.parse(A.w.localStorage.getItem("mtr-sons-v1")).volume === 40 && A.txt("#son-volume-val") === "40 %", "le curseur enregistre le volume (40) et l'affiche");
  jouer(A, "chat"); ok(Math.abs(maitre(J).gain.value - 0.4) < 1e-9, "… et le gain maître suit : 0,4"); J.osc.length = 0;
  muetCase.checked = true; muetCase.dispatchEvent(new A.w.Event("change", { bubbles: true }));
  ok(JSON.parse(A.w.localStorage.getItem("mtr-sons-v1")).muet === true && jouer(A, "sms") === false && J.osc.length === 0, "la case « Couper les sons » met l'appareil en muet");
  A.$('#son-boite .son-test[data-son="sms"]').click();
  await attendre(() => J.osc.length > 0, 2000);
  ok(J.osc.length === SONS.sms.notes.length, "« ▶ Tester » joue le son même en muet (" + J.osc.length + ")");
  J.osc.length = 0;
  A.$("#son-fermer").click();
  ok(!A.$("#push-voile.ouvert"), "le ✕ du bloc Sons ferme le panneau");
  void pv;

  // ═══ 10. Menu « 🔊 Alertes et sons » : technicien ET réception, sans data-section ═══
  const trouverMenu = () => A.$$("#menu-lateral .menu-item").find((b) => /Alertes et sons/.test(b.textContent));
  const mb = trouverMenu();
  ok(!!mb, "le menu latéral a un bouton « Alertes et sons »");
  ok(mb && !mb.hasAttribute("data-section") && !mb.hasAttribute("data-tb-fixe") && /menuAller\('pushOuvrirReglages'\)/.test(mb.getAttribute("onclick") || ""), "… sans data-section ni data-tb-fixe, branché sur menuAller('pushOuvrirReglages')");
  ok(mb && mb.previousElementSibling && /Changer mon mot de passe/.test(mb.previousElementSibling.textContent) && /Compte/.test((A.$$("#menu-lateral .menu-sect").pop() || {}).textContent || ""), "… dans le bloc « Compte » du menu");
  L.connecter(A, "Gwendal"); A.w.appliquerDroits();
  const adm = A.$('#menu-lateral [data-section="admin"]');
  ok(adm && adm.style.display === "none" && trouverMenu().style.display !== "none" && A.w.getComputedStyle(trouverMenu()).display !== "none", "technicien : l'item est visible (alors que « Administration » est masquée par appliquerDroits)");
  L.connecter(A, "Marie", L.EMP.concat([RECEPTION])); A.w.appliquerDroits();
  ok(A.w.document.body.classList.contains("role-reception") && A.w.getComputedStyle(trouverMenu()).display !== "none", "réception : l'item est visible aussi");
  trouverMenu().click();
  await attendre(() => !!A.$("#push-voile.ouvert"), 2000);
  ok(!!A.$("#push-voile.ouvert") && !!A.$("#son-boite") && A.$$("#son-boite .son-test").length === 9, "un clic sur l'item ouvre le panneau Alertes et sons avec le bloc Sons");
  A.$("#son-fermer").click();
  ok(A.erreurs.length === 0, "app principale : aucune erreur JavaScript (" + A.erreurs.length + ")" + (A.erreurs.length ? " : " + A.erreurs.slice(0, 3).join(" | ") : ""));

  // ═══ 11. iPad jamais touché : « ▶ Tester » est lui-même le geste de déblocage ═══
  {
    const X = await nouvelleApp({ J: { etatInitial: "suspended", autoriser: true } });
    L.connecter(X.A, "Jason");
    X.A.w.pushOuvrirReglages();
    ok(X.J.ctxs.length === 0 && X.J.osc.length === 0, "iPad neuf : panneau ouvert, aucun contexte audio encore");
    X.A.$('#son-boite .son-test[data-son="demande"]').click();
    await attendre(() => X.J.osc.length > 0, 2000);
    ok(X.J.ctxs.length === 1 && X.J.osc.length === lire(X.A, "SONS.demande.notes.length"), "le tout premier « ▶ Tester » crée le contexte, le débloque et joue (" + X.J.osc.length + " oscillateurs)");
    ok(X.A.erreurs.length === 0, "aucune erreur JavaScript (iPad neuf)");
  }
  {
    const X = await nouvelleApp({ J: { etatInitial: "suspended", autoriser: false } });
    L.connecter(X.A, "Jason");
    X.A.w.pushOuvrirReglages();
    X.A.$('#son-boite .son-test[data-son="sms"]').click();
    await dodo(900);
    ok(X.J.osc.length === 0 && /bloqué/.test(X.A.txt("#son-etat")), "contexte qui refuse de démarrer : rien n'est planifié et le panneau dit que le son est bloqué");
    ok(X.A.erreurs.length === 0, "aucune erreur JavaScript (contexte refusé)");
  }

  // ═══ 12. Navigateur sans AudioContext utilisable / audioSession qui plante : aucune erreur ═══
  {
    const X = await nouvelleApp({ J: { constructeurLeve: true }, audioSession: { set type(v) { throw new Error("audioSession refusé"); }, get type() { return "auto"; } } });
    L.connecter(X.A, "Jason");
    evt(X.A, "click", X.A.w.document.body); evt(X.A, "touchend", X.A.w.document.body); evt(X.A, "visibilitychange");
    X.A.w.sonNotification(); X.A.w.sonAcceptation(); X.A.w.__dem.sonnerie();
    ok(jouer(X.A, "demande") === false && lire(X.A, "sonCtx") === null && X.A.erreurs.length === 0, "AudioContext qui lève : tout reste silencieux, jouerSon retourne faux, zéro erreur JavaScript");
  }
  {
    const trace = { type: "auto" };
    const X = await nouvelleApp({ audioSession: trace });
    evt(X.A, "click", X.A.w.document.body);
    ok(trace.type === "playback", "navigator.audioSession.type = « playback » au premier geste (à observer sur l'iPad) : " + trace.type);
    ok(X.A.erreurs.length === 0, "aucune erreur JavaScript");
  }

  // ═══ 13. Texte des limites push (pushRendre) ═══
  {
    const X = await nouvelleApp({ swResolu: true });
    L.connecter(X.A, "Jason");
    await X.A.w.pushOuvrirReglages();
    const t = X.A.txt("#push-boite");
    ok(/choisi par le syst/.test(t) && /Concentration/.test(t) && /jamais au-delà du volume de l'appareil/.test(t) && /commutateur sur sonnerie/.test(t), "texte des limites : son choisi par le système, plus fort app ouverte mais jamais au-delà du volume de l'appareil, commutateur sur sonnerie");
    const v = X.A.$("#son-volume"); v.value = "60"; v.dispatchEvent(new X.A.w.Event("input", { bubbles: true }));
    await X.A.w.pushRendre();
    ok(X.A.$("#son-volume") === v && X.A.$("#son-volume").value === "60" && X.A.$("#push-boite #son-boite") === null, "pushRendre réécrit #push-boite sans toucher au curseur du bloc Sons");
    ok(X.A.erreurs.length === 0, "aucune erreur JavaScript");
  }

  // ═══ 14. sw.js : requireInteraction seulement pour « demande », vibration par type, pas de silent ═══
  {
    const dossier = (process.argv[2] || "./index.html").replace(/[^/]*$/, "");
    let src = null; try { src = fs.readFileSync(dossier + "sw.js", "utf8"); } catch (_) { try { src = fs.readFileSync("./sw.js", "utf8"); } catch (__) {} }
    if (src) {
      const ecout = {}, affiches = [];
      const self = { addEventListener: (t, f) => { ecout[t] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => [] }, location: { origin: "https://atelier.mtrperformance.ca" },
        registration: { showNotification: (titre, o) => { affiches.push({ titre, o }); return Promise.resolve(); } } };
      new Function("self", src)(self);
      const push = (charge) => { affiches.length = 0; ecout.push({ data: { json: () => { if (charge === null) throw new Error("pas du json"); return charge; }, text: () => "texte brut" }, waitUntil() {} }); return affiches[0] && affiches[0].o; };
      const dm = push({ titre: "Nouvelle demande", corps: "VTT", type: "demande" }), sm = push({ type: "sms" }), ap = push({ type: "appel" }), inf = push({ type: "info" }), sans = push({}), cons = push({ type: "constructor" }), brut = push(null);
      ok(dm && dm.requireInteraction === true && sm.requireInteraction === false && ap.requireInteraction === false && inf.requireInteraction === false && sans.requireInteraction === false, "sw.js : demande → requireInteraction vrai ; sms, appel, info, sans type → faux");
      ok(JSON.stringify(dm.vibrate) === "[300,150,300,150,300,150,600]" && JSON.stringify(sm.vibrate) === "[200,100,200,100,400]" && JSON.stringify(ap.vibrate) === "[400,150,400,150,400]", "sw.js : vibration par type (demande, sms, appel)");
      ok(JSON.stringify(inf.vibrate) === "[200,100,200,100,400]" && JSON.stringify(sans.vibrate) === "[200,100,200,100,400]" && JSON.stringify(cons.vibrate) === "[200,100,200,100,400]" && JSON.stringify(brut.vibrate) === "[200,100,200,100,400]", "sw.js : vibration par défaut inchangée (info, sans type, type piégé « constructor », charge illisible)");
      ok([dm, sm, ap, inf].every((o) => !("silent" in o)) && dm.renotify === true && /^mtr-/.test(dm.tag), "sw.js : pas de silent:false ; renotify et tag conservés");
    } else console.log("(sw.js introuvable à côté de l'index testé : assertions sw.js sautées — cas des sabotages d'index.html)");
  }

  // ═══ 15. Mesure : vrai OfflineAudioContext de Chromium, vrai jouerSon() de l'app contre l'ancien sonNotification (reconstitué) ═══
  if (typeof OfflineAudioContext !== "undefined") {
    const SR = 44100;
    const hors = (sec) => OfflineAudioContext && new OfflineAudioContext(1, Math.ceil(SR * sec), SR);
    const rms = (buf, a, b) => { const d = buf.getChannelData(0); const i0 = Math.max(0, Math.floor(a * SR)), i1 = Math.min(d.length, Math.ceil(b * SR)); let s = 0; for (let i = i0; i < i1; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
    const crete = (buf) => { const d = buf.getChannelData(0); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; };
    // l'ancien sonNotification (v177), recopié tel quel : 2 sinus (880 puis 1175 Hz), gain de pointe 0,25, décroissance exponentielle sur 0,28 s
    const ancienNotif = (ctx) => { [[880, 0], [1175, 0.16]].forEach(([f, t]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3); }); };
    // l'ancien demSonnerie (v177) : triangle 0,3, do-mi-sol × 4
    const ancienDem = (ctx) => { const t0 = ctx.currentTime; for (let rep = 0; rep < 4; rep++) [523.25, 659.25, 783.99].forEach((f, i) => { const d = t0 + rep * 0.85 + i * 0.16; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, d); g.gain.exponentialRampToValueAtTime(0.3, d + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, d + 0.34); o.connect(g).connect(ctx.destination); o.start(d); o.stop(d + 0.36); }); };
    const rendre = async (planifier, sec) => { const off = hors(sec); planifier(off); return await off.startRendering(); };
    const bufAncienNotif = await rendre(ancienNotif, 1);
    const bufAncienDem = await rendre(ancienDem, 4);
    // fenêtres : « durée propre » = du début de la 1re note à la fin de la dernière
    const rNotif = rms(bufAncienNotif, 0, 0.46), rNotif05 = rms(bufAncienNotif, 0, 0.5), pNotif = crete(bufAncienNotif);
    const rDem = rms(bufAncienDem, 0, 3.6), pDem = crete(bufAncienDem);
    console.log("MESURE ancien sonNotification (sinus 880/1175, 0,25) : RMS " + rNotif.toFixed(4) + " sur sa durée (0-0,46 s), " + rNotif05.toFixed(4) + " sur 0,5 s ; crête " + pNotif.toFixed(3));
    console.log("MESURE ancien demSonnerie (triangle 0,3, do-mi-sol × 4) : RMS " + rDem.toFixed(4) + " sur 0-3,6 s ; crête " + pDem.toFixed(3));
    // le VRAI jouerSon de l'app, rendu hors ligne (faux contexte « running » dont les nœuds sont ceux d'un OfflineAudioContext)
    const M = await nouvelleApp(); L.connecter(M.A, "Jason");
    const mesures = {};
    for (const t of TYPES) {
      const off = hors(4);
      const faux = { state: "running", currentTime: 0, destination: off.destination, resume() { return Promise.resolve(); }, close() {}, createOscillator: () => off.createOscillator(), createGain: () => off.createGain() };
      M.A.set("sonCtx", faux);
      const r = jouer(M.A, t);
      const buf = await off.startRendering();
      const notes = SONS[t].notes, debut = 0.03, fin = 0.03 + notes[notes.length - 1][1] + notes[notes.length - 1][2];
      mesures[t] = { r, rms: rms(buf, debut, fin), rms05: rms(buf, 0, 0.5), crete: crete(buf), duree: fin - debut };
    }
    const dB = (a, b) => 20 * Math.log10(a / b);
    TYPES.forEach((t) => console.log("MESURE nouveau " + t + " (" + SONS[t].onde + ", gain " + SONS[t].gain + ") : RMS " + mesures[t].rms.toFixed(4) + " sur " + mesures[t].duree.toFixed(2) + " s, " + mesures[t].rms05.toFixed(4) + " sur 0,5 s ; crête " + mesures[t].crete.toFixed(3) + " ; " + dB(mesures[t].rms, rNotif).toFixed(1) + " dB vs ancien sonNotification, " + dB(mesures[t].rms, rDem).toFixed(1) + " dB vs ancien demSonnerie"));
    ok(TYPES.every((t) => mesures[t].r === true && mesures[t].rms > 0), "mesure : les 9 sons rendus par le vrai jouerSon() contiennent du signal");
    ok(TYPES.every((t) => mesures[t].crete <= 0.9 + 1e-3), "mesure : aucune crête au-dessus de 0,9 à volume 100 (pas d'écrêtage) : max " + Math.max(...TYPES.map((t) => mesures[t].crete)).toFixed(3));
    ok(dB(mesures.demande.rms, rNotif) >= 10, "mesure : « demande » est d'au moins +10 dB RMS au-dessus de l'ancien sonNotification (" + dB(mesures.demande.rms, rNotif).toFixed(1) + " dB)");
    ok(dB(mesures.demande.rms, rDem) >= 3, "mesure : « demande » est plus fort que l'ancien demSonnerie (" + dB(mesures.demande.rms, rDem).toFixed(1) + " dB)");
    ok(["sms", "appel"].every((t) => dB(mesures[t].rms, rNotif) >= 10), "mesure : « sms » et « appel » aussi au-dessus de +10 dB vs l'ancien sonNotification (" + dB(mesures.sms.rms, rNotif).toFixed(1) + " et " + dB(mesures.appel.rms, rNotif).toFixed(1) + " dB)");
    ok(M.A.erreurs.length === 0, "aucune erreur JavaScript (mesure)");
  } else console.log("(OfflineAudioContext absent : mesure RMS sautée)");

  process.exit();
})().catch((e) => { ok(false, "exception dans le test : " + (e && e.stack || e)); process.exit(); });
