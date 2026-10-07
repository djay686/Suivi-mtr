// v176 — Rôle « Réception / Service à la clientèle » : la même maison que l'administration (tableau de bord, téléphone,
//   rendez-vous, pièces, soumissions, clients) ET l'atelier (scanner un bon, travail live, punch), SANS les dossiers
//   employés, la rentabilité, la feuille de temps, le GPS, le marketing, les coûts ni la gestion (supprimer, exporter,
//   réglages, QuickBooks). Deux options par employé : « Voir les coûts » et « Gestion ».
// NODE_PATH=… node test-v176.js ./index.html            (ajouter --sabotages pour rejouer les 15 sabotages)
// Le CORPS (entre les deux marqueurs) tourne aussi tel quel dans un navigateur (window = w, avec w.__NAVIGATEUR = true).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const FICHIER = process.argv[2] || "./index.html";
const htmlOriginal = fs.readFileSync(FICHIER, "utf8");

const table = () => { const ch = new Proxy({}, { get(t, k) { if (k === "then") return (ok) => ok({ data: [], error: null }); return (...a) => (k === "maybeSingle" || k === "single") ? Promise.resolve({ data: null, error: null }) : ch; } }); return ch; };
const sbStub = {
  from: table,
  channel: () => { const o = { on() { return o; }, subscribe() { return o; } }; return o; },
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: { access_token: "ok" } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: {}, error: { message: "x" } }),
  },
  functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }), createSignedUrl: async () => ({ data: null, error: null }) }) },
};
function preparer(html) {
  html = html.replace("</head>", `<script>window.supabase={createClient:()=>window.__sbStub};</script></head>`);
  const i = html.lastIndexOf("</body>");
  return html.slice(0, i) + `<script>window.__set=function(n,v){ eval(n+" = v"); }; window.__get=function(n){ return eval(n); };</script>` + html.slice(i);
}
const dodo = (ms) => new Promise(r => setTimeout(r, ms));

