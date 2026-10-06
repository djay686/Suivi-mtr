// ============================================================
// Fonction Edge : appel-entrant  (MTR Performance, v150.4)
// Appels du PBX Yeastar P-Series (Anexa, Linkus) → `communications`
// + SMS d'appel manqué avec menu 1/2/3.
//
// Deux façons de recevoir les appels :
//   A) RELÈVE (v150.3, active) : pg_cron appelle cette fonction chaque minute
//      avec x-cron-secret + {"releve":true}. On lit la liste des appels
//      terminés (cdr/list) avec l'API du PBX (secrets YEASTAR_URL,
//      YEASTAR_CLIENT_ID, YEASTAR_CLIENT_SECRET) et on traite les nouveaux.
//      • Jeton réutilisé (table pbx_jeton) : le PBX limite à 8 jetons valides.
//      • Après un refus d'authentification, pause de 30 min avant de réessayer
//        (le PBX bloque les IP qui échouent trop souvent).
//      • Seuls les appels postérieurs à telephonie_config.pbx_releve_depuis
//        sont traités : aucun vieil appel ne reçoit de texto.
//      • Un appel = un `uid` (plusieurs lignes possibles : groupe, poste…).
//        Répondu = une ligne ANSWERED, conversation > 0, vers un POSTE réel
//        (liste extension/list). Le message « fermé », l'IVR ou la boîte
//        vocale ne comptent pas comme répondus → texto envoyé.
//   B) WEBHOOK (si Anexa le branche un jour) : même traitement, instantané.
//
//   {"pbx_diag":true} + x-cron-secret → test de l'API (jeton, postes, 5 derniers appels).
//   {"simuler":"819..."} + jeton employé → simulation (bouton Tester de l'app).
//   ?diag → état de la configuration.
//   v150.1 CORS · v150.2 un seul menu valide par numéro · v150.3 relève API
//   v150.4 jeton réellement réutilisé (colonnes echec_* manquantes → nouveau jeton
//          chaque minute → limite de 8 atteinte → appels lus 20 min en retard)
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const LIGNE_CLIENTS = 3;
const TZ = "America/Toronto";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const sb = createClient(SB_URL, SB_SERVICE);

function secret(...noms: string[]): string | undefined {
  for (const n of noms) { const v = Deno.env.get(n); if (v) return v; }
  return undefined;
}
const TW_SID   = secret("TWILIO_ACCOUNT_SID", "TWILIO_SID", "ACCOUNT_SID");
const TW_TOKEN = secret("TWILIO_AUTH_TOKEN", "TWILIO_TOKEN", "AUTH_TOKEN");
const TW_FROM  = secret("TWILIO_FROM", "TWILIO_PHONE", "TWILIO_PHONE_NUMBER", "TWILIO_NUMERO", "TWILIO_NUMBER", "TWILIO_FROM_NUMBER", "FROM_NUMBER");
const WEBHOOK_SECRET = secret("YEASTAR_WEBHOOK_SECRET", "PBX_WEBHOOK_SECRET");
const PBX_URL = (secret("YEASTAR_URL", "PBX_URL") || "").trim().replace(/\/+$/, "").replace(/\/openapi.*$/i, "");
const PBX_ID  = (secret("YEASTAR_CLIENT_ID", "PBX_CLIENT_ID") || "").trim();
const PBX_SEC = (secret("YEASTAR_CLIENT_SECRET", "PBX_CLIENT_SECRET") || "").trim();
const API = PBX_URL ? PBX_URL + "/openapi/v1.0" : "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-cron-secret", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const tel10 = (t?: string | null) => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const sansAccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function hmacOk(corps: string, signature: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true;
  if (!signature) return false;
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(corps)));
  const hex = Array.from(sig).map(b => b.toString(16).padStart(2, "0")).join("");
  const b64 = btoa(String.fromCharCode(...sig));
  const s = signature.trim().replace(/^sha256=/i, "");
  return s.toLowerCase() === hex || s === b64;
}

