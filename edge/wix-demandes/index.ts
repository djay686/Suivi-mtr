// Copie locale récupérée de Supabase le 2026-10-06 (version 13, verify_jwt = false) — ne pas redéployer sans relire
// ============================================================
// Fonction Edge : wix-demandes  (MTR Performance, v139)
// Importe les soumissions des formulaires Wix dans `demandes_service`.
//
// • Modèle : liste de la marque choisie (modele_brp/_pol/_yam/_kaw/_hon).
// • **Date souhaitée** : le champ « Quand souhaitez-vous venir? » du formulaire
//   (DATE_PICKER) va dans la colonne `date_souhaitee`.
// • 2e machine : marque2/annee2/modele2_* → colonne `machine2`.
// • Une demande supprimée ne revient jamais (`demandes_ignorees`).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const WIX_KEY = Deno.env.get("WIX_API_KEY");
const WIX_SITE = Deno.env.get("WIX_SITE_ID") ?? "8e2bb7bf-6cb7-472b-8309-cfaac26f9ba3";
const NAMESPACE = "wix.form_app.form";
const LIGNE_CLIENTS = 3;

const FORMULAIRES: Record<string, string> = {
  "ea31d22b-34e1-4aaf-9b06-9cde8c475259": "Motomarine",
  "7f827568-8a7c-4849-9676-f51bbf151d99": "Motoneige",
  "3d21b194-3d28-4edd-a34e-c7c4cacf48ce": "VTT",
  "5f394edb-f726-45d8-839d-5209eed80b9b": "Côte à côte",
};
const MODELE_1 = ["modele_brp", "modele_pol", "modele_yam", "modele_kaw", "modele_hon", "modele"];
const MODELE_2 = ["modele2_brp", "modele2_pol", "modele2_yam", "modele2_kaw", "modele2_hon", "modele2"];
const QUAND = ["quand_souhaitez_vous_venir", "quand", "date_souhaitee"];

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { "Content-Type": "application/json" } });
const tel10 = (t?: string | null) => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };

