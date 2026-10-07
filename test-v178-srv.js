// test-v178-srv.js — lot SRV de la v178 : capacité par technicien côté Edge (A10) + adresse des rappels (A1-f).
// Test Node PUR (aucun navigateur, aucun réseau) : node test-v178-srv.js          (depuis la racine du dépôt)
// Le TypeScript des fonctions Edge est transpilé avec `typescript.transpileModule` puis exécuté avec un Supabase en mémoire.
//
// CONTRAT figé avec le poste (CALA, lot A10) — demandes_service.creneaux[] = { no, iso, heure, duree, techs: string[] }
//   où `techs` = les noms de TOUS les techniciens capables à la proposition (jamais seulement les libres).
// Fixture figée de ce lot (la vraie sortie de demEnvoyerCreneaux sera comparée à celle-ci en INT, après la fusion de CALA) :
//   FIX = { no: 1, iso: "2026-10-13", heure: "9:00", duree: 60, techs: ["Jason", "Gwendal"] }
// Règle testée : la plage est refusée seulement si (bons non archivés du jour avec heure + créneaux retenus des AUTRES demandes)
// qui chevauchent (tampon compris) sont AU MOINS aussi nombreux que `techs` ; `techs` absent / null / vide = capacité 1 (comportement d'avant).
//
// Variables d'environnement (sabotage à la main) : SRV_SMS, SRV_RDV, SRV_RAP = chemin d'une copie fautive de la fonction à tester.
const fs = require("fs");
const ts = require("/opt/node22/lib/node_modules/typescript");
const SRC = {
  sms: process.env.SRV_SMS || "edge/sms-entrant/index.ts",
  rdv: process.env.SRV_RDV || "edge/rdv-confirmer/index.ts",
  rap: process.env.SRV_RAP || "edge/envoyer-rappels/index.ts",
};

let nOk = 0, nKo = 0;
const sortie = console.log.bind(console); console.log = () => {};   // les fonctions Edge journalisent avec console.log : on ne garde que la sortie du test
const ok = (c, m) => { if (c) nOk++; else nKo++; sortie((c ? "✅ " : "❌ ") + m); };
const cp = (x) => x == null ? x : JSON.parse(JSON.stringify(x));

// ── Supabase en mémoire (select / insert / update / upsert / delete ; eq / in / is ; single / maybeSingle ; select(cols) après une écriture) ──
function creerBase() {
  const db = {}; let id = 1;
  function from(nom) {
    const q = { op: "select", vals: null, f: [], un: false, proj: null };
    const exec = () => {
      const rows = (db[nom] = db[nom] || []);
      const garde = (r) => q.f.every((fn) => fn(r));
      let data;
      if (q.op === "select") data = rows.filter(garde).map(cp);
      else if (q.op === "insert") { data = [].concat(q.vals).map((v) => Object.assign({ id: id++ }, cp(v))); rows.push(...data); }
      else if (q.op === "upsert") { [].concat(q.vals).forEach((v) => { const i = rows.findIndex((r) => r.id === v.id); if (i >= 0) rows[i] = cp(v); else rows.push(cp(v)); }); data = cp(q.vals); }
      else if (q.op === "update") { data = rows.filter(garde); data.forEach((r) => Object.assign(r, cp(q.vals))); }
      else if (q.op === "delete") { data = rows.filter(garde); db[nom] = rows.filter((r) => !garde(r)); }
      if (q.op !== "select") { data = cp(data); if (q.proj && q.proj !== "*") { const cols = q.proj.split(",").map((c) => c.trim()); data = (data || []).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))); } }
      if (q.un) data = Array.isArray(data) ? (data[0] ?? null) : data;
      return { data, error: null };
    };
    const ch = new Proxy({}, { get(_, k) {
      if (k === "then") return (res, rej) => Promise.resolve().then(exec).then(res, rej);
      if (["insert", "update", "upsert", "delete"].includes(k)) return (v) => { q.op = k; q.vals = v; return ch; };
      if (k === "eq") return (c, v) => { q.f.push((r) => r[c] === v); return ch; };
      if (k === "in") return (c, l) => { q.f.push((r) => (l || []).includes(r[c])); return ch; };
      if (k === "is") return (c, v) => { q.f.push((r) => v === null ? r[c] == null : r[c] === v); return ch; };
      if (k === "select") return (cols) => { if (q.op !== "select") q.proj = cols || "*"; return ch; };
      if (k === "single" || k === "maybeSingle") return () => { q.un = true; return ch; };
      return () => ch;   // order, limit
    } });
    return ch;
  }
  return { db, from };
}

