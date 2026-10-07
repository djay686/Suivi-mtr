// test-v178.js — agrégateur de la v178 : lance tous les test-v178-<lot>.js (et les tests du socle) à la suite et additionne.
//   NODE_PATH=…/jsdom/node_modules node test-v178.js ./index.html            (jsdom, comme les autres test-v1xx.js)
//   RUNNER="node outils-v178/run-in-chromium.js" node test-v178.js ./index.html   (Chromium / Playwright, sans jsdom)
// Chaque fichier accepte argv[2] = chemin d'index.html (tv.html et procedure.html sont pris à côté).
// Sort avec le nombre de fichiers en échec. Les tests serveur (edge/) ne sont pas lancés ici : voir outils-v178/README.md.
const { spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");
const INDEX = process.argv[2] || "./index.html";
const RUNNER = (process.env.RUNNER || "node").split(" ");
const ici = __dirname;
const FICHIERS = fs.readdirSync(ici).filter((f) => /^test-v178-[a-z0-9-]+\.js$/.test(f) && f !== "test-v178-srv.js").sort();   // srv : test Node pur, lancé à part (node test-v178-srv.js)
let ok = 0, ko = 0, echecs = 0;
console.log(`v178 — ${FICHIERS.length} fichiers (${RUNNER.join(" ")}) contre ${INDEX}`);
for (const f of FICHIERS) {
  const t0 = Date.now();
  const r = spawnSync(RUNNER[0], [...RUNNER.slice(1), path.join(ici, f), INDEX], { encoding: "utf8", cwd: ici, maxBuffer: 64 * 1024 * 1024 });
  const sortie = (r.stdout || "") + (r.stderr || "");
  const nOk = (sortie.match(/^✅/gm) || []).length, nKo = (sortie.match(/^❌/gm) || []).length;
  const bon = r.status === 0 && nKo === 0 && nOk > 0;
  ok += nOk; ko += nKo; if (!bon) echecs++;
  console.log(`${bon ? "✅" : "❌"} ${f.padEnd(26)} ${String(nOk).padStart(4)}/${String(nOk + nKo).padEnd(4)} ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!bon) sortie.split("\n").filter((l) => /^❌|Error|error/.test(l)).slice(0, 6).forEach((l) => console.log("      " + l.slice(0, 160)));
}
console.log(`\n${ok} ✅ / ${ko} ❌ sur ${FICHIERS.length} fichiers, ${echecs} en échec`);
process.exitCode = echecs ? 1 : 0;
