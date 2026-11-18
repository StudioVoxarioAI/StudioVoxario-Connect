// Náhledy nového HUD vzhledu (ukázkový účet, Ashes nainstalovaná pro „Pokračovat“)
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const ud = fs.mkdtempSync(path.join(os.tmpdir(), "connect-hud-"));
const out = path.resolve("shots"); fs.mkdirSync(out, { recursive: true });
const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"], env: { ...process.env, CONNECT_DEMO: "1", CONNECT_USER_DATA: ud } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForTimeout(5000);
if (process.env.INSTALL === "1") {
  await win.evaluate((d) => window.connect.settings.set({ libraries: [d] }), path.join(ud, "Library"));
  await win.evaluate(() => window.connect.library.refresh());
  await win.evaluate(() => window.connect.installs.install("ashes-of-eryon", "install"));
  for (;;) { const s = await win.evaluate(() => window.connect.installs.get()); if (!s.jobs.length) break; await win.waitForTimeout(1000); }
  await win.evaluate(() => window.connect.installs.install("fantasy", "install"));
  await win.waitForTimeout(6000);
}
const go = async (h, n) => { await win.evaluate((x) => { window.location.hash = x; }, "#/account"); await win.waitForTimeout(150); await win.evaluate((x) => { window.location.hash = x; }, h); await win.waitForTimeout(1600); await win.screenshot({ path: path.join(out, n + ".png") }); };
await go("#/", "40-hud-domu");
await win.evaluate(() => document.querySelector("main").scrollTo(0, 700)); await win.waitForTimeout(500); await win.screenshot({ path: path.join(out, "41-hud-domu-2.png") });
await go("#/store", "42-hud-obchod");
await go("#/store/ashes-of-eryon", "43-hud-detail");
await go("#/library?select=ashes-of-eryon", "44-hud-knihovna");
await go("#/downloads", "45-hud-stahovani");
await go("#/settings", "46-hud-nastaveni");
if (process.env.INSTALL === "1") await win.evaluate(() => window.connect.installs.cancel("fantasy"));
await app.close();
fs.rmSync(ud, { recursive: true, force: true });
