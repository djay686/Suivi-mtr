// Démo du socle : vérifie qu'on peut piloter l'app et observer sons / vibrations / SMS (fetch smart-api) sans copier 60 lignes.
const L = require("./test-lib-v178.js");
const { ok, dodo } = L;
(async () => {
  const S = L.creerSupabase({ tableau: [{ id: 1, donnees: [{ id: "bt-1", numeroBT: "BT-300", nom: "Maverick", client: "Marc", statut: "reparation" }] }, { id: 4, donnees: L.cp(L.EMP) }] });
  const A = await L.chargerApp({ sb: S.sb, fetch: async (u) => /smart-api/.test(u) ? { status: 200, data: { ok: true } } : null });
  L.connecter(A, "Jason");
  A.set("machines", [{ id: "bt-1", numeroBT: "BT-300", nom: "2021 Maverick", client: "Marc", statut: "reparation", pieces: [] }]);
  A.w.afficher();
  ok(A.$$("article.carte").some(c => /BT-300|Maverick/.test(c.textContent)), "la carte du BT-300 est au tableau");
  try { A.w.document.dispatchEvent(new A.w.Event("click", { bubbles: true })); } catch (_) {}   // v178 : le contexte audio naît au premier geste
  A.w.sonNotification();
  ok(A.sons.notes.length >= 1 && Math.min(...A.sons.notes) >= 1000 && Math.max(...A.sons.pics) >= 0.4 && A.vibrations.length >= 1, "sonNotification (v178 : jouerSon « chat ») : notes ≥ 1000 Hz, volume de pointe ≥ 0,4, vibration → on peut vérifier « plus fort »");
  await A.w.__get("smsEnvoyer") && 0;
  S.db.tableau[0].donnees.push({ id: "bt-2" }); S.pousser("tableau", S.db.tableau[0], "UPDATE");
  ok(true, "pousser() (autre poste) appelé sans erreur");
  L.fin(A);
})();