async function journalPbx(type: string, appel_id: string, brut: unknown, action: string, note = "") {
  try {
    const b = typeof brut === "string" ? brut.slice(0, 4000) : brut;
    await sb.from("pbx_evenements").insert({ type, appel_id: appel_id || null, brut: b, action, note });
  } catch (e) { console.log("journalPbx échoué", e); }
}

async function config() {
  const { data } = await sb.from("telephonie_config").select("*").eq("id", 1).maybeSingle();
  return data || { actif: true, lien_reservation: "", delai_min: 240, menu_valide_h: 24, heures: {}, liste_noire: [],
    sms_menu: "MTR Performance : on a manque votre appel. Repondez :\n1 - Prendre un rendez-vous\n2 - Ajouts de performance\n3 - Poser une question",
    sms_hors_heures: "", sms_rep_1: "", sms_rep_2: "", sms_rep_3: "", sms_merci: "", pbx_releve_actif: true };
}

function ouvertMaintenant(heures: Record<string, number[]>): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "numeric", minute: "numeric", weekday: "short", hour12: false }).formatToParts(new Date());
  const j = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.find(p => p.type === "weekday")?.value || "Mon"] ?? 1;
  const h = Number(parts.find(p => p.type === "hour")?.value || 0) + Number(parts.find(p => p.type === "minute")?.value || 0) / 60;
  const pl = heures?.[String(j)];
  return Array.isArray(pl) && pl.length === 2 && h >= pl[0] && h < pl[1];
}

let clientsCache: any[] | null = null;
async function clientPour(t10: string) {
  if (!t10) return null;
  if (!clientsCache) {
    const { data } = await sb.from("tableau").select("donnees").eq("id", LIGNE_CLIENTS).maybeSingle();
    clientsCache = Array.isArray(data?.donnees) ? data!.donnees : [];
  }
  return clientsCache!.find(c => tel10(c?.tel) === t10 || tel10(c?.tel2) === t10 || tel10(c?.cellulaire) === t10) || null;
}

