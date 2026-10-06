// Edge Function « quickbooks » — Groupe MTR Performance
// Relie l'app Suivi Garage à QuickBooks en ligne (API Intuit, OAuth 2.0).
//
//   POST { action: "statut" }                         → état de la connexion + réglages
//   POST { action: "config", clientId, clientSecret, env, config }   (admin)
//   POST { action: "connecter", retour }              → URL d'autorisation Intuit  (admin)
//   POST { action: "deconnecter" }                     (admin)
//   POST { action: "taxes" }                           → codes de taxe du dossier QBO
//   POST { action: "envoyer", soumission, adresse }   → crée / met à jour le DEVIS (Estimate)
//   POST { action: "facturer", facture }               → crée / met à jour la FACTURE (Invoice)   (admin, v158)
//   GET  /callback?code&state&realmId                 → retour d'Intuit après autorisation (public)
//
// v158 — Lignes (devis et facture) :
//   • article dont le numéro existe dans QuickBooks (nom ou SKU du produit) → ce produit-là ;
//   • sinon → article générique « Pièce », description = « numéro description » ;
//   • main-d'œuvre → article « Atelier ».
// Client : retrouvé par son id QuickBooks (mémorisé au carnet), son nom, puis son courriel ; créé sinon
// avec les informations du carnet (téléphone, courriel, adresse).
// v159 — Un id QuickBooks (facture, devis, client) n'a de sens que dans l'entreprise (realm) où il a été
// créé : l'app envoie le realm avec chaque id, et un id venu d'une autre entreprise (ex. l'entreprise de
// TEST) est ignoré. Sans ça, la facture 182 du sandbox aurait pointé vers la facture 182 du vrai dossier.
// v160 (Jason) — Facture :
//   • 1re ligne = la machine (nom, n° de série, heures / km), en texte seulement (aucun produit) ;
//   • rien sur le bon de travail ni la soumission : ni dans le message au client, ni dans le mémo de
//     relevé (PrivateNote, qui s'imprime sur les relevés de compte) — le client n'a pas à voir ça ;
//   • main-d'œuvre d'une hivernisation → service « Hivernisation » du dossier, avec SA description
//     (la liste des travaux faits). Service absent du dossier → « Atelier » comme avant (jamais créé).
// Les jetons Intuit vivent dans la table qbo_connexion (RLS sans politique : clé service seulement).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIGNE_EMPLOYES = 4;

const AUTH_URL   = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL  = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const SCOPE      = "com.intuit.quickbooks.accounting";
const MINOR      = "75";
const REDIRECT_URI = SUPABASE_URL + "/functions/v1/quickbooks/callback";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reponse = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// ─────────────────────────────────────────────────────────────
//  Connexion (ligne unique) + jetons
// ─────────────────────────────────────────────────────────────
type Conn = {
  id: number; client_id: string | null; client_secret: string | null; env: string;
  realm_id: string | null; access_token: string | null; refresh_token: string | null;
  access_expire: string | null; refresh_expire: string | null; company_name: string | null;
  oauth_state: string | null; oauth_expire: string | null; retour_url: string | null;
  config: Record<string, any>;
};

async function lireConn(): Promise<Conn> {
  const { data, error } = await admin.from("qbo_connexion").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error("qbo_connexion : " + error.message);
  if (!data) {
    await admin.from("qbo_connexion").insert({ id: 1 });
    return (await admin.from("qbo_connexion").select("*").eq("id", 1).single()).data as Conn;
  }
  return data as Conn;
}
async function ecrireConn(patch: Partial<Conn>) {
  const { error } = await admin.from("qbo_connexion").update({ ...patch, maj: new Date().toISOString() }).eq("id", 1);
  if (error) throw new Error("qbo_connexion (écriture) : " + error.message);
}
function identifiants(c: Conn) {
  const id = Deno.env.get("QBO_CLIENT_ID") || c.client_id || "";
  const secret = Deno.env.get("QBO_CLIENT_SECRET") || c.client_secret || "";
  return { id, secret, basic: "Basic " + btoa(id + ":" + secret) };
}
const apiBase = (c: Conn) => c.env === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
const appBase = (c: Conn) => c.env === "sandbox" ? "https://app.sandbox.qbo.intuit.com" : "https://app.qbo.intuit.com";
const urlDevis = (c: Conn, id: string) => appBase(c) + "/app/estimate?txnId=" + id;
const urlFacture = (c: Conn, id: string) => appBase(c) + "/app/invoice?txnId=" + id;
// v158 — noms d'articles par défaut (Jason : « Pièce » et « Atelier » dans QuickBooks)
const ART_PIECE_DEFAUT = "Pièce";
const ART_MO_DEFAUT = "Atelier";
// v160 — main-d'œuvre reconnue par sa description → service du dossier QuickBooks (pris tel quel, jamais créé)
const SERVICES_MO = [
  { cle: "hivernisation", re: /hivern|winteri[sz]/i, noms: ["Hivernisation", "Hivernation", "Hivernage"] },
];
const serviceMO = (l: any) => (l && l.type === "mo" && SERVICES_MO.find(s => s.re.test(String(l.desc || "")))) || null;
const connecte = (c: Conn) => !!(c.realm_id && c.refresh_token && c.refresh_expire && new Date(c.refresh_expire) > new Date());

class ReconnexionRequise extends Error {}
// v159 — l'id vient-il de l'entreprise branchée ? (sans realm = envoi d'avant v159 = entreprise inconnue → non)
const memeEntreprise = (c: Conn, realm: any) => !!(realm && c.realm_id && String(realm) === String(c.realm_id));

async function echangerJetons(c: Conn, params: Record<string, string>) {
  const { basic } = identifiants(c);
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Authorization": basic, "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Intuit (jetons) : " + (j.error_description || j.error || r.status));
  const now = Date.now();
  const patch: Partial<Conn> = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    access_expire: new Date(now + (Number(j.expires_in) || 3600) * 1000).toISOString(),
    refresh_expire: new Date(now + (Number(j.x_refresh_token_expires_in) || 100 * 86400) * 1000).toISOString(),
  };
  await ecrireConn(patch);
  return { ...c, ...patch } as Conn;
}

