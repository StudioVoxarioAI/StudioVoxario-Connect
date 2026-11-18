// Fáze 7: převzetí her nainstalovaných stávajícím launcherem Ashes of Eryon (bez nového stahování).
// Starý launcher ukládá hru do <kořen>\Game{-fantasy|-beta} (kořen v registru StudioVoxario.AshesOfEryon ->
// InstallLocation) nebo do %LOCALAPPDATA%\StudioVoxario\AshesOfEryon{přípona}; v obou je install.json stejného
// formátu, jaký používá Connect. Převzetí jen zapíše záznam – soubory zůstávají, starý launcher funguje dál.
import type { Product } from "@connect/catalog-client";
import { expandEnv, parseRegQuery } from "@connect/installer-core";
import { readState } from "@connect/installer-core/node";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { BrowserWindow } from "electron";
import { dialog } from "electron";
import { currentCatalog } from "./catalog";
import { adopt, installsRaw } from "./installer";

const isWin = process.platform === "win32";

function regInstallLocation(key: string): Promise<string | null> {
  if (!isWin) return Promise.resolve(null);
  return new Promise((r) => execFile("reg", ["query", key, "/v", "InstallLocation"], { windowsHide: true, encoding: "utf8" },
    (err, out) => r(err ? null : parseRegQuery(out).InstallLocation || null)));
}

async function resolveLegacy(p: string): Promise<string | null> {
  let s = p;
  const m = /%REG:([^%]+)%/.exec(s);
  if (m) { const loc = await regInstallLocation(m[1]!); if (!loc) return null; s = s.replace(m[0], loc.replace(/[\\/]+$/, "")); }
  const e = expandEnv(s, process.env);
  if (!e) return null;
  return path.resolve(isWin ? e : e.replace(/\\/g, "/"));
}

const valid = (dir: string) => { const st = readState(dir); return !!st?.version && !!st.exe && fs.existsSync(path.join(dir, st.exe)); };

export interface LegacyFound { productId: string; dir: string; version: string }

/** Najde instalace starého launcheru u her, které Connect ještě nemá. */
export async function scanLegacy(): Promise<LegacyFound[]> {
  const out: LegacyFound[] = [];
  const have = installsRaw();
  for (const p of currentCatalog()?.products ?? []) {
    if (have[p.id] || p.build?.kind !== "voxario-manifest") continue;
    for (const lp of p.build.legacyPaths ?? []) {
      const dir = await resolveLegacy(lp);
      if (dir && valid(dir)) { out.push({ productId: p.id, dir, version: readState(dir)!.version }); break; }
    }
  }
  return out;
}

/** Převezme všechny nalezené instalace; vrací převzaté. Volá se po startu (jednou, dokud hra v Connectu není). */
export async function adoptLegacy(): Promise<LegacyFound[]> {
  const done: LegacyFound[] = [];
  for (const f of await scanLegacy()) if (adopt(f.productId, f.dir)) done.push(f);
  return done;
}

/** Ruční převzetí: uživatel vybere složku hry (s install.json). */
export async function adoptFolder(win: BrowserWindow | null, productId: string): Promise<{ ok: boolean; error?: string }> {
  const p: Product | undefined = currentCatalog()?.products.find((x) => x.id === productId);
  if (!p || p.build?.kind !== "voxario-manifest") return { ok: false, error: "Tuto položku nelze převzít." };
  const r = await dialog.showOpenDialog(win ?? undefined!, { properties: ["openDirectory"], title: `Složka hry ${p.name}` });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const dir = r.filePaths[0];
  if (!valid(dir)) return { ok: false, error: "Ve složce není hra nainstalovaná launcherem (chybí install.json nebo spustitelný soubor)." };
  return adopt(productId, dir) ? { ok: true } : { ok: false, error: "Instalaci se nepodařilo převzít." };
}
