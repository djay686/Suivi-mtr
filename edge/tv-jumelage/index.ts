// Edge Function « tv-jumelage » — Groupe MTR Performance (v169)
// Brancher la TV du lift sans rien taper sur la TV : la TV affiche un code (et un code QR), le technicien le confirme
// dans l'app sur son cell, avec SON compte. La TV reçoit alors une connexion à usage unique pour ce compte : elle suit
// son punch, et ses punchs restent à son nom. Aucun mot de passe ne passe par la TV.
//
//   POST { action: "demander", ecran }          (la TV, pas encore connectée)  → { code, secret, expire_le }
//   POST { action: "attendre", code, secret }   (la TV, toutes les 3 s)        → { etat: attente | pret | expire | inconnu, token_hash? }
//   POST { action: "confirmer", code }          (l'app, employé connecté)      → { ok, ecran, tech }
//
// À déployer avec « Verify JWT » DÉSACTIVÉ : la TV n'a pas encore de session quand elle demande son code.
// « confirmer » vérifie lui-même le jeton de l'employé. Le « secret » ne quitte jamais la TV : sans lui, un code vu à
// l'écran ne permet pas de récupérer la connexion.
// Table : tv_jumelages (edge/ecrans.sql), fermée à tous sauf à cette fonction.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIGNE_EMPLOYES = 4;
const DUREE_MIN = 10;          // un code vit 10 minutes
const MAX_EN_COURS = 30;       // garde-fou : codes en attente en même temps

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reponse = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ── Qui confirme ? (mêmes règles que l'app : employé actif, identifiant = début du courriel) ──
const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.\-]/g, "").replace(/\.{2,}/g, ".").replace(/^\.|\.$/g, "");
function identifiantPour(prenom: string, nomFamille: string) {
  const p = norm(prenom), n = norm(nomFamille).replace(/\./g, "");
  return p && n ? p[0] + "." + n : (p || n);
}
function roleDe(e: any) {
  if (!e) return "technicien";
  if (e.role === "admin" || e.role === "technicien" || e.role === "tache") return e.role;
  return e.nom === "Jason" ? "admin" : "technicien";
}
async function appelant(req: Request) {
  const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jeton || !jeton.includes(".")) return null;          // pas un jeton d'employé (clé publique de l'app)
  const { data: { user } } = await admin.auth.getUser(jeton);
  if (!user || !user.email) return null;
  const { data: ligne } = await admin.from("tableau").select("donnees").eq("id", LIGNE_EMPLOYES).single();
  const employes: any[] = (ligne && ligne.donnees) || [];
  const ident = user.email.split("@")[0].toLowerCase();
  const e = employes.find((x) => String(x.identifiant || identifiantPour(x.nom, x.nomFamille) || "").toLowerCase() === ident);
  if (!e || e.actif === false) return null;
  return { nom: e.nom || ident, role: roleDe(e), email: user.email };
}

const hex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))); }
function codeAleatoire() { const b = new Uint32Array(1); crypto.getRandomValues(b); return String(100000 + (b[0] % 900000)); }
function secretAleatoire() { const b = new Uint8Array(32); crypto.getRandomValues(b); return hex(b); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reponse({ erreur: "POST seulement" }, 405);
  const corps = await req.json().catch(() => ({}));
  const maintenant = new Date();
  try {
    // ── La TV demande un code ──
    if (corps.action === "demander") {
      const ecran = String(corps.ecran || "lift").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "lift";
      await admin.from("tv_jumelages").delete().lt("expire_le", maintenant.toISOString());   // ménage
      const { count } = await admin.from("tv_jumelages").select("code", { count: "exact", head: true });
      if ((count || 0) >= MAX_EN_COURS) return reponse({ erreur: "Trop de codes en attente : réessaie dans quelques minutes" }, 429);
      const expire = new Date(maintenant.getTime() + DUREE_MIN * 60000).toISOString();
      for (let essai = 0; essai < 6; essai++) {
        const code = codeAleatoire(), secret = secretAleatoire();
        const { error } = await admin.from("tv_jumelages").insert({ code, secret_hash: await sha256(secret), ecran, expire_le: expire });
        if (!error) return reponse({ code, secret, expire_le: expire, duree_min: DUREE_MIN });
        if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
      }
      throw new Error("Aucun code libre : réessaie");
    }

    // ── La TV attend la confirmation (avec son secret) ──
    if (corps.action === "attendre") {
      const code = String(corps.code || "").replace(/\D/g, ""), secret = String(corps.secret || "");
      const { data: j } = await admin.from("tv_jumelages").select("*").eq("code", code).maybeSingle();
      if (!j || !secret || j.secret_hash !== await sha256(secret)) return reponse({ etat: "inconnu" });
      if (new Date(j.expire_le) < maintenant) {
        await admin.from("tv_jumelages").delete().eq("code", code);
        return reponse({ etat: "expire" });
      }
      if (!j.token_hash) return reponse({ etat: "attente" });
      await admin.from("tv_jumelages").delete().eq("code", code);    // à usage unique
      return reponse({ etat: "pret", token_hash: j.token_hash, tech: j.tech || "" });
    }

    // ── Le technicien confirme dans l'app, avec son compte ──
    if (corps.action === "confirmer") {
      const qui = await appelant(req);
      if (!qui) return reponse({ erreur: "Connecte-toi dans l'app avec ton compte (mot de passe) pour brancher la TV — le NIP seul ne suffit pas" }, 401);
      if (qui.role === "admin") return reponse({ erreur: "Pas de compte d'administration sur un écran visible de tous : un technicien branche la TV avec son compte" }, 403);
      const code = String(corps.code || "").replace(/\D/g, "");
      const { data: j } = await admin.from("tv_jumelages").select("code,ecran,expire_le,token_hash").eq("code", code).maybeSingle();
      if (!j || new Date(j.expire_le) < maintenant) return reponse({ erreur: "Code inconnu ou expiré : regarde le code affiché sur la TV" }, 404);
      if (j.token_hash) return reponse({ erreur: "Cette TV vient déjà d'être branchée" }, 409);
      // Connexion à usage unique pour CE compte (aucun courriel n'est envoyé)
      const { data: lien, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: qui.email });
      const hache = (lien as any)?.properties?.hashed_token;
      if (error || !hache) throw new Error("Connexion refusée par Supabase : " + (error?.message || "jeton absent"));
      const { error: e2 } = await admin.from("tv_jumelages").update({ token_hash: hache, tech: qui.nom, confirme_le: maintenant.toISOString() }).eq("code", code);
      if (e2) throw new Error(e2.message);
      return reponse({ ok: true, ecran: j.ecran, tech: qui.nom });
    }

    return reponse({ erreur: "action inconnue (demander, attendre ou confirmer)" }, 400);
  } catch (e) {
    const msg = (e as Error).message || "Erreur";
    if (/tv_jumelages|42P01|does not exist|schema cache/i.test(msg)) return reponse({ erreur: "Table tv_jumelages absente : exécute edge/ecrans.sql" }, 500);
    return reponse({ erreur: msg }, 500);
  }
});
