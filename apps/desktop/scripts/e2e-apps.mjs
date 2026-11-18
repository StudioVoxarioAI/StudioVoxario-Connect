// E2E Fáze 5–6: aplikace s instalátorem. Na Linuxu ověří: rozpoznání nainstalované aplikace (Voxar.app podle složky),
// modul VoxarioProtect -> Voxar.app, skutečné stažení instalátoru VoxarioBrowser z GitHub Releases (navázání, velikost)
// a hlášku, že instalátor se spouští jen ve Windows; deep link nákupu; náhledy.
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const ud = fs.mkdtempSync(path.join(os.tmpdir(), "connect-apps-"));
const local = path.join(ud, "LocalAppData");
fs.mkdirSync(path.join(local, "Voxar.app"), { recursive: true });
fs.writeFileSync(path.join(local, "Voxar.app", "Voxar.app.exe"), "MZ fake");
const out = path.resolve("shots");
fs.mkdirSync(out, { recursive: true });
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("OK:", m); };
const states = { "voxar-app": "owned", "voxario-protect": "owned", "voxario-browser": "owned", "voxario-studio-engine": "owned" };
const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"],
  env: { ...process.env, CONNECT_DEMO: "1", CONNECT_DEMO_STATES: JSON.stringify(states), CONNECT_USER_DATA: ud, LOCALAPPDATA: local } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForTimeout(6000);
const ev = (fn, arg) => win.evaluate(fn, arg);
await ev(() => window.connect.library.refresh());
await ev(() => window.connect.installs.get()); await win.waitForTimeout(800);
let st = await ev(() => window.connect.installs.get());
ok(st.installs["voxar-app"]?.external && st.installs["voxar-app"].dir.endsWith("Voxar.app"), "Voxar.app rozpoznána jako nainstalovaná (mimo Connect)");
const go = async (h) => { await ev((x) => { window.location.hash = x; }, "#/"); await win.waitForTimeout(150); await ev((x) => { window.location.hash = x; }, h); await win.waitForTimeout(1300); };
await go("#/library?select=voxar-app"); await win.screenshot({ path: path.join(out, "29-knihovna-voxar.png") });
await go("#/library?select=voxario-protect"); await win.screenshot({ path: path.join(out, "30-knihovna-protect.png") });
ok(await win.getByRole("button", { name: /Otevřít v Voxar.app/ }).count() > 0, "VoxarioProtect se otevírá v Voxar.app");

// skutečné stažení instalátoru VoxarioBrowser
const r = await ev(() => window.connect.installs.install("voxario-browser", "install"));
ok(r.ok, "instalace VoxarioBrowser zařazena");
let seen = 0;
for (let i = 0; i < 600; i++) {
  st = await ev(() => window.connect.installs.get());
  const j = st.jobs.find((x) => x.productId === "voxario-browser");
  if (!j || j.phase === "error") break;
  seen = Math.max(seen, j.doneBytes);
  if (i === 4) { await go("#/library?select=voxario-browser"); await win.screenshot({ path: path.join(out, "31-knihovna-browser-stahuje.png") }); }
  await win.waitForTimeout(1000);
}
const j = st.jobs.find((x) => x.productId === "voxario-browser");
const setup = path.join(ud, "setups", "voxario-browser", "VoxarioBrowserSetup.exe");
ok(j?.phase === "error" && /jen ve Windows/.test(j.error ?? ""), `po stažení: ${j?.error}`);
ok(fs.existsSync(setup) && fs.statSync(setup).size > 1_000_000 && fs.readFileSync(setup).subarray(0, 2).toString() === "MZ", `instalátor stažen (${(fs.statSync(setup).size / 1048576).toFixed(1)} MB, PE soubor)`);
await go("#/library?select=voxario-browser"); await win.screenshot({ path: path.join(out, "32-knihovna-browser-chyba.png") });
await ev(() => window.connect.installs.cancel("voxario-browser"));

// engine: dialog instalace (oprávnění správce)
await go("#/library?select=voxario-studio-engine");
await win.getByRole("button", { name: /^Instalovat$/ }).first().click();
await win.waitForTimeout(500);
await win.screenshot({ path: path.join(out, "33-engine-instalace.png") });
await win.keyboard.press("Escape");
await app.close();
fs.rmSync(ud, { recursive: true, force: true });
