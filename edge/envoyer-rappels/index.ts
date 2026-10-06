// ============================================================
// Fonction Edge : envoyer-rappels  (MTR Performance, v154)
// Appelée par pg_cron toutes les 10 min → envoie les rappels SMS dus.
//
// v154 :
//  • Numéro manquant sur le bon → on prend celui de la fiche du carnet (clientId).
//    Sans aucun numéro, le bon est listé dans `sans_numero` (visible avec ?simuler).
//  • Un seul rappel à la fois : si plusieurs rappels sont dus en même temps (numéro
//    ajouté en retard, rendez-vous pris la veille…), seul le plus proche du rendez-vous
//    part ; les plus anciens sont notés « saute » et ne partiront jamais.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const LIGNE_MACHINES = 1;
const LIGNE_CLIENTS = 3;
const SHOP = "MTR Performance";
const TZ = "America/Toronto";
const SILENCE_DEBUT = 8;           // rappels en "jours" : jamais avant 8 h
const SILENCE_FIN = 20;            // ni après 20 h

type Machine = {
  id: string; nom?: string; client?: string; tel?: string; statut?: string; clientId?: string;
  echeance?: string; heure?: string; annee?: string | number; sansRappels?: boolean;
};

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function secret(...noms: string[]): string | undefined {
  for (const n of noms) { const v = Deno.env.get(n); if (v) return v; }
  return undefined;
}
const TW_SID   = secret("TWILIO_ACCOUNT_SID", "TWILIO_SID", "ACCOUNT_SID");
const TW_TOKEN = secret("TWILIO_AUTH_TOKEN", "TWILIO_TOKEN", "AUTH_TOKEN");
const TW_FROM  = secret("TWILIO_FROM", "TWILIO_PHONE", "TWILIO_PHONE_NUMBER", "TWILIO_NUMBER", "TWILIO_FROM_NUMBER", "FROM_NUMBER");

async function envoyerSms(to: string, body: string): Promise<{ sid?: string; erreur?: string }> {
  if (!TW_SID || !TW_TOKEN || !TW_FROM) return { erreur: "Secrets Twilio introuvables (voir /?diag)" };
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${TW_SID}:${TW_TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: TW_FROM, Body: body }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { sid: j.sid } : { erreur: j.message || `HTTP ${r.status}` };
}

function delaiMs(v: number, u: string) { return v * ({ minutes: 6e4, heures: 36e5, jours: 864e5 }[u] ?? 0); }

function e164(tel?: string | null): string | null {
  if (!tel) return null;
  const d = String(tel).replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

function tzOffsetMin(d: Date): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {} as Record<string, string>);
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - d.getTime()) / 6e4;
}
function dateRdv(echeance?: string, heure?: string): Date | null {
  if (!echeance || !/^\d{4}-\d{2}-\d{2}$/.test(echeance)) return null;
  const h = /^\d{1,2}:\d{2}$/.test(heure || "") ? heure!.padStart(5, "0") : "09:00";
  const off = tzOffsetMin(new Date(`${echeance}T12:00:00Z`));
  const s = off < 0 ? "-" : "+", a = Math.abs(off);
  const d = new Date(`${echeance}T${h}:00${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`);
  return isNaN(d.getTime()) ? null : d;
}

