// E2E Fáze 7: převzetí instalace starého launcheru. 1) Connect nainstaluje Ashes (skutečný build), 2) složku přesuneme
// tam, kam ji ukládá starý launcher (%LOCALAPPDATA%\StudioVoxario\AshesOfEryon), 3) čistý Connect (nový profil)
// ji po startu sám převezme – bez stahování – a ověření souborů nic nestáhne.
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "connect-mig-"));
const local = path.join(root, "LocalAppData");
const out = path.resolve("shots");
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("OK:", m); };
const start = async (ud) => {
  const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"], env: { ...process.env, CONNECT_DEMO: "1", CONNECT_USER_DATA: ud, LOCALAPPDATA: local } });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  await win.waitForTimeout(6000);
  return { app, win, ev: (fn, a) => win.evaluate(fn, a) };
};
// 1) instalace
let { app, win, ev } = await start(path.join(root, "ud1"));
await ev((d) => window.connect.settings.set({ libraries: [d] }), path.join(root, "lib"));
await ev(() => window.connect.library.refresh());
await ev(() => window.connect.installs.install("ashes-of-eryon", "install"));
let st;
for (;;) { st = await ev(() => window.connect.installs.get()); if (!st.jobs.length || st.jobs[0].phase === "error") break; await win.waitForTimeout(1000); }
ok(!!st.installs["ashes-of-eryon"], "instalace pro test hotová");
await app.close();
// 2) „starý launcher“
const legacy = path.join(local, "StudioVoxario", "AshesOfEryon");
fs.mkdirSync(path.dirname(legacy), { recursive: true });
fs.renameSync(path.join(root, "lib", "ashes-of-eryon"), legacy);
// 3) čistý Connect
({ app, win, ev } = await start(path.join(root, "ud2")));
await ev(() => window.connect.library.refresh());
st = await ev(() => window.connect.installs.get());
ok(st.installs["ashes-of-eryon"]?.dir === legacy, `převzato po startu: ${st.installs["ashes-of-eryon"]?.dir}`);
await ev((x) => { window.location.hash = x; }, "#/library?select=ashes-of-eryon");
await win.waitForTimeout(800);
await win.screenshot({ path: path.join(out, "34-prevzeti.png") });
await ev(() => window.connect.installs.install("ashes-of-eryon", "repair"));
let fetched = 0;
for (;;) { st = await ev(() => window.connect.installs.get()); if (!st.jobs.length) break; fetched = Math.max(fetched, st.jobs[0].doneBytes); await win.waitForTimeout(800); }
ok(fetched === 0, "ověření převzaté instalace nic nestáhlo");
await ev((x) => { window.location.hash = x; }, "#/settings?s=general");
await win.waitForTimeout(900);
await win.screenshot({ path: path.join(out, "35-nastaveni-aktualizace.png") });
await app.close();
fs.rmSync(root, { recursive: true, force: true });
