// Copie locale récupérée de Supabase le 2026-10-06 (version 5, verify_jwt = false) — ne pas redéployer sans relire
// v178 : seule modification = la capacité par technicien dans plageLibre (même règle que sms-entrant) ; le reste est la version 5.
// ============================================================
// Fonction Edge : rdv-confirmer  (MTR Performance, v125)
// Page publique ouverte par le client quand il clique « Réserver ce moment »
// dans le courriel de disponibilités.
//   GET ?d=<demande>&c=<1|2|3>&j=<jeton>
// Fait exactement ce que fait la réponse 1/2/3 par SMS :
//   • vérifie que la plage est encore libre
//   • crée le bon de travail (ligne 1)
//   • marque le créneau choisi, libère les deux autres
//   • envoie la confirmation (courriel, ou SMS si on a le cellulaire)
// Répond une page HTML lisible, jamais du JSON brut.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LIGNE_MACHINES = 1;
const LIGNE_PARAMS = 7;
const SHOP = "MTR Performance";
const TEL_SHOP = "819-489-0477";
const BASE = Deno.env.get("SUPABASE_URL")!;

const enDec = (h: string) => { const [a, b] = String(h || "0:0").split(":").map(Number); return (a || 0) + (b || 0) / 60; };
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const tel10 = (t?: string | null) => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
function dateLisible(iso: string, heure: string) {
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} à ${String(heure || "").replace(":", " h ")}`;
}

function page(titre: string, message: string, couleur: string, detail = "") {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titre} — ${SHOP}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#111827;padding:22px 26px">
    <div style="color:#f59e0b;font-size:21px;font-weight:700;letter-spacing:.5px">MTR PERFORMANCE</div>
    <div style="color:#9ca3af;font-size:13px;margin-top:2px">Trois-Rivières</div>
  </div>
  <div style="padding:34px 26px;text-align:center">
    <div style="font-size:46px;line-height:1;margin-bottom:14px">${couleur === "ok" ? "✅" : couleur === "info" ? "ℹ️" : "⚠️"}</div>
    <h1 style="margin:0 0 12px;font-size:23px;color:#111827">${titre}</h1>
    <p style="margin:0;font-size:17px;line-height:1.55;color:#374151">${message}</p>
    ${detail ? `<p style="margin:16px 0 0;font-size:15px;color:#6b7280">${detail}</p>` : ""}
  </div>
  <div style="padding:16px 26px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:14px;color:#6b7280">
    Une question? <a href="tel:+18194890477" style="color:#b45309;text-decoration:none">${TEL_SHOP}</a>
  </div>
</div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// v178 : « techs » = noms de TOUS les techniciens capables, figés à la proposition (demandes_service.creneaux[].techs).
// Absent / vide (créneau proposé avant la v178) → capacité 1 (comportement d'avant) ; sinon la plage reste libre tant que le
// nombre d'occupants qui chevauchent (bons non archivés du jour avec heure + créneaux retenus des AUTRES demandes) est inférieur
// au nombre de techniciens. Même règle que sms-entrant.
async function plageLibre(iso: string, heure: string, dureeMin: number, saufDemande: string, techs: string[] | null = null) {
  const jour = String(iso).slice(0, 10);
  const [{ data: l1 }, { data: l7 }, { data: retenus }] = await Promise.all([
    sb.from("tableau").select("donnees").eq("id", LIGNE_MACHINES).maybeSingle(),
    sb.from("tableau").select("donnees").eq("id", LIGNE_PARAMS).maybeSingle(),
    sb.from("creneaux_actifs").select("demande_id,heure,duree_min").eq("iso", jour),
  ]);
  const machines: any[] = Array.isArray(l1?.donnees) ? l1!.donnees : [];
  const tampon = (((l7?.donnees as any)?.rdv?.tampon) ?? 15) / 60;
  const t = enDec(heure), fin = t + dureeMin / 60;
  const chevauche = (d: number, f: number) => !(fin + tampon <= d || t >= f + tampon);
  const capacite = Array.isArray(techs) && techs.length ? techs.length : 1;
  let chevauchants = 0;
  for (const m of machines) {
    if (!m || m.statut === "archive" || m.echeance !== jour || !m.heure) continue;
    const d = enDec(m.heure); if (chevauche(d, d + (m.dureeEstimee || 60) / 60)) chevauchants++;
  }
  for (const r of (retenus || [])) {
    if (r.demande_id === saufDemande) continue;
    const d = enDec(r.heure); if (chevauche(d, d + (r.duree_min || 60) / 60)) chevauchants++;
  }
  return chevauchants < capacite;
}

async function journal(id: string, evenement: string, detail: unknown) {
  try { await sb.from("demandes_journal").insert({ demande_id: id, evenement, detail, par: "client" }); } catch (_) {}
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("d") || "";
  const choix = Number(url.searchParams.get("c") || 0);
  const jeton = url.searchParams.get("j") || "";
  if (!id || !jeton || ![1, 2, 3].includes(choix))
    return page("Lien incomplet", "Ce lien n'est pas valide. Appelez-nous et on place votre rendez-vous ensemble.", "err");

  const { data: dem } = await sb.from("demandes_service").select("*").eq("id", id).maybeSingle();
  if (!dem || dem.jeton !== jeton)
    return page("Lien expiré", "Ce lien n'est plus valide — de nouvelles disponibilités vous ont peut-être été envoyées depuis.", "err");

  if (dem.statut === "confirmee") {
    const cr = (dem.creneaux || []).find((x: any) => Number(x.no) === Number(dem.choix));
    return page("C'est déjà confirmé", `Votre rendez-vous est déjà réservé${cr ? " le " + dateLisible(cr.iso, cr.heure) : ""}.`,
      "info", "Besoin de le changer? Appelez-nous.");
  }
  if (dem.statut !== "creneaux_envoyes")
    return page("Demande fermée", "Cette demande n'est plus en attente de votre choix. Appelez-nous et on regarde ça ensemble.", "err");

  const cr = (dem.creneaux || []).find((x: any) => Number(x.no) === choix);
  if (!cr) return page("Choix introuvable", "Ce moment ne fait plus partie des disponibilités proposées.", "err");

  const jour = String(cr.iso).slice(0, 10), heure = cr.heure;
  const duree = Number(cr.duree) || dem.duree_min || 60;
  // v178 : capacité par technicien figée dans le créneau proposé (absente pour les créneaux d'avant la v178 → capacité 1)
  const techs: string[] | null = Array.isArray(cr.techs) ? cr.techs.map((x: any) => String(x ?? "").trim()).filter(Boolean) : null;

  if (!(await plageLibre(jour, heure, duree, dem.id, techs))) {
    await sb.from("creneaux_reserves").update({ statut: "libere", libere_le: new Date().toISOString(), motif: "plage prise entre-temps" })
      .eq("demande_id", dem.id).eq("statut", "reserve");
    await sb.from("demandes_service").update({ statut: "conflit", lu: false, choix,
      note_interne: `Le client a cliqué le ${dateLisible(jour, heure)} par courriel, mais la plage était prise. À replacer.` }).eq("id", dem.id);
    await journal(dem.id, "conflit", { canal: "courriel", choix, iso: jour, heure });
    return page("Ce moment vient d'être pris", "Désolé! Quelqu'un a réservé cette plage avant vous.", "err",
      "On vous revient très vite avec d'autres disponibilités.");
  }

  // bon de travail
  const { data: l1 } = await sb.from("tableau").select("donnees").eq("id", LIGNE_MACHINES).maybeSingle();
  const machines: any[] = Array.isArray(l1?.donnees) ? l1!.donnees : [];
  const nomMachine = [dem.annee, dem.marque, dem.modele].filter(Boolean).join(" ").trim() || dem.type_machine || "Machine";
  const bt = {
    id: genId(), creeLe: new Date().toISOString(),
    nom: nomMachine, client: dem.nom || "", tel: dem.tel || "", courriel: dem.courriel || "",
    type: dem.type_machine || "", marque: dem.marque || "", modele: dem.modele || "", annee: dem.annee || "", reference: dem.serie || "",
    travaux: dem.description || "", statut: "avenir",
    echeance: jour, heure, dureeEstimee: duree,
    clientId: dem.client_id || "", origine: "demande-web", demandeId: dem.id,
  };
  machines.unshift(bt);
  const { error } = await sb.from("tableau").upsert({ id: LIGNE_MACHINES, donnees: machines });
  if (error) {
    await journal(dem.id, "erreur", { etape: "bon de travail (courriel)", message: error.message });
    return page("Petit pépin technique", "On n'a pas pu enregistrer votre rendez-vous.", "err", `Appelez-nous au ${TEL_SHOP}, on le place tout de suite.`);
  }

  await sb.from("creneaux_reserves").update({ statut: "choisi", motif: "choisi par le client (courriel)" })
    .eq("demande_id", dem.id).eq("no", choix).eq("statut", "reserve");
  await sb.from("creneaux_reserves").update({ statut: "libere", libere_le: new Date().toISOString(), motif: "non retenu par le client" })
    .eq("demande_id", dem.id).eq("statut", "reserve");
  await sb.from("demandes_service").update({ statut: "confirmee", choix, confirme_le: new Date().toISOString(), bt_id: bt.id, lu: false, jeton: null }).eq("id", dem.id);

  // confirmation : courriel si on a l'adresse, sinon SMS
  const quand = dateLisible(jour, heure);
  const texte = `Bonjour ${(dem.nom || "").trim().split(/\s+/)[0] || ""}, votre rendez-vous chez ${SHOP} est confirmé pour le ${quand} (${nomMachine}). Merci et à bientôt!`;
  try {
    if (dem.courriel) {
      await fetch(`${BASE}/functions/v1/envoyer-courriel`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dest: dem.courriel, sujet: "Rendez-vous confirmé — " + SHOP, texte }) });
    } else if (tel10(dem.tel)) {
      await fetch(`${BASE}/functions/v1/smart-api`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tel: "+1" + tel10(dem.tel), message: sansAccent(texte) }) });
    }
  } catch (_) {}

  await journal(dem.id, "confirmee", { canal: "courriel", choix, iso: jour, heure, duree_min: duree, bt_id: bt.id, machine: nomMachine });
  return page("C'est confirmé!", `Votre rendez-vous est réservé le <b>${quand}</b>.`, "ok",
    `${nomMachine} · Une confirmation vous a été envoyée.`);
});
