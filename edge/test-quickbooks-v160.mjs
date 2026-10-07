// Test de la fonction Edge « quickbooks » (v158 + v159 : ids liés à l'entreprise + v160 : ligne machine, rien sur le BT, service Hivernisation) avec un faux QuickBooks et un faux Supabase.
// node test-quickbooks-v158.mjs chemin/vers/index.ts
import fs from "fs";
import path from "path";
import { transformSync } from "esbuild";
const SRC = process.argv[2];
let ts = fs.readFileSync(SRC, "utf8");
ts = ts.replace(/import \{ createClient \} from "npm:@supabase\/supabase-js@2";/, "const { createClient } = (globalThis as any).__supa;");
const js = transformSync(ts, { loader: "ts", format: "esm" }).code;
const tmp = path.join(path.dirname(new URL(import.meta.url).pathname), "_qb_" + Date.now() + ".mjs");
fs.writeFileSync(tmp, js);

const ok = (c, m) => { console.log((c ? "✅ " : "❌ ") + m); if (!c) process.exitCode = 1; };
// ── Faux Supabase ──
const db = {
  qbo_connexion: [{ id: 1, env: "production", realm_id: "R1", access_token: "AT", refresh_token: "RT",
    access_expire: new Date(Date.now() + 3600e3).toISOString(), refresh_expire: new Date(Date.now() + 50 * 86400e3).toISOString(),
    client_id: "cid", client_secret: "sec", company_name: "Groupe MTR", config: { taxeId: "7", taxeNom: "TPS/TVQ QC" } }],
  qbo_envois: [],
  tableau: [{ id: 4, donnees: [{ nom: "Jason", nomFamille: "Blouin", role: "admin" }, { nom: "Gwendal", nomFamille: "Brossault", role: "technicien" }] }],
};
let utilisateur = "j.blouin@mtr";
function requeteTable(nom) {
  const f = { eq: [], not: [] }; let op = "select", payload = null, ord = null, lim = null;
  const exec = () => {
    let rows = db[nom] || (db[nom] = []);
    if (op === "insert") { const r = { quand: new Date(Date.now() + rows.length).toISOString(), ...payload }; rows.push(r); return { data: null, error: null }; }
    let sel = rows.filter(r => f.eq.every(([k, v]) => String(r[k]) === String(v)) && f.not.every(([k]) => r[k] != null));
    if (op === "update") { sel.forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }
    if (ord) sel = [...sel].sort((a, b) => ord.asc ? (a[ord.k] > b[ord.k] ? 1 : -1) : (a[ord.k] < b[ord.k] ? 1 : -1));
    if (lim) sel = sel.slice(0, lim);
    return { data: sel, error: null };
  };
  const ch = {
    select() { return ch; }, eq(k, v) { f.eq.push([k, v]); return ch; }, not(k) { f.not.push([k]); return ch; },
    order(k, o) { ord = { k, asc: !!(o && o.ascending) }; return ch; }, limit(n) { lim = n; return ch; },
    insert(p) { op = "insert"; payload = p; return ch; }, update(p) { op = "update"; payload = p; return ch; },
    maybeSingle() { const r = exec(); return Promise.resolve({ data: r.data[0] || null, error: null }); },
    single() { const r = exec(); return Promise.resolve({ data: r.data[0] || null, error: null }); },
    then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
  };
  return ch;
}
globalThis.__supa = { createClient: () => ({ from: requeteTable, auth: { getUser: async () => ({ data: { user: utilisateur ? { email: utilisateur } : null } }) } }) };
const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "svc" };
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { globalThis.__handler = h; } };

