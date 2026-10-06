// v163 — « Travailles-tu encore ? » 5 min avant la fermeture automatique de la session (12 h après la connexion),
//        et message sur l'écran de connexion quand la session a été fermée toute seule.
// NODE_PATH=… node test-v163.js ./index.html
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
let html = fs.readFileSync(FICHIER, "utf8");

const etat = { session: { access_token: "ok" }, signOuts: [] };
const table = () => { const ch = new Proxy({}, { get(t, k) { if (k === "then") return (ok) => ok({ data: [], error: null }); return (...a) => (k === "maybeSingle" || k === "single") ? Promise.resolve({ data: null, error: null }) : ch; } }); return ch; };
const sbStub = {
  from: table,
  channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; },
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: etat.session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async (o) => { etat.signOuts.push(o || null); etat.session = null; return { error: null }; },
    signInWithPassword: async () => ({ data: {}, error: { message: "x" } }),
  },
  functions: { invoke: async () => ({ data: null, error: null }) },
};
html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
{ const i = html.lastIndexOf("</body>"); html = html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i); }
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
  beforeParse(w) {
    w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => "";
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  } });
const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
const dodo = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const H = 3600000, MN = 60000;
const toasts = () => [...w.document.body.children].filter(x => x.tagName === "DIV" && /bottom:\s*26px/.test(x.getAttribute("style") || "")).map(x => x.textContent);
const avertOuvert = () => { const v = $("#voile-encore"); return !!(v && v.classList.contains("ouvert")); };
const connexionOuverte = () => $("#ecran-connexion").classList.contains("ouvert");
const avis = () => { const z = $("#cx-avis"); return z && z.style.display !== "none" ? z.textContent : ""; };
const session = (nom, ilYa) => {
  const s = { nom, quand: new Date(Date.now() - ilYa).toISOString() };
  w.__set("sessionCourante", s); w.localStorage.setItem("mtr-session-v1", JSON.stringify(s));
  w.document.getElementById("ecran-connexion").classList.remove("ouvert");
};

