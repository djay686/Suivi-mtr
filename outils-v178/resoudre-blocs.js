// resoudre-blocs.js — résout le conflit de fusion attendu dans la zone « un bloc de style et un bloc de script par lot »
// à la fin d'index.html (chaque lot remplit son propre bloc ; deux lots voisins fusionnés à la suite créent un conflit git
// purement mécanique). Usage, pendant une fusion en conflit sur index.html, à la racine du dépôt :
//   node outils-v178/resoudre-blocs.js            → réécrit index.html (zone des blocs reconstruite), puis `git add index.html`
// Règle : pour chaque <style id="v178-LOT"> / <script id="v178-LOT">, on prend la version NON VIDE (la nôtre ou la leur) ;
// si les deux sont non vides et différentes, on s'arrête (ce n'est plus un conflit mécanique). Tout conflit hors de la zone
// des blocs fait aussi échouer le script : il faut le résoudre à la main.
const { execSync } = require("child_process");
const fs = require("fs");
const LOTS = ["COM", "PCS", "FAC", "TAB", "CALA", "CALB", "CAL9", "CAL6", "SON", "BTA"];
const COMMENTAIRE = "<!-- v178 : un bloc de style et un bloc de script par lot (CSS et JS neufs de chaque lot ; vides au socle) -->";
const lire = (stage) => execSync(`git show :${stage}:index.html`, { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
const notre = lire(2), leur = lire(3);
const debut = (t) => { const i = t.indexOf("<!-- v178 : un bloc"); if (i < 0) throw new Error("commentaire des blocs introuvable"); return i; };
const blocs = (t) => {
  const zone = t.slice(debut(t));
  const out = {};
  for (const lot of LOTS) for (const tag of ["style", "script"]) {
    const re = new RegExp(`<${tag} id="v178-${lot}">([\\s\\S]*?)</${tag}>`);
    const m = zone.match(re); if (!m) throw new Error(`bloc ${tag} ${lot} introuvable`);
    out[tag + ":" + lot] = m[1];
  }
  return out;
};
const bN = blocs(notre), bL = blocs(leur);
const choisis = {};
for (const k of Object.keys(bN)) {
  const n = bN[k].trim(), l = bL[k].trim();
  if (n && l && n !== l) throw new Error("les deux côtés ont rempli " + k + " différemment : résolution manuelle");
  choisis[k] = n ? bN[k] : bL[k];
}
// Tout ce qui précède la zone doit être identique ou fusionné sans conflit : on repart de la version de l'index de travail
let courant = fs.readFileSync("index.html", "utf8");
const marqueurs = courant.split("\n").map((l, i) => /^(<<<<<<< |=======$|>>>>>>> )/.test(l) ? i + 1 : 0).filter(Boolean);
const iZone = courant.split("\n").findIndex((l) => l.startsWith("<<<<<<< ") && courant.split("\n").slice(0, 0).length >= 0);
const avantZone = courant.slice(0, courant.indexOf("<<<<<<< "));
if (marqueurs.some((n) => n < avantZone.split("\n").length)) throw new Error("conflit hors de la zone des blocs : résolution manuelle");
if (!/<\/script>\s*$/.test(avantZone)) throw new Error("le conflit ne commence pas juste après le dernier </script> : résolution manuelle");
let region = COMMENTAIRE + "\n";
for (const lot of LOTS) region += `<style id="v178-${lot}">${choisis["style:" + lot]}</style>\n<script id="v178-${lot}">${choisis["script:" + lot]}</script>\n`;
const fin = "</body>\n</html>\n";
fs.writeFileSync("index.html", avantZone + region + fin);
const reste = fs.readFileSync("index.html", "utf8").split("\n").filter((l) => /^(<<<<<<< |=======$|>>>>>>> )/.test(l)).length;
if (reste) throw new Error("il reste des marqueurs de conflit");
console.log("zone des blocs reconstruite ; blocs remplis :", Object.keys(choisis).filter((k) => choisis[k].trim()).join(", "));
