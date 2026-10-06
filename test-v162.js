// v162 — Assistant MTR « Non connecté (code 401) » : l'appareil avait perdu sa session SERVEUR.
//   • « Changer d'utilisateur » ne déconnecte plus que cet appareil (signOut scope local)
//   • serveur qui nous déconnecte → fenêtre « Reconnexion au serveur » (rien d'effacé)
//   • Assistant / QuickBooks : session vérifiée avant l'appel, message clair sur un 401
// NODE_PATH=… node test-v162.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

// ── Supabase simulé, avec une vraie mécanique de session ──
const etat = { session: null, abonnes: [], signOuts: [], connexions: [], invokes: [], mdpBon: "bonmdp", reponseInvoke: null };
const table = () => { const ch = new Proxy({}, { get(t, k) { if (k === "then") return (ok) => ok({ data: [], error: null }); return (...a) => (k === "maybeSingle" || k === "single") ? Promise.resolve({ data: null, error: null }) : ch; } }); return ch; };
const emettre = async (evt) => { for (const f of etat.abonnes) await f(evt, etat.session); };
const sbStub = {
  from: table,
  channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; },
  auth: {
    getSession: async () => ({ data: { session: etat.session } }),
    onAuthStateChange: (f) => { etat.abonnes.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
    signOut: async (opts) => { etat.signOuts.push(opts || null); etat.session = null; await emettre("SIGNED_OUT"); return { error: null }; },
    signInWithPassword: async ({ email, password }) => {
      etat.connexions.push({ email, password });
      if (password !== etat.mdpBon) return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      etat.session = { access_token: "jeton-" + email, user: { id: "u1", email } };
      await emettre("SIGNED_IN");
      return { data: { user: etat.session.user, session: etat.session }, error: null };
    },
    updateUser: async () => ({ error: null }),
  },
  functions: { invoke: async (nom, opts) => { etat.invokes.push({ nom, opts }); return etat.reponseInvoke ? etat.reponseInvoke(nom) : { data: { texte: "Serrer à 25 N·m." }, error: null }; } },
};
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const fetchs = [];
let reponseFetch = null;
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) {
    w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async (url, init) => { fetchs.push({ url, init }); const r = reponseFetch ? reponseFetch(url, init) : { status: 404, data: {} }; return { ok: r.status < 300, status: r.status, json: async () => r.data, text: async () => JSON.stringify(r.data) }; };
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /position:\s*fixed/.test(x.getAttribute("style") || "") && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const recoOuverte = () => { const v = $("#voile-reco"); return !!(v && v.classList.contains("ouvert")); };
const connecterEmploye = (e) => { w.__set("sessionCourante", { nom: e, quand: new Date().toISOString() }); try { w.localStorage.setItem("mtr-session-v1", JSON.stringify({ nom: e, quand: new Date().toISOString() })); } catch (_) {} };

(async () => {
 await dodo(1500);
 try {
  // ── Vérification statique : plus aucun signOut() global ──
  const src = fs.readFileSync(FICHIER, "utf8");
  const sansCommentaires = src.split("\n").map(l => l.replace(/\/\/[^"'`]*$/, "")).filter(l => !/^\s*\/\//.test(l)).join("\n");
  const globaux = (sansCommentaires.match(/auth\.signOut\((?!\{\s*scope:\s*"local")/g) || []).length;
  ok(globaux === 0, "plus aucun sb.auth.signOut() global dans l'app (" + globaux + " trouvé)");
  ok(/if \(sessionCourante\) \{ presenceDemarrer\(\);[^\n]*\n\s*if \(sessionCourante\) authVerifierAuDemarrage\(\);/.test(src), "au démarrage (session reprise), l'app vérifie la connexion au serveur");

  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [
    { nom: "Jason", nomFamille: "Blouin", identifiant: "j.blouin", role: "admin", actif: true, compteAuth: true },
    { nom: "Gwendal", nomFamille: "Brossault", identifiant: "g.brossault", role: "technicien", actif: true, compteAuth: true },
    { nom: "Nip", nomFamille: "Seulement", identifiant: "n.seulement", role: "technicien", actif: true, nip: "1234" },
  ]);
  ok(etat.abonnes.length >= 1, "l'app surveille les changements de session du serveur (onAuthStateChange)");

  // ════ 1. « Changer d'utilisateur » : cet appareil seulement, et pas de fenêtre de reconnexion ════
  connecterEmploye("Jason"); etat.session = { access_token: "x" };
  await w.deconnecter(); await dodo(50);
  ok(etat.signOuts.length === 1 && etat.signOuts[0] && etat.signOuts[0].scope === "local", "« Changer d'utilisateur » : signOut({ scope: \"local\" }) — les autres appareils restent connectés");
  ok(!recoOuverte(), "notre propre déconnexion n'ouvre pas la fenêtre « Reconnexion au serveur »");

  // ════ 2. Le serveur nous déconnecte (refresh token révoké ailleurs) ════
  connecterEmploye("Jason"); etat.session = { access_token: "x" };
  etat.session = null; await emettre("SIGNED_OUT"); await dodo(30);
  ok(recoOuverte(), "session serveur perdue pendant que Jason est à l'écran → fenêtre « Reconnexion au serveur »");
  ok(/déconnecté du serveur/.test($("#reco-sous").textContent) && /rien n'est perdu/.test($("#reco-sous").textContent), "texte : appareil déconnecté du serveur, rien n'est perdu");
  ok($("#reco-ident").textContent === "j.blouin", "le nom d'utilisateur affiché est celui de l'employé à l'écran (j.blouin)");
  ok(w.__get("sessionCourante") && w.__get("sessionCourante").nom === "Jason", "l'employé reste à l'écran (rien d'effacé)");
  ok($("#voile-reco").matches(".live-modale") && +$("#voile-reco").style.zIndex > 1000, "la fenêtre entre dans la pile des fenêtres (v71) : elle passe par-dessus la dernière ouverte (z " + $("#voile-reco").style.zIndex + ")");

  // mauvais mot de passe
  $("#reco-mdp").value = "mauvais"; await w.authReconnexionValider(); await dodo(20);
  ok(recoOuverte() && /incorrect/i.test($("#reco-msg").textContent), "mauvais mot de passe : message, la fenêtre reste ouverte");
  ok(etat.connexions[0].email === "j.blouin@mtrperformance.local", "connexion tentée avec j.blouin@mtrperformance.local");
  // bon mot de passe
  $("#reco-mdp").value = "bonmdp"; await w.authReconnexionValider(); await dodo(20);
  ok(!recoOuverte() && etat.session && etat.session.access_token, "bon mot de passe : reconnecté, fenêtre fermée");
  ok(toasts().some(t => /Reconnecté au serveur/.test(t)), "toast « 🔒 Reconnecté au serveur »");

  // ════ 3. Employé qui entre avec son NIP (pas de compte) : pas de fenêtre sur SIGNED_OUT ════
  connecterEmploye("Nip"); etat.session = null; await emettre("SIGNED_OUT"); await dodo(30);
  ok(!recoOuverte(), "employé sans compte (NIP) : aucune fenêtre quand il n'y a pas de session serveur");

  // ════ 4. Assistant MTR ════
  const m = { id: "b1", numeroBT: "BT-300", nom: "Sea-Doo RXP-X 300", annee: "2022", client: "Samuel Gervais", tel: "819-995-2590", statut: "reparation" };
  w.__set("machines", [m]); w.__set("liveId", "b1");
  const q = $("#assist-question");
  ok(!!q, "zone de question de l'Assistant présente");

  // 4a. pas de session → fenêtre, puis la question part après la reconnexion
  connecterEmploye("Jason"); etat.session = null; etat.invokes.length = 0;
  q.value = "Couple de serrage de l'hélice ?";
  const envoi = w.assistEnvoyer(); await dodo(40);
  ok(recoOuverte() && /pour utiliser l'Assistant MTR/.test($("#reco-sous").textContent), "Assistant sans session serveur : fenêtre de reconnexion « pour utiliser l'Assistant MTR »");
  ok(etat.invokes.length === 0, "rien n'est envoyé au serveur tant qu'on n'est pas reconnecté (pas de 401)");
  $("#reco-mdp").value = "bonmdp"; await w.authReconnexionValider(); await envoi; await dodo(30);
  ok(etat.invokes.length === 1 && etat.invokes[0].nom === "assistant-claude", "après la reconnexion : la question part toute seule à « assistant-claude »");
  ok((w.__get("machines")[0].assistant || []).some(x => /25 N·m/.test(x.r)), "la réponse est ajoutée au fil du bon");

  // 4b. « Plus tard » : rien d'envoyé, la question reste dans la zone
  etat.session = null; etat.invokes.length = 0; q.value = "Code P0122 ?";
  const envoi2 = w.assistEnvoyer(); await dodo(40);
  w.authReconnexionFermer(false); await envoi2; await dodo(20);
  ok(etat.invokes.length === 0 && q.value === "Code P0122 ?", "« Plus tard » : rien d'envoyé, la question reste écrite");
  ok(toasts().some(t => /reconnecte-toi au serveur/.test(t)), "toast : reconnecte-toi au serveur (la question est gardée)");

  // 4c. session bonne → envoi direct, sans fenêtre
  etat.session = { access_token: "ok" }; etat.invokes.length = 0; q.value = "Jeu aux soupapes ?";
  await w.assistEnvoyer(); await dodo(20);
  ok(etat.invokes.length === 1 && !recoOuverte(), "session bonne : envoi direct, aucune fenêtre");

  // 4d. le serveur répond 401 et la session a sauté entre-temps → message clair (plus « la fonction est-elle installée ? »)
  const avant = toasts().length;
  etat.reponseInvoke = () => { etat.session = null; return { data: null, error: { message: "non-2xx", context: { status: 401, json: async () => ({ erreur: "Non connecté" }) } } }; };
  q.value = "Pression d'huile ?"; await w.assistEnvoyer(); await dodo(40);
  const nouveaux = toasts().slice(avant);
  ok(nouveaux.some(t => /n'est plus connecté au serveur/.test(t)) && !nouveaux.some(t => /est-elle installée/.test(t)), "401 : « cet appareil n'est plus connecté au serveur » (fini « la fonction serveur est-elle installée ? »)");
  ok(recoOuverte(), "401 : la fenêtre de reconnexion s'ouvre");
  w.authReconnexionFermer(false);
  // 4e. autre erreur (ex. 500) : message d'erreur normal, pas de fenêtre
  etat.session = { access_token: "ok" };
  etat.reponseInvoke = () => ({ data: null, error: { message: "non-2xx", context: { status: 500, json: async () => ({ erreur: "Clé ANTHROPIC_API_KEY manquante dans les secrets" }) } } });
  const avant2 = toasts().length; q.value = "Test ?"; await w.assistEnvoyer(); await dodo(30);
  ok(toasts().slice(avant2).some(t => /ANTHROPIC_API_KEY manquante/.test(t)) && !recoOuverte(), "autre erreur du serveur : message réel affiché, pas de fenêtre de reconnexion");
  etat.reponseInvoke = null;

  // 4f. employé NIP sans compte : on explique qu'il faut un compte
  connecterEmploye("Nip"); etat.session = null; etat.invokes.length = 0; q.value = "Question ?";
  const envoi3 = w.assistEnvoyer(); await dodo(40);
  ok(recoOuverte() && /pas encore créé/.test($("#reco-sous").textContent) && $("#reco-champs").style.display === "none" && $("#reco-plus-tard").textContent === "OK",
     "employé sans compte (NIP) : explication « compte pas encore créé », pas de champ mot de passe, bouton OK");
  w.authReconnexionFermer(false); await envoi3;
  ok(etat.invokes.length === 0, "employé sans compte : rien d'envoyé");

  // ════ 5. QuickBooks : 401 sans session → message clair + fenêtre ════
  connecterEmploye("Jason"); etat.session = null;
  reponseFetch = (url) => /quickbooks/.test(url) ? { status: 401, data: { erreur: "Non connecté" } } : { status: 404, data: {} };
  let err = null; try { await w.qboAppel({ action: "statut" }); } catch (e) { err = e; }
  ok(err && /n'est plus connecté au serveur/.test(err.message) && err.sessionPerdue, "QuickBooks 401 sans session : « cet appareil n'est plus connecté au serveur »");
  ok(recoOuverte(), "QuickBooks 401 : fenêtre de reconnexion");
  w.authReconnexionFermer(false);
  etat.session = { access_token: "ok" };
  reponseFetch = (url) => /quickbooks/.test(url) ? { status: 401, data: { erreur: "Compte d'employé requis" } } : { status: 404, data: {} };
  err = null; try { await w.qboAppel({ action: "statut" }); } catch (e) { err = e; }
  ok(err && /Compte d'employé requis/.test(err.message) && !recoOuverte(), "QuickBooks 401 AVEC session : le vrai message du serveur, pas de fenêtre");
  reponseFetch = null;

  // ════ 6. Au démarrage : employé à l'écran mais plus de session serveur → fenêtre ════
  connecterEmploye("Gwendal"); etat.session = null;
  await w.authVerifierAuDemarrage(); await dodo(20);
  ok(recoOuverte() && $("#reco-ident").textContent === "g.brossault", "démarrage sans session serveur : fenêtre pour g.brossault");
  w.authReconnexionFermer(false);
  etat.session = { access_token: "ok" }; await w.authVerifierAuDemarrage(); await dodo(20);
  ok(!recoOuverte(), "démarrage avec session : aucune fenêtre");

  // ════ 7. Une seule fenêtre à la fois, nom échappé ════
  w.__get("EMPLOYES").push({ nom: "<b>X</b>", identifiant: "x.x", role: "technicien", actif: true, compteAuth: true });
  connecterEmploye("<b>X</b>"); etat.session = null;
  const p1 = w.authReconnexionOuvrir("perdue"), p2 = w.authReconnexionOuvrir("perdue");
  ok(p1 === p2 && w.document.querySelectorAll("#voile-reco").length === 1, "deux demandes en même temps : une seule fenêtre (même promesse)");
  ok(!$("#reco-sous").querySelector("b") && /<b>X<\/b>/.test($("#reco-sous").textContent), "nom de l'employé échappé dans la fenêtre");
  w.authReconnexionFermer(false);
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