(async () => {
 await dodo(1500);
 try {
  w.__set("sb", sbStub); w.__set("chargementOK", true);
  w.__set("EMPLOYES", [{ nom: "Jason", nomFamille: "Blouin", identifiant: "j.blouin", role: "admin", actif: true, compteAuth: true },
                       { nom: "Gwendal", nomFamille: "Brossault", identifiant: "g.brossault", role: "technicien", actif: true, compteAuth: true }]);
  const DUREE = w.__get("SESSION_DUREE_H");
  ok(DUREE === 12 && w.__get("SESSION_AVERT_MIN") === 5, "règle gardée : session de 12 h, avertissement 5 min avant");

  // ── 1. Session récente : rien ──
  session("Jason", 2 * H); await w.sessionVerifier();
  ok(!avertOuvert() && !connexionOuverte(), "connecté depuis 2 h : aucune fenêtre");

  // ── 2. À 4 min de la fin : « Travailles-tu encore ? » ──
  session("Jason", DUREE * H - 4 * MN); await w.sessionVerifier();
  ok(avertOuvert(), "à 4 min de la fin : fenêtre « Travailles-tu encore ? »");
  ok($("#encore-titre").textContent === "Travailles-tu encore ?" && /Jason, ta session se ferme 12 h après la connexion/.test($("#encore-texte").textContent)
     && /fermer la session ou continuer à travailler/.test($("#encore-texte").textContent), "texte : titre, nom de l'employé, 12 h, fermer ou continuer");
  ok(/^3:5\d$|^4:00$/.test($("#encore-compte").textContent), "compte à rebours affiché (« " + $("#encore-compte").textContent + " »)");
  const c1 = $("#encore-compte").textContent; await dodo(1100);
  ok($("#encore-compte").textContent !== c1, "le compte à rebours avance chaque seconde (" + c1 + " → " + $("#encore-compte").textContent + ")");
  ok(!!$("#voile-encore .encore-fermer") && !!$("#encore-continuer") && /Fermer la session/.test($("#voile-encore .encore-fermer").textContent) && /Continuer à travailler/.test($("#encore-continuer").textContent),
     "deux boutons : « Fermer la session » et « Continuer à travailler »");
  ok($("#voile-encore").matches(".live-modale") && +$("#voile-encore").style.zIndex > 1000, "la fenêtre passe par-dessus la dernière ouverte (pile des fenêtres)");

  // ── 3. Continuer à travailler ──
  const avant = Date.now();
  $("#encore-continuer").click(); await dodo(20);
  const sc = w.__get("sessionCourante"), stock = JSON.parse(w.localStorage.getItem("mtr-session-v1"));
  ok(!avertOuvert() && sc && new Date(sc.quand).getTime() >= avant - 5 && stock.quand === sc.quand, "« Continuer à travailler » : fenêtre fermée, session repartie pour 12 h (aussi dans l'appareil)");
  ok(toasts().some(t => /Session prolongée de 12 h/.test(t)), "toast « ✅ Session prolongée de 12 h »");
  ok(sc.nom === "Jason" && !connexionOuverte(), "toujours Jason, toujours connecté");
  await w.sessionVerifier(); ok(!avertOuvert(), "après prolongation : plus de fenêtre");

  // ── 4. ✕ et Échap = continuer ──
  session("Jason", DUREE * H - 2 * MN); await w.sessionVerifier();
  $("#voile-encore .encore-x").click(); await dodo(10);
  ok(!avertOuvert() && w.__get("sessionFinMs")() - Date.now() > (DUREE - 0.01) * H, "✕ : continue (session prolongée)");
  session("Jason", DUREE * H - 2 * MN); await w.sessionVerifier();
  $("#voile-encore").dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await dodo(10);
  ok(!avertOuvert() && w.__get("sessionFinMs")() - Date.now() > (DUREE - 0.01) * H, "Échap : continue (session prolongée)");

  // ── 5. Sans réponse : fermeture automatique + message à l'écran de connexion ──
  etat.signOuts.length = 0;
  session("Jason", DUREE * H + 30 * 1000); await w.sessionVerifier(); await dodo(50);
  ok(w.__get("sessionCourante") === null && connexionOuverte(), "12 h passées : session fermée, écran de connexion");
  ok(/La session de Jason a été fermée automatiquement \(12 h après la connexion\)/.test(avis()), "écran de connexion : « 🔒 La session de Jason a été fermée automatiquement (12 h après la connexion) »");
  ok(etat.signOuts.length === 1 && etat.signOuts[0] && etat.signOuts[0].scope === "local", "fermeture automatique : déconnexion de CET appareil seulement (v162 gardée)");
  ok(!avertOuvert(), "la fenêtre d'avertissement est refermée");
  ok(w.localStorage.getItem("mtr-session-v1") === null, "session retirée de l'appareil");

  // ── 6. Le compte à rebours qui arrive à 0 ferme la session tout seul ──
  session("Gwendal", DUREE * H - 1500); await w.sessionVerifier();
  ok(avertOuvert(), "à 1,5 s de la fin : fenêtre ouverte");
  await dodo(2600);
  ok(w.__get("sessionCourante") === null && connexionOuverte() && /La session de Gwendal a été fermée/.test(avis()), "compte à rebours à 0 : session de Gwendal fermée toute seule, avec le message");

  // ── 7. « Fermer la session » : fermeture tout de suite, sans message « automatique » ──
  session("Jason", DUREE * H - 3 * MN); await w.sessionVerifier();
  await w.sessionFermerMaintenant(); await dodo(30);
  ok(w.__get("sessionCourante") === null && connexionOuverte() && avis() === "", "« Fermer la session » : écran de connexion, sans message « fermée automatiquement »");

  // ── 8. Écran d'atelier (2e moniteur) : jamais fermé tout seul ──
  session("Jason", DUREE * H + 60 * 1000);
  $("#ecran-atelier") && $("#ecran-atelier").classList.add("ouvert");
  await w.sessionVerifier();
  ok(w.__get("sessionCourante") && w.__get("sessionCourante").nom === "Jason" && !avertOuvert(), "écran d'atelier ouvert : ni fenêtre ni fermeture (l'affichage reste)");
  $("#ecran-atelier") && $("#ecran-atelier").classList.remove("ouvert");
  await w.sessionVerifier(); await dodo(30);
  ok(w.__get("sessionCourante") === null && connexionOuverte(), "écran d'atelier refermé : la session échue se ferme");

  // ── 9. Prolongée dans un autre onglet : la fenêtre se referme ──
  session("Jason", DUREE * H - 3 * MN); await w.sessionVerifier();
  ok(avertOuvert(), "fenêtre ouverte dans cet onglet");
  w.localStorage.setItem("mtr-session-v1", JSON.stringify({ nom: "Jason", quand: new Date().toISOString() }));
  await w.sessionVerifier();
  ok(!avertOuvert() && w.__get("sessionFinMs")() - Date.now() > (DUREE - 0.01) * H, "« Continuer » fait dans un autre onglet : la fenêtre se referme ici aussi");

  // ── 10. Session sans heure de connexion (vieux format) : jamais fermée ──
  w.localStorage.removeItem("mtr-session-v1"); w.__set("sessionCourante", { nom: "Jason" }); await w.sessionVerifier();
  ok(!avertOuvert() && w.__get("sessionCourante") && w.__get("sessionFinMs")() === Infinity, "session sans heure : ni fenêtre ni fermeture");

  // ── 11. Session échue pendant que l'app était fermée : message au prochain démarrage ──
  w.localStorage.setItem("mtr-session-v1", JSON.stringify({ nom: "Gwendal", quand: new Date(Date.now() - 20 * H).toISOString() }));
  w.chargerSession();
  ok(w.__get("sessionCourante") === null, "au démarrage, session de 20 h : refusée (comme avant)");
  w.ouvrirConnexion();
  ok(/La session de Gwendal a été fermée automatiquement/.test(avis()), "écran de connexion : le message explique pourquoi");
  ok(w.localStorage.getItem("mtr-session-v1") === null, "message montré une seule fois (session retirée)");
  w.ouvrirConnexion();
  ok(avis() === "", "réouverture de l'écran de connexion : plus de message");
  w.localStorage.setItem("mtr-session-v1", JSON.stringify({ nom: "Gwendal", quand: new Date(Date.now() - 1 * H).toISOString() }));
  w.chargerSession(); w.ouvrirConnexion();
  ok(avis() === "", "session encore valide : aucun message");

  // ── 12. Nom échappé ──
  w.__get("EMPLOYES").push({ nom: "<img src=x onerror=alert(1)>", role: "technicien", actif: true });
  session("<img src=x onerror=alert(1)>", DUREE * H - 2 * MN); await w.sessionVerifier();
  ok(!$("#encore-texte img") && /<img/.test($("#encore-texte").textContent), "nom de l'employé affiché comme texte (aucun HTML injecté)");
  w.sessionContinuer();
 } catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
 ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
 process.exit();
})();
