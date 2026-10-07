// Copie locale récupérée de Supabase le 2026-10-06 (version 11, verify_jwt = false) — ne pas redéployer sans relire
// ═══════════════════════════════════════════════════════════════
//  Fonction « soumission-accept »
//  Reçoit les actions de la page client : ouverture, acceptation, refus.
//  Le fichier DOIT s'appeler index.ts (contrainte Supabase).
//
//  Dans Supabase → Edge Functions → Secrets, il faut :
//    SB_URL          = https://riwamsdpynpbjfadajlz.supabase.co
//    SB_SERVICE_KEY  = la clé « service_role » (Settings → API)
//
//  Et dans les réglages de la fonction :
//    « Verify JWT with legacy secret » → DÉSACTIVÉ
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reponse({ ok: false, error: "méthode refusée" }, 405);

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return reponse({ ok: false, error: "corps illisible" }, 400);
  }

  const jeton = String(corps.jeton || "").trim();
  const action = String(corps.action || "").trim();
  if (!jeton || jeton.length < 12) return reponse({ ok: false, error: "jeton invalide" }, 400);
  if (!["vue", "accepter", "refuser"].includes(action)) {
    return reponse({ ok: false, error: "action inconnue" }, 400);
  }

  const url = Deno.env.get("SB_URL");
  const cle = Deno.env.get("SB_SERVICE_KEY");
  if (!url || !cle) return reponse({ ok: false, error: "secrets manquants" }, 500);

  const sb = createClient(url, cle, { auth: { persistSession: false } });

  // La ligne doit avoir été créée à la publication du lien.
  const { data: ligne, error: err1 } = await sb
    .from("soumissions_suivi")
    .select("jeton, numero, acceptee_le, vues")
    .eq("jeton", jeton)
    .maybeSingle();

  if (err1) return reponse({ ok: false, error: err1.message }, 500);
  if (!ligne) return reponse({ ok: false, error: "soumission introuvable" }, 404);

  const now = new Date().toISOString();
  const maj: Record<string, unknown> = {};

  if (action === "vue") {
    maj.vues = (Number(ligne.vues) || 0) + 1;
    maj.vue_le = now;                       // dernière ouverture
  } else if (action === "accepter") {
    // Déjà acceptée : on ne réécrit pas la date, on répond simplement oui.
    if (ligne.acceptee_le) {
      return reponse({ ok: true, deja: true, numero: ligne.numero });
    }
    maj.acceptee_le = now;
    maj.signature = String(corps.signature || "").slice(0, 120);
    maj.note_client = String(corps.note || "").slice(0, 500);
  } else {
    maj.refusee_le = now;
    maj.note_client = String(corps.note || "").slice(0, 500);
  }

  const { error: err2 } = await sb
    .from("soumissions_suivi")
    .update(maj)
    .eq("jeton", jeton);

  if (err2) return reponse({ ok: false, error: err2.message }, 500);

  return reponse({ ok: true, numero: ligne.numero, action });
});
