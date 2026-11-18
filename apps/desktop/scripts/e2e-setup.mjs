// E2E vlastního instalátoru: zabalená aplikace v režimu instalace (CONNECT_SETUP=1) – obrazovka, instalace do
// zvolené složky, kontrola souborů (aplikace, app-update.yml pro aktualizace, installer.json), náhledy.
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const exe = path.resolve("release/linux-unpacked/StudioVoxarioConnect");
const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "connect-setup-")), "StudioVoxario Connect");
const out = path.resolve("shots"); fs.mkdirSync(out, { recursive: true });
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("OK:", m); };
const app = await _electron.launch({ executablePath: exe, args: ["--no-sandbox"], env: { ...process.env, CONNECT_SETUP: "1", CONNECT_SETUP_DIR: target } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1180, height: 700 });
await win.waitForTimeout(3500);
await win.screenshot({ path: path.join(out, "50-setup.png") });
ok((await win.getByRole("button", { name: /^Instalovat$/ }).count()) === 1, "obrazovka instalace s tlačítkem Instalovat");
await win.getByRole("button", { name: /^Instalovat$/ }).click();
await win.waitForTimeout(1200);
await win.screenshot({ path: path.join(out, "51-setup-prubeh.png") });
await win.getByRole("button", { name: /Spustit Connect/ }).waitFor({ timeout: 120000 });
await win.screenshot({ path: path.join(out, "52-setup-hotovo.png") });
ok(fs.existsSync(path.join(target, "StudioVoxarioConnect")), "aplikace zkopírovaná do cílové složky");
ok(fs.readFileSync(path.join(target, "resources", "app-update.yml"), "utf8").includes("StudioVoxario-Connect"), "app-update.yml pro automatické aktualizace");
ok(JSON.parse(fs.readFileSync(path.join(target, "installer.json"), "utf8")).custom === true, "installer.json (vlastní instalace)");
ok(fs.existsSync(path.join(target, "resources", "app.asar")), "app.asar");
await app.close();
fs.rmSync(path.dirname(target), { recursive: true, force: true });