const heureLocale = (d: Date) => +new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d) % 24;
const fmtDate  = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
const fmtHeure = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(":", " h ");
const remplir  = (g: string, v: Record<string, string>) => g.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const json     = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const secretFourni = req.headers.get("x-cron-secret") || url.searchParams.get("secret");
  if (secretFourni !== Deno.env.get("CRON_SECRET")) return json({ erreur: "Non autorisé" }, 401);

  if (url.searchParams.has("diag")) {
    return json({ twilio: { sid: !!TW_SID, token: !!TW_TOKEN, from: TW_FROM ?? null }, heure_locale: heureLocale(new Date()) });
  }
  let simuler = url.searchParams.has("simuler");
  try { if (req.method === "POST") { const j = await req.clone().json().catch(() => ({})); if (j && j.simuler) simuler = true; } } catch (_) {}

  const maintenant = new Date();
  const hLoc = heureLocale(maintenant);

  const { data: rappels, error: e1 } = await sb.from("rappels_config").select("*")
    .eq("actif", true).eq("type", "rappel").order("ordre");
  if (e1) return json({ erreur: e1.message }, 500);
  if (!rappels?.length) return json({ message: "aucun rappel actif" });

  const [{ data: ligne, error: e2 }, { data: lc }] = await Promise.all([
    sb.from("tableau").select("donnees").eq("id", LIGNE_MACHINES).single(),
    sb.from("tableau").select("donnees").eq("id", LIGNE_CLIENTS).maybeSingle(),
  ]);
  if (e2) return json({ erreur: e2.message }, 500);
  const machines: Machine[] = Array.isArray(ligne?.donnees) ? ligne!.donnees : [];
  const clients: any[] = Array.isArray(lc?.donnees) ? lc!.donnees : [];
  const telCarnet = (id?: string) => { if (!id) return null; const c = clients.find(x => x && x.id === id); return c ? e164(c.tel) : null; };

  const resultats: unknown[] = [];
  const sansNumero: unknown[] = [];
  const delaiDe = (r: any) => delaiMs(r.delai_valeur, r.delai_unite);

  for (const m of machines) {
    if (m.statut !== "avenir" || m.sansRappels) continue;
    const rdv = dateRdv(m.echeance, m.heure);
    if (!rdv || rdv <= maintenant) continue;

    const dus = rappels.filter(r => r.canal !== "courriel" && maintenant.getTime() >= rdv.getTime() - delaiDe(r));
    if (!dus.length) continue;

    const tel = e164(m.tel) || telCarnet(m.clientId);
    if (!tel) { sansNumero.push({ bt: m.id, client: m.client || "", machine: m.nom || "", rdv: m.echeance }); continue; }

    const { data: faits } = await sb.from("rappels_envoyes").select("rappel_id").eq("bt_id", String(m.id));
    const dejaFaits = new Set((faits || []).map((x: any) => x.rappel_id));
    const aFaire = dus.filter(r => !dejaFaits.has(r.id)).sort((a, b) => delaiDe(a) - delaiDe(b));
    if (!aFaire.length) continue;
    const [r, ...vieux] = aFaire;   // le plus proche du rendez-vous ; les autres sont dépassés

    const vars = {
      prenom: (m.client || "").trim().split(/\s+/)[0] || "",
      client: m.client || "",
      date: fmtDate(rdv), heure: fmtHeure(rdv),
      machine: m.nom || "votre véhicule",
      shop: SHOP,
    };

    if (simuler) {
      if (!(r.delai_unite === "jours" && (hLoc < SILENCE_DEBUT || hLoc >= SILENCE_FIN)))
        resultats.push({ client: m.client, tel, rappel: r.nom, message: remplir(r.gabarit, vars), sautes: vieux.map(v => v.nom) });
      continue;
    }

    for (const v of vieux) {
      await sb.from("rappels_envoyes").insert({ bt_id: String(m.id), rappel_id: v.id, type: "rappel", canal: "sms", destinataire: tel, client: m.client || "",
        message: `(non envoyé : « ${r.nom} » part à la place)`, statut: "saute" });   // doublon → ignoré par la contrainte unique
    }

    if (r.delai_unite === "jours" && (hLoc < SILENCE_DEBUT || hLoc >= SILENCE_FIN)) continue;   // heures de silence

    const message = remplir(r.gabarit, vars);
    const { data: ins, error: eIns } = await sb.from("rappels_envoyes")
      .insert({ bt_id: String(m.id), rappel_id: r.id, type: "rappel", canal: "sms", destinataire: tel, client: m.client || "", message, statut: "en_cours" })
      .select("id").single();
    if (eIns) continue;   // déjà envoyé

    const res = await envoyerSms(tel, message);
    await sb.from("rappels_envoyes").update({ statut: res.sid ? "envoye" : "erreur", twilio_sid: res.sid ?? null, erreur: res.erreur ?? null }).eq("id", ins.id);
    resultats.push({ client: m.client, tel, rappel: r.nom, ok: !!res.sid, erreur: res.erreur, sautes: vieux.map(v => v.nom) });
  }

  return json({ maintenant: maintenant.toISOString(), simulation: simuler, envois: resultats.length, resultats, sans_numero: sansNumero });
});
