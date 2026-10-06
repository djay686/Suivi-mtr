// ============================================================
// Fonction Edge : sms-entrant  (MTR Performance, v172)
// Webhook Twilio « A MESSAGE COMES IN ».
//
//   STOP / ARRÊT → marque le client désabonné (c.smsStop, ligne 3)
//   1 / 2 / 3     → confirme LE créneau QUE JASON A CHOISI dans le tableau
//   4             → le client veut d'autres plages
//   autre         → rien de plus, mais VISIBLE dans 💬 Messages reçus
//
// ⚠ v124 : chaque texto reçu est marqué `traite` + `resultat` sur sa propre
//   ligne dans `sms_recus`, pour que rien ne puisse plus disparaître en silence
//   (cas de la réponse « 1 » de Patrick Brodeur le 14 sept.).
//
// ✚ v150 : menu d'appel manqué (table `sms_menu_etat`, réglages
//   `telephonie_config`). Quand appel-entrant a envoyé le menu à ce numéro
//   (et qu'il n'est pas expiré) :
//     1 → lien de réservation en ligne
//     2 → « indiquez marque, modèle, année… » puis la réponse crée une
//         fiche « performance » à traiter dans 📞 Communications
//     3 → « quelle est votre question ? » puis fiche « question » à traiter
//     texte libre → fiche « question » (s'il parle de rendez-vous : le lien)
//   Une demande de rendez-vous avec créneaux envoyés garde la priorité sur
//   le menu quand le client répond un chiffre.
// ✚ v150.2 : la réponse du client règle TOUS ses appels manqués encore
//   ouverts, pas seulement celui qui a déclenché le menu.
// ✚ v172 : chaque RÉPONSE AUTOMATIQUE (question du menu, « bien reçu », lien,
//   confirmation, STOP, aide…) est aussi écrite dans 📞 Communications
//   (sms_out, meta.origine « auto ») : la conversation se voit au complet.
//   Avant, elle partait à Twilio sans laisser de trace dans le fil.
//   Et le bon créé à la confirmation reçoit les services cochés + la description.
//
//   ?diag → état des secrets, sans rien écrire
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const LIGNE_MACHINES = 1;
const LIGNE_CLIENTS = 3;
const LIGNE_PARAMS = 7;
const SHOP = "MTR Performance";
const TEL_SHOP = "819-489-0477";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function secret(...noms: string[]): string | undefined {
  for (const n of noms) { const v = Deno.env.get(n); if (v) return v; }
  return undefined;
}
const TW_SID   = secret("TWILIO_ACCOUNT_SID", "TWILIO_SID", "ACCOUNT_SID");
const TW_TOKEN = secret("TWILIO_AUTH_TOKEN", "TWILIO_TOKEN", "AUTH_TOKEN");
const TW_FROM  = secret("TWILIO_FROM", "TWILIO_PHONE", "TWILIO_PHONE_NUMBER", "TWILIO_NUMERO", "TWILIO_NUMBER", "TWILIO_FROM_NUMBER", "FROM_NUMBER");

const tel10 = (t?: string | null) => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const twiml = (msg?: string) => new Response(
  msg ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg.replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]!))}</Message></Response>`
      : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
  { headers: { "Content-Type": "text/xml" } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const RE_STOP = /^\s*(stop|arret|arr[eê]t(er|ez)?|d[eé]sabonn(er|ez|e)|unsubscribe|cancel|end|quit)\b/i;
const RE_AIDE = /^\s*(aide|help|info)\b/i;
const RE_RDV  = /rendez|reserv|r[eé]serv|booking|rdv/i;

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const enDec = (h: string) => { const [a,b] = String(h||"0:0").split(":").map(Number); return (a||0) + (b||0)/60; };

const MOIS = ["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
const JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
function dateLisible(iso: string, heure: string) {
  const d = new Date(String(iso).slice(0,10) + "T12:00:00Z");
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${String(heure||"").replace(":", "h")}`;
}

