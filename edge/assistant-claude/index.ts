// Copie locale récupérée de Supabase le 2026-10-06 (version 10, verify_jwt = true) — ne pas redéployer sans relire
// Edge Function « assistant-claude » — Groupe MTR Performance
// Relais vers l'API Anthropic pour l'assistant du bon de travail live.
// La clé API reste ici (secret ANTHROPIC_API_KEY) ; seuls les employés connectés peuvent appeler.
// Déploiement : supabase functions deploy assistant-claude   (voir GUIDE-SUPABASE.md)
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// Modèle utilisé par tout l'atelier. Sonnet = meilleur rapport qualité/prix.
// Pour en changer sans redéployer : ajouter le secret MODELE_CLAUDE dans Supabase
// (ex. claude-sonnet-5, claude-opus-5, claude-haiku-4-5-20251001).
const MODELE = Deno.env.get("MODELE_CLAUDE") || "claude-sonnet-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reponse = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jeton = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jeton) return reponse({ erreur: "Non connecté" }, 401);
    const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jeton}` } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return reponse({ erreur: "Non connecté" }, 401);
    if (!ANTHROPIC_API_KEY) return reponse({ erreur: "Clé ANTHROPIC_API_KEY manquante dans les secrets" }, 500);

    const { systeme, messages } = await req.json();
    if (!Array.isArray(messages) || !messages.length) return reponse({ erreur: "Aucun message" }, 400);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELE, max_tokens: 1500, system: systeme || "", messages }),
    });
    const data = await r.json();
    if (!r.ok) return reponse({ erreur: data?.error?.message || "Refus de l'API" }, 502);
    const texte = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    return reponse({ texte, modele: MODELE, usage: data.usage || null });
  } catch (e) {
    return reponse({ erreur: (e as Error).message || "Erreur" }, 500);
  }
});
