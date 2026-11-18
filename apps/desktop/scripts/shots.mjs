// Náhledy aplikace: spustí skutečný Electron (sestavený renderer) a vyfotí stránky -> shots/*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const out = path.resolve("shots");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"], env: { ...process.env } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForLoadState("domcontentloaded");
await win.waitForTimeout(Number(process.env.SHOTS_WAIT ?? 6000));   // katalog + živé ceny a verze
const go = async (hash, wait = 900) => { await win.evaluate((h) => { window.location.hash = h; }, hash); await win.waitForTimeout(wait); };
const shot = (name) => win.screenshot({ path: path.join(out, `${name}.png`) });
const pages = (process.env.SHOTS ?? "01-domu=#/;02-obchod=#/store;03-obchod-software=#/store?tab=software;04-detail-fantasy=#/store/fantasy;05-detail-voxar=#/store/voxar-app;06-detail-engine=#/store/voxario-studio-engine;07-knihovna=#/library;08-stahovani=#/downloads;09-nastaveni=#/settings;10-ucet=#/account")
  .split(";").map((s) => s.split("="));
for (const [name, hash] of pages) { await go(hash); await shot(name); }
await go("#/");
await win.keyboard.press("Control+k");
await win.waitForTimeout(300);
await win.keyboard.type("broswer", { delay: 30 });
await win.waitForTimeout(400);
await shot("11-hledani");
await app.close();
console.log("náhledy:", fs.readdirSync(out).join(", "));
