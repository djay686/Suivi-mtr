// Copie locale récupérée de Supabase le 2026-10-06 (version 8, verify_jwt = false) — ne pas redéployer sans relire
// ============================================================
// Fonction Edge : envoyer-courriel  (MTR Performance, v125)
// Envoi par SendGrid, gabarit HTML aux couleurs de l'atelier.
//   POST { dest, sujet, texte, boutons?, html?, repondreA? }
//   boutons : [{ texte, url }] → gros boutons cliquables (ex. « Réserver »)
//   ?diag → état des secrets, sans rien envoyer
// Secrets : SENDGRID_API_KEY, COURRIEL_EXPEDITEUR, COURRIEL_NOM (facultatif)
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLE = Deno.env.get("SENDGRID_API_KEY") ?? Deno.env.get("SENDGRID_API_SECRET") ?? "";
const EXPEDITEUR = Deno.env.get("COURRIEL_EXPEDITEUR") ?? Deno.env.get("FROM_EMAIL_ADDRESS") ?? "";
const NOM = Deno.env.get("COURRIEL_NOM") ?? "MTR Performance";
const TEL_SHOP = "819-489-0477";

const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const ech = (t: string) => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function enveloppe(sujet: string, texte: string, boutons: { texte: string; url: string }[] = []) {
  const corps = ech(texte).split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#1f2937">${p.replace(/\n/g, "<br>")}</p>`).join("");
  const blocs = boutons.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">` +
    boutons.map(b => `<tr><td style="padding:5px 0">
      <a href="${ech(b.url)}" style="display:block;background:#f59e0b;color:#111827;text-decoration:none;
        font-size:17px;font-weight:700;text-align:center;padding:15px 18px;border-radius:10px">${ech(b.texte)}</a>
    </td></tr>`).join("") + `</table>
    <p style="margin:10px 0 0;font-size:14px;color:#6b7280;text-align:center">Cliquez le moment qui vous convient — c'est réservé immédiatement.</p>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${ech(sujet)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
    <tr><td style="background:#111827;padding:20px 24px">
      <div style="color:#f59e0b;font-size:20px;font-weight:700;letter-spacing:.5px">MTR PERFORMANCE</div>
      <div style="color:#9ca3af;font-size:13px;margin-top:2px">Trois-Rivières · Sea-Doo · Ski-Doo · Can-Am</div>
    </td></tr>
    <tr><td style="padding:24px">${corps}${blocs}</td></tr>
    <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <div style="font-size:13px;color:#6b7280;line-height:1.5">
        Une question? Appelez-nous au <a href="tel:+18194890477" style="color:#b45309;text-decoration:none">${TEL_SHOP}</a><br>
        <a href="https://www.mtrperformance.ca" style="color:#b45309;text-decoration:none">mtrperformance.ca</a>
      </div>
    </td></tr>
  </table>
  <div style="max-width:600px;margin:12px auto 0;font-size:11px;color:#9ca3af;text-align:center">
    Vous recevez ce message parce que vous avez communiqué avec MTR Performance.
  </div>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (url.searchParams.has("diag")) {
    return json({ pret: !!(CLE && EXPEDITEUR), cle_presente: !!CLE, expediteur: EXPEDITEUR || null, nom: NOM,
      message: CLE && EXPEDITEUR ? "prêt à envoyer" : !CLE ? "Secret SENDGRID_API_KEY manquant" : "Secret COURRIEL_EXPEDITEUR manquant" });
  }
  try {
    const { dest, sujet, texte, html, boutons, repondreA } = await req.json();
    if (!dest || !sujet || !(texte || html)) return json({ ok: false, error: "dest, sujet et texte sont requis" }, 400);
    if (!CLE || !EXPEDITEUR) return json({ ok: false, error: "Courriel non configuré : secrets SendGrid manquants (voir ?diag)" }, 200);

    const destinataires = (Array.isArray(dest) ? dest : [dest]).map((e: string) => ({ email: String(e).trim() }));
    const contenu: { type: string; value: string }[] = [];
    if (texte) {
      const liens = Array.isArray(boutons) && boutons.length
        ? "\n\n" + boutons.map((b: any) => `${b.texte} : ${b.url}`).join("\n") : "";
      contenu.push({ type: "text/plain", value: texte + liens });
    }
    contenu.push({ type: "text/html", value: html || enveloppe(sujet, texte, Array.isArray(boutons) ? boutons : []) });

    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": "Bearer " + CLE, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: destinataires }],
        from: { email: EXPEDITEUR, name: NOM },
        reply_to: { email: repondreA || EXPEDITEUR, name: NOM },
        subject: sujet, content: contenu,
      }),
    });
    if (r.status === 202) return json({ ok: true, id: r.headers.get("x-message-id") });
    const d = await r.json().catch(() => ({}));
    return json({ ok: false, error: d?.errors?.[0]?.message || `erreur ${r.status}`, details: d?.errors ?? null }, 200);
  } catch (e) { return json({ ok: false, error: String(e) }, 200); }
});