async function journal(demande_id: string | null, evenement: string, detail: unknown, par = "client") {
  try { await sb.from("demandes_journal").insert({ demande_id, evenement, detail, par }); } catch (_) {}
}
async function marquerSms(id: number | null, resultat: string, demande_id: string | null = null) {
  if (!id) return;
  try { await sb.from("sms_recus").update({ traite: true, resultat, demande_id }).eq("id", id); } catch (e) { console.log("marquerSms a échoué", e); }
}
// v172 : la réponse automatique est aussi notée dans 📞 Communications (fil du client), pour voir la conversation au complet.
// Rien n'est envoyé par cette ligne : c'est Twilio qui envoie la réponse (TwiML), ceci n'en garde que la trace.
async function noterReponse(de: string, msg: string, declencheur: string, smsId: number | null) {
  const t = tel10(de);
  if (!msg || !t) return;
  try {
    const { error } = await sb.from("communications").insert({ tel: t, tel_brut: de, canal: "sms_out", direction: "out", statut: "traite",
      contenu: msg, par: "automatique", meta: { origine: "auto", declencheur, en_reponse_a: smsId } });
    if (error) console.log("réponse automatique non notée :", error.message);
  } catch (e) { console.log("réponse automatique non notée", e); }
}

async function marquerStop(tel: string) {
  const t = tel10(tel); if (!t) return 0;
  const { data } = await sb.from("tableau").select("donnees").eq("id", LIGNE_CLIENTS).maybeSingle();
  const clients: any[] = Array.isArray(data?.donnees) ? data!.donnees : [];
  let n = 0;
  for (const c of clients) if (tel10(c?.tel) === t && !c.smsStop) { c.smsStop = new Date().toISOString(); c.smsStopSource = "sms"; n++; }
  if (n) await sb.from("tableau").upsert({ id: LIGNE_CLIENTS, donnees: clients });
  return n;
}

async function plageLibre(iso: string, heure: string, dureeMin: number, saufDemande: string) {
  const jour = String(iso).slice(0, 10);
  const [{ data: l1 }, { data: l7 }, { data: retenus }] = await Promise.all([
    sb.from("tableau").select("donnees").eq("id", LIGNE_MACHINES).maybeSingle(),
    sb.from("tableau").select("donnees").eq("id", LIGNE_PARAMS).maybeSingle(),
    sb.from("creneaux_actifs").select("demande_id,iso,heure,duree_min").eq("iso", jour),
  ]);
  const machines: any[] = Array.isArray(l1?.donnees) ? l1!.donnees : [];
  const tampon = (((l7?.donnees as any)?.rdv?.tampon) ?? 15) / 60;
  const t = enDec(heure), fin = t + dureeMin/60;
  const chevauche = (d: number, f: number) => !(fin + tampon <= d || t >= f + tampon);
  for (const m of machines) {
    if (!m || m.statut === "archive" || m.echeance !== jour || !m.heure) continue;
    const d = enDec(m.heure); if (chevauche(d, d + (m.dureeEstimee||60)/60)) return false;
  }
  for (const r of (retenus || [])) {
    if (r.demande_id === saufDemande) continue;
    const d = enDec(r.heure); if (chevauche(d, d + (r.duree_min||60)/60)) return false;
  }
  return true;
}

