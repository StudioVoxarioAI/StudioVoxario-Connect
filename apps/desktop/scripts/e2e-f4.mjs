// E2E Fáze 4 (přijetí): instalace do zvolené knihovny na jiném disku, přesun instalace mezi disky,
// omezení rychlosti, plánovač; náhledy obrazovek Nastavení.
// Druhý „disk“ = /dev/shm (jiný souborový systém -> přesun kopií s ověřením, ne přejmenováním).
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const ud = fs.mkdtempSync(path.join(os.tmpdir(), "connect-f4-"));
const libA = path.join(ud, "LibA");
const libB = fs.mkdtempSync("/dev/shm/connect-f4-") + "/StudioVoxarioLibrary";
const out = path.resolve("shots");
fs.mkdirSync(out, { recursive: true });
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("OK:", m); };

const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"], env: { ...process.env, CONNECT_DEMO: "1", CONNECT_USER_DATA: ud } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForTimeout(5000);
const ev = (fn, arg) => win.evaluate(fn, arg);
await ev((l) => window.connect.settings.set({ libraries: l }), [libA, libB]);
await ev(() => window.connect.library.refresh());

// 1) plánovač: okno mimo aktuální čas -> fronta čeká
const now = new Date(); const hh = (h) => String((h + 24) % 24).padStart(2, "0") + ":00";
await ev((s) => window.connect.settings.set({ schedule: s }), { enabled: true, from: hh(now.getHours() + 2), to: hh(now.getHours() + 3) });
await ev((d) => window.connect.installs.install("ashes-of-eryon", "install", d), libB);
await win.waitForTimeout(1500);
let st = await ev(() => window.connect.installs.get());
ok(st.scheduleWaiting && st.jobs[0]?.phase === "queued" && st.jobs[0]?.doneBytes === 0, "plánovač: stahování čeká mimo okno");

// 2) omezení rychlosti 2 MB/s, plánovač vypnout -> stahování běží omezeně
await ev(() => window.connect.settings.set({ speedLimitKBps: 2048, schedule: { enabled: false, from: "01:00", to: "07:00" } }));
await ev(() => window.connect.installs.resume("ashes-of-eryon"));
await win.waitForTimeout(9000);
st = await ev(() => window.connect.installs.get());
const avg = st.history.slice(-5).reduce((a, b) => a + b, 0) / 5;
ok(avg > 0 && avg < 2.6 * 1024 * 1024, `omezení rychlosti: průměr ${(avg / 1048576).toFixed(2)} MB/s (limit 2 MB/s)`);
await ev(() => window.connect.settings.set({ speedLimitKBps: 0 }));
await win.waitForTimeout(1500);
await ev((h) => { window.location.hash = h; }, "#/settings?s=downloads");
await win.waitForTimeout(1200);
await win.screenshot({ path: path.join(out, "22-nastaveni-stahovani.png") });
for (let i = 0; ; i++) {
  st = await ev(() => window.connect.installs.get());
  if (i % 10 === 0) console.log("  stav:", JSON.stringify(st.jobs.map((j) => [j.phase, j.doneBytes, j.totalBytes, j.error])), "speed", Math.round(st.speed));
  if (!st.jobs.length) break; if (st.jobs[0].phase === "error") { console.error(st.jobs[0].error); break; } await win.waitForTimeout(1000);
}
const rec = st.installs["ashes-of-eryon"];
ok(rec && rec.dir.startsWith(libB), `instalace do zvolené knihovny: ${rec?.dir}`);

// 3) přesun na jiný disk (kopie + ověření + smazání původní)
await ev((h) => { window.location.hash = h; }, "#/library"); await win.waitForTimeout(300);
await ev((h) => { window.location.hash = h; }, "#/settings?s=downloads"); await win.waitForTimeout(1200);
await win.screenshot({ path: path.join(out, "23-nastaveni-knihovny.png") });
const r = await ev((d) => window.connect.system.relocate("ashes-of-eryon", d), libA);
st = await ev(() => window.connect.installs.get());
const moved = st.installs["ashes-of-eryon"];
ok(r.ok && moved.dir === path.join(libA, "ashes-of-eryon") && !fs.existsSync(path.join(libB, "ashes-of-eryon")) && fs.existsSync(path.join(moved.dir, "install.json")), `přesun mezi disky -> ${moved?.dir}`);
// 4) ověření po přesunu: nic se nestahuje
await ev(() => window.connect.installs.install("ashes-of-eryon", "repair"));
let fetched = 0;
for (;;) { st = await ev(() => window.connect.installs.get()); if (!st.jobs.length) break; fetched = Math.max(fetched, st.jobs[0].doneBytes); await win.waitForTimeout(800); }
ok(fetched === 0, "ověření po přesunu: žádný soubor znovu nestažen");
const libs = await ev(() => window.connect.system.libraries());
ok(libs.find((l) => l.path === libA)?.installs.includes("ashes-of-eryon"), "knihovna A eviduje hru");

await ev((h) => { window.location.hash = h; }, "#/library"); await win.waitForTimeout(300);
await ev((h) => { window.location.hash = h; }, "#/settings?s=downloads"); await win.waitForTimeout(1200);
await win.screenshot({ path: path.join(out, "24-nastaveni-po-presunu.png") });
for (const [s, n] of [["general", "25-nastaveni-obecne"], ["notifications", "26-nastaveni-oznameni"], ["diagnostics", "27-nastaveni-diagnostika"]]) {
  await ev((h) => { window.location.hash = h; }, "#/library"); await win.waitForTimeout(200);
  await ev((h) => { window.location.hash = h; }, `#/settings?s=${s}`); await win.waitForTimeout(900);
  await win.screenshot({ path: path.join(out, `${n}.png`) });
}
// deep link z webu (nákup dokončen) -> knihovna s vybranou položkou
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send("connect:deep-link", "studiovoxario://purchase-complete?product=voxario-studio-engine"));
await win.waitForTimeout(1500);
ok((await win.evaluate(() => location.hash)).includes("/library?select=voxario-studio-engine"), "deep link nákupu otevře knihovnu");
await win.screenshot({ path: path.join(out, "28-deeplink-nakup.png") });

await ev(() => window.connect.installs.uninstall("ashes-of-eryon", false));
await app.close();
fs.rmSync(ud, { recursive: true, force: true });
fs.rmSync(path.dirname(libB), { recursive: true, force: true });
