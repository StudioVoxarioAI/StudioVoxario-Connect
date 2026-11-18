// E2E: skutečný Electron v ukázkovém režimu nainstaluje skutečný build ze serveru, ověří soubory,
// zkusí aktualizaci (nic ke stažení) a odinstaluje. Data v dočasné složce.
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const product = process.env.E2E_PRODUCT ?? "ashes-of-eryon";
const ud = fs.mkdtempSync(path.join(os.tmpdir(), "connect-e2e-"));
const lib = path.join(ud, "Library");
const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"],
  env: { ...process.env, CONNECT_DEMO: "1", CONNECT_USER_DATA: ud } });
const win = await app.firstWindow();
await win.waitForTimeout(5000);
await win.evaluate((d) => window.connect.settings.set({ libraries: [d] }), lib);
await win.evaluate(() => window.connect.library.refresh());
const t0 = Date.now();
const r = await win.evaluate((id) => window.connect.installs.install(id, "install"), product);
console.log("zařazeno:", r.ok, r.ok ? "" : r.error);
let last = "";
for (;;) {
  const s = await win.evaluate(() => window.connect.installs.get());
  const j = s.jobs.find((x) => x.productId === product);
  if (!j) { console.log("hotovo:", JSON.stringify(s.installs[product])); break; }
  const line = `${j.phase} ${(j.doneBytes / 1048576).toFixed(1)}/${(j.totalBytes / 1048576).toFixed(1)} MB ${(s.speed / 1048576).toFixed(1)} MB/s`;
  if (line !== last) { last = line; if (Math.random() < 0.15 || j.phase !== "downloading") console.log(line); }
  if (j.phase === "error") { console.log("CHYBA:", j.error); break; }
  if (Date.now() - t0 > 600_000) { console.log("timeout"); break; }
  await win.waitForTimeout(1000);
}
console.log("čas", ((Date.now() - t0) / 1000).toFixed(0), "s");
const dir = path.join(lib, product);
const st = JSON.parse(fs.readFileSync(path.join(dir, "install.json"), "utf8"));
console.log("install.json:", st.version, st.exe, st.files.length, "souborů, verified", st.verified);
console.log("staging zbyl:", fs.existsSync(path.join(dir, ".staging")));
// ověření souborů (repair) – nic se nemá stahovat
const r2 = await win.evaluate((id) => window.connect.installs.install(id, "repair"), product);
for (;;) { const s = await win.evaluate(() => window.connect.installs.get()); if (!s.jobs.length) break; await win.waitForTimeout(500); }
console.log("ověření ok:", r2.ok);
const u = await win.evaluate((id) => window.connect.installs.uninstall(id, false), product);
console.log("odinstalace:", u.ok, "složka existuje:", fs.existsSync(dir));
await app.close();
fs.rmSync(ud, { recursive: true, force: true });