// ── Faux QuickBooks ──
const Q = {
  Customer: [{ Id: "50", DisplayName: "Marilyn Dubois", Active: true, PrimaryEmailAddr: { Address: "marilyn@x.ca" } },
             { Id: "51", DisplayName: "Ancien Nom", Active: true, PrimaryEmailAddr: { Address: "unique@x.ca" } }],
  Item: [{ Id: "300", Name: "295100522", Type: "Inventory", Active: true, Description: "Filtre à huile BRP" },
         { Id: "301", Name: "Huile XPS 4T", Sku: "WCFQTC", Type: "NonInventory", Active: true },
         { Id: "302", Name: "Pièces", Type: "NonInventory", Active: true },
         { Id: "303", Name: "420956123", Type: "Inventory", Active: false },
         { Id: "304", Name: "Filtres", Type: "Category", Active: true }],
  Account: [{ Id: "1", Name: "Ventes", AccountType: "Income", Active: true }],
  TaxCode: [{ Id: "7", Name: "TPS/TVQ QC - 9,975", Taxable: true }],
  Invoice: [], Estimate: [{ Id: "900", DocNumber: "SO-0047", TxnStatus: "Pending" }],
};
let prochainId = 1000;
const journalHttp = [];
let pieges = {};   // erreurs à simuler
const faute = (status, message, code) => new Response(JSON.stringify({ Fault: { Error: [{ Message: message, Detail: message, code: String(code || "") }] } }), { status });
const valeursIN = (s) => [...s.matchAll(/'((?:\\'|[^'])*)'/g)].map(m => m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\"));
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const meth = (init.method || "GET").toUpperCase();
  const body = init.body && typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : null;
  journalHttp.push({ meth, chemin: u.pathname, q: u.searchParams.get("query"), body });
  if (u.pathname.includes("/oauth2/")) return new Response(JSON.stringify({ access_token: "AT2", refresh_token: "RT2", expires_in: 3600 }), { status: 200 });
  const m = u.pathname.match(/\/v3\/company\/R1\/(\w+)(?:\/(\w+))?/);
  const ent = m[1], id = m[2];
  if (ent === "query") {
    const q = u.searchParams.get("query");
    const [, type] = q.match(/from (\w+)/i);
    let L = Q[type] || [];
    let w;
    if ((w = q.match(/DisplayName = '((?:\\'|[^'])*)'/))) { const v = w[1].replace(/\\'/g, "'"); L = L.filter(x => x.DisplayName.toLowerCase() === v.toLowerCase()); }
    if ((w = q.match(/PrimaryEmailAddr = '((?:\\'|[^'])*)'/))) { if (pieges.emailNonFiltrable) return faute(400, "Property PrimaryEmailAddr not queryable", 4001); const v = w[1]; L = L.filter(x => x.PrimaryEmailAddr && x.PrimaryEmailAddr.Address === v); }
    if ((w = q.match(/Name in \(([^)]*)\)/i))) { const vs = valeursIN(w[1]).map(v => v.toLowerCase()); L = L.filter(x => vs.includes(String(x.Name).toLowerCase())); }
    if ((w = q.match(/Sku in \(([^)]*)\)/i))) { if (pieges.skuNonFiltrable) return faute(400, "Sku not queryable", 4001); const vs = valeursIN(w[1]); L = L.filter(x => x.Sku && vs.includes(x.Sku)); }
    if (!/Active in \(true, false\)/i.test(q)) L = L.filter(x => x.Active !== false);
    if (type === "Account") L = L.filter(x => x.AccountType === "Income");
    return new Response(JSON.stringify({ QueryResponse: { [type]: L } }), { status: 200 });
  }
  if (meth === "GET") {
    const map = { customer: "Customer", invoice: "Invoice", estimate: "Estimate" };
    const x = (Q[map[ent]] || []).find(x => x.Id === id);
    if (!x) return faute(400, "Object Not Found : Something you're trying to use has been made inactive or deleted", 610);
    return new Response(JSON.stringify({ [map[ent]]: x }), { status: 200 });
  }
  if (meth === "POST") {
    if (ent === "customer") {
      if (Q.Customer.some(c => c.DisplayName === body.DisplayName) || (pieges.nomPris && body.DisplayName === pieges.nomPris)) return faute(400, "Duplicate Name Exists Error", 6240);
      const c = { Id: String(prochainId++), Active: true, ...body }; Q.Customer.push(c); return new Response(JSON.stringify({ Customer: c }), { status: 200 });
    }
    if (ent === "item") {
      if (body.Id) { const it = Q.Item.find(x => x.Id === body.Id); Object.assign(it, body); return new Response(JSON.stringify({ Item: it }), { status: 200 }); }
      const it = { Id: String(prochainId++), Active: true, ...body }; Q.Item.push(it); return new Response(JSON.stringify({ Item: it }), { status: 200 });
    }
    if (ent === "invoice") {
      if (body.AutoDocNumber && pieges.autoDoc) return faute(400, "Invalid AutoDocNumber : custom transaction numbers are off", 2010);
      if (body.LinkedTxn && body.LinkedTxn.some(t => t.TxnType === "Estimate") && !body.Id && pieges.devisFerme) return faute(400, "Invalid Reference Id : Estimate is closed", 2500);
      const total = Math.round(body.Line.filter(l => l.Amount != null).reduce((t, l) => t + l.Amount, 0) * 1.14975 * 100) / 100;
      if (body.Id) {
        const ex = Q.Invoice.find(x => x.Id === body.Id);
        if (!body.sparse) return faute(400, "test : on attend une mise à jour sparse", 1);
        Object.assign(ex, body, { SyncToken: String(Number(ex.SyncToken) + 1), TotalAmt: total, Balance: total });
        return new Response(JSON.stringify({ Invoice: ex }), { status: 200 });
      }
      const inv = { Id: String(prochainId++), SyncToken: "0", DocNumber: String(1500 + Q.Invoice.length), ...body, TotalAmt: total, Balance: total };
      Q.Invoice.push(inv); return new Response(JSON.stringify({ Invoice: inv }), { status: 200 });
    }
    if (ent === "estimate") {
      const e = { Id: String(prochainId++), SyncToken: "0", DocNumber: body.DocNumber || "E1", ...body, TotalAmt: 1 }; Q.Estimate.push(e);
      return new Response(JSON.stringify({ Estimate: e }), { status: 200 });
    }
  }
  return faute(500, "route inconnue " + meth + " " + u.pathname);
};

await import(tmp);
fs.unlinkSync(tmp);
const appel = async (corps) => {
  const r = await globalThis.__handler(new Request("https://x.supabase.co/functions/v1/quickbooks", { method: "POST", headers: { Authorization: "Bearer jwt" }, body: JSON.stringify(corps) }));
  return { status: r.status, data: await r.json() };
};
const facture = (extra) => ({
  btId: "bt83", numeroBT: "BT-083", soumissionId: "s47", soumissionNumero: "SO-0047", estimateId: "900", estimateRealm: "R1", date: "2026-09-22",
  machine: "2021 Sea-Doo GTX 170", memo: "Merci !",
  client: { nom: "Alex Paquin", tel: "819-555-0101", courriel: "alex@x.ca", adresse: "12 rue Test", ville: "Trois-Rivières", cp: "G8V 1A1" },
  lignes: [
    { type: "mo", desc: "Hivernisation", qte: 1.5, prix: 95 },
    { type: "art", num: "295100522", desc: "Filtre à huile", qte: 1, prix: 24.99 },
    { type: "art", num: "wcfqtc", desc: "Huile 4T", qte: 3, prix: 23.29 },
    { type: "art", num: "XYZ-1", desc: "Joint torique", qte: 2, prix: 1.005 },
    { type: "art", num: "420956123", desc: "Bougie (produit désactivé)", qte: 1, prix: 12 },
    { type: "art", num: "", desc: "Frais environnementaux", qte: 1, prix: 3.5 },
    { type: "note", desc: "Ajout en atelier :" },
    { type: "art", num: "", desc: "", qte: 0, prix: 0 },
  ], ...(extra || {}) });

// 1) Première facture
let r = await appel({ action: "facturer", facture: facture() });
ok(r.status === 200 && r.data.ok, "facture créée (" + r.status + " " + (r.data.erreur || "") + ")");
const inv = Q.Invoice[0] || {};
ok(r.data.url === "https://app.qbo.intuit.com/app/invoice?txnId=" + inv.Id, "URL de la facture QuickBooks renvoyée (" + r.data.url + ")");
const cli = Q.Customer.find(c => c.DisplayName === "Alex Paquin");
ok(!!cli && r.data.clientCree && cli.PrimaryPhone.FreeFormNumber === "819-555-0101" && cli.PrimaryEmailAddr.Address === "alex@x.ca" && cli.BillAddr.City === "Trois-Rivières" && cli.BillAddr.PostalCode === "G8V 1A1", "client inexistant → créé avec téléphone, courriel et adresse du carnet");
const L = inv.Line || [];
const ventes = L.filter(l => l.DetailType === "SalesItemLineDetail");
const atelier = Q.Item.find(x => x.Name === "Atelier");
ok(!!atelier && atelier.Type === "Service" && ventes[0].SalesItemLineDetail.ItemRef.value === atelier.Id && ventes[0].Description === "Hivernisation" && ventes[0].SalesItemLineDetail.Qty === 1.5 && ventes[0].Amount === 142.5, "main-d'œuvre → article « Atelier » (créé, Service), 1,5 h × 95 $ — pas de service « Hivernisation » dans ce dossier : « Atelier », rien de créé");
ok(!Q.Item.some(x => /hivern/i.test(x.Name)), "v160 : le service « Hivernisation » n'est jamais créé par l'app");
ok(L[0].DetailType === "DescriptionOnly" && L[0].Description === "2021 Sea-Doo GTX 170" && L[0].LineNum === 1, "v160 : 1re ligne = la machine, texte seulement (app d'avant v160 : « machine »)");
ok(ventes[1].SalesItemLineDetail.ItemRef.value === "300" && ventes[1].Description === "Filtre à huile", "295100522 existe dans QuickBooks → ce produit-là");
ok(ventes[2].SalesItemLineDetail.ItemRef.value === "301", "wcfqtc retrouvé par le SKU (casse différente) → produit « Huile XPS 4T »");
ok(ventes[3].SalesItemLineDetail.ItemRef.value === "302" && ventes[3].Description === "XYZ-1 Joint torique" && ventes[3].Amount === 2.01, "pièce inconnue → « Pièce » (ici « Pièces » du dossier) + « numéro description », 2 × 1,005 = 2,01");
ok(ventes[4].SalesItemLineDetail.ItemRef.value === "302" && Q.Item.find(x => x.Id === "303").Active === false, "produit désactivé dans QuickBooks → pas réveillé, la ligne part sur « Pièce »");
ok(ventes[5].SalesItemLineDetail.ItemRef.value === "302" && ventes[5].Description === "Frais environnementaux", "ligne sans numéro → « Pièce » + description");
ok(ventes.length === 6 && L.some(l => l.DetailType === "DescriptionOnly" && l.Description === "Ajout en atelier :"), "ligne vide ignorée, ligne de texte conservée");
ok(ventes.every(l => l.SalesItemLineDetail.TaxCodeRef.value === "7") && inv.GlobalTaxCalculation === "TaxExcluded", "code de taxe TPS/TVQ QC sur chaque ligne, taxes hors prix");
ok(inv.AutoDocNumber === true && !("DocNumber" in (journalHttp.filter(h => h.meth === "POST" && /invoice/.test(h.chemin))[0].body)), "numéro de facture laissé à QuickBooks (AutoDocNumber)");
ok(JSON.stringify(inv.LinkedTxn) === JSON.stringify([{ TxnId: "900", TxnType: "Estimate" }]) && r.data.estimateLie, "facture liée au devis SO-0047 (le devis se ferme dans QuickBooks)");
ok(inv.CustomerMemo.value === "Merci !" && !("PrivateNote" in inv) && !/BT-083|SO-0047|Bon de travail|Soumission/.test(JSON.stringify(inv)) && inv.BillEmail.Address === "alex@x.ca", "v160 : message au client = celui de l'admin seulement ; aucun n° de bon ni de soumission sur la facture (ni mémo de relevé) ; courriel de facturation");
ok(r.data.nbTrouves === 2 && r.data.nbPiece === 3, "compte : 2 produits trouvés, 3 sur « Pièce »");
const j1 = db.qbo_envois.at(-1);
ok(j1.type === "facture" && j1.bt === "bt83" && j1.invoice_id === inv.Id && /client créé/.test(j1.message), "journal qbo_envois : type facture, bon, n° de facture");
ok(!Q.Item.some(x => x.Name === "Pièce"), "aucun doublon « Pièce » créé quand « Pièces » existe déjà");

// 2) Deuxième envoi sans l'id (autre appareil) → mise à jour de la même facture
const nbAvant = Q.Invoice.length;
r = await appel({ action: "facturer", facture: facture({ lignes: [{ type: "mo", desc: "Hivernisation", qte: 2, prix: 95 }] }) });
ok(r.status === 200 && r.data.action === "maj" && Q.Invoice.length === nbAvant && Q.Invoice[0].Line.length === 2 && Q.Invoice[0].Line[0].DetailType === "DescriptionOnly", "2e envoi du même bon (id inconnu de l'appareil) → même facture mise à jour, pas de doublon");
const majCorps = journalHttp.filter(h => h.meth === "POST" && /invoice/.test(h.chemin)).at(-1).body;
ok(majCorps.sparse === true && !("TxnDate" in majCorps) && !("DocNumber" in majCorps) && Q.Invoice[0].DocNumber === inv.DocNumber, "mise à jour partielle : numéro et date de la facture conservés");

// 3) Facture déjà payée → refus clair
Q.Invoice[0].Balance = 0;
r = await appel({ action: "facturer", facture: facture({ qbo: { id: Q.Invoice[0].Id, realm: "R1" } }) });
ok(r.status === 409 && r.data.paye && /paiement/.test(r.data.erreur), "facture déjà payée → refus (409) : correction à faire dans QuickBooks");

// 4) Facture supprimée dans QuickBooks → nouvelle facture
r = await appel({ action: "facturer", facture: facture({ btId: "btX", qbo: { id: "99999", realm: "R1" } }) });
ok(r.status === 200 && r.data.action === "cree", "facture supprimée dans QuickBooks → une nouvelle est créée");

// 5) Devis fermé + numérotation : les deux replis
pieges = { devisFerme: true, autoDoc: true };
r = await appel({ action: "facturer", facture: facture({ btId: "btY" }) });
const dern = Q.Invoice.at(-1);
ok(r.status === 200 && !dern.LinkedTxn && !dern.AutoDocNumber, "devis fermé + AutoDocNumber refusé → facture créée quand même, sans lien");
pieges = {};

// 6) Client retrouvé : par id mémorisé, par nom, par courriel
const nbC = Q.Customer.length;
r = await appel({ action: "facturer", facture: facture({ btId: "b1", client: { nom: "Autre nom", qboId: "50", qboRealm: "R1" } }) });
ok(r.data.clientId === "50" && !r.data.clientCree, "client retrouvé par l'id QuickBooks mémorisé au carnet");
r = await appel({ action: "facturer", facture: facture({ btId: "b2", client: { nom: "marilyn dubois" } }) });
ok(r.data.clientId === "50" && !r.data.clientCree, "client retrouvé par son nom");
r = await appel({ action: "facturer", facture: facture({ btId: "b3", client: { nom: "Nouveau Nom", courriel: "unique@x.ca" } }) });
ok(r.data.clientId === "51" && Q.Customer.length === nbC, "client retrouvé par son courriel (nom changé) — aucun doublon");
pieges = { emailNonFiltrable: true };
r = await appel({ action: "facturer", facture: facture({ btId: "b4", client: { nom: "L'Heureux Réjean", courriel: "rh@x.ca" } }) });
ok(r.status === 200 && r.data.clientCree && Q.Customer.some(c => c.DisplayName === "L'Heureux Réjean"), "apostrophe dans le nom + courriel non filtrable → client créé sans erreur");
pieges = { skuNonFiltrable: true };
r = await appel({ action: "facturer", facture: facture({ btId: "b5" }) });
ok(r.status === 200 && r.data.nbTrouves === 1, "SKU non filtrable dans le dossier → on s'en tient aux noms, sans erreur");
pieges = {};

// 6b) v159 — ids venus d'une AUTRE entreprise (le sandbox) : ignorés
Q.Invoice.push({ Id: "182", SyncToken: "3", DocNumber: "SH1058", TotalAmt: 46.28, Balance: 46.28, Line: [{ Description: "vraie facture" }] });   // vraie facture 182, non payée
const nbI = Q.Invoice.length, nbC2 = Q.Customer.length;
r = await appel({ action: "facturer", facture: facture({ btId: "bt90", qbo: { id: "182", realm: "SANDBOX-9341" }, estimateId: "900", estimateRealm: "SANDBOX-9341",
  client: { nom: "pierre fiset", qboId: "50", qboRealm: "SANDBOX-9341" } }) });
const vraie = Q.Invoice.find(x => x.Id === "182");
ok(r.status === 200 && r.data.action === "cree" && Q.Invoice.length === nbI + 1 && vraie.DocNumber === "SH1058" && vraie.Line[0].Description === "vraie facture",
   "facture 182 du TEST : la vraie facture 182 (SH1058) n'est pas touchée, une nouvelle facture est créée");
ok(r.data.clientId !== "50" && Q.Customer.length === nbC2 + 1 && Q.Customer.at(-1).DisplayName === "pierre fiset", "client 67/50 du TEST : pas réutilisé, le vrai client est retrouvé ou créé par son nom");
ok(!Q.Invoice.at(-1).LinkedTxn, "devis du TEST : pas lié à la nouvelle facture");
ok(/ignoré \(autre entreprise\)/.test(db.qbo_envois.at(-1).message) && db.qbo_envois.at(-1).realm === "R1" && r.data.realm === "R1" && r.data.env === "production", "journal : ids ignorés notés, realm enregistré ; réponse avec realm et env");
r = await appel({ action: "facturer", facture: facture({ btId: "bt91", qbo: { id: "182" } }) });
ok(r.data.action === "cree" && vraie.Line[0].Description === "vraie facture", "id sans entreprise (envoi d'avant v159) : ignoré aussi");
// Journal d'une autre entreprise : pas de mise à jour croisée
db.qbo_envois.push({ quand: new Date().toISOString(), type: "facture", bt: "btS", invoice_id: "182", realm: "SANDBOX-9341", action: "cree" });
r = await appel({ action: "facturer", facture: facture({ btId: "btS" }) });
ok(r.data.action === "cree" && vraie.Line[0].Description === "vraie facture", "journal du TEST (même bon) : ignoré dans la vraie entreprise → nouvelle facture, rien d'écrasé");
r = await appel({ action: "facturer", facture: facture({ btId: "btS" }) });
ok(r.data.action === "maj", "même bon, même entreprise : le 2e envoi met à jour la facture créée (pas de doublon)");
// Devis : id d'une autre entreprise ignoré
r = await appel({ action: "envoyer", soumission: { id: "s9", numero: "SO-0099", clientNom: "Alex Paquin", qbo: { id: "182", realm: "SANDBOX-9341" }, lignes: [{ type: "mo", desc: "Inspection", qte: 1, prix: 95 }] } });
ok(r.status === 200 && r.data.action === "cree" && r.data.realm === "R1", "devis : id d'une autre entreprise ignoré, nouveau devis créé");

// 7) Droits
utilisateur = "g.brossault@mtr";
r = await appel({ action: "facturer", facture: facture({ btId: "b6" }) });
ok(r.status === 403, "technicien → refusé (403)");
utilisateur = "j.blouin@mtr";

// 8) Devis (non-régression) : article trouvé, entête de machine en texte, articles génériques
r = await appel({ action: "envoyer", soumission: { id: "s1", numero: "SO-0100", clientNom: "Alex Paquin", date: "2026-09-22",
  lignes: [{ type: "machine", desc: "GTX 170" }, { type: "mo", desc: "Inspection", qte: 1, prix: 95 }, { type: "art", num: "295100522", desc: "Filtre", qte: 1, prix: 24.99 }, { type: "soustotal", desc: "Option" }] } });
const est = Q.Estimate.at(-1);
ok(r.status === 200 && est.Line.filter(l => l.DetailType === "DescriptionOnly").length === 2 && est.Line.find(l => l.Description === "Filtre").SalesItemLineDetail.ItemRef.value === "300"
   && est.Line.find(l => l.Description === "Inspection").SalesItemLineDetail.ItemRef.value === atelier.Id, "devis : entête machine en texte (plus de ligne à 0 $), produit trouvé, main-d'œuvre sur « Atelier »");
r = await appel({ action: "statut" });
ok(r.data.config.artPieces === "Pièce" && r.data.config.artMO === "Atelier", "réglages par défaut : « Pièce » et « Atelier »");
r = await appel({ action: "facturer", facture: { lignes: [{ type: "art", desc: "", qte: 0, prix: 0 }], client: { nom: "X" } } });
ok(r.status === 502 && /Aucune ligne/.test(r.data.erreur), "facture vide → refusée avec un message clair");

// ═══ v160 ═══
const DESC_HIV = "Changement d'huile\nChangement filtre huile\nRemise a zéro heure entretien\nChangement des bougies\nVérification bague usure et hélice\nHivernisation des hoses a l'eau\nRetrait de la batterie";
Q.Item.push({ Id: "642", Name: "Hivernisation", Type: "Service", Active: true, Description: DESC_HIV, UnitPrice: 105 },
            { Id: "451", Name: "Maintenance 1503 Ponton Switch  Hivernisation", Type: "Service", Active: true, Description: "autre" });
const LM = "2022 Sea-Doo RXP-X 300 · n° de série YDV12345K122 · 123,4 h";
const dernierPost = (ent) => journalHttp.filter(h => h.meth === "POST" && new RegExp("/" + ent + "$").test(h.chemin)).at(-1).body;

// A) Hivernisation : service du dossier + SA description ; ligne machine de l'app v160 ; autre MO sur « Atelier »
r = await appel({ action: "facturer", facture: facture({ btId: "bt160", ligneMachine: LM, memo: "",
  lignes: [{ type: "mo", desc: "Hivernisation / remisage", qte: 1.5, prix: 105 },
           { type: "mo", desc: "Remplacement bague d'usure", qte: 1, prix: 105 },
           { type: "mo", desc: "Main-d'œuvre — Hivernisation", qte: 0.5, prix: 105 },
           { type: "art", num: "295100522", desc: "Filtre à huile", qte: 1, prix: 24.99 }] }) });
let I = Q.Invoice.find(x => x.Id === r.data.id) || {};
let V = (I.Line || []).filter(l => l.DetailType === "SalesItemLineDetail");
ok(r.status === 200 && I.Line[0].DetailType === "DescriptionOnly" && I.Line[0].Description === LM && !I.Line[0].SalesItemLineDetail && I.Line.filter(l => l.Description === LM).length === 1,
   "1re ligne = « " + LM + " » (machine, n° de série, heures), sans produit, une seule fois");
ok(V[0].SalesItemLineDetail.ItemRef.value === "642" && V[0].Description === DESC_HIV && V[0].SalesItemLineDetail.Qty === 1.5 && V[0].SalesItemLineDetail.UnitPrice === 105 && V[0].Amount === 157.5,
   "MO « Hivernisation / remisage » → service « Hivernisation » (642) avec sa description (les travaux faits), 1,5 h × 105 $");
ok(V[1].SalesItemLineDetail.ItemRef.value === atelier.Id && V[1].Description === "Remplacement bague d'usure", "autre main-d'œuvre du même bon → « Atelier » avec sa description");
ok(V[2].SalesItemLineDetail.ItemRef.value === "642" && V[2].Description === DESC_HIV, "ligne « heures punchées » d'une hivernisation (« Main-d'œuvre — Hivernisation ») → service « Hivernisation »");
ok(V[0].SalesItemLineDetail.TaxCodeRef.value === "7", "service Hivernisation : code de taxe TPS/TVQ QC");
ok(!I.CustomerMemo && !("PrivateNote" in I) && !/BT-083|SO-0047/.test(JSON.stringify(I)), "sans message de l'admin : aucun message au client, aucun n° de bon ni de soumission");
ok(JSON.stringify(r.data.services) === JSON.stringify(["Hivernisation"]) && /main-d'œuvre sur « Hivernisation »/.test(db.qbo_envois.at(-1).message), "réponse et journal : main-d'œuvre sur « Hivernisation »");
ok(Q.Item.find(x => x.Id === "451").Description === "autre" && !V.some(l => l.SalesItemLineDetail.ItemRef.value === "451"), "« Maintenance 1503 Ponton Switch Hivernisation » n'est pas pris pour « Hivernisation » (nom exact)");

// B) Ce que la ligne dit de plus est gardé à la fin
r = await appel({ action: "facturer", facture: facture({ btId: "bt161", ligneMachine: LM, lignes: [{ type: "mo", desc: "Hivernisation + shrink wrap", qte: 2, prix: 105 }] }) });
I = Q.Invoice.find(x => x.Id === r.data.id);
ok(I.Line[1].Description === DESC_HIV + "\nHivernisation + shrink wrap", "« Hivernisation + shrink wrap » → description du service + la ligne (rien de perdu)");

// C) La ligne machine n'est pas doublée si l'app l'a déjà mise dans les lignes
r = await appel({ action: "facturer", facture: facture({ btId: "bt162", ligneMachine: LM, lignes: [{ type: "machine", desc: LM }, { type: "mo", desc: "Inspection", qte: 1, prix: 105 }] }) });
I = Q.Invoice.find(x => x.Id === r.data.id);
ok(I.Line.filter(l => l.Description === LM).length === 1 && I.Line[0].Description === LM, "ligne machine déjà présente → pas en double");

// D) Mise à jour d'une facture faite par la v159 : le n° de bon disparaît (message et mémo de relevé)
Q.Invoice.push({ Id: "4700", SyncToken: "0", DocNumber: "1886", TotalAmt: 100, Balance: 100,
  CustomerMemo: { value: "Machine : 2022 RXP-X\nBon de travail BT-093 · Soumission SO-0050" }, PrivateNote: "Bon de travail BT-093 · Soumission SO-0050 · Suivi Garage MTR",
  Line: [{ DetailType: "SalesItemLineDetail", Amount: 100 }] });
r = await appel({ action: "facturer", facture: facture({ btId: "bt93", memo: "", ligneMachine: LM, qbo: { id: "4700", realm: "R1" }, lignes: [{ type: "mo", desc: "Hivernisation", qte: 1, prix: 105 }] }) });
let corpsMaj = dernierPost("invoice");
I = Q.Invoice.find(x => x.Id === "4700");
ok(r.data.action === "maj" && corpsMaj.sparse && corpsMaj.CustomerMemo && corpsMaj.CustomerMemo.value === "" && corpsMaj.PrivateNote === "" && !/BT-093|SO-0050/.test(I.CustomerMemo.value + I.PrivateNote),
   "facture de la v159 mise à jour : message et mémo de relevé vidés (plus de BT-093 ni SO-0050)");
ok(I.Line[0].Description === LM && I.Line[1].SalesItemLineDetail.ItemRef.value === "642", "… et ses lignes refaites : machine en 1re ligne, service Hivernisation");
// Note écrite à la main dans QuickBooks (pas de l'app) : on n'y touche pas
Q.Invoice.push({ Id: "4701", SyncToken: "0", DocNumber: "1887", TotalAmt: 100, Balance: 100, PrivateNote: "Note interne — voir Léa", Line: [] });
r = await appel({ action: "facturer", facture: facture({ btId: "bt94", memo: "Bonne saison !", ligneMachine: LM, qbo: { id: "4701", realm: "R1" }, lignes: [{ type: "mo", desc: "Inspection", qte: 1, prix: 105 }] }) });
corpsMaj = dernierPost("invoice");
ok(!("PrivateNote" in corpsMaj) && Q.Invoice.find(x => x.Id === "4701").PrivateNote === "Note interne — voir Léa" && corpsMaj.CustomerMemo.value === "Bonne saison !",
   "note écrite dans QuickBooks gardée ; message au client = celui de l'admin");

// E) Service Hivernisation désactivé → « Atelier », pas réveillé
Q.Item.find(x => x.Id === "642").Active = false;
r = await appel({ action: "facturer", facture: facture({ btId: "bt163", ligneMachine: LM, lignes: [{ type: "mo", desc: "Hivernisation", qte: 1, prix: 105 }] }) });
I = Q.Invoice.find(x => x.Id === r.data.id);
ok(I.Line[1].SalesItemLineDetail.ItemRef.value === atelier.Id && I.Line[1].Description === "Hivernisation" && Q.Item.find(x => x.Id === "642").Active === false && r.data.services.length === 0,
   "service « Hivernisation » désactivé → la ligne part sur « Atelier », le service n'est pas réactivé");
Q.Item.find(x => x.Id === "642").Active = true;

// F) Pas de main-d'œuvre d'hivernisation → le service n'est même pas cherché
const avantQ = journalHttp.length;
r = await appel({ action: "facturer", facture: facture({ btId: "bt164", ligneMachine: LM, lignes: [{ type: "art", num: "295100522", desc: "Filtre", qte: 1, prix: 24.99 }] }) });
ok(r.status === 200 && !journalHttp.slice(avantQ).some(h => h.q && /Hivernisation/.test(h.q)), "aucune ligne d'hivernisation → aucune requête pour le service");

// G) Devis : même règle pour la main-d'œuvre d'hivernisation
r = await appel({ action: "envoyer", soumission: { id: "s160", numero: "SO-0160", clientNom: "Alex Paquin", lignes: [{ type: "mo", desc: "Hivernisation / remisage", qte: 1.5, prix: 105 }] } });
const E = Q.Estimate.at(-1);
ok(r.status === 200 && E.Line[0].SalesItemLineDetail.ItemRef.value === "642" && E.Line[0].Description === DESC_HIV, "devis : main-d'œuvre d'hivernisation → service « Hivernisation » et sa description");