async function envoyerSms(tel: string, message: string): Promise<{ ok: boolean; sid?: string; erreur?: string }> {
  if (!TW_SID || !TW_TOKEN || !TW_FROM) return { ok: false, erreur: "secrets Twilio manquants" };
  const body = new URLSearchParams({ To: "+1" + tel, From: TW_FROM, Body: message });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: "POST", headers: { Authorization: "Basic " + btoa(`${TW_SID}:${TW_TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, erreur: j.message || ("erreur Twilio " + r.status) };
  return { ok: true, sid: j.sid };
}

// ── API du PBX ────────────────────────────────────────────────
const UA = { "User-Agent": "OpenAPI", "Content-Type": "application/json" };
async function pbxPost(chemin: string, corps: unknown) {
  const r = await fetch(`${API}/${chemin}`, { method: "POST", headers: UA, body: JSON.stringify(corps) });
  return await r.json().catch(() => ({ errcode: -1, errmsg: "réponse illisible (HTTP " + r.status + ")" }));
}
async function jeton(forcer = false): Promise<string> {
  if (!API || !PBX_ID || !PBX_SEC) throw new Error("secrets YEASTAR_URL / YEASTAR_CLIENT_ID / YEASTAR_CLIENT_SECRET manquants");
  const { data: j } = await sb.from("pbx_jeton").select("*").eq("id", 1).maybeSingle();
  const maintenant = Date.now();
  if (!forcer && j?.access_token && j.access_expire && new Date(j.access_expire).getTime() - maintenant > 120000) return j.access_token;
  if (j?.echec_le && maintenant - new Date(j.echec_le).getTime() < 30 * 60000)
    throw new Error("authentification refusée il y a moins de 30 min (" + (j.echec_msg || "") + ") — pause pour éviter le blocage d'IP");
  let rep: any = null;
  if (j?.refresh_token && j.refresh_expire && new Date(j.refresh_expire).getTime() - maintenant > 120000) {
    rep = await pbxPost("refresh_token", { refresh_token: j.refresh_token });
    if (rep?.errcode !== 0) rep = null;
  }
  if (!rep) rep = await pbxPost("get_token", { username: PBX_ID, password: PBX_SEC });
  if (rep?.errcode !== 0 || !rep.access_token) {
    const msg = `errcode ${rep?.errcode} ${rep?.errmsg || ""}`.trim();
    // 60002 = trop de jetons actifs : ce n'est PAS un refus d'identifiants, on réessaie à la minute suivante
    const refusIdentifiants = Number(rep?.errcode) !== 60002;
    await sb.from("pbx_jeton").update({ access_token: null, echec_le: refusIdentifiants ? new Date().toISOString() : null, echec_msg: msg, maj_le: new Date().toISOString() }).eq("id", 1);
    throw new Error("jeton refusé par le PBX : " + msg);
  }
  const { error: errSauve } = await sb.from("pbx_jeton").upsert({
    id: 1, access_token: rep.access_token, access_expire: new Date(maintenant + (Number(rep.access_token_expire_time) || 1800) * 1000).toISOString(),
    refresh_token: rep.refresh_token || null, refresh_expire: new Date(maintenant + (Number(rep.refresh_token_expire_time) || 86400) * 1000).toISOString(),
    echec_le: null, echec_msg: null, maj_le: new Date().toISOString(),
  });
  // v150.4 : si le jeton ne peut pas être gardé, chaque minute en redemanderait un et le PBX bloquerait à 8 → on le dit fort
  if (errSauve) throw new Error("jeton obtenu mais impossible de l'enregistrer (pbx_jeton) : " + errSauve.message);
  return rep.access_token;
}
async function pbxGet(chemin: string, params: Record<string, string | number> = {}, essai = 0): Promise<any> {
  const tok = await jeton(essai > 0);
  const q = new URLSearchParams({ access_token: tok, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const r = await fetch(`${API}/${chemin}?${q}`, { headers: UA });
  const j = await r.json().catch(() => ({ errcode: -1, errmsg: "réponse illisible (HTTP " + r.status + ")" }));
  // jeton expiré ou révoqué côté PBX → un nouvel essai avec un jeton neuf
  if (j?.errcode !== 0 && essai === 0 && /token/i.test(String(j?.errmsg || ""))) return pbxGet(chemin, params, 1);
  return j;
}
async function postesDuPbx(): Promise<Set<string>> {
  const j = await pbxGet("extension/list", { page: 1, page_size: 500 });
  if (j?.errcode !== 0) throw new Error("extension/list : " + (j?.errmsg || j?.errcode));
  return new Set((j.data || []).map((e: any) => String(e.number || e.extension_number || "").trim()).filter(Boolean));
}
async function derniersCdr(n = 100) {
  let j = await pbxGet("cdr/list", { page: 1, page_size: n, sort_by: "time", order_by: "desc" });
  if (j?.errcode !== 0) j = await pbxGet("cdr/list", { page: 1, page_size: n, sort_by: "uid", order_by: "desc" });
  if (j?.errcode !== 0) throw new Error("cdr/list : " + (j?.errmsg || j?.errcode));
  return (j.data || []) as any[];
}

// ── Interprétation d'un événement webhook Yeastar ─────────────
type Evt = { type: string; appel_id: string; fin: boolean; entrant: boolean; externe: boolean; repondu: boolean;
             de: string; a: string; duree: number; conversation: number; statut: string; enregistrement: string; debut: string; brut: any };
function lireEvenement(j: any): Evt {
  let msg = j?.msg ?? j?.data ?? j;
  if (typeof msg === "string") { try { msg = JSON.parse(msg); } catch { msg = { texte: msg }; } }
  const type = String(j?.type ?? msg?.type ?? msg?.event ?? "");
  const statut = String(msg?.status ?? msg?.call_status ?? msg?.disposition ?? "").toUpperCase();
  const sens = String(msg?.type_of_call ?? msg?.call_type ?? msg?.direction ?? (type === "30011" ? msg?.type : "") ?? "").toLowerCase();
  const de = String(msg?.call_from_number ?? msg?.call_from ?? msg?.caller ?? msg?.from ?? msg?.caller_number ?? msg?.src ?? "");
  const a = String(msg?.call_to_number ?? msg?.call_to ?? msg?.callee ?? msg?.to ?? msg?.callee_number ?? msg?.dst ?? "");
  const conversation = Number(msg?.talk_duration ?? msg?.talkduration ?? msg?.billsec ?? 0) || 0;
  const duree = Number(msg?.call_duration ?? msg?.duration ?? 0) || 0;
  const fin = type === "30011" || "time_end" in (msg || {}) || "talk_duration" in (msg || {}) || "disposition" in (msg || {}) || !!msg?.cdr;
  const entrant = sens === "inbound" || sens === "in" || /^incoming|^inbound/.test(sens) || (!sens && tel10(de).length === 10 && tel10(a).length < 10);
  const externe = tel10(de).length === 10;
  const repondu = statut === "ANSWERED" && conversation > 0;
  return { type, appel_id: String(msg?.uid ?? msg?.call_id ?? msg?.callid ?? msg?.uniqueid ?? j?.call_id ?? ""), fin, entrant, externe, repondu,
    de, a, duree, conversation, statut, enregistrement: String(msg?.record_file ?? msg?.recording ?? msg?.recording_file ?? ""), debut: String(msg?.time ?? msg?.time_start ?? msg?.start_time ?? ""), brut: msg };
}

// ── Cœur : un appel manqué entrant ────────────────────────────
async function traiterAppelManque(t10: string, telBrut: string, appelId: string, meta: Record<string, unknown>, simule = false) {
  const cfg = await config();
  const client = await clientPour(t10);
  const { data: ligne } = await sb.from("communications").insert({
    tel: t10, tel_brut: telBrut, client_id: client?.id || null, client_nom: client?.nom || null,
    canal: "appel_manque", direction: "in", statut: "a_traiter", appel_id: appelId || null,
    contenu: simule ? "Appel manqué (simulation)" : "Appel manqué",
    meta: { ...meta, simule }, source_table: appelId ? "pbx" : null, source_id: appelId || null,
  }).select("id").single();
  const commId = ligne?.id ?? null;

  let raisonSaut = "";
  if (!cfg.actif) raisonSaut = "SMS d'appel manqué désactivé dans les réglages";
  else if (!t10) raisonSaut = "numéro masqué ou non nord-américain";
  else if ((cfg.liste_noire || []).some((n: string) => tel10(n) === t10)) raisonSaut = "numéro en liste noire";
  else if (client?.smsStop) raisonSaut = "client désabonné (STOP)";
  else {
    const { data: menu } = await sb.from("sms_menu_etat").select("expire_le,etape").eq("tel", t10).maybeSingle();
    if (menu && new Date(menu.expire_le) > new Date()) raisonSaut = `menu déjà envoyé et encore valide (étape ${menu.etape})`;
  }
  if (!raisonSaut) {
    const depuis = new Date(Date.now() - (Number(cfg.delai_min) || 240) * 60000).toISOString();
    const { data: recents } = await sb.from("communications").select("id").eq("tel", t10).eq("canal", "sms_out")
      .contains("meta", { origine: "appel_manque" }).gte("cree_le", depuis).limit(1);
    if (recents && recents.length) raisonSaut = `SMS déjà envoyé à ce numéro depuis moins de ${cfg.delai_min} min`;
  }
  if (raisonSaut) {
    if (commId) await sb.from("communications").update({ meta: { ...meta, simule, sms: "non envoyé", pourquoi: raisonSaut } }).eq("id", commId);
    return { commId, sms: false, pourquoi: raisonSaut };
  }

  const ouvert = ouvertMaintenant(cfg.heures || {});
  let texte = (ouvert || !cfg.sms_hors_heures ? cfg.sms_menu : cfg.sms_hors_heures) || cfg.sms_menu;
  const { data: deja } = await sb.from("communications").select("id").eq("tel", t10).eq("canal", "sms_out").limit(1);
  if (!deja || !deja.length) texte += "\nRep. STOP pour arreter. Frais de messagerie standard.";
  texte = sansAccent(texte);

  const r = simule ? { ok: true, sid: "SIMULATION" } : await envoyerSms(t10, texte);
  await sb.from("communications").insert({
    tel: t10, tel_brut: telBrut, client_id: client?.id || null, client_nom: client?.nom || null,
    canal: "sms_out", direction: "out", statut: "traite", contenu: texte, appel_id: appelId || null,
    meta: { origine: "appel_manque", ouvert, twilio_sid: r.sid || null, erreur: r.erreur || null, simule, comm_appel: commId },
  });
  if (r.ok) {
    const expire = new Date(Date.now() + (Number(cfg.menu_valide_h) || 24) * 3600000).toISOString();
    await sb.from("sms_menu_etat").upsert({ tel: t10, etape: "menu", comm_id: commId, envoye_le: new Date().toISOString(), expire_le: expire, maj_le: new Date().toISOString() });
  }
  if (commId) await sb.from("communications").update({ meta: { ...meta, simule, sms: r.ok ? "envoyé" : "échec", erreur: r.erreur || null } }).eq("id", commId);
  return { commId, sms: r.ok, erreur: r.erreur };
}

// Appel répondu : complète la note Linkus créée à la sonnerie, sinon journalise
async function traiterRepondu(t10: string, telBrut: string, appelId: string, meta: Record<string, unknown>) {
  const client = await clientPour(t10);
  const { data: existe } = await sb.from("communications").select("id,meta").eq("tel", t10).eq("canal", "appel_repondu")
    .gte("cree_le", new Date(Date.now() - 3 * 3600000).toISOString()).is("appel_id", null).order("cree_le", { ascending: false }).limit(1);
  if (existe && existe.length) {
    await sb.from("communications").update({ appel_id: appelId || null, meta: { ...(existe[0].meta || {}), ...meta } }).eq("id", existe[0].id);
    return "note d'appel complétée";
  }
  await sb.from("communications").insert({ tel: t10, tel_brut: telBrut, client_id: client?.id || null, client_nom: client?.nom || null,
    canal: "appel_repondu", direction: "in", statut: "traite", appel_id: appelId || null, contenu: "Appel répondu", meta,
    source_table: appelId ? "pbx" : null, source_id: appelId || null });
  return "appel répondu journalisé";
}

// ── Relève : lecture de la liste des appels du PBX ────────────
// Heure locale du PBX (« 22/09/2026 08:29:07 », « 06/18/2024 13:47:33 » ou « 2025/12/19 10:40:07 ») → secondes UTC
function tempsPbx(txt: string): number {
  const m = txt.match(/(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  let [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let y: number, mo: number, d: number;
  if (m[1].length === 4) { y = a; mo = b; d = c; }
  else { y = c; if (a > 12) { d = a; mo = b; } else if (b > 12) { mo = a; d = b; } else { d = a; mo = b; } }   // ce PBX écrit jour/mois
  const h = Number(m[4]), mi = Number(m[5]), se = Number(m[6] || 0);
  const devine = Date.UTC(y, mo - 1, d, h, mi, se);
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(devine));
  const g = (t: string) => Number(p.find(x => x.type === t)?.value || 0);
  const vue = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second"));
  return Math.floor((devine - (vue - devine)) / 1000);
}

async function releve(diag = false) {
  const cfg: any = await config();
  const lignes = await derniersCdr(diag ? 20 : 100);
  let postes: Set<string> | null = null, errPostes = "";
  try { postes = await postesDuPbx(); } catch (e) { errPostes = String(e); }

  // Regroupe les lignes d'un même appel
  const appels = new Map<string, any[]>();
  for (const l of lignes) {
    const k = String(l.uid || l.call_id || l.new_id || l.id || "");
    if (!k) continue;
    if (!appels.has(k)) appels.set(k, []);
    appels.get(k)!.push(l);
  }
  const ts = (l: any) => { const n = Number(l.timestamp); return n > 1e9 ? (n > 1e12 ? Math.floor(n / 1000) : n) : tempsPbx(String(l.time || "")); };
  const estPoste = (n: string) => postes ? postes.has(String(n || "").trim()) : /^\d{2,4}$/.test(String(n || "").trim()) && !/^6\d{3}$/.test(String(n || "").trim());

  const resume = [...appels.entries()].map(([uid, ls]) => {
    const t = Math.min(...ls.map(ts));
    const entrant = ls.some(l => String(l.call_type || "").toLowerCase() === "inbound");
    const deBrut = String(ls.find(l => l.call_from_number)?.call_from_number || ls[0].call_from || "");
    const repondu = ls.some(l => String(l.disposition || "").toUpperCase() === "ANSWERED" && Number(l.talk_duration || 0) > 0 && estPoste(l.call_to_number));
    const conversation = Math.max(0, ...ls.map(l => estPoste(l.call_to_number) ? Number(l.talk_duration || 0) : 0));
    return { uid, t, entrant, deBrut, t10: tel10(deBrut), repondu, conversation,
      etapes: ls.map(l => ({ vers: l.call_to_number, nom: l.call_to_name, statut: l.disposition, conv: l.talk_duration, type: l.call_type })),
      enregistrement: ls.map(l => l.record_file).find(Boolean) || null, time: ls[0].time };
  }).sort((a, b) => a.t - b.t);

  if (diag) {
    const l0 = lignes[0] || {};
    return { postes: postes ? [...postes] : null, erreur_postes: errPostes || null, lignes_recues: lignes.length,
      cles_cdr: Object.keys(l0), timestamp_brut: l0.timestamp ?? null, time_brut: l0.time ?? null, secondes_lues: ts(l0),
      utc_lu: ts(l0) ? new Date(ts(l0) * 1000).toISOString() : null,
      appels: resume.slice(-8).map(a => ({ quand: a.time, entrant: a.entrant, de_fin: a.t10 ? "…" + a.t10.slice(-4) : a.deBrut.slice(-4), repondu: a.repondu, etapes: a.etapes })) };
  }

  const depuis = cfg.pbx_releve_depuis ? Math.floor(new Date(cfg.pbx_releve_depuis).getTime() / 1000) : Math.floor(Date.now() / 1000);
  const curseur = Number(cfg.pbx_dernier_ts) || depuis;
  const candidats = resume.filter(a => a.t >= depuis && a.t >= curseur - 900);   // 15 min de recouvrement
  if (!candidats.length) return { traites: 0 };

  const uids = candidats.map(a => a.uid);
  const [{ data: d1 }, { data: d2 }] = await Promise.all([
    sb.from("communications").select("appel_id").in("appel_id", uids),
    sb.from("pbx_evenements").select("appel_id").in("appel_id", uids).eq("type", "cdr"),
  ]);
  const vus = new Set([...(d1 || []), ...(d2 || [])].map((x: any) => x.appel_id));
  let traites = 0, sms = 0;
  for (const a of candidats) {
    if (vus.has(a.uid)) continue;
    const meta = { debut: a.time, conversation: a.conversation, etapes: a.etapes, enregistrement: a.enregistrement, source: "releve" };
    let action = "", note = "";
    if (!a.entrant) action = "ignoré (sortant ou interne)";
    else if (!a.t10) action = "ignoré (numéro masqué ou non nord-américain)";
    else if (a.repondu) action = await traiterRepondu(a.t10, a.deBrut, a.uid, meta);
    else {
      const r = await traiterAppelManque(a.t10, a.deBrut, a.uid, meta);
      action = r.sms ? "appel manqué → SMS envoyé" : "appel manqué, SMS non envoyé"; note = r.pourquoi || r.erreur || "";
      if (r.sms) sms++;
    }
    await journalPbx("cdr", a.uid, { etapes: a.etapes, entrant: a.entrant, repondu: a.repondu, time: a.time }, action, note);
    traites++;
  }
  const maxT = Math.max(curseur, ...candidats.map(a => a.t));
  await sb.from("telephonie_config").update({ pbx_dernier_ts: maxT }).eq("id", 1);
  return { traites, sms, postes_connus: !!postes, erreur_postes: errPostes || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (url.searchParams.has("diag")) {
    const cfg = await config();
    return json({ twilio: { sid: !!TW_SID, token: !!TW_TOKEN, from: TW_FROM ?? null }, signature_verifiee: !!WEBHOOK_SECRET,
      pbx: { url: !!PBX_URL, client_id: !!PBX_ID, secret: !!PBX_SEC },
      config: { actif: cfg.actif, delai_min: cfg.delai_min, ouvert_maintenant: ouvertMaintenant(cfg.heures || {}) } });
  }
  if (req.method !== "POST") return json({ ok: true, note: "POST seulement" });

  const corps = await req.text();
  let j: any = {};
  try { j = JSON.parse(corps); } catch { j = { texte: corps }; }
  const parCron = !!CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET;

  // ── Relève chaque minute (pg_cron) et diagnostic ──
  if (parCron && (j?.releve || j?.pbx_diag)) {
    const maintenant = new Date().toISOString();
    try {
      const cfg: any = await config();
      if (j.releve && cfg.pbx_releve_actif === false) return json({ ok: true, note: "relève désactivée" });
      const res = await releve(!!j.pbx_diag);
      await sb.from("telephonie_config").update({ pbx_derniere_releve: maintenant, pbx_derniere_erreur: null }).eq("id", 1);
      return json({ ok: true, ...res });
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      console.log("relève PBX en erreur :", msg);
      await sb.from("telephonie_config").update({ pbx_derniere_releve: maintenant, pbx_derniere_erreur: msg.slice(0, 500) }).eq("id", 1);
      return json({ ok: false, error: msg }, 200);
    }
  }

  // ── Simulation depuis l'app (jeton d'un employé connecté) ──
  if (j && j.simuler) {
    const jetonU = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jetonU || !SB_ANON) return json({ ok: false, error: "non autorisé" }, 401);
    const { data: u } = await createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: "Bearer " + jetonU } } }).auth.getUser();
    if (!u?.user) return json({ ok: false, error: "non autorisé" }, 401);
    const t10 = tel10(String(j.simuler));
    const id = "sim-" + Date.now().toString(36);
    await journalPbx("simulation", id, { simuler: t10, par: u.user.email }, "appel manqué simulé");
    const res = await traiterAppelManque(t10, String(j.simuler), id, { debut: new Date().toISOString(), statut: "NO ANSWER", simulation: true }, !!j.sans_sms);
    return json({ ok: true, ...res });
  }

  // ── Webhook PBX (si Anexa le branche) ──
  const sigOk = await hmacOk(corps, req.headers.get("x-signature") || req.headers.get("X-Signature"));
  const ev = lireEvenement(j);
  if (!sigOk) { await journalPbx(ev.type, ev.appel_id, j, "refusé", "signature invalide"); return json({ ok: false, error: "signature invalide" }, 401); }
  if (!ev.fin) { await journalPbx(ev.type, ev.appel_id, j, "ignoré", "pas un événement de fin d'appel"); return json({ ok: true }); }
  if (!ev.entrant || !ev.externe) { await journalPbx(ev.type, ev.appel_id, j, "ignoré", ev.entrant ? "appel interne" : "appel sortant"); return json({ ok: true }); }
  if (ev.appel_id) {
    const { data: deja } = await sb.from("communications").select("id").eq("appel_id", ev.appel_id).in("canal", ["appel_manque", "appel_repondu"]).limit(1);
    if (deja && deja.length) { await journalPbx(ev.type, ev.appel_id, j, "ignoré", "déjà journalisé"); return json({ ok: true }); }
  }
  const t10 = tel10(ev.de);
  const meta = { debut: ev.debut, statut: ev.statut, duree: ev.duree, conversation: ev.conversation, vers: ev.a, enregistrement: ev.enregistrement || null, type_evenement: ev.type, source: "webhook" };
  if (ev.repondu) {
    const action = await traiterRepondu(t10, ev.de, ev.appel_id, meta);
    await journalPbx(ev.type, ev.appel_id, j, action, `durée ${ev.conversation}s`);
    return json({ ok: true });
  }
  const res = await traiterAppelManque(t10, ev.de, ev.appel_id, meta);
  await journalPbx(ev.type, ev.appel_id, j, res.sms ? "appel manqué → SMS envoyé" : "appel manqué, SMS non envoyé", res.pourquoi || res.erreur || "");
  return json({ ok: true, ...res });
});
