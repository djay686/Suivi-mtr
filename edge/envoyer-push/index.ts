// ============================================================
// Fonction Edge : envoyer-push  (MTR Performance, v148)
// Envoie une notification Web Push (VAPID) à tous les appareils abonnés.
// Appelée par les déclencheurs Postgres (nouvelle demande, texto à vérifier)
// avec l'en-tête x-cron-secret, ou par l'app (jeton employé) pour un test.
// Déploiement : verify_jwt = false (la fonction vérifie elle-même).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-cron-secret" } });

async function config() {
  const { data } = await sb.from("push_config").select("cle, valeur");
  const c: Record<string, string> = {};
  (data || []).forEach((r) => (c[r.cle] = r.valeur));
  return c;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  const url = new URL(req.url);
  const cfg = await config();
  if (!cfg.vapid_public || !cfg.vapid_private) return json({ erreur: "push_config incomplète" }, 500);

  // Clé publique : lecture libre (elle est publique par nature)
  if (url.searchParams.has("cle")) return json({ cle: cfg.vapid_public });

  // Authentification : secret (déclencheurs / cron) OU jeton d'un employé connecté (test depuis l'app)
  const secretOk = (req.headers.get("x-cron-secret") || url.searchParams.get("secret")) === Deno.env.get("CRON_SECRET");
  let employe: string | null = null;
  if (!secretOk) {
    const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jeton) return json({ erreur: "Non autorisé" }, 401);
    const { data, error } = await sb.auth.getUser(jeton);
    if (error || !data?.user) return json({ erreur: "Non autorisé" }, 401);
    employe = data.user.email || data.user.id;
  }

  webpush.setVapidDetails(cfg.vapid_subject || "mailto:info@mtrperformance.ca", cfg.vapid_public, cfg.vapid_private);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const type = String(body.type || url.searchParams.get("type") || "info");
  const titre = String(body.titre || "MTR Performance");
  const corps = String(body.corps || "");
  const lien = String(body.url || "/");

  if (url.searchParams.has("diag")) {
    const { count } = await sb.from("push_abonnements").select("*", { count: "exact", head: true }).eq("actif", true);
    return json({ abonnements_actifs: count ?? 0, cle: cfg.vapid_public });
  }

  // Cibles : tous les appareils actifs, ou seulement l'endpoint fourni (test depuis un appareil)
  let q = sb.from("push_abonnements").select("id, endpoint, p256dh, auth, employe").eq("actif", true);
  if (body.endpoint) q = q.eq("endpoint", String(body.endpoint));
  const { data: cibles, error } = await q;
  if (error) return json({ erreur: error.message }, 500);
  if (!cibles?.length) return json({ envoyes: 0, message: "aucun appareil abonné" });

  const charge = JSON.stringify({ titre, corps, url: lien, type, tag: `mtr-${type}-${Date.now()}` });
  const resultats: unknown[] = [];
  let ok = 0;
  for (const c of cibles) {
    try {
      await webpush.sendNotification({ endpoint: c.endpoint, keys: { p256dh: c.p256dh, auth: c.auth } }, charge, { TTL: 3600, urgency: "high" });
      ok++;
      await sb.from("push_abonnements").update({ dernier_ok: new Date().toISOString(), derniere_erreur: null }).eq("id", c.id);
      resultats.push({ id: c.id, employe: c.employe, ok: true });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      const msg = (e as Error).message || String(e);
      // 404 / 410 : abonnement révoqué (app désinstallée, permission retirée) → on le désactive
      const maj: Record<string, unknown> = { derniere_erreur: `${code ?? ""} ${msg}`.trim() };
      if (code === 404 || code === 410) maj.actif = false;
      await sb.from("push_abonnements").update(maj).eq("id", c.id);
      resultats.push({ id: c.id, employe: c.employe, ok: false, code, erreur: msg });
    }
  }
  await sb.from("push_journal").insert({ type, titre, corps, nb_cibles: cibles.length, nb_ok: ok, detail: { par: employe || "declencheur", resultats } });
  return json({ envoyes: ok, cibles: cibles.length, resultats });
});
