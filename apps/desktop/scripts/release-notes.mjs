// Poznámky k vydání z src/changelog.json: Markdown pro GitHub Release + strukturovaná data pro web
// (komentář <!-- connect-changelog {...} -->, čte ho stránka Novinky a Verze na webu).
// Použití: node scripts/release-notes.mjs <verze> [soubor]   – bez záznamu pro verzi skončí chybou (vydání se zastaví).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const log = JSON.parse(fs.readFileSync(path.join(here, "../src/changelog.json"), "utf8"));
const version = (process.argv[2] ?? "").replace(/^v/, "");
const e = log.find((x) => x.version === version);
if (!e) { console.error(`V src/changelog.json chybí poznámky pro verzi ${version} – doplňte je před vydáním.`); process.exit(1); }
const label = { feature: "Novinka", improvement: "Vylepšení", fix: "Oprava", security: "Bezpečnost" };
const md = [
  `## ${e.title}`, "",
  ...e.changes.map((c) => `- **${label[c.type] ?? c.type}:** ${c.text}`), "",
  "**Stažení:** `StudioVoxarioConnectSetup.exe` níže (Windows 10/11). Nainstalované Connecty se aktualizují samy.", "",
  `<!-- connect-changelog ${JSON.stringify(e)} -->`, "",
].join("\n");
if (process.argv[3]) fs.writeFileSync(process.argv[3], md); else process.stdout.write(md);
