// Copie locale récupérée de Supabase le 2026-10-06 (version 12, verify_jwt = false) — ne pas redéployer sans relire
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SID   = Deno.env.get("TWILIO_ACCOUNT_SID") ?? Deno.env.get("TWILIO_SID") ?? "";
const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? Deno.env.get("TWILIO_TOKEN") ?? "";
const FROM  = Deno.env.get("TWILIO_FROM") ?? Deno.env.get("TWILIO_NUMERO")
           ?? Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const { tel, message, mediaUrl } = await req.json();
    if (!tel || !message) return json({ ok: false, error: "tel ou message manquant" }, 400);
    if (!SID || !TOKEN || !FROM) return json({ ok: false, error: "secrets Twilio manquants" }, 500);

    const form = new URLSearchParams();
    form.append("To", tel);
    form.append("From", FROM);
    form.append("Body", message);
    if (mediaUrl) form.append("MediaUrl", mediaUrl);

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${SID}:${TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const d = await r.json();
    if (!r.ok) return json({ ok: false, error: d.message || `erreur ${r.status}` }, 200);
    return json({ ok: true, sid: d.sid, statut: d.status });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});