// ── charge une fonction Edge : retire l'import, transpile, exécute avec createClient / Deno factices ; expose handler et plageLibre ──
function charger(fichier, base, env) {
  const src = fs.readFileSync(fichier, "utf8").replace(/^import\s*\{\s*createClient\s*\}\s*from\s*"npm:@supabase\/supabase-js@2";\s*$/m, "");
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  const E = Object.assign({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "cle", CRON_SECRET: "sec" }, env || {});
  let handler = null;
  const Deno = { env: { get: (k) => E[k] }, serve: (h) => { handler = h; } };
  const api = new Function("createClient", "Deno", js + "\n;return { plageLibre: typeof plageLibre === 'function' ? plageLibre : null };")(() => ({ from: base.from }), Deno);
  return { handler, plageLibre: api.plageLibre };
}

const ISO = "2026-10-13";
const FIX = { no: 1, iso: ISO, heure: "9:00", duree: 60, techs: ["Jason", "Gwendal"] };   // la fixture figée du contrat
const bon = (o) => Object.assign({ id: "b" + Math.random().toString(36).slice(2, 8), statut: "avenir", echeance: ISO, heure: "9:00", dureeEstimee: 60 }, o);

// base neuve avec : ligne 1 = bons, ligne 7 = réglages (tampon éventuel), creneaux_actifs = créneaux retenus
function monterBase({ bons = [], retenus = [], tampon } = {}) {
  const b = creerBase();
  b.db.tableau = [{ id: 1, donnees: bons.map(bon) }, { id: 3, donnees: [] }, { id: 7, donnees: tampon === undefined ? {} : { rdv: { tampon } } }];
  b.db.creneaux_actifs = retenus.map((r) => Object.assign({ iso: ISO, heure: "9:00", duree_min: 60 }, r));
  return b;
}