// ════════ CORPS DES TESTS ════════
async function corpsV176(w, ok, dodo) {
  const $ = (s) => w.document.querySelector(s);
  const $$ = (s) => [...w.document.querySelectorAll(s)];
  const navig = !!w.__NAVIGATEUR;                                   // vrai navigateur : on peut lire le style calculé
  const cache = (el) => !el || (navig ? w.getComputedStyle(el).display === "none" : el.classList.contains("cout-seul") || el.classList.contains("gestion-seul"));
  const toasts = () => [...w.document.body.children].filter(el => el.style && el.style.position === "fixed" && el.style.zIndex === "10000").map(el => el.textContent);
  const dernierToast = () => toasts().slice(-1)[0] || "";
  const refuse = () => /Réservé à l'administration/.test(dernierToast());
  const viderToasts = () => [...w.document.body.children].filter(el => el.style && el.style.position === "fixed" && el.style.zIndex === "10000").forEach(el => el.remove());
  const connecter = (nom) => {
    const s = { nom, quand: new Date().toISOString() };
    w.__set("sessionCourante", s); try { w.localStorage.setItem("mtr-session-v1", JSON.stringify(s)); } catch (_) {}
    const cx = $("#ecran-connexion"); if (cx) cx.classList.remove("ouvert");
    w.appliquerDroits();
  };
  const src = w.document.documentElement.outerHTML + "\n" + $$("script").map(s => s.textContent).join("\n");

  w.__set("sb", w.__sbStub); w.__set("chargementOK", true);
  const HOR = { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [8, 12], 6: null };
  w.__set("rdvConfig", { horaire: JSON.parse(JSON.stringify(HOR)), tampon: 15, diner: { actif: true, debut: 12, duree: 60 } });
  w.__set("dispoOverride", {});
  w.__set("commandes", []);
  w.__set("pointages", []);
  w.__set("EMPLOYES", [
    { nom: "Jason", nomFamille: "Blouin", identifiant: "j.blouin", role: "admin", actif: true, compteAuth: true, horaire: null, vacances: [], competences: [] },
    { nom: "Gwendal", nomFamille: "Brossault", identifiant: "g.brossault", role: "technicien", actif: true, compteAuth: true, horaire: null, vacances: [], competences: [] },
    { nom: "Marie", nomFamille: "Lavoie", identifiant: "m.lavoie", role: "reception", actif: true, compteAuth: true, horaire: null, vacances: [], competences: [] },
  ]);
  const M = (o) => Object.assign({ id: o.id, nom: o.nom || "Machine " + o.id, client: o.client || "Client " + o.id, tel: "819-555-0101", type: o.type || "Motomarine", statut: "avenir",
                                   dureeEstimee: 60, machineArrivee: false, pieceComplete: true, pieces: [], chrono: [], creeLe: new Date().toISOString() }, o);
  w.__set("machines", [
    M({ id: "A", nom: "GTX 170", numeroBT: "BT-201", statut: "prete", machineArrivee: true, facturation: { qbo: { id: "7", doc: "1042", total: 453, realm: "prod" }, total: 453, sousTotal: 394 } }),
    M({ id: "B", nom: "RXT-X 300", numeroBT: "BT-202", statut: "afacturer", machineArrivee: true, facturation: { confirmeLe: new Date().toISOString(), sousTotal: 120 } }),
    M({ id: "C", nom: "Spark", numeroBT: "BT-190", statut: "archive", livreLe: "2026-09-01" }),
    M({ id: "D", nom: "Outlander 650", numeroBT: "BT-203", statut: "reparation", machineArrivee: true, type: "VTT",
        pieces: [{ num: "X1", qte: "1", nom: "Courroie", coche: true, coutAchat: 55, prixVente: 89 }] }),
  ]);
  w.__set("catalPieces", [{ num: "X1", desc: "Courroie", prix: 89, cout: 55, suivi: true, qte: 3 }]);

  // ── 1. Le rôle existe, avec ses droits par défaut ──
  ok(w.__get("ROLES").reception === "Réception / Service à la clientèle" && w.roleDe({ role: "reception" }) === "reception" && w.roleDe({ role: "inconnu" }) === "technicien",
     "rôle « reception » dans ROLES et roleDe ; un rôle inconnu retombe sur technicien");
  const D = w.__get("DROITS_DEFAUT").reception;
  const cles = [...w.__get("SECTIONS"), ...w.__get("SOUS_DROITS")].map(s => s.id);
  ok(!!D && cles.every(k => Object.prototype.hasOwnProperty.call(D, k)), "DROITS_DEFAUT.reception a une valeur pour chacune des " + cles.length + " clés (25 sections + 2 options)");
  ok(["tableau", "nouvelle", "scanBT", "live", "punch", "commandes", "calendrier", "ordre", "soumissions", "clients", "inventaire", "archives", "sms", "rappels", "demandes", "communications", "messages", "taches"].every(k => D[k] === true),
     "ouvert : tableau, nouvelle machine, scanner, live, punch, pièces, calendrier, ordre, soumissions, clients, inventaire, archives, SMS, rappels, demandes, communications, messages, tâches");
  ok(["admin", "positions", "marketing", "marketplace", "activites", "checklists", "voirCouts", "gestion"].every(k => D[k] === false),
     "fermé : administration, GPS, marketing, marketplace, activités hors bon, checklists, « Voir les coûts », « Gestion »");
  ok(w.__get("DROITS_DEFAUT").admin.voirCouts === true && w.__get("DROITS_DEFAUT").admin.gestion === true && w.__get("DROITS_DEFAUT").technicien.gestion === false && w.__get("DROITS_DEFAUT").tache.voirCouts === false,
     "l'administration a les deux options ; technicien et homme à tout faire ne les ont pas");
  ok(/<option value="reception">/.test(src), "le dossier employé propose le rôle Réception dans sa liste déroulante");

  // ── 2. Sans session : rien n'est bloqué (mode local) ──
  w.__set("sessionCourante", null); w.appliquerDroits();
  ok(w.peut("voirCouts") && w.peut("gestion") && !w.document.body.classList.contains("sans-couts") && !w.document.body.classList.contains("sans-gestion"),
     "sans session : peut() dit oui et <body> n'a aucune classe de masquage");

  // ── 3. Marie (réception) connectée ──
  connecter("Marie");
  ok(w.estReception() && !w.estAdmin() && !w.peut("voirCouts") && !w.peut("gestion"), "Marie : réception, pas admin, ni coûts ni gestion");
  ok(w.document.body.classList.contains("role-reception") && w.document.body.classList.contains("sans-couts") && w.document.body.classList.contains("sans-gestion"),
     "<body> porte role-reception, sans-couts, sans-gestion");
  ok($('#menu-lateral .menu-item[data-section="admin"]').style.display === "none" && $('#menu-lateral .menu-item[data-section="positions"]').style.display === "none"
     && $('#menu-lateral .menu-item[data-section="marketing"]').style.display === "none", "menu : Administration, Positions, Marketing cachés");
  ok($('#menu-lateral .menu-item[data-section="communications"]').style.display !== "none" && $('#menu-lateral .menu-item[data-section="live"]').style.display !== "none"
     && $('#menu-lateral .menu-item[data-section="inventaire"]').style.display !== "none", "menu : Communications, TV (live), Inventaire visibles");
  connecter("Jason");
  ok(w.peut("voirCouts") && w.peut("gestion") && !w.document.body.classList.contains("sans-couts") && !w.document.body.classList.contains("sans-gestion"), "Jason : tout, aucune classe de masquage");
  connecter("Gwendal");
  ok(!w.peut("gestion") && w.document.body.classList.contains("sans-gestion") && !w.document.body.classList.contains("role-reception"), "Gwendal (technicien) : sans gestion, mais pas « role-reception »");

  // ── 4. Accueil et punch ──
  connecter("Marie");
  w.ouvrirAccueil(); await dodo(900);
  ok($("#ecran-tech").classList.contains("ouvert") && $("#ecran-tech").classList.contains("poste") && $$("#tech-tuiles .tech-tuile").length === 0, "Marie arrive sur « Mon poste » (v177 ; pas les tuiles d'un technicien)");
  ok(/Pense à puncher/.test(toasts().join(" ")), "… avec le rappel « Pense à puncher ton arrivée »");
  w.fermerEcranTech();
  ok(!w.techPunchRequis(), "aucun verrou de punch pour la réception (le téléphone n'attend pas)");
  connecter("Gwendal");
  ok(w.techPunchRequis(), "… le technicien, lui, reste verrouillé tant qu'il n'a pas punché");
  w.ouvrirAccueil();
  ok($("#ecran-tech").classList.contains("ouvert"), "Gwendal arrive sur « Mon écran »");
  w.fermerEcranTech();
  connecter("Marie");
  w.ouvrirPunch();
  ok($("#voile-mon-punch").classList.contains("ouvert") && !$("#voile-punch").classList.contains("ouvert"), "Punch employés → « Mon punch » (jamais la borne à NIP)");
  w.fermerMonPunch();
  w.afficherFeuille();
  ok(refuse() && $("#feuille-contenu").innerHTML === "", "feuille de temps de tout le monde : refusée (vide)");
  w.exporterFeuille();
  ok(refuse(), "export CSV de la feuille : refusé");
  connecter("Jason");
  w.ouvrirPunch();
  ok($("#voile-punch").classList.contains("ouvert"), "Jason garde la borne à NIP");
  w.fermerPunch();

  // ── 5. Tableau de bord : coûts et suppression ──
  connecter("Marie");
  w.afficher();
  const carteA = $$(".carte").find(c => /BT-201/.test(c.textContent));
  const spanMontant = carteA && [...carteA.querySelectorAll(".cout-seul")].find(s => /453/.test(s.textContent));
  ok(!!spanMontant && cache(spanMontant), "carte facturée : le montant (453 $) est dans un élément « cout-seul », caché pour Marie");
  ok(carteA && /Facture n° 1042/.test(carteA.textContent), "… mais « Facture n° 1042 » reste visible");
  const carteB = $$(".carte").find(c => /BT-202/.test(c.textContent));
  ok(carteB && /Facturation prête/.test(carteB.textContent) && cache([...carteB.querySelectorAll(".cout-seul")][0]), "« Facturation prête » sans le montant");
  const poubelle = carteA && carteA.querySelector('.btn-ico[title="Supprimer"]');
  ok(!!poubelle && poubelle.classList.contains("gestion-seul") && cache(poubelle), "poubelle de la carte : cachée (gestion)");
  ok(cache($("#tableau-pied")), "pied du tableau (Exporter / Importer / Sauvegarde automatique) : caché");
  const nAvant = w.__get("machines").length;
  w.supprimer("A");
  ok(refuse() && w.__get("machines").length === nAvant, "supprimer('A') depuis la console : refusé, rien n'est retiré");
  w.exporter(); ok(refuse(), "exporter() : refusé");
  w.restaurer("C"); ok(refuse() && w.__get("machines").find(m => m.id === "C").statut === "archive", "restaurer() une archive : refusé");
  connecter("Jason"); w.afficher();
  const pA = $$(".carte").find(c => /BT-201/.test(c.textContent)).querySelector('.btn-ico[title="Supprimer"]');
  ok(!cache(pA) && !cache($("#tableau-pied")), "Jason : poubelle et pied visibles");

  // ── 6. Fiche machine (formulaire) ──
  connecter("Marie");
  w.ouvrirEdition("D");
  ok($("#voile").classList.contains("ouvert") && !!$("#f-pieces .pc-cout"), "la fiche s'ouvre ; le champ « Coût $ » est TOUJOURS dans le DOM (caché, pas retiré)");
  ok(cache($("#f-pieces .pc-cout")) && !cache($("#f-pieces .pc-vente")), "… « Coût $ » caché, « Vente $ » visible");
  const lus = w.lirePiecesFormulaire();
  ok(lus.length === 1 && lus[0].coutAchat === 55 && lus[0].prixVente === 89, "lirePiecesFormulaire garde le coûtant (55) même caché : rien n'est perdu à l'enregistrement");
  ok(cache($("#btn-supprimer-machine")), "bouton 🗑️ Supprimer de la fiche : caché");
  ok($('#f-statut option[value="afacturer"]').hidden && $('#f-statut option[value="prete"]').hidden && !$('#f-statut option[value="reparation"]').hidden && !$('#f-statut option[value="attente"]').hidden,
     "statuts : « Prêt à facturer » et « Facturé » retirés ; « Réparation en cours » et « En attente de pièce » restent");
  w.supprimerMachineCourante();
  ok(refuse() && !!w.__get("machines").find(m => m.id === "D"), "supprimerMachineCourante() : refusé");
  w.fermerFormulaire();
  connecter("Jason"); w.ouvrirEdition("D");
  ok(!$('#f-statut option[value="afacturer"]').hidden && !cache($("#btn-supprimer-machine")), "Jason : tous les statuts et le bouton Supprimer");
  w.fermerFormulaire();

  // ── 7. Soumissions et inventaire ──
  connecter("Marie");
  w.ouvrirSoumissions(); await dodo(10);
  ok(cache($("#so-tab-reglages")), "soumissions : onglet ⚙️ Réglages caché");
  w.soumOnglet("reglages");
  ok($("#so-tab-liste").classList.contains("actif") && !$("#so-tab-reglages").classList.contains("actif"), "soumOnglet('reglages') retombe sur la liste");
  w.soumOnglet("pieces");
  ok(cache($('#so-vue-pieces th.cout-seul')) && $$("#so-catal td.cout-seul").length === 1 && cache($("#so-catal td.cout-seul")), "catalogue : colonne « Coûtant » cachée (entête et cellule)");
  ok(cache($("#so-btn-qbo")) && $$("#so-vue-edit .gestion-seul").length >= 3, "soumission : Supprimer, QuickBooks, CSV QuickBooks cachés");
  w.qboEnvoyerSoumission(); ok(refuse(), "qboEnvoyerSoumission() : refusé");
  w.soumExporterCatalogue(); ok(refuse(), "soumExporterCatalogue() : refusé");
  w.fermerSoumissions();
  w.ouvrirInventaire(); await dodo(10);
  ok(cache($("#inv-tab-ventes")), "inventaire : onglet 💰 Ventes caché");
  w.invOnglet("ventes");
  ok($("#inv-tab-articles").classList.contains("actif") && !$("#inv-tab-ventes").classList.contains("actif"), "invOnglet('ventes') retombe sur Articles");
  ok(cache($("#inv-kpis .cout-seul")) && /Valeur au coûtant/.test($("#inv-kpis .cout-seul").textContent), "KPI « Valeur au coûtant » caché");
  const carteX1 = $$(".inv-carte").find(c => /X1/.test(c.textContent));
  ok(!!carteX1 && /détail 89/.test(carteX1.textContent.replace(/\s+/g, " ")) && [...carteX1.querySelectorAll(".cout-seul")].every(cache) && carteX1.querySelectorAll(".cout-seul").length === 2,
     "article : « coûtant 55 → » et la marge cachés, « détail 89 » visible");
  w.invFicheOuvrir("X1");
  ok(cache($("#inv-f-cout").closest(".so-champ")) && cache($("#inv-f-marge").closest(".so-champ")) && !cache($("#inv-f-prix").closest(".so-champ")), "fiche article : coûtant et marge cachés, prix de détail visible");
  w.invExporterCSV(); ok(refuse(), "invExporterCSV() : refusé");
  w.invSelSupprimer(); ok(refuse(), "invSelSupprimer() : refusé");
  w.fermerInventaire();
  w.cmdDelaisOuvrir(); ok(refuse() && !$("#voile-cmd-delais"), "⏱️ Délais de commande : refusé");

  // ── 8. Archives, clients, SMS, rappels, communications ──
  w.ouvrirArchives();
  const cA = $$("#voile-archives .carte").find(c => /Spark/.test(c.textContent));
  ok(!!cA && cache(cA.querySelector('.btn-ico[title="Supprimer définitivement"]')) && cache(cA.querySelector(".btn-statut")) && !!cA.querySelector(".btn-bt"),
     "archives : poubelle et « Remettre en Facturé » cachés, le bon de travail ✅ reste");
  w.supprimerArchive("C"); ok(refuse() && !!w.__get("machines").find(m => m.id === "C"), "supprimerArchive() : refusé");
  w.fermerArchives();
  w.ouvrirClients(); await dodo(10);
  ok(cache($('#clients-liste-vue .gestion-seul')) && $$("#clients-liste-vue .gestion-seul").length === 2 && cache($("#c-suppr")), "clients : Importer, Tout effacer, Supprimer cachés");
  w.effacerTousClients(); ok(refuse(), "effacerTousClients() : refusé");
  w.fermerClients();
  w.ouvrirHistoriqueSMS(); w.smsOnglet("modeles");
  ok($$("#aviser-contenu .sms-mod-fiche").length > 0 && $$("#aviser-contenu .sms-mod-sup").length === 0 && !$("#aviser-contenu .sms-mod-actions")
     && $$("#aviser-contenu .sms-zone").every(t => t.readOnly) && /lecture seule/.test($("#aviser-contenu").textContent), "modèles SMS : lecture seule (ni ✕, ni + Nouveau, ni ↺)");
  w.smsViderHisto(); ok(refuse(), "smsViderHisto() : refusé");
  w.smsAjouterModele(); ok(refuse(), "smsAjouterModele() : refusé");
  w.fermerMenuAviser();
  await w.ouvrirRappels(); await dodo(30);
  const ongR = $$("#rap-boite .rap-onglets button").map(b => b.textContent);
  ok(ongR.length === 2 && !ongR.some(t => /Réglages/.test(t)) && /RDV à venir/.test(ongR[0]), "rappels SMS : onglets « RDV à venir » et « Historique » seulement");
  try { $("#rap-fermer").click(); } catch (_) {}
  await w.ouvrirCommunications(); await dodo(30);
  ok(!!$("#comm-boite") && !$("#comm-cfg") && !!$("#comm-messenger"), "communications : pas de ⚙️ Réglages ; bouton « 💬 Messenger ↗ » présent");
  let ouvert = null; const openOrig = w.open; w.open = (u, n) => { ouvert = u; return null; };
  $("#comm-messenger").click();
  ok(/business\.facebook\.com\/latest\/inbox/.test(ouvert || ""), "… il ouvre la boîte Messenger de la Page (Business Suite) dans un autre onglet");
  w.open = openOrig;
  try { $("#comm-fermer").click(); } catch (_) {}
  connecter("Jason");
  await w.ouvrirCommunications(); await dodo(30);
  ok(!!$("#comm-cfg"), "Jason : ⚙️ Réglages des communications présent");
  try { $("#comm-fermer").click(); } catch (_) {}
  await w.ouvrirRappels(); await dodo(30);
  ok($$("#rap-boite .rap-onglets button").some(b => /Réglages/.test(b.textContent)), "Jason : onglet Réglages des rappels présent");
  try { $("#rap-fermer").click(); } catch (_) {}
  w.ouvrirHistoriqueSMS(); w.smsOnglet("modeles");
  ok($$("#aviser-contenu .sms-mod-sup").length > 0 && !!$("#aviser-contenu .sms-mod-actions"), "Jason : modèles SMS modifiables");
  w.fermerMenuAviser();

  // ── 9. Atelier : live, capacité, assignation ──
  connecter("Marie"); viderToasts();   // les refus précédents restent affichés 3,5 s : on repart à neuf
  w.ouvrirLive("D"); await dodo(10);
  ok(w.__get("liveId") === "D" && !refuse() && ($("#live-odo").classList.contains("ouvert") || $("#live-page").classList.contains("ouvert")),
     "Marie entre en travail live sur BT-203 (relevé km/heures demandé comme à un technicien)");
  try { w.liveAnnulerLogin(); } catch (_) {} try { $("#live-odo").classList.remove("ouvert"); } catch (_) {}
  ok(!w.techniciensDisponibles("2026-10-06").some(e => e.nom === "Marie") && w.techniciensDisponibles("2026-10-06").some(e => e.nom === "Gwendal"),
     "capacité de l'atelier (lundi) : Gwendal compte, Marie non");
  ok(!w.ordreTechsJour("2026-10-06").some(t => t.nom === "Marie") && w.ordreTechsJour("2026-10-06").some(t => t.nom === "Gwendal"), "horaire de l'ordre de travail : Marie n'y est pas");
  w.remplirSelectTechniciens("");
  ok([...$("#f-technicien").options].some(o => o.value === "Marie"), "… mais on peut lui assigner un bon à la main (liste « Technicien assigné »)");
  const e0 = w.document.getElementById("tech-btr");
  w.ouvrirEcranTech(); w.fermerEcranTech();
  ok(!e0 || e0.style.display === "none", "pas de rangée « Activités hors bon » sur son écran");

  // ── 10. Dossier employé : les options ──
  connecter("Jason");
  w.nouvelEmploye();
  $("#emp-role").value = "reception"; w.empRoleChange();
  const cases = $$("#emp-droits input[type=checkbox]");
  const c = (id) => cases.find(x => x.dataset.section === id);
  ok(cases.length === w.__get("SECTIONS").length + 2 && !!c("voirCouts") && !!c("gestion") && /Options/.test($("#emp-droits").textContent), "dossier employé : 25 sections + groupe « Options » (Voir les coûts, Gestion)");
  ok(c("live").checked && c("scanBT").checked && c("communications").checked && !c("admin").checked && !c("voirCouts").checked && !c("gestion").checked, "rôle Réception : live, scanner, communications cochés ; administration, coûts, gestion décochés");
  c("voirCouts").checked = true;
  const lusD = w.empLireDroits();
  ok(lusD.voirCouts === true && lusD.gestion === false && lusD.admin === false, "empLireDroits lit les options comme les sections");
  $("#emp-role").value = "admin"; w.empRoleChange();
  ok($$("#emp-droits input[type=checkbox]").every(x => x.checked), "rôle Administration : tout coché, options comprises");
  w.empDroitsDefaut();
  ok($$("#emp-droits input[type=checkbox]").every(x => x.checked), "« Défaut du rôle » garde les options de l'administration cochées");
  // un employé avec l'option cochée dans son dossier la garde
  w.__get("EMPLOYES").find(e => e.nom === "Marie").droits = { voirCouts: true };
  connecter("Marie");
  ok(w.peut("voirCouts") && !w.peut("gestion") && !w.document.body.classList.contains("sans-couts") && w.document.body.classList.contains("sans-gestion"), "Marie avec « Voir les coûts » coché : les coûts reviennent, la gestion reste fermée");
  delete w.__get("EMPLOYES").find(e => e.nom === "Marie").droits;
  w.retourListeEmployes();

  // ── 11. Le code dit ce qu'il doit dire (protège contre un oubli futur) ──
  ok(/body\.sans-couts \.cout-seul, body\.sans-couts \.ligne-piece \.pc-cout \{ display: none !important; \}/.test(src), "CSS : .cout-seul et .pc-cout cachés par body.sans-couts");
  ok(/body\.sans-gestion \.gestion-seul, body\.sans-gestion #tableau-pied, body\.sans-gestion #ong-feuille,\s*body\.sans-gestion #btn-supprimer-machine \{ display: none !important; \}/.test(src), "CSS : .gestion-seul, pied, feuille de temps, Supprimer de la fiche cachés par body.sans-gestion");
  ok(/function garderGestion\(\)/.test(src) && ["supprimer", "exporter", "importer", "activerAuto", "invPoSupprimer", "smsResetModeles", "cmdDelaisOuvrir", "qboExporterCSV"].every(n => new RegExp('"' + n + '"').test(src)), "garderGestion enveloppe les fonctions de gestion (supprimer, exporter, importer, …)");
  ok(/adminSeul = \["afficherFeuille", "exporterFeuille", "exporterFeuilleTemps"\]/.test(src), "la feuille de temps (3 fonctions) reste à l'administration");
  ok(/roleDe\(e\) === "reception"\) return false;\s*\/\/ v176/.test(src), "techniciensDisponibles exclut la réception");
}
// ════════ FIN DU CORPS ════════

