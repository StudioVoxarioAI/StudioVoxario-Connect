// Fáze 4: systémové funkce nastavení – knihovní složky, přesun instalace, plánovač a automatické aktualizace,
// spuštění se systémem, oznamovací oblast (tray), systémová oznámení, logy a diagnostika.
import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, Menu, Notification, Tray, nativeImage } from "electron";
import { inSchedule } from "@connect/installer-core";
import { dirSize, readState } from "@connect/installer-core/node";
import { currentCatalog } from "./catalog";
import { defaultLibraryDir, enqueue, installsRaw, isRunning, setInstallRecord, state as installsState } from "./installer";
import { settings, updateSettings } from "./settings";

// ------------------------------------------------------------------ log
const logFile = () => path.join(app.getPath("userData"), "logs", "connect.log");
export function log(line: string) {
  try {
    fs.mkdirSync(path.dirname(logFile()), { recursive: true });
    const f = logFile();
    if (fs.existsSync(f) && fs.statSync(f).size > 2_000_000) fs.renameSync(f, f + ".1");
    // nikdy tokeny ani klíče – jen události
    fs.appendFileSync(f, `${new Date().toISOString()} ${line.replace(/(token|key|code)=\S+/gi, "$1=***")}\n`);
  } catch { /* log je jen pomůcka */ }
}

export async function exportLogs(win: BrowserWindow | null): Promise<string | null> {
  const r = await dialog.showSaveDialog(win ?? undefined!, { defaultPath: `StudioVoxarioConnect-log-${new Date().toISOString().slice(0, 10)}.txt` });
  if (r.canceled || !r.filePath) return null;
  const head = [`StudioVoxario Connect ${app.getVersion()}`, `${process.platform} ${process.arch} · Electron ${process.versions.electron}`,
    `Knihovny: ${(settings().libraries.length ? settings().libraries : [defaultLibraryDir()]).join("; ")}`,
    `Instalace: ${Object.entries(installsRaw()).map(([k, v]) => `${k} ${v.version}`).join(", ") || "žádné"}`, ""].join("\n");
  let body = "";
  for (const f of [logFile() + ".1", logFile()]) { try { body += fs.readFileSync(f, "utf8"); } catch { /* nic */ } }
  fs.writeFileSync(r.filePath, head + body);
  return r.filePath;
}

// ------------------------------------------------------------------ knihovní složky
export interface LibraryFolder { path: string; free?: number; total?: number; isDefault: boolean; writable: boolean; installs: string[] }

export function libraryFolders(): LibraryFolder[] {
  const list = settings().libraries.length ? settings().libraries : [defaultLibraryDir()];
  const inst = installsRaw();
  return list.map((p, i) => {
    let free: number | undefined, total: number | undefined, writable = false;
    try {
      fs.mkdirSync(p, { recursive: true });
      const s = fs.statfsSync(p);
      free = s.bavail * s.bsize;
      total = s.blocks * s.bsize;
      const probe = path.join(p, `.probe-${process.pid}`);
      fs.writeFileSync(probe, "ok");
      fs.rmSync(probe, { force: true });
      writable = true;
    } catch { /* nedostupný disk */ }
    return { path: p, free, total, isDefault: i === 0, writable, installs: Object.entries(inst).filter(([, r]) => path.dirname(r.dir) === p).map(([k]) => k) };
  });
}

export async function addLibraryFolder(win: BrowserWindow | null): Promise<LibraryFolder[]> {
  const r = await dialog.showOpenDialog(win ?? undefined!, { properties: ["openDirectory", "createDirectory"], title: "Knihovní složka StudioVoxario Connect" });
  if (r.canceled || !r.filePaths[0]) return libraryFolders();
  const dir = path.join(r.filePaths[0], path.basename(r.filePaths[0]) === "StudioVoxarioLibrary" ? "" : "StudioVoxarioLibrary");
  fs.mkdirSync(dir, { recursive: true });
  const cur = settings().libraries.length ? settings().libraries : [defaultLibraryDir()];
  updateSettings({ libraries: [...cur, dir] });
  log(`Knihovna přidána: ${dir}`);
  return libraryFolders();
}

export function removeLibraryFolder(dir: string): LibraryFolder[] {
  const cur = settings().libraries.length ? settings().libraries : [defaultLibraryDir()];
  if (Object.values(installsRaw()).some((r) => path.dirname(r.dir) === dir)) throw new Error("Ve složce jsou nainstalované hry – nejdřív je přesuňte nebo odinstalujte.");
  updateSettings({ libraries: cur.filter((x) => x !== dir) });
  return libraryFolders();
}

export function setDefaultLibrary(dir: string): LibraryFolder[] {
  const cur = settings().libraries.length ? settings().libraries : [defaultLibraryDir()];
  updateSettings({ libraries: [dir, ...cur.filter((x) => x !== dir)] });
  return libraryFolders();
}