// Jeton d'accès valide, rafraîchi au besoin (le refresh token TOURNE à chaque rafraîchissement : on le réécrit)
async function jetonValide(c: Conn): Promise<Conn> {
  if (!connecte(c)) throw new ReconnexionRequise("QuickBooks n'est pas connecté (ou l'autorisation a expiré) — reconnecte-le dans les réglages");
  if (c.access_token && c.access_expire && new Date(c.access_expire).getTime() - Date.now() > 90_000) return c;
  try {
    return await echangerJetons(c, { grant_type: "refresh_token", refresh_token: c.refresh_token! });
  } catch (e) {
    const msg = (e as Error).message || "";
    if (/invalid_grant|invalid_client/i.test(msg)) {
      await ecrireConn({ access_token: null, refresh_token: null, access_expire: null, refresh_expire: null });
      throw new ReconnexionRequise("Autorisation QuickBooks révoquée ou expirée — reconnecte-le dans les réglages");
    }
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
//  Appels à l'API QuickBooks
// ─────────────────────────────────────────────────────────────
function messageFaute(j: any, status: number) {
  try {
    const f = j.Fault || (j.fault);
    const e = (f && (f.Error || f.error) || [])[0];
    if (e) return [e.Message || e.message, e.Detail || e.detail, e.code ? "(code " + e.code + ")" : ""].filter(Boolean).join(" — ");
  } catch (_) {}
  return "QuickBooks a répondu " + status;
}
async function qbo(c: Conn, method: string, chemin: string, body?: unknown, essai = 0): Promise<{ conn: Conn; data: any }> {
  c = await jetonValide(c);
  const sep = chemin.includes("?") ? "&" : "?";
  const r = await fetch(apiBase(c) + "/v3/company/" + c.realm_id + "/" + chemin + sep + "minorversion=" + MINOR, {
    method,
    headers: { "Authorization": "Bearer " + c.access_token, "Accept": "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  let j: any = {};
  try { j = txt ? JSON.parse(txt) : {}; } catch (_) { j = { brut: txt }; }
  if (r.status === 401 && essai === 0) {
    // jeton refusé malgré la date : on force un rafraîchissement, une seule fois
    c = await echangerJetons(c, { grant_type: "refresh_token", refresh_token: c.refresh_token! });
    return qbo(c, method, chemin, body, 1);
  }
  if (!r.ok) {
    const err: any = new Error(messageFaute(j, r.status));
    err.code = (((j.Fault || {}).Error || [])[0] || {}).code || "";
    err.status = r.status;
    throw err;
  }
  return { conn: c, data: j };
}
const sqlEsc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
async function requete(c: Conn, sql: string) {
  const { conn, data } = await qbo(c, "GET", "query?query=" + encodeURIComponent(sql));
  return { conn, res: (data.QueryResponse || {}) as Record<string, any[]> };
}

// ── Client QBO : retrouvé (id mémorisé → nom d'affichage → courriel), créé sinon ──
// cli = { nom, tel, courriel, adresse, ville, cp, qboId }  (v158 : infos du carnet de l'app)
const courrielValide = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
async function assurerClient(c: Conn, cli: any) {
  cli = cli || {};
  let nom = String(cli.nom || "").replace(/:/g, " ").replace(/\s+/g, " ").trim();
  if (!nom) nom = "Client sans nom";
  if (nom.length > 100) nom = nom.slice(0, 100);
  // 1) id QuickBooks déjà connu (retenu au carnet lors d'un envoi précédent)
  if (cli.qboId) {
    try {
      const g = await qbo(c, "GET", "customer/" + encodeURIComponent(String(cli.qboId))); c = g.conn;
      const x = g.data.Customer;
      if (x && x.Id && x.Active !== false) return { conn: c, id: String(x.Id), cree: false, nom: x.DisplayName as string };
    } catch (e: any) {
      if (e instanceof ReconnexionRequise) throw e;   // sinon : client supprimé / fusionné → on cherche autrement
    }
  }
  // 2) même nom d'affichage
  let r = await requete(c, `select * from Customer where DisplayName = '${sqlEsc(nom)}'`);
  c = r.conn;
  let cl = (r.res.Customer || [])[0];
  if (cl) return { conn: c, id: cl.Id as string, cree: false, nom: cl.DisplayName as string };
  // 3) même courriel (un seul client porteur, sinon on ne devine pas)
  const courriel = String(cli.courriel || "").trim();
  if (courrielValide(courriel)) {
    try {
      const rq = await requete(c, `select * from Customer where PrimaryEmailAddr = '${sqlEsc(courriel)}'`);
      c = rq.conn;
      const L = (rq.res.Customer || []).filter((x: any) => x.Active !== false);
      if (L.length === 1) return { conn: c, id: String(L[0].Id), cree: false, nom: L[0].DisplayName as string };
    } catch (e: any) {
      if (e instanceof ReconnexionRequise) throw e;   // champ non filtrable sur ce dossier : on passe
    }
  }

  // 4) création avec les informations du carnet
  const tel = String(cli.tel || "").trim();
  const corps: any = { DisplayName: nom };
  if (tel) corps.PrimaryPhone = { FreeFormNumber: tel };
  if (courrielValide(courriel)) corps.PrimaryEmailAddr = { Address: courriel };
  if (cli.adresse || cli.ville || cli.cp) {
    corps.BillAddr = { Line1: String(cli.adresse || ""), City: String(cli.ville || ""), PostalCode: String(cli.cp || ""), CountrySubDivisionCode: "QC", Country: "Canada" };
  }
  try {
    const { conn, data } = await qbo(c, "POST", "customer", corps);
    return { conn, id: data.Customer.Id as string, cree: true, nom: data.Customer.DisplayName as string };
  } catch (e: any) {
    // 6240 = nom déjà pris (ex. un fournisseur ou un employé porte ce nom) : on suffixe
    if (String(e.code) !== "6240") throw e;
    corps.DisplayName = nom + " (client)";
    r = await requete(c, `select * from Customer where DisplayName = '${sqlEsc(corps.DisplayName)}'`);
    cl = (r.res.Customer || [])[0];
    if (cl) return { conn: r.conn, id: cl.Id, cree: false, nom: cl.DisplayName };
    const { conn, data } = await qbo(r.conn, "POST", "customer", corps);
    return { conn, id: data.Customer.Id as string, cree: true, nom: data.Customer.DisplayName as string };
  }
}

// ── Compte de revenus pour créer un article manquant ──
async function compteRevenu(c: Conn) {
  const r = await requete(c, "select * from Account where AccountType = 'Income' and Active = true maxresults 100");
  const liste = r.res.Account || [];
  if (!liste.length) throw new Error("Aucun compte de revenus actif dans QuickBooks : impossible de créer l'article");
  const pref = liste.find((a: any) => /vente|sales|revenu|income/i.test(a.Name) && !/rabais|discount|escompte|shipping|livraison/i.test(a.Name)) || liste[0];
  return { conn: r.conn, id: pref.Id as string };
}
// ── Article générique QBO : le premier nom trouvé parmi les variantes, créé (1er nom) s'il manque ──
// v158 — « Pièce » peut s'écrire « Pièces », « Piece »… dans le dossier : on prend celui qui existe.
const sansAccent = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
function variantesNom(nom: string, autres: string[]) {
  const out: string[] = [];
  for (const v of [nom, ...autres]) {
    const t = String(v || "").trim();
    if (t && !out.some(x => x === t)) out.push(t);
    const u = t.toUpperCase();
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}
async function assurerArticle(c: Conn, nom: string, type: "NonInventory" | "Service", autres: string[] = []) {
  nom = String(nom || "").trim();
  const noms = variantesNom(nom, autres);
  const r = await requete(c, `select * from Item where Name in (${noms.map(n => `'${sqlEsc(n)}'`).join(",")}) and Active in (true, false)`);
  c = r.conn;
  const trouves = (r.res.Item || []).filter((x: any) => x.Type !== "Category" && x.Type !== "Group");
  // ordre de préférence = ordre des noms (le nom réglé d'abord), comparaison sans accent ni casse
  let it: any = null;
  for (const n of noms) { it = trouves.find((x: any) => sansAccent(x.Name) === sansAccent(n)); if (it) break; }
  if (!it) it = trouves[0] || null;
  if (it) {
    if (it.Active === false) { const u = await qbo(c, "POST", "item", { Id: it.Id, SyncToken: it.SyncToken, sparse: true, Active: true }); c = u.conn; }
    return { conn: c, id: it.Id as string, cree: false, nom: it.Name as string };
  }
  const cr = await compteRevenu(c);
  const { conn, data } = await qbo(cr.conn, "POST", "item", { Name: nom, Type: type, IncomeAccountRef: { value: cr.id }, Taxable: true });
  return { conn, id: data.Item.Id as string, cree: true, nom };
}
// v160 — service existant du dossier (actif seulement), avec sa description. Jamais créé ni réveillé :
// sa description (la liste des travaux) est écrite par Jason dans QuickBooks.
async function trouverService(c: Conn, noms: string[]) {
  const variantes = variantesNom(noms[0], noms.slice(1));
  const r = await requete(c, `select * from Item where Name in (${variantes.map(n => `'${sqlEsc(n)}'`).join(",")})`);
  const L = (r.res.Item || []).filter((x: any) => x && x.Active !== false && x.Type !== "Category" && x.Type !== "Group");
  let it: any = null;
  for (const n of variantes) { it = L.find((x: any) => sansAccent(x.Name) === sansAccent(n)); if (it) break; }
  return { conn: r.conn, service: it ? { id: String(it.Id), nom: String(it.Name || ""), desc: String(it.Description || "").trim() } : null };
}
// Description d'une ligne sur un service : celle du service ; ce que la ligne dit de plus (« + shrink wrap »)
// est ajouté à la fin, pour ne rien perdre.
function descService(descArticle: string, descLigne: string) {
  const a = String(descArticle || "").trim(), d = String(descLigne || "").trim();
  if (!a) return d || "Main-d'œuvre";
  const reste = d.replace(/main[\s\-]*d['’]?\s*(œ|oe)uvre/gi, " ")
    .replace(/hivernisation|hivernation|hivernage|winteri[sz]ation|remisage|package|forfait|motomarine|bateau|ponton|compl[eè]te?/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return reste.length >= 3 ? a + "\n" + d : a;
}

// ── v158 : produits QBO correspondant aux numéros de pièce (nom du produit, puis SKU) ──
// Retourne une table numéro normalisé → { id, nom, desc }. Seuls les produits ACTIFS comptent :
// un produit désactivé dans QuickBooks n'est pas réveillé, la ligne part sur « Pièce ».
const normNum = (s: any) => String(s ?? "").trim().toUpperCase().replace(/[\s\-_.]/g, "");
async function trouverArticles(c: Conn, nums: string[]) {
  const table = new Map<string, { id: string; nom: string; desc: string }>();
  const bruts = [...new Set(nums.map(n => String(n || "").trim()).filter(Boolean))];
  if (!bruts.length) return { conn: c, table };
  const cibles = new Set(bruts.map(normNum));
  const garder = (L: any[], champ: "Name" | "Sku") => {
    for (const x of L) {
      if (!x || x.Active === false || x.Type === "Category" || x.Type === "Group") continue;
      const k = normNum(x[champ]);
      if (k && cibles.has(k) && !table.has(k)) table.set(k, { id: String(x.Id), nom: String(x.Name || ""), desc: String(x.Description || "") });
    }
  };
  // les variantes : tel quel, en majuscules, et sans tirets/espaces (le catalogue les enlève)
  const variantes = (liste: string[]) => [...new Set(liste.flatMap(n => [n, n.toUpperCase(), normNum(n)]).filter(Boolean))];
  const paquets = (L: string[]) => { const out: string[][] = []; for (let i = 0; i < L.length; i += 25) out.push(L.slice(i, i + 25)); return out; };
  for (const p of paquets(variantes(bruts))) {
    const r = await requete(c, `select * from Item where Name in (${p.map(n => `'${sqlEsc(n)}'`).join(",")}) maxresults 1000`);
    c = r.conn;
    garder(r.res.Item || [], "Name");
  }
  const restants = bruts.filter(n => !table.has(normNum(n)));
  if (restants.length) {
    try {
      for (const p of paquets(variantes(restants))) {
        const r = await requete(c, `select * from Item where Sku in (${p.map(n => `'${sqlEsc(n)}'`).join(",")}) maxresults 1000`);
        c = r.conn;
        garder(r.res.Item || [], "Sku");
      }
    } catch (e: any) {
      if (e instanceof ReconnexionRequise) throw e;   // SKU désactivé dans ce dossier : on s'en tient aux noms
    }
  }
  return { conn: c, table };
}
// ── Code de taxe : celui des réglages, sinon le TPS/TVQ du Québec ──
async function listerTaxes(c: Conn) {
  const r = await requete(c, "select * from TaxCode where Active = true maxresults 200");
  const liste = (r.res.TaxCode || []).map((t: any) => ({
    id: String(t.Id), nom: t.Name || "", desc: t.Description || "", taxable: t.Taxable !== false,
  }));
  return { conn: r.conn, liste };
}
function choisirTaxeQC(liste: { id: string; nom: string; desc: string; taxable: boolean }[]) {
  const ok = liste.filter(t => t.taxable && !/exempt|exon|zero|z[ée]ro|hors|out of scope|0\s*%/i.test(t.nom));
  return ok.find(t => /QC/i.test(t.nom) && /TPS|GST/i.test(t.nom) && /TVQ|QST/i.test(t.nom))
      || ok.find(t => /TPS\/TVQ|GST\/QST/i.test(t.nom))
      || ok.find(t => /QC|Qu[ée]bec/i.test(t.nom))
      || ok[0] || null;
}
async function assurerTaxe(c: Conn) {
  const cfg = c.config || {};
  if (cfg.taxeId) return { conn: c, id: String(cfg.taxeId), nom: cfg.taxeNom || "" };
  const { conn, liste } = await listerTaxes(c);
  const t = choisirTaxeQC(liste);
  if (!t) throw new Error("Aucun code de taxe trouvé dans QuickBooks — choisis-en un dans les réglages");
  const config = { ...cfg, taxeId: t.id, taxeNom: t.nom };
  await ecrireConn({ config });
  return { conn: { ...conn, config }, id: t.id, nom: t.nom };
}

// ── Lignes de vente (devis et facture) ──
// Arrondi au cent, sans l'erreur binaire de 1,005 → 1,00
const arrondi = (n: number) => Math.round(((Number(n) || 0) + (n >= 0 ? 1 : -1) * 1e-9) * 100) / 100;
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(",", ".").replace(/[^\d.\-]/g, "")); return isNaN(n) ? 0 : n; };
const estTexte = (l: any) => l && (l.type === "soustotal" || l.type === "machine" || l.type === "note");
const estVente = (l: any) => l && !estTexte(l) && (String(l.desc || "").trim() || String(l.num || "").trim() || num(l.qte) * num(l.prix));

// Prépare tout ce qu'il faut pour écrire les lignes : produits trouvés, génériques « Pièce » / « Atelier », taxe
async function preparerLignes(c: Conn, lignes: any[]) {
  const cfg = c.config || {};
  const ventes = (lignes || []).filter(estVente);
  if (!ventes.length) throw new Error("Aucune ligne avec un montant");
  const nums = ventes.filter(l => l.type !== "mo").map(l => String(l.num || "").trim()).filter(Boolean);
  const ta = await trouverArticles(c, nums); c = ta.conn;
  const besoinPiece = ventes.some(l => l.type !== "mo" && !ta.table.has(normNum(l.num)));
  // v160 — services de main-d'œuvre (hivernisation…) : cherchés seulement si une ligne en a besoin
  const services = new Map<string, { id: string; nom: string; desc: string }>();
  for (const sv of SERVICES_MO) {
    if (!ventes.some(l => serviceMO(l) === sv)) continue;
    const t = await trouverService(c, sv.noms); c = t.conn;
    if (t.service) services.set(sv.cle, t.service);
  }
  const besoinMO = ventes.some(l => l.type === "mo" && !(serviceMO(l) && services.has(serviceMO(l)!.cle)));
  let idPiece = "", idMO = "", nomPiece = "", nomMO = "";
  if (besoinPiece) { const a = await assurerArticle(c, cfg.artPieces || ART_PIECE_DEFAUT, "NonInventory", ["Pièce", "Pièces", "Piece", "Pieces"]); c = a.conn; idPiece = a.id; nomPiece = a.nom; }
  if (besoinMO) { const a = await assurerArticle(c, cfg.artMO || ART_MO_DEFAUT, "Service", ["Atelier"]); c = a.conn; idMO = a.id; nomMO = a.nom; }
  const tx = await assurerTaxe(c); c = tx.conn;
  return { conn: c, table: ta.table, services, idPiece, idMO, nomPiece, nomMO, taxeId: tx.id };
}
function lignesVente(lignes: any[], p: { table: Map<string, any>; services?: Map<string, any>; idPiece: string; idMO: string; taxeId: string }) {
  const out: any[] = [];
  let n = 0, nbTrouves = 0, nbPiece = 0, nbMO = 0;
  const servicesPris: string[] = [];
  for (const l of (lignes || [])) {
    if (!l) continue;
    if (estTexte(l)) {
      const d = String(l.desc || "").trim();
      if (d) out.push({ LineNum: ++n, DetailType: "DescriptionOnly", Description: d.slice(0, 4000), DescriptionLineDetail: {} });
      continue;
    }
    if (!estVente(l)) continue;                          // ligne vide (rien d'écrit, aucun montant)
    const qte = num(l.qte), prix = num(l.prix);
    const numero = String(l.num || "").trim(), desc = String(l.desc || "").trim();
    let itemId: string, description: string;
    if (l.type === "mo") {
      const sv = serviceMO(l);
      const svc = sv && p.services ? p.services.get(sv.cle) : null;
      if (svc) {                                         // v160 : service du dossier + sa description
        itemId = svc.id;
        description = descService(svc.desc, desc);
        if (!servicesPris.includes(svc.nom)) servicesPris.push(svc.nom);
      } else {
        itemId = p.idMO; nbMO++;
        description = desc || "Main-d'œuvre";
      }
    } else {
      const trouve = numero ? p.table.get(normNum(numero)) : null;
      if (trouve) {                                      // le produit existe dans QuickBooks
        itemId = trouve.id; nbTrouves++;
        description = desc || trouve.desc || numero;
      } else {                                           // sinon : « Pièce » + numéro et description
        itemId = p.idPiece; nbPiece++;
        description = [numero, desc].filter(Boolean).join(" ") || "Pièce";
      }
    }
    out.push({
      LineNum: ++n,
      DetailType: "SalesItemLineDetail",
      Amount: arrondi(qte * prix),
      Description: description.slice(0, 4000),
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: qte, UnitPrice: prix,
        TaxCodeRef: { value: p.taxeId },
      },
    });
  }
  return { Line: out, nbTrouves, nbPiece, nbMO, services: servicesPris };
}

async function envoyerDevis(c: Conn, s: any, adresse: any, par: string) {
  const cl = await assurerClient(c, {
    nom: s.clientNom, tel: s.tel, courriel: s.courriel, qboId: s.clientQboId || "",
    adresse: adresse ? adresse.adresse : "", ville: adresse ? adresse.ville : "", cp: adresse ? adresse.cp : "",
  }); c = cl.conn;
  const prep = await preparerLignes(c, s.lignes || []); c = prep.conn;

  const { Line } = lignesVente(s.lignes || [], prep);
  if (!Line.some(l => l.DetailType === "SalesItemLineDetail")) throw new Error("La soumission n'a aucune ligne avec un montant");

  const machine = [s.annee, s.marque, s.modele].filter(Boolean).join(" ").trim();
  const corps: any = {
    CustomerRef: { value: cl.id },
    TxnDate: /^\d{4}-\d{2}-\d{2}$/.test(String(s.date || "")) ? s.date : new Date().toISOString().slice(0, 10),
    GlobalTaxCalculation: "TaxExcluded",
    Line,
    PrivateNote: ("Soumission " + (s.numero || "") + (machine ? " — " + machine : "") + " · Suivi Garage MTR").slice(0, 4000),
  };
  if (s.numero) corps.DocNumber = String(s.numero).slice(0, 21);
  const courriel = String(s.courriel || "").trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courriel)) corps.BillEmail = { Address: courriel };
  const memo = [machine ? "Machine : " + machine : "", String(s.notes || "").trim()].filter(Boolean).join("\n");
  if (memo) corps.CustomerMemo = { value: memo.slice(0, 1000) };

  // Déjà envoyée ? → mise à jour complète du même devis (SyncToken obligatoire)
  const dejaId = s.qbo && s.qbo.id ? String(s.qbo.id) : "";
  if (dejaId) {
    try {
      const g = await qbo(c, "GET", "estimate/" + dejaId); c = g.conn;
      const ex = g.data.Estimate;
      if (ex && ex.Id) {
        corps.Id = ex.Id; corps.SyncToken = ex.SyncToken; corps.sparse = false;
        if (ex.DocNumber) corps.DocNumber = ex.DocNumber;   // on garde le numéro que QBO lui a donné
        const u = await qbo(c, "POST", "estimate", corps); c = u.conn;
        const E = u.data.Estimate;
        return { conn: c, id: String(E.Id), doc: E.DocNumber || "", total: E.TotalAmt, action: "maj", client: cl, url: urlDevis(c, E.Id) };
      }
    } catch (e: any) {
      if (e.status !== 400 && e.status !== 404 && !/deleted|supprim|introuvable|not found|6240|610/i.test(e.message || "")) throw e;
      // le devis n'existe plus dans QBO : on en crée un nouveau
    }
  }
  let cr;
  try {
    cr = await qbo(c, "POST", "estimate", corps);
  } catch (e: any) {
    // 6140 : numéro de document déjà utilisé (numérotation personnalisée activée) → on laisse QBO numéroter
    if (String(e.code) !== "6140" && !/Duplicate Document Number/i.test(e.message || "")) throw e;
    delete corps.DocNumber;
    cr = await qbo(c, "POST", "estimate", corps);
  }
  c = cr.conn;
  const E = cr.data.Estimate;
  return { conn: c, id: String(E.Id), doc: E.DocNumber || "", total: E.TotalAmt, action: "cree", client: cl, url: urlDevis(c, E.Id) };
}

// ─────────────────────────────────────────────────────────────
//  v158 — FACTURE (Invoice) à partir de la facturation confirmée d'un bon de travail
//  f = { btId, numeroBT, soumissionId, soumissionNumero, estimateId, date, machine, memo,
//        client: { nom, tel, courriel, adresse, ville, cp, qboId }, lignes: [...], qbo: { id } }
// ─────────────────────────────────────────────────────────────
class RefusFacture extends Error {}
async function envoyerFacture(c: Conn, f: any) {
  const cl = await assurerClient(c, f.client || {}); c = cl.conn;
  const prep = await preparerLignes(c, f.lignes || []); c = prep.conn;
  // v160 — 1re ligne : la machine (nom, n° de série, heures / km), texte seulement. L'app v160 l'envoie
  // toute faite (ligneMachine) ; une app plus vieille n'envoie que « machine ».
  const ligneMachine = String(f.ligneMachine || f.machine || "").replace(/\s+/g, " ").trim();
  const lignes = (f.lignes || []).filter((l: any) => !(ligneMachine && l && l.type === "machine" && String(l.desc || "").replace(/\s+/g, " ").trim() === ligneMachine));
  if (ligneMachine) lignes.unshift({ type: "machine", desc: ligneMachine });
  const lv = lignesVente(lignes, prep);
  if (!lv.Line.some(l => l.DetailType === "SalesItemLineDetail")) throw new Error("La facture n'a aucune ligne avec un montant");

  // v160 (Jason) : aucun n° de bon de travail ni de soumission sur la facture — seulement le message de l'admin
  const corps: any = {
    CustomerRef: { value: cl.id },
    TxnDate: /^\d{4}-\d{2}-\d{2}$/.test(String(f.date || "")) ? f.date : new Date().toISOString().slice(0, 10),
    GlobalTaxCalculation: "TaxExcluded",
    Line: lv.Line,
  };
  const courriel = String((f.client || {}).courriel || "").trim();
  if (courrielValide(courriel)) corps.BillEmail = { Address: courriel };
  const memo = String(f.memo || "").trim();
  if (memo) corps.CustomerMemo = { value: memo.slice(0, 1000) };

  // Déjà facturée ? → mise à jour de la même facture, sauf si un paiement y est déjà appliqué
  const dejaId = f.qbo && f.qbo.id ? String(f.qbo.id) : "";
  if (dejaId) {
    let ex: any = null;
    try {
      const g = await qbo(c, "GET", "invoice/" + encodeURIComponent(dejaId)); c = g.conn;
      ex = g.data.Invoice;
    } catch (e: any) {
      if (e instanceof ReconnexionRequise) throw e;
      if (e.status !== 400 && e.status !== 404 && !/deleted|supprim|introuvable|not found|610/i.test(e.message || "")) throw e;
      ex = null;                                         // facture supprimée dans QBO : on en recrée une
    }
    const annulee = ex && Number(ex.TotalAmt) === 0 && Number(ex.Balance) === 0 && /void|annul/i.test(String(ex.PrivateNote || ""));
    if (ex && ex.Id && !annulee) {
      if (Number(ex.Balance) < Number(ex.TotalAmt) - 0.005) {
        throw new RefusFacture("La facture n° " + (ex.DocNumber || ex.Id) + " a déjà un paiement dans QuickBooks — fais la correction directement dans QuickBooks.");
      }
      // Mise à jour partielle (sparse) : les lignes sont remplacées en bloc ; numéro, date, échéance,
      // adresses et lien au devis restent ceux de la facture existante.
      const maj: any = { Id: ex.Id, SyncToken: ex.SyncToken, sparse: true,
        CustomerRef: corps.CustomerRef, GlobalTaxCalculation: corps.GlobalTaxCalculation, Line: corps.Line };
      // v160 : le message au client est celui de l'app (vidé s'il ne reste rien — l'ancien portait le n° de bon) ;
      // le mémo de relevé n'est vidé que s'il vient de l'app (une note écrite dans QuickBooks reste).
      if (corps.CustomerMemo) maj.CustomerMemo = corps.CustomerMemo;
      else if (ex.CustomerMemo && String(ex.CustomerMemo.value || "").trim()) maj.CustomerMemo = { value: "" };
      if (/Suivi Garage MTR/i.test(String(ex.PrivateNote || ""))) maj.PrivateNote = "";
      if (corps.BillEmail) maj.BillEmail = corps.BillEmail;
      const u = await qbo(c, "POST", "invoice", maj); c = u.conn;
      const I = u.data.Invoice;
      return { conn: c, id: String(I.Id), doc: I.DocNumber || "", total: I.TotalAmt, action: "maj", client: cl, url: urlFacture(c, I.Id),
               nbTrouves: lv.nbTrouves, nbPiece: lv.nbPiece, services: lv.services, estimateLie: !!(I.LinkedTxn || []).some((t: any) => t.TxnType === "Estimate") };
    }
  }

  // Création : numéro de facture donné par QuickBooks (suite normale), lien au devis s'il existe
  corps.AutoDocNumber = true;
  if (f.estimateId) corps.LinkedTxn = [{ TxnId: String(f.estimateId), TxnType: "Estimate" }];
  let cr: any = null, derniere: any = null;
  for (let essai = 0; essai < 3 && !cr; essai++) {
    try {
      cr = await qbo(c, "POST", "invoice", corps);
    } catch (e: any) {
      if (e instanceof ReconnexionRequise) throw e;
      derniere = e;
      const m = String(e.message || "");
      if (corps.AutoDocNumber && /AutoDocNumber/i.test(m)) { delete corps.AutoDocNumber; continue; }
      if (corps.LinkedTxn) { delete corps.LinkedTxn; continue; }   // devis fermé / supprimé : facture sans lien
      throw e;
    }
  }
  if (!cr) throw derniere || new Error("QuickBooks a refusé la facture");
  c = cr.conn;
  const I = cr.data.Invoice;
  return { conn: c, id: String(I.Id), doc: I.DocNumber || "", total: I.TotalAmt, action: "cree", client: cl, url: urlFacture(c, I.Id),
           nbTrouves: lv.nbTrouves, nbPiece: lv.nbPiece, services: lv.services, estimateLie: !!(I.LinkedTxn || []).some((t: any) => t.TxnType === "Estimate") };
}

// ─────────────────────────────────────────────────────────────
//  Qui appelle ? (même logique que gerer-compte)
// ─────────────────────────────────────────────────────────────
function identifiantPour(prenom: string, nomFamille: string) {
  const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9.\-]/g, "");
  const p = norm(prenom), n = norm(nomFamille).replace(/\./g, "");
  return p && n ? p[0] + "." + n : p || n;
}
async function appelant(req: Request) {
  const jeton = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jeton) return null;
  const cli = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jeton}` } } });
  const { data: { user } } = await cli.auth.getUser();
  if (!user || !user.email) return null;
  const { data: ligne } = await admin.from("tableau").select("donnees").eq("id", LIGNE_EMPLOYES).single();
  const employes: any[] = (ligne && ligne.donnees) || [];
  const ident = user.email.split("@")[0].toLowerCase();
  const e = employes.find((x) => ((x.identifiant || identifiantPour(x.nom, x.nomFamille)) || "").toLowerCase() === ident);
  if (!e || e.actif === false) return null;
  const role = (e.role === "admin" || e.role === "technicien") ? e.role : (e.nom === "Jason" ? "admin" : "technicien");
  return { nom: e.nom || ident, role };
}

// ─────────────────────────────────────────────────────────────
//  Retour d'Intuit après autorisation (GET public)
// ─────────────────────────────────────────────────────────────
async function callback(url: URL) {
  const c = await lireConn();
  const retour = c.retour_url || "";
  const versApp = (q: string) => new Response(null, { status: 302, headers: { Location: (retour || "/") + (retour.includes("?") ? "&" : "?") + q } });
  const erreur = url.searchParams.get("error");
  if (erreur) return versApp("qbo=erreur&msg=" + encodeURIComponent(url.searchParams.get("error_description") || erreur));
  const code = url.searchParams.get("code") || "", state = url.searchParams.get("state") || "", realm = url.searchParams.get("realmId") || "";
  if (!code || !realm) return versApp("qbo=erreur&msg=" + encodeURIComponent("Réponse d'Intuit incomplète"));
  if (!c.oauth_state || state !== c.oauth_state || !c.oauth_expire || new Date(c.oauth_expire) < new Date()) {
    return versApp("qbo=erreur&msg=" + encodeURIComponent("Demande d'autorisation expirée — recommence depuis les réglages"));
  }
  try {
    await ecrireConn({ realm_id: realm, oauth_state: null, oauth_expire: null });
    let conn = await echangerJetons({ ...c, realm_id: realm }, { grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
    let nomCie = "";
    try { const { data } = await qbo(conn, "GET", "companyinfo/" + realm); nomCie = (data.CompanyInfo || {}).CompanyName || ""; } catch (_) {}
    await ecrireConn({ company_name: nomCie });
    // Code de taxe par défaut choisi tout de suite (TPS/TVQ QC), pour que le premier envoi passe sans réglage
    try { if (!(conn.config || {}).taxeId) await assurerTaxe({ ...conn, company_name: nomCie }); } catch (_) {}
    return versApp("qbo=ok&cie=" + encodeURIComponent(nomCie));
  } catch (e) {
    return versApp("qbo=erreur&msg=" + encodeURIComponent((e as Error).message || "Erreur"));
  }
}

// ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET" && /\/callback\/?$/.test(url.pathname)) return callback(url);

  try {
    const corps = await req.json().catch(() => ({}));
    const action = String(corps.action || "");
    const qui = await appelant(req);
    if (!qui) return reponse({ erreur: "Connecte-toi avec ton compte d'employé pour utiliser QuickBooks" }, 401);
    const adminSeulement = () => qui.role === "admin" ? null : reponse({ erreur: "Réservé à l'administration" }, 403);

    let c = await lireConn();
    const cfgPublique = (x: Conn) => ({
      connecte: connecte(x), company: x.company_name || "", env: x.env || "production", realm: x.realm_id || "",
      clesPresentes: !!identifiants(x).id && !!identifiants(x).secret, clesEnv: !!Deno.env.get("QBO_CLIENT_ID"),
      clientId: identifiants(x).id, redirectUri: REDIRECT_URI, refreshExpire: x.refresh_expire || "",
      config: { artPieces: ART_PIECE_DEFAUT, artMO: ART_MO_DEFAUT, autoAccept: false, ...(x.config || {}) },
    });

    if (action === "statut") return reponse({ ok: true, ...cfgPublique(c) });

    if (action === "config") {
      const r = adminSeulement(); if (r) return r;
      const patch: Partial<Conn> = {};
      if (typeof corps.clientId === "string") patch.client_id = corps.clientId.trim();
      if (typeof corps.clientSecret === "string" && corps.clientSecret.trim()) patch.client_secret = corps.clientSecret.trim();
      if (corps.env === "sandbox" || corps.env === "production") patch.env = corps.env;
      if (corps.config && typeof corps.config === "object") {
        const cf = corps.config;
        patch.config = {
          ...(c.config || {}),
          ...(typeof cf.artPieces === "string" ? { artPieces: cf.artPieces.trim() || ART_PIECE_DEFAUT } : {}),
          ...(typeof cf.artMO === "string" ? { artMO: cf.artMO.trim() || ART_MO_DEFAUT } : {}),
          ...(typeof cf.autoAccept === "boolean" ? { autoAccept: cf.autoAccept } : {}),
          ...(typeof cf.taxeId === "string" ? { taxeId: cf.taxeId, taxeNom: String(cf.taxeNom || "") } : {}),
        };
      }
      await ecrireConn(patch);
      c = await lireConn();
      return reponse({ ok: true, ...cfgPublique(c) });
    }

    if (action === "connecter") {
      const r = adminSeulement(); if (r) return r;
      const { id } = identifiants(c);
      if (!id || !identifiants(c).secret) return reponse({ erreur: "Entre d'abord le Client ID et le Client Secret de ton app Intuit" }, 400);
      const state = crypto.randomUUID();
      const retour = typeof corps.retour === "string" && /^https?:\/\//.test(corps.retour) ? corps.retour.split("#")[0].split("?")[0] : "";
      await ecrireConn({ oauth_state: state, oauth_expire: new Date(Date.now() + 15 * 60_000).toISOString(), retour_url: retour });
      const u = new URL(AUTH_URL);
      u.searchParams.set("client_id", id);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("scope", SCOPE);
      u.searchParams.set("redirect_uri", REDIRECT_URI);
      u.searchParams.set("state", state);
      return reponse({ ok: true, url: u.toString() });
    }

    if (action === "deconnecter") {
      const r = adminSeulement(); if (r) return r;
      if (c.refresh_token) {
        try {
          await fetch(REVOKE_URL, { method: "POST", headers: { "Authorization": identifiants(c).basic, "Accept": "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ token: c.refresh_token }) });
        } catch (_) {}
      }
      await ecrireConn({ realm_id: null, access_token: null, refresh_token: null, access_expire: null, refresh_expire: null, company_name: null });
      c = await lireConn();
      return reponse({ ok: true, ...cfgPublique(c) });
    }

    if (action === "taxes") {
      const { liste } = await listerTaxes(c);
      const sugg = choisirTaxeQC(liste);
      return reponse({ ok: true, taxes: liste, suggestion: sugg ? sugg.id : "", actuelle: (c.config || {}).taxeId || "" });
    }

    if (action === "envoyer") {
      const s = corps.soumission;
      if (!s || typeof s !== "object") return reponse({ erreur: "Soumission manquante" }, 400);
      if (s.qbo && s.qbo.id && !memeEntreprise(c, s.qbo.realm)) delete s.qbo;       // v159 : devis d'une autre entreprise
      if (s.clientQboId && !memeEntreprise(c, s.clientQboRealm)) delete s.clientQboId;
      // Garde-fou contre les doublons : si cet appareil ignore que la soumission est déjà partie
      // (copie locale en retard, envoi automatique lancé par deux appareils), on retrouve le devis
      // déjà créé dans le journal et on le met à jour au lieu d'en créer un second.
      if (!(s.qbo && s.qbo.id) && s.id) {
        const { data: prev } = await admin.from("qbo_envois").select("estimate_id").eq("soumission", String(s.id))
          .eq("realm", String(c.realm_id || "")).not("estimate_id", "is", null).order("quand", { ascending: false }).limit(1);
        if (prev && prev[0] && prev[0].estimate_id) s.qbo = { id: String(prev[0].estimate_id), realm: c.realm_id };
      }
      try {
        const r = await envoyerDevis(c, s, corps.adresse || null, qui.nom);
        await admin.from("qbo_envois").insert({ soumission: String(s.id || ""), numero: String(s.numero || ""), estimate_id: r.id, doc_number: r.doc, action: r.action, message: "OK " + (r.client.cree ? "(client créé)" : ""), par: qui.nom, realm: r.conn.realm_id });
        return reponse({ ok: true, id: r.id, doc: r.doc, total: r.total, action: r.action, url: r.url, clientId: r.client.id, clientNom: r.client.nom, clientCree: r.client.cree,
          realm: r.conn.realm_id, env: r.conn.env || "production" });
      } catch (e: any) {
        await admin.from("qbo_envois").insert({ soumission: String(s.id || ""), numero: String(s.numero || ""), action: "erreur", message: String(e.message || e).slice(0, 2000), par: qui.nom, realm: c.realm_id });
        if (e instanceof ReconnexionRequise) return reponse({ erreur: e.message, reconnexion: true }, 409);
        return reponse({ erreur: e.message || "Erreur QuickBooks" }, 502);
      }
    }

    // v158 — facture finale d'un bon de travail (administration seulement)
    if (action === "facturer") {
      const r = adminSeulement(); if (r) return r;
      const f = corps.facture;
      if (!f || typeof f !== "object" || !Array.isArray(f.lignes)) return reponse({ erreur: "Facture manquante" }, 400);
      // v159 — facture, client et devis connus seulement s'ils viennent de l'entreprise branchée
      const ignores: string[] = [];
      if (f.qbo && f.qbo.id && !memeEntreprise(c, f.qbo.realm)) { ignores.push("facture " + f.qbo.id); f.qbo = null; }
      if (f.client && f.client.qboId && !memeEntreprise(c, f.client.qboRealm)) { ignores.push("client " + f.client.qboId); f.client.qboId = ""; }
      if (f.estimateId && !memeEntreprise(c, f.estimateRealm)) { ignores.push("devis " + f.estimateId); f.estimateId = ""; }
      // Garde-fou contre les doublons : ce bon a-t-il déjà une facture DANS CETTE ENTREPRISE (autre appareil, copie en retard) ?
      if (!(f.qbo && f.qbo.id) && f.btId) {
        const { data: prev } = await admin.from("qbo_envois").select("invoice_id").eq("bt", String(f.btId))
          .eq("realm", String(c.realm_id || "")).not("invoice_id", "is", null).order("quand", { ascending: false }).limit(1);
        if (prev && prev[0] && prev[0].invoice_id) f.qbo = { id: String(prev[0].invoice_id), realm: c.realm_id };
      }
      const journal = (x: Record<string, unknown>) => admin.from("qbo_envois").insert({
        type: "facture", bt: String(f.btId || ""), soumission: String(f.soumissionId || ""),
        numero: String(f.numeroBT || f.soumissionNumero || ""), par: qui.nom, realm: c.realm_id, ...x });
      try {
        const x = await envoyerFacture(c, f);
        await journal({ invoice_id: x.id, doc_number: x.doc, action: x.action,
          message: "OK " + [x.client.cree ? "client créé" : "", x.nbTrouves + " produit(s) trouvé(s)", x.nbPiece + " sur « Pièce »",
            (x.services || []).length ? "main-d'œuvre sur « " + x.services.join(" », « ") + " »" : "", x.estimateLie ? "devis lié" : "",
            ignores.length ? "ignoré (autre entreprise) : " + ignores.join(", ") : ""].filter(Boolean).join(", ") });
        return reponse({ ok: true, id: x.id, doc: x.doc, total: x.total, action: x.action, url: x.url,
          clientId: x.client.id, clientNom: x.client.nom, clientCree: x.client.cree,
          nbTrouves: x.nbTrouves, nbPiece: x.nbPiece, services: x.services || [], estimateLie: x.estimateLie,
          realm: x.conn.realm_id, env: x.conn.env || "production", company: x.conn.company_name || "", ignores });
      } catch (e: any) {
        await journal({ action: "erreur", message: String(e.message || e).slice(0, 2000) });
        if (e instanceof ReconnexionRequise) return reponse({ erreur: e.message, reconnexion: true }, 409);
        if (e instanceof RefusFacture) return reponse({ erreur: e.message, paye: true }, 409);
        return reponse({ erreur: e.message || "Erreur QuickBooks" }, 502);
      }
    }

    return reponse({ erreur: "Action inconnue : " + action }, 400);
  } catch (e) {
    if (e instanceof ReconnexionRequise) return reponse({ erreur: e.message, reconnexion: true }, 409);
    return reponse({ erreur: (e as Error).message || "Erreur" }, 500);
  }
});