// ════════ SABOTAGES ════════ (chaque remplacement doit faire échouer au moins un test)
// SABOTAGES-JSON-BEGIN
const SABOTAGES = [
  { nom: "rôle inconnu de roleDe (la réception redevient technicien)", de: ' || e.role === "reception") return e.role;', a: ') return e.role;' },
  { nom: "administration ouverte par défaut à la réception", de: 'rappels: true, marketing: false, demandes: true, communications: true,\n                voirCouts: false, gestion: false },\n};', a: 'rappels: true, marketing: false, demandes: true, communications: true, admin: true,\n                voirCouts: false, gestion: false },\n};' },
  { nom: "appliquerDroits ne pose plus sans-couts", de: 'document.body.classList.toggle("sans-couts", !!e && !peut("voirCouts"));', a: ';' },
  { nom: "CSS du champ « Coût $ » retiré", de: 'body.sans-couts .cout-seul, body.sans-couts .ligne-piece .pc-cout { display: none !important; }', a: 'body.sans-couts .cout-seul { display: none !important; }' },
  { nom: "la borne à NIP s'ouvre pour tout le monde", de: 'if (utilisateurCourant() && !estAdmin()) { ouvrirMonPunch(); return; }', a: '' },
  { nom: "supprimer() plus enveloppé", de: '"exporter", "importer", "activerAuto", "supprimer",', a: '"exporter", "importer", "activerAuto",' },
  { nom: "verrou de punch appliqué à la réception", de: 'roleDe(e) !== "admin" && roleDe(e) !== "reception" && droitDe(e, "punch")', a: 'roleDe(e) !== "admin" && droitDe(e, "punch")' },
  { nom: "la réception reçoit les tuiles d'un technicien", de: 'if (roleDe(e) === "reception") { posteRendre(e); return; }', a: 'if (false) { posteRendre(e); return; }' },
  { nom: "la réception compte dans la capacité", de: 'if (roleDe(e) === "reception") return false;   // v176', a: '// v176' },
  { nom: "« Prêt à facturer » offert sans gestion", de: 'o.hidden = !estEdition || (!g && (o.value === "afacturer" || o.value === "prete"));', a: 'o.hidden = !estEdition;' },
  { nom: "montant de la facture hors de cout-seul", de: '<span class="cout-seul"> · ${soumArgent(F.qbo.total != null ? F.qbo.total : F.total)}</span>', a: ' · ${soumArgent(F.qbo.total != null ? F.qbo.total : F.total)}' },
  { nom: "dossier employé sans le groupe Options", de: '+ `<div class="emp-droits-options"><div class="emp-droits-titre">Options</div>${SOUS_DROITS.map(case_).join("")}</div>`;', a: ';' },
  { nom: "⚙️ Réglages des communications pour tous", de: '${(typeof peut !== "function" || peut("gestion")) ? `<button class="comm-btn" id="comm-cfg">⚙️ Réglages</button>` : ""}', a: '<button class="comm-btn" id="comm-cfg">⚙️ Réglages</button>' },
  { nom: "peut() dit toujours oui", de: 'function peut(option) { return estAdmin() || droit(option); }', a: 'function peut(option) { return true; }' },
  { nom: "onglet Réglages des rappels pour tous", de: '${g ? t("reglages", "⚙️ Réglages") : ""}', a: '${t("reglages", "⚙️ Réglages")}' },
];
// SABOTAGES-JSON-END

