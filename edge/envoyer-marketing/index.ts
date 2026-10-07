// Copie locale récupérée de Supabase le 2026-10-06 (version 9, verify_jwt = false) — ne pas redéployer sans relire
// ============================================================
// Fonction Edge : envoyer-marketing  (MTR Performance, v135)
// Appelée par pg_cron toutes les heures → envoie le lot du jour de chaque
// campagne active : quota_jour clients par jour, jours ouvrables, à partir de
// heure_envoi, jamais après 18 h. **Rien ne part avant `debut_le`** quand une
// date de départ a été choisie. Ignore les clients désabonnés (c.smsStop) et
// ceux marqués « ne pas contacter », même s'ils ont été mis en file avant.
//   ?diag · ?simuler · ?forcer (ignore heure, jour et date de départ)
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const LIGNE_CLIENTS = 3;
const TZ = "America/Toronto";
const HEURE_MAX = 18;

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

const tel10 = (t?: string | null) => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
function localParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short" })
    .formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {} as Record<string, string>);
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: +p.hour % 24, weekend: p.weekday === "Sat" || p.weekday === "Sun" };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const secretFourni = req.headers.get("x-cron-secret") || url.searchParams.get("secret");
  if (secretFourni !== Deno.env.get("CRON_SECRET")) return json({ erreur: "Non autorisé" }, 401);
  const maintenant = new Date();
  const loc = localParts(maintenant);
  if (url.searchParams.has("diag")) return json({ twilio: { sid: !!TW_SID, token: !!TW_TOKEN, from: TW_FROM ?? null }, local: loc });
  const simuler = url.searchParams.has("simuler");
  const forcer = url.searchParams.has("forcer");

  const { data: campagnes, error: e1 } = await sb.from("mkt_campagnes").select("*").eq("statut", "en_cours");
  if (e1) return json({ erreur: e1.message }, 500);
  if (!campagnes?.length) return json({ message: "aucune campagne en cours", local: loc });

  // Désabonnés et « ne pas contacter » : fiche client (ligne 3) → numéros à ignorer
  const stops = new Set<string>();
  try {
    const { data: l3 } = await sb.from("tableau").select("donnees").eq("id", LIGNE_CLIENTS).single();
    for (const c of (Array.isArray(l3?.donnees) ? l3!.donnees : []))
      if ((c?.smsStop || c?.nePasContacter) && tel10(c.tel)) stops.add(tel10(c.tel));
  } catch (_) {}

  const rapport: unknown[] = [];
  for (const k of campagnes) {
    if (!forcer) {
      // Date de départ choisie par Jason : rien ne part avant
      if (k.debut_le && new Date(k.debut_le).getTime() > maintenant.getTime()) {
        rapport.push({ campagne: k.nom, saute: "pas avant " + k.debut_le }); continue;
      }
      if (k.jours_ouvrables && loc.weekend) { rapport.push({ campagne: k.nom, saute: "fin de semaine" }); continue; }
      if (loc.heure < (k.heure_envoi ?? 10) || loc.heure >= HEURE_MAX) { rapport.push({ campagne: k.nom, saute: "hors plage horaire" }); continue; }
    }
    const { data: dejaRows } = await sb.from("mkt_file").select("envoye_le").eq("campagne_id", k.id).in("statut", ["envoye", "erreur"]).gte("envoye_le", new Date(maintenant.getTime() - 36e5 * 30).toISOString());
    const deja = (dejaRows || []).filter(r => r.envoye_le && localParts(new Date(r.envoye_le)).jour === loc.jour).length;
    const reste = Math.max(0, (k.quota_jour ?? 20) - deja);
    if (!reste) { rapport.push({ campagne: k.nom, saute: "quota du jour atteint", deja }); continue; }

    const { data: attente } = await sb.from("mkt_file").select("*").eq("campagne_id", k.id).eq("statut", "attente").order("id").limit(reste + 50);
    if (!attente?.length) {
      await sb.from("mkt_campagnes").update({ statut: "terminee", termine_le: maintenant.toISOString() }).eq("id", k.id);
      rapport.push({ campagne: k.nom, terminee: true });
      continue;
    }
    let n = 0; const envois: unknown[] = [];
    for (const f of attente) {
      if (n >= reste) break;
      if (stops.has(tel10(f.tel))) { if (!simuler) await sb.from("mkt_file").update({ statut: "annule", erreur: "désabonné ou ne pas contacter" }).eq("id", f.id); envois.push({ client: f.client, annule: "STOP" }); continue; }
      if (simuler) { envois.push({ client: f.client, tel: f.tel }); n++; continue; }
      const { data: res } = await sb.from("mkt_file").update({ statut: "en_cours" }).eq("id", f.id).eq("statut", "attente").select("id");
      if (!res?.length) continue;
      const r = await envoyerSms(f.tel, f.message);
      await sb.from("mkt_file").update({ statut: r.sid ? "envoye" : "erreur", twilio_sid: r.sid ?? null, erreur: r.erreur ?? null, envoye_le: new Date().toISOString() }).eq("id", f.id);
      envois.push({ client: f.client, ok: !!r.sid, erreur: r.erreur }); n++;
      await new Promise(x => setTimeout(x, 300));
    }
    rapport.push({ campagne: k.nom, quota: k.quota_jour, heure_envoi: k.heure_envoi, debut_le: k.debut_le,
      deja_aujourdhui: deja, envoyes_maintenant: n, envois });
  }
  return json({ maintenant: maintenant.toISOString(), local: loc, simulation: simuler, rapport });
});
