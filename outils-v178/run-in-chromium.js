// Lance un test-vNNN.js (écrit pour jsdom) dans Chromium via Playwright, SANS jsdom :
//   - require("jsdom") -> petit JSDOM maison = <iframe> même origine (beforeParse via addInitScript)
//   - require("fs").readFileSync -> fichiers du dépôt préchargés
// usage : node run-in-chromium.js <test.js> [index.html]   (cwd = racine du dépôt)
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs"), path = require("path");
const [, , testFile, indexArg = "./index.html"] = process.argv;
const ORIGIN = "https://atelier.mtrperformance.ca";
const src = fs.readFileSync(testFile, "utf8");
const files = {};
const D = path.dirname(indexArg);   // le dossier de index.html (tv.html, procedure.html en sont voisins : le test les dérive de argv[2])
for (const f of fs.readdirSync(D)) { const p = path.join(D, f); if (fs.statSync(p).isFile() && /\.(html|js|txt|json|md)$/.test(f) && fs.statSync(p).size < 5e6) files[p] = fs.readFileSync(p, "utf8"); }

const libs = {};
for (const f of fs.readdirSync(path.dirname(path.resolve(testFile)))) if (/\.js$/.test(f)) libs[f] = fs.readFileSync(path.join(path.dirname(path.resolve(testFile)), f), "utf8");
(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block", timezoneId: process.env.MTR_TZ || "America/Toronto", locale: "fr-CA" });
  // MTR_FAKE_NOW="2026-10-10T10:00:00-04:00" : décale l'horloge (elle continue d'avancer) pour essayer un autre jour de la semaine
  if (process.env.MTR_FAKE_NOW) {
    const off = new Date(process.env.MTR_FAKE_NOW).getTime() - Date.now();
    await ctx.addInitScript((off) => { const D = Date; function F(...a) { if (!(this instanceof F)) return new D(D.now() + off).toString(); if (a.length === 0) return new D(D.now() + off); return new D(...a); }
      F.prototype = D.prototype; F.now = () => D.now() + off; F.UTC = D.UTC; F.parse = D.parse; Object.setPrototypeOf(F, D); window.Date = F; }, off);
  }
  const page = await ctx.newPage();
  let pending = [];
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== ORIGIN) return route.abort();
    if (u.pathname === "/__runner") return route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" });
    if (route.request().resourceType() === "document" && route.request().frame().parentFrame()) {
      const html = await page.evaluate(() => window.__pending.shift());
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    }
    const f = path.join(D, u.pathname.slice(1));
    if (files[f] !== undefined) return route.fulfill({ contentType: "text/plain", body: files[f] });
    return route.fulfill({ status: 404, body: "" });
  });
  await ctx.addInitScript(() => {
    try { if (window.parent !== window && window.parent.__beforeParse) window.parent.__beforeParse(window); } catch (e) {}
  });
  let code = null; let resolveDone; const done = new Promise(r => resolveDone = r);
  await page.exposeFunction("__done", (c) => { code = c; resolveDone(); });
  let nOk = 0, nKo = 0;
  page.on("console", (m) => { const t = m.text(); if (t.startsWith("✅")) nOk++; else if (t.startsWith("❌")) nKo++; console.log(t); });
  page.on("pageerror", (e) => console.log("PAGEERROR " + e.message));
  await page.goto(ORIGIN + "/__runner");
  await page.evaluate(({ src, files, libs, argv }) => {
    window.__pending = []; window.__frames = [];
    window.__beforeParse = (win) => { const i = window.__frames.find(x => x.frame.contentWindow === win); if (i && i.opts.beforeParse) i.opts.beforeParse(win); };
    class JSDOM {
      constructor(html, opts = {}) {
        this.opts = opts;
        const f = document.createElement("iframe"); this.frame = f;
        f.style.cssText = "position:fixed;left:0;top:0;width:1280px;height:800px;border:0;background:#fff";
        document.body.appendChild(f);
        window.__frames.push(this);
        window.__pending.push(html);
        f.src = opts.url || "about:blank";
        this.window = f.contentWindow;
        // expose le window final dès qu'il existe (contentWindow change à la navigation)
        const self = this; Object.defineProperty(this, "window", { get() { return f.contentWindow; } });
      }
      serialize() { return this.frame.contentDocument.documentElement.outerHTML; }
    }
    window.__t0 = Date.now();
    const process = { argv: ["node", "test", argv], set exitCode(c) { window.__exitCode = c; }, get exitCode() { return window.__exitCode; },
      exit(c) { window.__done(c !== undefined ? c : (window.__exitCode || 0)); }, stdout: { write: (s) => console.log(String(s)) } };
    const fs = { readFileSync(p) { const b = String(p).replace(/^\.\//, "").replace(/\/\.\//g, "/"); if (b in files) return files[b]; throw new Error("ENOENT " + p); } };
    const cache = {};
    const require = (n) => { if (n === "jsdom") return { JSDOM }; if (n === "fs") return fs;
      const b = String(n).replace(/^\.\//, ""); if (b in libs) { if (!cache[b]) { const m = { exports: {} }; cache[b] = m; new Function("require", "module", "exports", "process", libs[b])(require, m, m.exports, process); } return cache[b].exports; }
      throw new Error("require " + n); };
    window.addEventListener("unhandledrejection", (e) => { console.log("❌ promesse rejetée non gérée : " + (e.reason && e.reason.stack || e.reason)); window.__exitCode = 1; });
    try { new Function("require", "process", src)(require, process); } catch (e) { console.log("❌ exception au chargement : " + e.stack); window.__done(1); }
  }, { src, files, libs, argv: indexArg });
  const timeout = new Promise(r => setTimeout(() => r("timeout"), 170000));
  const r = await Promise.race([done.then(() => "done"), timeout]);
  const exit = await page.evaluate(() => window.__exitCode || 0).catch(() => "?");
  console.log("##RESULT " + JSON.stringify({ test: testFile, ok: nOk, ko: nKo, total: nOk + nKo, exitCode: exit, status: r, secondes: ((Date.now() - t0) / 1000).toFixed(1) }));
  await browser.close(); process.exit(0);
})().catch(e => { console.log("RUNNER ERR " + e.stack); process.exit(2); });