async function confirmer(dem: any, choix: number, smsId: number | null) {
  const { data: reserves } = await sb.from("creneaux_reserves")
    .select("*").eq("demande_id", dem.id).in("statut", ["reserve", "expire"]).order("no");
  const cr = (reserves || []).find(r => Number(r.no) === choix)
          || ((dem.creneaux || []) as any[]).find(c => Number(c.no) === choix);
  if (!cr) { console.log("confirmer: choix", choix, "introuvable dans les créneaux de", dem.id); await marquerSms(smsId, "aucune_correspondance", dem.id); return { msg: "" }; }

  const jour = String(cr.iso).slice(0, 10);
  const heure = cr.heure;
  const duree = Number(cr.duree_min || cr.duree) || dem.duree_min || 60;
  const expiree = cr.expire_le && new Date(cr.expire_le) < new Date();

  if (!(await plageLibre(jour, heure, duree, dem.id))) {
    await sb.from("creneaux_reserves").update({ statut: "libere", libere_le: new Date().toISOString(), motif: "plage prise entre-temps" })
      .eq("demande_id", dem.id).eq("statut", "reserve");
    await sb.from("demandes_service").update({
      statut: "conflit", lu: false, choix,
      note_interne: `Le client a choisi le ${dateLisible(jour, heure)}, mais la plage n'etait plus libre${expiree ? " (reservation expiree)" : ""}. A replacer.`,
    }).eq("id", dem.id);
    await journal(dem.id, "conflit", { choix, iso: jour, heure, reservation_expiree: !!expiree });
    await marquerSms(smsId, "conflit", dem.id);
    return { msg: sansAccent(`${SHOP} : merci! Cette plage vient tout juste d'etre prise. On vous revient tres vite avec d'autres disponibilites.`) };
  }

  const { data: l1 } = await sb.from("tableau").select("donnees").eq("id", LIGNE_MACHINES).maybeSingle();
  const machines: any[] = Array.isArray(l1?.donnees) ? l1!.donnees : [];
  const nomMachine = [dem.annee, dem.marque, dem.modele].filter(Boolean).join(" ").trim() || dem.type_machine || "Machine";
  // v172 : les travaux = les services cochés par le client + sa description (avant : la description seule → bon vide)
  let services: any = dem.services;
  if (typeof services === "string") { try { services = JSON.parse(services); } catch { services = String(services).split(/[,;]/); } }
  const travaux = [(Array.isArray(services) ? services : []).map((x: any) => String(x ?? "").trim()).filter(Boolean).join(" · "),
                   String(dem.description || "").trim()].filter(Boolean).join("\n");
  const bt = {
    id: genId(), creeLe: new Date().toISOString(),
    nom: nomMachine, client: dem.nom || "", tel: dem.tel || "", courriel: dem.courriel || "",
    type: dem.type_machine || "", marque: dem.marque || "", modele: dem.modele || "", annee: dem.annee || "", reference: dem.serie || "",
    travaux, statut: "avenir",
    echeance: jour, heure, dureeEstimee: duree,
    clientId: dem.client_id || "", origine: "demande-web", demandeId: dem.id,
  };
  machines.unshift(bt);
  const { error } = await sb.from("tableau").upsert({ id: LIGNE_MACHINES, donnees: machines });
  if (error) {
    await sb.from("demandes_service").update({ statut: "conflit", lu: false, note_interne: "Echec d'ecriture du bon de travail : " + error.message }).eq("id", dem.id);
    await journal(dem.id, "erreur", { etape: "ecriture bon de travail", message: error.message }, "systeme");
    await marquerSms(smsId, "erreur", dem.id);
    return { msg: sansAccent(`${SHOP} : un probleme technique nous empeche de confirmer. Appelez-nous au ${TEL_SHOP}.`) };
  }

  if (cr.id) await sb.from("creneaux_reserves").update({ statut: "choisi", motif: "choisi par le client" }).eq("id", cr.id);
  await sb.from("creneaux_reserves")
    .update({ statut: "libere", libere_le: new Date().toISOString(), motif: "non retenu par le client" })
    .eq("demande_id", dem.id).eq("statut", "reserve");

  await sb.from("demandes_service").update({ statut: "confirmee", choix, confirme_le: new Date().toISOString(), bt_id: bt.id, lu: false }).eq("id", dem.id);

  let gabarit = "";
  try {
    const { data } = await sb.from("rappels_config").select("gabarit").eq("type", "confirmation").eq("actif", true).limit(1).maybeSingle();
    gabarit = data?.gabarit || "";
  } catch (_) {}
  const vars: Record<string,string> = {
    prenom: (dem.nom || "").trim().split(/\s+/)[0] || "", client: dem.nom || "",
    date: dateLisible(jour, heure).replace(/\s\d{1,2}h\d{2}$/, ""), heure: String(heure).replace(":", " h "),
    machine: nomMachine, shop: SHOP,
  };
  const msg = gabarit ? gabarit.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "")
    : sansAccent(`${SHOP} : c'est confirme! Votre rendez-vous est le ${dateLisible(jour, heure)} pour votre ${nomMachine}. Au plaisir!`);

  await journal(dem.id, "confirmee", { choix, iso: jour, heure, duree_min: duree, bt_id: bt.id, machine: nomMachine, confirmation_sms: msg });
  await marquerSms(smsId, "confirme", dem.id);
  return { msg };
}

async function demandesOuvertes(de: string) {
  const t10 = tel10(de);
  const { data: demandes, error: errDem } = await sb.from("demandes_service").select("*").eq("statut", "creneaux_envoyes").eq("tel", de);
  let ouvertes = demandes || [];
  if (errDem) console.log("lecture demandes_service en erreur :", errDem.message);
  if (!ouvertes.length) {
    const { data: toutes } = await sb.from("demandes_service").select("*").eq("statut", "creneaux_envoyes");
    ouvertes = (toutes || []).filter(d => tel10(d.tel) === t10);
    if (ouvertes.length) console.log("trouvé par comparaison de format (10 chiffres), pas par égalité exacte");
  }
  return ouvertes;
}

