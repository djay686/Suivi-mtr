// Copie locale récupérée de Supabase le 2026-10-06 (version 11, verify_jwt = true) — ne pas redéployer sans relire
// Edge Function « gerer-compte » — Groupe MTR Performance
// Crée ou réinitialise le compte (courriel + mot de passe) d'un employé.
// Seul un employé dont le dossier a le rôle « admin » (ligne 4 de la table) peut l'appeler.
// Déploiement : supabase functions deploy gerer-compte   (voir GUIDE-SUPABASE.md)
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIGNE_EMPLOYES = 4;
const DOMAINE = "@mtrperformance.local";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reponse = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

function identifiantPour(prenom: string, nomFamille: string) {
  const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.\-]/g, "");
  const p = norm(prenom), n = norm(nomFamille).replace(/\./g, "");
  return p && n ? p[0] + "." + n : p || n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, courriel, motDePasse, nom, bootstrap } = await req.json();
    if (action !== "creer-ou-reinitialiser") return reponse({ erreur: "Action inconnue" }, 400);
    if (!courriel || !courriel.endsWith(DOMAINE)) return reponse({ erreur: "Courriel invalide" }, 400);
    if (!motDePasse || motDePasse.length < 6) return reponse({ erreur: "Mot de passe trop court" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: ligne } = await admin.from("tableau").select("donnees").eq("id", LIGNE_EMPLOYES).single();
    const employes: any[] = (ligne && ligne.donnees) || [];
    const roleDe = (e: any) => (e?.role === "admin" || e?.role === "technicien") ? e.role : (e?.nom === "Jason" ? "admin" : "technicien");
    const identDe = (e: any) => ((e.identifiant || identifiantPour(e.nom, e.nomFamille)) || "").toLowerCase();
    const { data: liste } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const utilisateurs = liste?.users || [];

    // 1. Qui appelle ?
    const jeton = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const clientAppelant = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jeton}` } } });
    const { data: { user } } = await clientAppelant.auth.getUser();

    if (user && user.email) {
      // 2a. Employé connecté : doit être administrateur dans les dossiers
      const identAppelant = user.email.split("@")[0].toLowerCase();
      const appelant = employes.find((e) => identDe(e) === identAppelant);
      if (!appelant || appelant.actif === false || roleDe(appelant) !== "admin") return reponse({ erreur: "Réservé à l'administration" }, 403);
    } else {
      // 2b. Personne de connecté : SEUL le tout premier compte peut se créer, par un
      //     administrateur qui prouve son identité avec le NIP de son dossier.
      const comptesAtelier = utilisateurs.filter((u) => (u.email || "").toLowerCase().endsWith(DOMAINE));
      if (comptesAtelier.length > 0) return reponse({ erreur: "Non connecté : un compte de l'atelier existe déjà (" + comptesAtelier.map((u) => u.email).join(", ") + ") — connecte-toi avec ton compte pour créer les autres" }, 401);
      if (!bootstrap || !bootstrap.identifiant) return reponse({ erreur: "Premier compte : identifiant et NIP requis" }, 401);
      const ident = String(bootstrap.identifiant).toLowerCase();
      const e = employes.find((x) => identDe(x) === ident);
      if (!e || e.actif === false || roleDe(e) !== "admin") return reponse({ erreur: "Le premier compte doit être celui d'un administrateur" }, 403);
      if (!e.nip || String(e.nip) !== String(bootstrap.nip || "")) return reponse({ erreur: "NIP incorrect" }, 403);
      if (courriel.toLowerCase() !== ident + DOMAINE) return reponse({ erreur: "Le premier compte doit être le tien" }, 403);
    }

    // 3. Créer, ou remettre le mot de passe si le compte existe déjà
    const existant = (liste?.users || []).find((u) => (u.email || "").toLowerCase() === courriel.toLowerCase());
    if (existant) {
      const { error } = await admin.auth.admin.updateUserById(existant.id, { password: motDePasse, email_confirm: true, user_metadata: { nom } });
      if (error) return reponse({ erreur: error.message }, 500);
      return reponse({ ok: true, action: "reinitialise", id: existant.id });
    }
    const { data, error } = await admin.auth.admin.createUser({ email: courriel, password: motDePasse, email_confirm: true, user_metadata: { nom } });
    if (error) return reponse({ erreur: error.message }, 500);
    return reponse({ ok: true, action: "cree", id: data.user?.id });
  } catch (e) {
    return reponse({ erreur: (e as Error).message || "Erreur" }, 500);
  }
});