/** Přesun instalace do jiné knihovny: na stejném disku přejmenováním, jinak kopií s ověřením a smazáním. */
export async function moveInstall(id: string, toLibrary: string, onProgress: (done: number, total: number) => void): Promise<void> {
  const rec = installsRaw()[id];
  if (!rec) throw new Error("Hra není nainstalovaná.");
  if (isRunning(id)) throw new Error("Hra běží – nejdřív ji ukončete.");
  if (installsState().jobs.some((j) => j.productId === id)) throw new Error("Hra se právě stahuje.");
  const target = path.join(toLibrary, id);
  if (path.resolve(target) === path.resolve(rec.dir)) return;
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error("V cílové knihovně už složka hry existuje.");
  fs.mkdirSync(toLibrary, { recursive: true });
  const total = dirSize(rec.dir);
  const s = fs.statfsSync(toLibrary);
  try {
    fs.renameSync(rec.dir, target);   // stejný disk: okamžitě
    onProgress(total, total);
  } catch {
    if (s.bavail * s.bsize < total * 1.02) throw new Error("V cílové knihovně není dost místa.");
    let done = 0;
    const copy = async (from: string, to: string) => {
      fs.mkdirSync(to, { recursive: true });
      for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        const a = path.join(from, e.name), b = path.join(to, e.name);
        if (e.isDirectory()) await copy(a, b);
        else { await fs.promises.copyFile(a, b); done += fs.statSync(b).size; onProgress(done, total); }
      }
    };
    try {
      await copy(rec.dir, target);
      if (dirSize(target) !== total || !readState(target)) throw new Error("Kopie nesouhlasí.");
    } catch (e) {
      fs.rmSync(target, { recursive: true, force: true });
      throw e;
    }
    fs.rmSync(rec.dir, { recursive: true, force: true });
  }
  setInstallRecord(id, { ...rec, dir: target });
  log(`Přesun ${id}: ${rec.dir} -> ${target}`);
}

/** Ověřit všechny hry (oprava souborů) a vyčistit rozpracovaná stahování. */
export function verifyAll(): number {
  let n = 0;
  for (const id of Object.keys(installsRaw())) { try { enqueue(id, "repair"); n++; } catch { /* hra běží / nepatří */ } }
  return n;
}
export function clearDownloadCache(): number {
  let freed = 0;
  const busy = new Set(installsState().jobs.map((j) => j.productId));
  for (const [id, r] of Object.entries(installsRaw())) {
    if (busy.has(id)) continue;
    const st = path.join(r.dir, ".staging");
    if (fs.existsSync(st)) { freed += dirSize(st); fs.rmSync(st, { recursive: true, force: true }); }
  }
  return freed;
}

// ------------------------------------------------------------------ plánovač a automatické aktualizace
/** Je teď povolené stahovat? (plánovač: jen v okně od–do, i přes půlnoc) */
export function downloadAllowedNow(d = new Date()): boolean { return inSchedule(settings().schedule, d); }

/** Po obnovení katalogu: dostupné aktualizace nainstalovaných her zařadit (pokud je to povolené). */
export function autoUpdate() {
  const s = settings();
  const st = installsState();
  for (const [id, r] of Object.entries(st.installs)) {
    if (!r.updateAvailable || r.running || st.jobs.some((j) => j.productId === id)) continue;
    const name = currentCatalog()?.products.find((p) => p.id === id)?.name ?? id;
    if (s.notifications.update) notify("Aktualizace k dispozici", `${name} – nová verze je připravená.`);
    if (!s.autoUpdate) continue;
    if (s.autoUpdateOnlyIdle && Object.values(st.installs).some((x) => x.running)) continue;
    try { enqueue(id, "update"); log(`Automatická aktualizace: ${id}`); } catch { /* nevlastní / běží */ }
  }
}

// ------------------------------------------------------------------ systém
export function applyLoginItem() {
  if (process.platform === "linux") return;
  app.setLoginItemSettings({ openAtLogin: settings().launchOnStartup, args: ["--hidden"] });
}

export function notify(title: string, body: string) {
  try { if (Notification.isSupported()) new Notification({ title, body, silent: false }).show(); } catch { /* nic */ }
}

let tray: Tray | null = null;
export function setupTray(getWin: () => BrowserWindow | null, iconPath: string) {
  if (!settings().minimizeToTray) { tray?.destroy(); tray = null; return; }
  if (tray) return;
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
    tray.setToolTip("StudioVoxario Connect");
    const show = () => { const w = getWin(); if (w) { w.show(); w.focus(); } };
    tray.on("click", show);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Otevřít Connect", click: show },
      { label: "Knihovna", click: () => { show(); getWin()?.webContents.send("connect:navigate", "/library"); } },
      { label: "Stahování", click: () => { show(); getWin()?.webContents.send("connect:navigate", "/downloads"); } },
      { type: "separator" },
      { label: "Ukončit", click: () => app.quit() },
    ]));
  } catch { tray = null; }
}
export function hasTray() { return !!tray; }
