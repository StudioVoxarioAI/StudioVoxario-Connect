// E2E: stahování přežije restart – aplikace se zavře uprostřed stahování, po spuštění je úloha pozastavená
// a po obnovení naváže (už stažená data se nestahují znovu).
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require("playwright");
const product = "ashes-of-eryon";
const ud = fs.mkdtempSync(path.join(os.tmpdir(), "connect-e2e-"));
const lib = path.join(ud, "Library");
const start = async () => {
  const app = await _electron.launch({ executablePath: require("electron"), args: [".", "--no-sandbox"], env: { ...process.env, CONNECT_DEMO: "1", CONNECT_USER_DATA: ud } });
  const win = await app.firstWindow();
  await win.waitForTimeout(4000);
  return { app, win };
};
let { app, win } = await start();
await win.evaluate((d) => window.connect.settings.set({ libraries: [d] }), lib);
await win.evaluate(() => window.connect.library.refresh());
await win.evaluate((id) => window.connect.installs.install(id, "install"), product);
for (;;) {
  const s = await win.evaluate(() => window.connect.installs.get());
  const j = s.jobs[0];
  if (j && j.doneBytes > 30 * 1048576) { console.log("před zavřením:", (j.doneBytes / 1048576).toFixed(1), "MB"); break; }
  await win.waitForTimeout(500);
}
await app.close();   // „pád“ / zavření uprostřed stahování
({ app, win } = await start());
let s = await win.evaluate(() => window.connect.installs.get());
console.log("po restartu:", s.jobs.map((j) => `${j.productId} ${j.phase}`).join(", "));
await win.evaluate(() => window.connect.library.refresh());
await win.evaluate((id) => window.connect.installs.resume(id), product);
let first = -1;
for (;;) {
  s = await win.evaluate(() => window.connect.installs.get());
  const j = s.jobs[0];
  if (j && j.phase === "downloading" && first < 0 && j.doneBytes > 0) { first = j.doneBytes; console.log("navázáno od:", (first / 1048576).toFixed(1), "MB"); }
  if (!j) break;
  if (j.phase === "error") { console.log("CHYBA", j.error); break; }
  await win.waitForTimeout(500);
}
console.log("hotovo:", s.installs[product]?.version);
await app.close();
fs.rmSync(ud, { recursive: true, force: true });
