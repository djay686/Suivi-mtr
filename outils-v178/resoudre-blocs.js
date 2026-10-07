// resoudre-blocs.js — reconstruit la zone « un bloc de style et un bloc de script par lot » à la fin d'index.html.
// Chaque lot remplit son propre bloc ; deux lots voisins fusionnés à la suite créent un conflit git purement mécanique
// (et une fusion mal résolue peut dupliquer la zone). Usage, à la racine du dépôt, pendant une fusion en conflit sur
// index.html OU après coup :
//   node outils-v178/resoudre-blocs.js            → réécrit index.html (zone des blocs reconstruite), puis `git add index.html`
// Règle : pour chaque <style id="v178-LOT"> / <script id="v178-LOT">, on prend la version NON VIDE parmi toutes celles
// trouvées (index de travail, côté « nous » et côté « eux » de la fusion en cours) ; deux versions non vides différentes
// → arrêt (ce n'est plus un conflit mécanique). Un marqueur de conflit AVANT la zone fait aussi échouer le script.
const { execSync } = require("child_process");
const fs = require("fs");
const LOTS = ["COM", "PCS", "FAC", "TAB", "CALA", "CALB", "CAL9", "CAL6", "SON", "BTA"];
const COMMENTAIRE = "<!-- v178 : un bloc de style et un bloc de script par lot (CSS et JS neufs de chaque lot ; vides au socle) -->";
const DEBUT = "<!-- v178 : un bloc";
const sources = [fs.readFileSync("index.html", "utf8")];
for (const stage of [2, 3]) { try { sources.push(execSync(`git show :${stage}:index.html`, { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8")); } catch (_) {} }
const courant = sources[0];
const iDebut = courant.indexOf(DEBUT);
if (iDebut < 0) throw new Error("commentaire des blocs introuvable");
const avant = courant.slice(0, iDebut);
if (/^(<<<<<<< |=======$|>>>>>>> )/m.test(avant)) throw new Error("conflit AVANT la zone des blocs : résolution manuelle");
if (!/<\/script>\s*$/.test(avant)) throw new Error("la zone des blocs ne suit pas le dernier </script> : résolution manuelle");
const choisis = {};
for (const lot of LOTS) for (const tag of ["style", "script"]) {
  const re = new RegExp(`<${tag} id="v178-${lot}">([\\s\\S]*?)</${tag}>`, "g");
  const versions = new Set();
  for (const src of sources) { const zone = src.slice(src.indexOf(DEBUT)); let m; while ((m = re.exec(zone))) if (m[1].trim()) versions.add(m[1]); }
  if (versions.size > 1) throw new Error(`plusieurs versions non vides de <${tag} id="v178-${lot}"> : résolution manuelle`);
  choisis[tag + ":" + lot] = versions.size ? [...versions][0] : "";
}
let region = COMMENTAIRE + "\n";
for (const lot of LOTS) region += `<style id="v178-${lot}">${choisis["style:" + lot]}</style>\n<script id="v178-${lot}">${choisis["script:" + lot]}</script>\n`;
fs.writeFileSync("index.html", avant + region + "</body>\n</html>\n");
const verif = fs.readFileSync("index.html", "utf8");
if (/^(<<<<<<< |=======$|>>>>>>> )/m.test(verif)) throw new Error("il reste des marqueurs de conflit");
for (const lot of LOTS) for (const tag of ["style", "script"]) { const n = (verif.match(new RegExp(`<${tag} id="v178-${lot}">`, "g")) || []).length; if (n !== 1) throw new Error(`<${tag} id="v178-${lot}"> apparaît ${n} fois`); }
console.log("zone des blocs reconstruite ; blocs remplis :", Object.keys(choisis).filter((k) => choisis[k].trim()).join(", "));