async function wix(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": WIX_KEY!, "wix-site-id": WIX_SITE },
    body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Wix ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

function extraire(s: any, typeDefaut: string) {
  const v = s.submissions || {};
  const prendre = (...cles: string[]) => { for (const c of cles) { const x = v[c]; if (x !== undefined && x !== null && x !== "") return x; } return ""; };
  const propre = (t: unknown) => { const x = String(t || "").trim(); return /^je ne sais pas$/i.test(x) ? "" : x; };

  const nom = String(prendre("prenom_nom", "first_name", "nom") || "").trim();
  const services: string[] = ([] as string[])
    .concat(prendre("services_demandes") || [])
    .concat(prendre("entretien_fin_saison_d4a1") || []);
  const rep = String(prendre("petite_reparation_c7b2") || "");
  const desc = [String(prendre("description_de_la_situation") || ""), rep ? "Petite réparation : " + rep : ""]
    .filter(Boolean).join("\n");

  const tel = String(prendre("telephone_2387", "phone") || "");
  const courriel = String(prendre("e_mail_cb04", "email") || "");
  const brutCanal = String(prendre("canal_prefere_b8f3") || "").toLowerCase();
  const canal = brutCanal.includes("courriel") || brutCanal.includes("mail") ? "courriel"
              : brutCanal.includes("sms") || brutCanal.includes("texte") ? "sms"
              : (tel10(tel) ? "sms" : courriel ? "courriel" : "");

  // Quand le client souhaite venir (sélecteur de date du formulaire)
  const brutQuand = String(prendre(...QUAND) || "").slice(0, 10);
  const dateSouhaitee = /^\d{4}-\d{2}-\d{2}$/.test(brutQuand) ? brutQuand : null;

  const coche = ([] as string[]).concat(prendre("deuxieme_machine") || []).length > 0;
  const m2 = { marque: propre(prendre("marque2")), modele: propre(prendre(...MODELE_2)), annee: propre(prendre("annee2")) };
  const machine2 = (coche && (m2.marque || m2.modele || m2.annee)) ? m2 : null;

  return {
    source: "wix", source_ref: s.id,
    nom, tel, courriel,
    canal_prefere: canal || null,
    type_machine: typeDefaut,
    marque: String(prendre("marque") || ""), modele: propre(prendre(...MODELE_1)), annee: String(prendre("annee") || ""),
    machine2,
    date_souhaitee: dateSouhaitee,
    description: desc,
    services,
    brut: v,
    statut: "nouvelle", lu: false, duree_min: 60,
    cree_le: s.createdDate || new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const secretFourni = req.headers.get("x-cron-secret") || url.searchParams.get("secret");
  const diag = url.searchParams.has("diag");
  if (!diag && secretFourni !== Deno.env.get("CRON_SECRET")) return json({ erreur: "Non autorisé" }, 401);
  if (!WIX_KEY) return json({ pret: false, message: "Secret WIX_API_KEY absent.", site: WIX_SITE });

  if (diag) {
    try {
      const j = await wix("https://www.wixapis.com/forms/v4/submissions/namespace/query",
        { query: { filter: { namespace: NAMESPACE }, sort: [{ fieldName: "createdDate", order: "DESC" }], cursorPaging: { limit: 3 } } });
      const { count } = await sb.from("demandes_ignorees").select("*", { count: "exact", head: true });
      const d = (j.submissions || [])[0];
      return json({ pret: true, site: WIX_SITE, soumissions_vues: (j.submissions || []).length, ignorees: count ?? 0,
        exemple: d ? { id: d.id, formId: d.formId, date: d.createdDate, champs: Object.keys(d.submissions || {}),
          machine: MODELE_1.map(c => d.submissions?.[c]).find(x => x) ?? null,
          machine2: MODELE_2.map(c => d.submissions?.[c]).find(x => x) ?? null,
          date_souhaitee: QUAND.map(c => d.submissions?.[c]).find(x => x) ?? null } : null });
    } catch (e) { return json({ pret: false, erreur: String(e) }); }
  }

  const simuler = url.searchParams.has("simuler");
  let depuis = url.searchParams.get("depuis");
  if (!depuis) {
    const { data } = await sb.from("demandes_service").select("cree_le").eq("source", "wix").order("cree_le", { ascending: false }).limit(1);
    depuis = data && data[0] ? data[0].cree_le : new Date(Date.now() - 7 * 86400000).toISOString();
  }

  let j;
  try {
    j = await wix("https://www.wixapis.com/forms/v4/submissions/namespace/query", {
      query: { filter: { namespace: NAMESPACE, createdDate: { $gt: depuis } },
        sort: [{ fieldName: "createdDate", order: "ASC" }], cursorPaging: { limit: 100 } } });
  } catch (e) { return json({ erreur: String(e) }, 500); }

  const brutes = (j.submissions || []).filter((s: any) => FORMULAIRES[s.formId]);
  if (!brutes.length) return json({ depuis, vues: (j.submissions || []).length, retenues: 0, message: "rien de nouveau" });

  const refs = brutes.map((s: any) => s.id);
  const [{ data: dejaLa }, { data: ignorees }] = await Promise.all([
    sb.from("demandes_service").select("source_ref").in("source_ref", refs),
    sb.from("demandes_ignorees").select("source_ref").in("source_ref", refs),
  ]);
  const connus = new Set([...(dejaLa || []), ...(ignorees || [])].map((x: any) => x.source_ref));
  const nouvelles = brutes.filter((s: any) => !connus.has(s.id)).map((s: any) => extraire(s, FORMULAIRES[s.formId]));

  if (!nouvelles.length) return json({ depuis, vues: brutes.length, retenues: 0,
    ignorees: (ignorees || []).length, message: "rien de neuf (déjà importées ou supprimées)" });
  if (simuler) return json({ depuis, simulation: true, nouvelles });

  try {
    const { data: l3 } = await sb.from("tableau").select("donnees").eq("id", LIGNE_CLIENTS).single();
    const clients: any[] = Array.isArray(l3?.donnees) ? l3!.donnees : [];
    const parTel = new Map(clients.filter(c => tel10(c?.tel)).map(c => [tel10(c.tel), c.id]));
    nouvelles.forEach((d: any) => { const id = parTel.get(tel10(d.tel)); if (id) d.client_id = id; });
  } catch (_) {}

  const { data: ins, error } = await sb.from("demandes_service").insert(nouvelles)
    .select("id,nom,type_machine,marque,modele,annee,machine2,date_souhaitee,canal_prefere,cree_le");
  if (error) return json({ erreur: error.message, tentees: nouvelles.length }, 500);
  try {
    await sb.from("demandes_journal").insert((ins || []).map(d => ({ demande_id: d.id, evenement: "recue",
      detail: { source: "formulaire du site", canal_prefere: d.canal_prefere, date_souhaitee: d.date_souhaitee,
        deux_machines: !!d.machine2 }, par: "systeme" })));
  } catch (_) {}
  return json({ depuis, importees: ins?.length || 0, demandes: ins });
});
