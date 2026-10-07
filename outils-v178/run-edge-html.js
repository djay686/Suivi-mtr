// Lance edge/test-sms-entrant-v172.html dans Chromium (Playwright) ; typescript.min.js (cdnjs, bloqué ici) -> typescript.js local.
// usage : node run-edge-html.js [chemin/vers/sms-entrant/index.ts]   (cwd = racine du dépôt)
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs"), path = require("path");
const ORIGIN = "https://atelier.mtrperformance.ca";
const srcArg = process.argv[2];
(async () => {
  const t0 = Date.now();
  const b = await chromium.launch(); const ctx = await b.newContext(); const page = await ctx.newPage();
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (/cdnjs\.cloudflare\.com\/ajax\/libs\/typescript/.test(u.href)) return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync("/opt/node22/lib/node_modules/typescript/lib/typescript.js", "utf8") });
    if (u.origin !== ORIGIN) return route.abort();
    const f = path.join("edge", u.pathname.slice(1));
    if (u.pathname === "/src.ts" && srcArg) return route.fulfill({ contentType: "text/plain", body: fs.readFileSync(srcArg, "utf8") });
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ contentType: f.endsWith(".html") ? "text/html" : "text/plain", body: fs.readFileSync(f) });
    return route.fulfill({ status: 404, body: "" });
  });
  page.on("pageerror", (e) => console.log("PAGEERROR " + e.message));
  await page.goto(ORIGIN + "/test-sms-entrant-v172.html" + (srcArg ? "?src=/src.ts" : ""));
  await page.waitForFunction(() => window.__fini === true, null, { timeout: 60000 }).catch(() => console.log("TIMEOUT"));
  const lignes = await page.evaluate(() => window.__sortie);
  const nOk = lignes.filter(l => l.startsWith("✅")).length, nKo = lignes.filter(l => l.startsWith("❌")).length;
  lignes.forEach(l => console.log(l));
  console.log("##RESULT " + JSON.stringify({ test: "edge/test-sms-entrant-v172.html", ok: nOk, ko: nKo, secondes: ((Date.now() - t0) / 1000).toFixed(1) }));
  await b.close(); process.exit(0);
})();
