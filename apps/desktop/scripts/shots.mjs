// Náhledy aplikace: spustí skutečný Electron (sestavený renderer) a vyfotí stránky -> shots/*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const out = path.resolve("shots");
fs.mkdirSync(out, { recursive: true });
const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"], env: { ...process.env } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForLoadState("domcontentloaded");
await win.waitForTimeout(800);
const pages = [["01-domu", "#/"], ["02-obchod", "#/store"], ["03-knihovna", "#/library"], ["04-stahovani", "#/downloads"],
  ["05-nastaveni", "#/settings"], ["06-ucet", "#/account"]];
for (const [name, hash] of pages) {
  await win.evaluate((h) => { window.location.hash = h; }, hash);
  await win.waitForTimeout(500);
  await win.screenshot({ path: path.join(out, `${name}.png`) });
}
await win.evaluate(() => { window.location.hash = "#/"; });
await win.keyboard.press("Control+k");
await win.waitForTimeout(300);
await win.screenshot({ path: path.join(out, "07-hledani.png") });
await app.close();
console.log("náhledy:", fs.readdirSync(out).join(", "));
