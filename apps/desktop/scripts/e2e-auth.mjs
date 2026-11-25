// E2E: přihlášení vydrží restart. Napodobený Supabase rotuje obnovovací token a souběžné / opakované použití
// starého tokenu vyhodnotí jako zneužití (zruší celou relaci) – stejně jako skutečný server. Connect se spustí
// třikrát po sobě; pokaždé musí zůstat přihlášený a manifest hry v soukromém úložišti se musí načíst s tokenem.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const electron = require("electron");
const ud = fs.mkdtempSync(path.join(os.tmpdir(), "connect-auth-"));
let ok = true;
const check = (c, m) => { console.log(c ? "OK:" : "FAIL:", m); if (!c) ok = false; };

// ---- napodobený Supabase ----
let seq = 0;
const active = new Set(["rt0"]);      // platné obnovovací tokeny
const used = new Set();
let revoked = false, refreshes = 0, reuse = 0, manifestAuth = 0;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const u = new URL(req.url, "http://x");
    const json = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (u.pathname === "/auth/v1/token") {
      refreshes++;
      const rt = JSON.parse(body || "{}").refresh_token;
      if (revoked || used.has(rt)) { reuse++; revoked = true; active.clear(); return json(400, { error_description: "Invalid Refresh Token: Already Used" }); }
      if (!active.has(rt)) return json(400, { error_description: "Invalid Refresh Token" });
      active.delete(rt); used.add(rt);
      const next = `rt${++seq}`; active.add(next);
      return setTimeout(() => json(200, { access_token: `at${seq}`, refresh_token: next, expires_in: 3600, user: { id: "u1", email: "hrac@example.com" } }), 150);
    }
    if (u.pathname.startsWith("/storage/v1/object/authenticated/")) {
      if (!/^Bearer at\d+$/.test(req.headers.authorization ?? "")) return json(400, { error: "unauthorized" });
      manifestAuth++;
      return json(200, { version: "1.0.0", exe: "Game.exe", files: [] });
    }
    if (u.pathname.startsWith("/storage/v1/object/public/")) return json(400, { error: "not public" });
    if (u.pathname === "/catalog.json") {
      const cat = JSON.parse(fs.readFileSync(path.resolve("public/catalog.json"), "utf8"));
      const base = `http://127.0.0.1:${server.address().port}`;
      cat.api = { ...(cat.api ?? {}), supabaseUrl: base };
      for (const p of cat.products) if (p.build?.manifestUrl) p.build.manifestUrl = `${base}/storage/v1/object/public/game-updates/${p.id}.json`;
      return json(200, cat);
    }
    if (u.pathname.startsWith("/rest/v1/")) return json(200, u.pathname.includes("rpc/") ? false : []);
    if (u.pathname.startsWith("/functions/v1/")) return json(200, { allowed: false });
    json(404, {});
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// ---- uložené přihlášení z „minulého spuštění“ ----
execFileSync(electron, [path.resolve("scripts/auth-seed/main.cjs"), "--no-sandbox"],
  { env: { ...process.env, SEED_DIR: ud, SEED_RT: "rt0" }, stdio: "inherit" });

const env = { ...process.env, CONNECT_USER_DATA: ud, CONNECT_SUPABASE_URL: base, CONNECT_CATALOG_URL: `${base}/catalog.json`, CONNECT_NO_TRAY: "1", CONNECT_TEST_PLAIN_STORAGE: "1" };
for (let run = 1; run <= 3; run++) {
  const app = await _electron.launch({ executablePath: electron, args: [".", "--no-sandbox"], env });
  const win = await app.firstWindow();
  let st = null;
  for (let i = 0; i < 40; i++) {
    await win.waitForTimeout(500);
    st = await win.evaluate(() => window.connect.auth.status());
    if (st.signedIn && !st.pending) break;
  }
  await win.waitForTimeout(3000);   // katalog + knihovna + manifesty doběhnou
  st = await win.evaluate(() => window.connect.auth.status());
  check(st.signedIn && !st.error, `spuštění ${run}: přihlášený (${st.user?.email ?? "-"}) ${st.error ?? ""}`);
  await app.close();
}
check(reuse === 0 && !revoked, `server: ${refreshes} obnovení, žádné opakované použití tokenu (zneužití: ${reuse})`);
check(manifestAuth > 0, `manifesty her načtené s přihlášením (${manifestAuth}×)`);
server.close();
fs.rmSync(ud, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
