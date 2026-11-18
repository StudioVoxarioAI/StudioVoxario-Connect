// Náhledy Fáze 3: skutečná instalace Ashes of Eryon, rozběhnuté stahování Fantasy, knihovna, Stahování, Domů
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const ud = fs.mkdtempSync(path.join(os.tmpdir(), "connect-shots-"));
const out = path.resolve("shots");
fs.mkdirSync(out, { recursive: true });
const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"], env: { ...process.env, CONNECT_DEMO: "1", CONNECT_USER_DATA: ud } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForTimeout(5000);
await win.evaluate((d) => window.connect.settings.set({ libraries: [d] }), path.join(ud, "Library"));
await win.evaluate(() => window.connect.library.refresh());
await win.evaluate(() => window.connect.installs.install("ashes-of-eryon", "install"));
for (;;) { const s = await win.evaluate(() => window.connect.installs.get()); if (!s.jobs.length) break; await win.waitForTimeout(1000); }
await win.evaluate(() => window.connect.installs.install("fantasy", "install"));
await win.waitForTimeout(9000);
const go = async (h) => { await win.evaluate((x) => { window.location.hash = x; }, h); await win.waitForTimeout(1200); };
await go("#/library?select=ashes-of-eryon"); await win.screenshot({ path: path.join(out, "17-knihovna-hrat.png") });
await go("#/library?select=fantasy"); await win.screenshot({ path: path.join(out, "18-knihovna-stahuje.png") });
await go("#/downloads"); await win.screenshot({ path: path.join(out, "19-stahovani.png") });
await go("#/"); await win.screenshot({ path: path.join(out, "20-domu-pokracovat.png") });
await go("#/library?select=ashes-of-eryon");
await win.getByRole("button", { name: /Spravovat/ }).click();
await win.waitForTimeout(400);
await win.screenshot({ path: path.join(out, "21-spravovat.png") });
await win.evaluate(() => window.connect.installs.cancel("fantasy"));
await app.close();
fs.rmSync(ud, { recursive: true, force: true });
console.log("ok");