// ── v150 : menu d'appel manqué ────────────────────────────────
async function configTel() {
  const { data } = await sb.from("telephonie_config").select("*").eq("id", 1).maybeSingle();
  return data || {};
}
async function classerDansLeFil(smsId: number | null, etat: any, raison: string, aTraiter: boolean) {
  const maj: Record<string, unknown> = { raison, statut: aTraiter ? "a_traiter" : "traite" };
  if (!aTraiter) maj.traite_le = new Date().toISOString();
  if (smsId) await sb.from("communications").update(maj).eq("source_table", "sms_recus").eq("source_id", String(smsId));
  // Tous les appels manqués encore ouverts de ce numéro sont réglés par sa réponse (pas seulement le dernier)
  const t = etat?.tel || null;
  if (t) await sb.from("communications").update({ raison, statut: "traite", traite_le: new Date().toISOString(), traite_par: "menu SMS" }).eq("tel", t).eq("canal", "appel_manque").eq("statut", "a_traiter");
}
async function traiterMenu(etat: any, texte: string, chiffre: number, smsId: number | null, t10: string): Promise<string> {
  const cfg = await configTel();
  const lien = cfg.lien_reservation || "https://www.mtrperformance.ca";
  const rep = (s: string, defaut: string) => sansAccent((s || defaut).replace(/\{lien\}/g, lien));
  const fin = async () => { await sb.from("sms_menu_etat").delete().eq("tel", t10); };
  const etape = async (e: string) => { await sb.from("sms_menu_etat").update({ etape: e, maj_le: new Date().toISOString() }).eq("tel", t10); };

  if (etat.etape === "menu") {
    if (chiffre === 1 || (!chiffre && RE_RDV.test(texte))) {
      await marquerSms(smsId, "menu_rdv"); await classerDansLeFil(smsId, etat, "rdv", false); await fin();
      return rep(cfg.sms_rep_1, `${SHOP} : reservez votre date directement ici : {lien}`);
    }
    if (chiffre === 2) {
      await marquerSms(smsId, "menu_2"); await classerDansLeFil(smsId, etat, "performance", false); await etape("perf_attente");
      return rep(cfg.sms_rep_2, `${SHOP} : pour bien vous conseiller, indiquez-nous la marque, le modele, l'annee et ce que vous recherchez. Un technicien vous rappelle d'ici la fin de la prochaine journee ouvrable.`);
    }
    if (chiffre === 3) {
      await marquerSms(smsId, "menu_3"); await classerDansLeFil(smsId, etat, "question", false); await etape("question_attente");
      return rep(cfg.sms_rep_3, `${SHOP} : quelle est votre question ?`);
    }
    if (chiffre) {
      await marquerSms(smsId, "menu_texte"); await classerDansLeFil(smsId, etat, "question", true); await fin();
      return rep(cfg.sms_merci, `${SHOP} : bien recu, merci! On vous revient d'ici la fin de la prochaine journee ouvrable.`);
    }
    await marquerSms(smsId, "menu_question"); await classerDansLeFil(smsId, etat, "question", true); await fin();
    return rep(cfg.sms_merci, `${SHOP} : bien recu, merci! On vous revient d'ici la fin de la prochaine journee ouvrable.`);
  }
  if (etat.etape === "perf_attente") {
    await marquerSms(smsId, "menu_performance"); await classerDansLeFil(smsId, etat, "performance", true); await fin();
    return rep(cfg.sms_merci, `${SHOP} : bien recu, merci! Un technicien vous rappelle d'ici la fin de la prochaine journee ouvrable.`);
  }
  await marquerSms(smsId, "menu_question"); await classerDansLeFil(smsId, etat, "question", true); await fin();
  return rep(cfg.sms_merci, `${SHOP} : bien recu, merci! On vous revient d'ici la fin de la prochaine journee ouvrable.`);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.has("diag")) return json({ twilio: { sid: !!TW_SID, token: !!TW_TOKEN, from: TW_FROM ?? null }, note: "Les plages viennent du tableau de bord; rien n'est choisi automatiquement. v172 : menu d'appel manqué actif, réponses automatiques notées dans Communications." });
  if (req.method !== "POST") return twiml();

  let de = "", corps = "", sid = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await req.json();
      de = j.From || j.de || ""; corps = j.Body || j.corps || ""; sid = j.MessageSid || j.message_sid || "";
    } else {
      const f = new URLSearchParams(await req.text());
      de = f.get("From") || ""; corps = f.get("Body") || ""; sid = f.get("MessageSid") || "";
    }
  } catch (e) { console.log("lecture du corps de la requête échouée", e); return twiml(); }
  if (!de) { console.log("aucun numéro expéditeur dans la requête"); return twiml(); }
  const texte = (corps || "").trim();
  console.log(`reçu de ${de} : "${texte}"`);

  let smsId: number | null = null;
  try {
    const { data } = await sb.from("sms_recus").insert({ de, corps: texte, message_sid: sid || null }).select("id").single();
    smsId = data?.id ?? null;
  } catch (e) { console.log("insertion sms_recus échouée", e); }
  // v172 : toute réponse envoyée au client est aussi notée dans son fil (📞 Communications)
  const repondre = async (msg: string | undefined, declencheur: string) => {
    if (msg) await noterReponse(de, msg, declencheur, smsId);
    return twiml(msg || undefined);
  };

  if (RE_STOP.test(texte)) {
    const n = await marquerStop(de);
    await journal(null, "reponse_client", { de, corps: texte, action: "desabonnement", fiches_marquees: n });
    await marquerSms(smsId, "stop");
    console.log("STOP traité,", n, "fiche(s) marquée(s)");
    return await repondre(n ? sansAccent(`${SHOP} : c'est note, vous ne recevrez plus de messages. Repondez START pour vous reabonner.`) : undefined, "stop");
  }
  if (RE_AIDE.test(texte)) { await marquerSms(smsId, "aide"); return await repondre(sansAccent(`${SHOP}, Trois-Rivieres. Pour nous joindre : ${TEL_SHOP}. Repondez STOP pour ne plus recevoir de textos.`), "aide"); }

  const t10 = tel10(de);
  const m = texte.match(/^\s*(?:le\s*)?([1-4])\s*[.)]?\s*$/i);
  const choix = m ? Number(m[1]) : 0;

  let etat: any = null;
  try {
    const { data } = await sb.from("sms_menu_etat").select("*").eq("tel", t10).maybeSingle();
    if (data && new Date(data.expire_le) > new Date()) etat = data;
    else if (data) await sb.from("sms_menu_etat").delete().eq("tel", t10);
  } catch (e) { console.log("lecture sms_menu_etat échouée", e); }

  let ouvertes: any[] = [];
  if (choix) ouvertes = await demandesOuvertes(de);

  if (etat && !(choix && ouvertes.length)) {
    console.log(`menu d'appel manqué (${etat.etape}) pour ${t10}, choix=${choix || "texte"}`);
    const msg = await traiterMenu(etat, texte, choix, smsId, t10);
    return await repondre(msg || undefined, "menu:" + etat.etape + (choix ? ":" + choix : ""));
  }

  if (!m) { console.log("pas un chiffre 1-4, laissé pour Messages reçus"); await marquerSms(smsId, "autre"); return twiml(); }

  console.log(`choix=${choix}, ${ouvertes.length} demande(s) ouverte(s) pour ${t10}`);
  if (!ouvertes.length) { await marquerSms(smsId, "aucune_correspondance"); return twiml(); }
  if (ouvertes.length > 1) {
    await journal(ouvertes[0].id, "reponse_client", { de, corps: texte, note: "plusieurs demandes ouvertes pour ce numero" });
    await marquerSms(smsId, "ambigu", ouvertes[0].id);
    return await repondre(sansAccent(`${SHOP} : vous avez plus d'une demande en cours. Appelez-nous au ${TEL_SHOP}, on va placer ca ensemble.`), "ambigu");
  }
  const dem = ouvertes[0];
  await journal(dem.id, "reponse_client", { de, corps: texte, choix });

  if (choix === 4) {
    await sb.from("creneaux_reserves")
      .update({ statut: "libere", libere_le: new Date().toISOString(), motif: "le client a demande d'autres plages" })
      .eq("demande_id", dem.id).eq("statut", "reserve");
    const vus = ((dem.creneaux || []) as any[]).map(c => dateLisible(c.iso, c.heure)).join(", ");
    await sb.from("demandes_service").update({
      statut: "autres_choix", lu: false,
      note_interne: `Le client a repondu 4 : il veut d'autres plages. Deja proposees : ${vus}`,
    }).eq("id", dem.id);
    await journal(dem.id, "autres_choix", { deja_proposees: vus });
    await marquerSms(smsId, "autres_choix", dem.id);
    return await repondre(sansAccent(`${SHOP} : pas de probleme, on vous revient rapidement avec d'autres disponibilites.`), "autres_choix");
  }

  const res = await confirmer(dem, choix, smsId);
  return await repondre(res.msg || undefined, "confirmation");
});
