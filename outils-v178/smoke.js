// Garde « démarre sans erreur » : charge index.html dans Chromium, Supabase remplacé par un stub en mémoire
const { chromium } = require(require("fs").existsSync("/opt/node22/lib/node_modules/playwright") ? "/opt/node22/lib/node_modules/playwright" : "playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const f = path.resolve(process.argv[2] || "index.html");
  const b = await chromium.launch();
  const p = await b.newPage();
  const err = [];
  p.on("pageerror", e => err.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error") err.push("console.error: " + m.text().slice(0, 160)); });
  await p.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file:")) return r.continue();
    if (/supabase\.min\.js/.test(u)) return r.fulfill({ contentType: "text/javascript", body:
      "window.supabase={createClient:()=>{const q=()=>{const o={select:()=>o,eq:()=>o,in:()=>o,order:()=>o,limit:()=>o,maybeSingle:()=>o,single:()=>o,upsert:()=>o,update:()=>o,insert:()=>o,delete:()=>o,then:(ok)=>ok({data:[],error:null})};return o};return{from:q,channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){},auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:null,error:null})}}}};" });
    return r.abort();
  });
  await p.goto("file://" + f);
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => ({ v: typeof APP_VERSION !== "undefined" ? APP_VERSION : null, sections: typeof SECTIONS !== "undefined" ? SECTIONS.length : null, colonnes: !!document.getElementById("colonnes") }));
  console.log(JSON.stringify(info), "erreurs:", err.length); err.slice(0, 8).forEach(e => console.log(" -", e));
  await b.close(); process.exit(err.length ? 1 : 0);
})();