(async () => {
  const modules = [["sms-entrant", SRC.sms], ["rdv-confirmer", SRC.rdv]];

  // ══════ A. plageLibre (les deux fonctions : SMS et lien courriel) avec la fixture figée du contrat ══════
  for (const [nom, fichier] of modules) {
    const t = `[${nom}] `;
    const libre = async (o, techs, args) => {
      const b = monterBase(o); const m = charger(fichier, b);
      if (!m.plageLibre) throw new Error("plageLibre introuvable dans " + fichier);
      const a = Object.assign({ iso: FIX.iso, heure: FIX.heure, duree: FIX.duree, sauf: "dem-X" }, args || {});
      return m.plageLibre(a.iso, a.heure, a.duree, a.sauf, techs);
    };
    ok(await libre({}, FIX.techs) === true, t + "techs [Jason, Gwendal], plage vide : libre");
    ok(await libre({ bons: [{}] }, FIX.techs) === true, t + "… 1 bon à 9:00 : libre (il reste une place)");
    ok(await libre({ bons: [{ technicien: "Jason" }] }, FIX.techs) === true, t + "… 1 bon épinglé à Jason : libre (un bon épinglé compte pour UN seul occupant)");
    ok(await libre({ bons: [{}, {}] }, FIX.techs) === false, t + "… 2 bons à 9:00 : occupé (occupants = techs : refusé, c'est le >=)");
    ok(await libre({ bons: [{}, {}, {}] }, FIX.techs) === false, t + "… 3 bons : occupé");
    ok(await libre({ bons: [{}] }, undefined) === false, t + "techs absent (créneau d'avant la v178) + 1 bon : occupé (capacité 1)");
    ok(await libre({ bons: [{}] }, null) === false, t + "techs null + 1 bon : occupé");
    ok(await libre({ bons: [{}] }, []) === false, t + "techs vide + 1 bon : occupé");
    ok(await libre({}, undefined) === true && await libre({}, null) === true && await libre({}, []) === true, t + "sans techs et plage vide : libre");
    ok(await libre({ bons: [{}] }, undefined, {}) === false, t + "ancienne signature (4 arguments) : capacité 1, comportement d'avant");
    ok(await libre({ bons: [{}, {}] }, ["A", "B", "C"]) === true && await libre({ bons: [{}, {}, {}] }, ["A", "B", "C"]) === false, t + "la capacité = le NOMBRE de noms : 3 techs, 2 bons libre, 3 bons occupé");
    ok(await libre({ bons: [{}], retenus: [{ demande_id: "autre" }] }, FIX.techs) === false, t + "1 bon + 1 créneau retenu d'une AUTRE demande : occupé (2 occupants)");
    ok(await libre({ retenus: [{ demande_id: "autre" }] }, FIX.techs) === true, t + "1 seul retenu d'une autre demande : libre");
    ok(await libre({ bons: [{}], retenus: [{ demande_id: "dem-X" }] }, FIX.techs) === true, t + "les retenus de LA MÊME demande (saufDemande) ne comptent pas : libre");
    ok(await libre({ bons: [{}, {}], retenus: [{ demande_id: "dem-X" }, { demande_id: "dem-X" }] }, FIX.techs) === false, t + "… mais les 2 bons, eux, comptent : occupé");
    ok(await libre({ bons: [{}, { statut: "archive" }, { echeance: "2026-10-14" }, { heure: "" }, { heure: undefined }] }, FIX.techs) === true, t + "ne comptent pas : bon archivé, bon d'un autre jour, bon sans heure");
    ok(await libre({ bons: [{ heure: "10:00" }, { heure: "8:00", dureeEstimee: 120 }] }, FIX.techs) === false, t + "tampon de 15 min : un bon à 10:00 et un bon 8:00-10:00 chevauchent 9:00-10:00 : occupé");
    ok(await libre({ bons: [{ heure: "10:15" }, { heure: "10:30" }] }, FIX.techs) === true, t + "… un bon à 10:15 (juste après le tampon) ne chevauche pas : libre");
    ok(await libre({ bons: [{ heure: "10:00" }, { heure: "10:00" }], tampon: 0 }, FIX.techs) === true, t + "tampon réglé à 0 (ligne 7) : deux bons à 10:00 ne chevauchent plus 9:00-10:00");
    ok(await libre({ bons: [{ dureeEstimee: undefined, heure: "9:30" }, { heure: "8:30", dureeEstimee: 30 }] }, FIX.techs) === false, t + "durée absente = 60 min : un bon 9:30 (durée par défaut) et un bon 8:30-9:00 (tampon) chevauchent : occupé");
    ok(await libre({ bons: [{}, {}] }, FIX.techs, { heure: "13:00" }) === true, t + "une autre heure (13:00, sans bon) : libre malgré 2 bons à 9:00");
  }

  // ══════ B. rdv-confirmer (lien « Réserver » du courriel) de bout en bout ══════
  {
    const fetchReel = global.fetch; let appels = [];
    global.fetch = async (u) => { appels.push(String(u)); return new Response("{}", { status: 200 }); };
    const cliquer = async (o) => {
      const b = monterBase(o);
      b.db.demandes_service = [{ id: "dem-1", jeton: "jt", statut: "creneaux_envoyes", nom: "Julie Roy", courriel: "julie@exemple.ca", marque: "Polaris", modele: "RZR", annee: "2020",
        description: "Entretien", creneaux: [o.sansTechs ? { no: 1, iso: ISO, heure: "9:00", duree: 60 } : FIX], duree_min: 60 }];
      b.db.creneaux_reserves = [{ id: 51, demande_id: "dem-1", no: 1, iso: ISO, heure: "9:00", duree_min: 60, statut: "reserve" }];
      const m = charger(SRC.rdv, b);
      const res = await m.handler(new Request("https://x.supabase.co/functions/v1/rdv-confirmer?d=dem-1&c=1&j=jt"));
      return { html: await res.text(), dem: b.db.demandes_service[0], bons: b.db.tableau.find((r) => r.id === 1).donnees };
    };
    let r = await cliquer({ bons: [bon()] });
    ok(/C'est confirmé!/.test(r.html) && r.dem.statut === "confirmee" && r.bons.length === 2, "[rdv-confirmer] lien courriel, techs à 2 + 1 bon : « C'est confirmé! », demande confirmee, 2 bons");
    ok(r.bons[0].technicien === undefined, "[rdv-confirmer] … le bon créé reste sans technicien");
    r = await cliquer({ bons: [bon(), bon()] });
    ok(/vient d'être pris/.test(r.html) && r.dem.statut === "conflit" && r.bons.length === 2, "[rdv-confirmer] techs à 2 + 2 bons : « Ce moment vient d'être pris », demande en conflit, aucun bon créé");
    r = await cliquer({ bons: [bon()], sansTechs: true });
    ok(/vient d'être pris/.test(r.html) && r.dem.statut === "conflit", "[rdv-confirmer] créneau sans techs + 1 bon : conflit (capacité 1, comme avant)");
    r = await cliquer({ bons: [bon()], retenus: [{ demande_id: "autre" }] });
    ok(r.dem.statut === "conflit", "[rdv-confirmer] techs à 2 + 1 bon + 1 retenu d'une autre demande : conflit");
    global.fetch = fetchReel;
  }

  // ══════ C. sms-entrant : le contrat vu du webhook (le créneau du poste, avec techs, est accepté) ══════
  {
    const recevoir = async (o) => {
      const b = monterBase(o);
      b.db.demandes_service = [{ id: "dem-1", statut: "creneaux_envoyes", tel: "+14185550101", nom: "Julie Roy", marque: "Polaris", modele: "RZR", annee: "2020", services: ["Entretien"], description: "",
        creneaux: [o.sansTechs ? { no: 1, iso: ISO, heure: "9:00", duree: 60 } : FIX, { no: 2, iso: ISO, heure: "13:00", duree: 60 }] }];
      b.db.creneaux_reserves = [{ id: 51, demande_id: "dem-1", no: 1, iso: ISO, heure: "9:00", duree_min: 60, statut: "reserve" }, { id: 52, demande_id: "dem-1", no: 2, iso: ISO, heure: "13:00", duree_min: 60, statut: "reserve" }];
      const m = charger(SRC.sms, b);
      const res = await m.handler(new Request("https://x.supabase.co/functions/v1/sms-entrant", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: "+14185550101", To: "+12569214275", Body: o.corps || "1", MessageSid: "SM1" }) }));
      const xml = await res.text();
      return { msg: (xml.match(/<Message>([\s\S]*)<\/Message>/) || [])[1] || null, dem: b.db.demandes_service[0], bons: b.db.tableau.find((r) => r.id === 1).donnees, b };
    };
    let r = await recevoir({ bons: [bon({ technicien: "Jason" })] });
    ok(r.dem.statut === "confirmee" && r.bons.length === 2 && /c'est confirme/.test(r.msg), "[sms-entrant] la fixture du contrat (techs à 2) + 1 bon épinglé à Jason : confirmée par « 1 »");
    ok(r.bons[0].technicien === undefined && r.bons[0].demandeId === "dem-1", "[sms-entrant] … le bon est créé sans technicien");
    r = await recevoir({ bons: [bon(), bon()] });
    ok(r.dem.statut === "conflit" && r.bons.length === 2 && /tout juste d'etre prise/.test(r.msg), "[sms-entrant] techs à 2 + 2 bons : « plage tout juste prise », conflit");
    r = await recevoir({ bons: [bon()], sansTechs: true });
    ok(r.dem.statut === "conflit" && r.bons.length === 1, "[sms-entrant] créneau sans techs + 1 bon : conflit (capacité 1)");
    r = await recevoir({ bons: [bon({ heure: "13:00" })], corps: "2" });
    ok(r.dem.statut === "conflit", "[sms-entrant] « 2 » (créneau sans techs) avec 1 bon à 13:00 : conflit : la capacité est celle du créneau choisi");
    r = await recevoir({ bons: [bon()], corps: "1" });
    ok(r.dem.statut === "confirmee", "[sms-entrant] « 1 » (techs à 2) avec 1 bon à 9:00 : confirmée : chaque créneau porte sa capacité");
  }

  // ══════ D. envoyer-rappels : {adresse} dans les variables du gabarit ══════
  {
    const b = creerBase();
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    b.db.rappels_config = [{ id: "r1", nom: "96 h", actif: true, type: "rappel", canal: "sms", delai_valeur: 96, delai_unite: "heures", ordre: 1, gabarit: "Rappel {prenom} : {machine} au {adresse} ({shop})" }];
    b.db.tableau = [{ id: 1, donnees: [{ id: "b1", statut: "avenir", echeance: demain, heure: "09:00", nom: "RZR 2020", client: "Julie Roy", tel: "819-555-1234" }] }, { id: 3, donnees: [] }];
    const m = charger(SRC.rap, b);
    const res = await m.handler(new Request("https://x.supabase.co/functions/v1/envoyer-rappels?simuler=1&secret=sec"));
    const j = await res.json();
    ok(j.resultats && j.resultats.length === 1 && j.resultats[0].message === "Rappel Julie : RZR 2020 au 1856 rue Jérôme-Hamel, Trois-Rivières (MTR Performance)", "[envoyer-rappels] {adresse} : l'adresse (avec accents) est remplie dans le gabarit du rappel (simulation)");
    const b2 = creerBase(); b2.db.rappels_config = b.db.rappels_config; b2.db.tableau = b.db.tableau;
    const m2 = charger(SRC.rap, b2, { SHOP_ADRESSE: "99 rue Test, Lévis" });
    const j2 = await (await m2.handler(new Request("https://x.supabase.co/functions/v1/envoyer-rappels?simuler=1&secret=sec"))).json();
    ok(j2.resultats && j2.resultats[0] && /au 99 rue Test, Lévis \(/.test(j2.resultats[0].message), "[envoyer-rappels] SHOP_ADRESSE remplace l'adresse par défaut");
  }

  sortie(nKo ? `\n${nKo} échec(s)` : "\nTout passe.");
  sortie("##RESULT " + JSON.stringify({ test: "test-v178-srv.js", ok: nOk, ko: nKo }));
  process.exit(nKo ? 1 : 0);
})().catch((e) => { sortie("❌ exception : " + (e && e.stack || e)); sortie("##RESULT " + JSON.stringify({ test: "test-v178-srv.js", ok: nOk, ko: nKo + 1 })); process.exit(1); });