async function lancer(html, silencieux) {
  const resultats = [];
  const ok = (c, m) => { resultats.push({ ok: !!c, m }); if (!silencieux) console.log((c ? "✅ " : "❌ ") + m); };
  const dom = new JSDOM(preparer(html), { runScripts: "dangerously", pretendToBeVisual: true, url: "https://atelier.mtrperformance.ca/",
    beforeParse(w) {
      w.__sbStub = sbStub; w.alert = () => {}; w.confirm = () => true; w.prompt = () => "";
      w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
      w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
      w.open = () => null;
    } });
  const w = dom.window; const erreurs = []; w.addEventListener("error", e => erreurs.push(e.message));
  await dodo(1500);
  try { await corpsV176(w, ok, dodo); }
  catch (e) { ok(false, "exception : " + (e && e.stack || e)); }
  ok(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.length + ")" + (erreurs.length ? " : " + erreurs.slice(0, 3).join(" | ") : ""));
  try { w.close(); } catch (_) {}
  return resultats;
}

(async () => {
  const res = await lancer(htmlOriginal, false);
  const nOk = res.filter(r => r.ok).length;
  console.log(`\n${nOk}/${res.length} tests`);
  if (nOk !== res.length) process.exitCode = 1;
  if (process.argv.includes("--sabotages")) {
    console.log("\n── Sabotages ──");
    let attrapes = 0;
    for (const s of SABOTAGES) {
      if (!htmlOriginal.includes(s.de)) { console.log("⚠️  introuvable dans le code : " + s.nom); continue; }
      const r = await lancer(htmlOriginal.replace(s.de, s.a), true);
      const rates = r.filter(x => !x.ok);
      const casse = rates.some(x => /ReferenceError|SyntaxError/.test(x.m));   // le sabotage a cassé le fichier : ça ne compte pas
      if (rates.length && !casse) attrapes++;
      console.log((casse ? "⚠️  CASSE LE FICHIER : " : rates.length ? "✅ attrapé : " : "❌ PASSÉ INAPERÇU : ") + s.nom + (rates.length ? " (" + rates[0].m.slice(0, 70) + ")" : ""));
    }
    console.log(`${attrapes}/${SABOTAGES.length} sabotages attrapés`);
    if (attrapes !== SABOTAGES.length) process.exitCode = 1;
  }
  process.exit();
})();
