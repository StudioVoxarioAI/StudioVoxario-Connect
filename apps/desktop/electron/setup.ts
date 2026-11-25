// Vlastní instalátor StudioVoxario Connect (celoobrazovkový úvod, žádný průvodce NSIS).
//
// Instalátorem je sám Connect: StudioVoxarioConnectSetup.exe je „portable“ build, který se při spuštění rozbalí
// (s brandovaným splashem) a místo aplikace ukáže obrazovku instalace (#/setup). Ta zkopíruje rozbalenou aplikaci do
// zvolené složky, zapíše registr (odinstalace, protokol studiovoxario://, umístění pro aktualizace), vytvoří zástupce
// a spustí nainstalovaný Connect. Odinstalace: „StudioVoxarioConnect.exe --uninstall“ (stejná obrazovka).
//
// Automatické aktualizace dál dělá electron-updater s technickým NSIS balíčkem (StudioVoxarioConnectUpdate-x.exe,
// tichý /S): ten si složku přečte z HKCU\Software\{GUID}\InstallLocation, kterou zapisuje i tento instalátor.
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { cleanupAside, copyFileRobust, moveAside } from "@connect/installer-core/node";

const isWin = process.platform === "win32";
const APP_ID = "com.studiovoxario.connect";
const GUID = "778d1f68-ceb2-5fbc-a185-c4db8a94129a";          // UUID v5 electron-builderu z appId (NSIS aktualizace)
const NAME = "StudioVoxario Connect";
const KEY_INSTALL = `HKCU\\Software\\${GUID}`;
const KEY_UNINSTALL = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\StudioVoxarioConnect";
const KEY_UNINSTALL_NSIS = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${GUID}`;
const KEY_PROTOCOL = "HKCU\\Software\\Classes\\studiovoxario";
const UPDATE_YML = "owner: StudioVoxarioAI\nrepo: StudioVoxario-Connect\nprovider: github\nupdaterCacheDirName: studiovoxario-connect-updater\n";

export const isSetupMode = () => !!process.env.PORTABLE_EXECUTABLE_FILE || process.env.CONNECT_SETUP === "1";
export const isUninstallMode = () => process.argv.includes("--uninstall");

const exeName = () => path.basename(process.execPath);
/** Rozbalená aplikace, kterou instalujeme (u portable = dočasná složka, ze které běží tento proces). */
const sourceDir = () => process.env.CONNECT_SETUP_SOURCE || path.dirname(process.execPath);
const defaultDir = () => process.env.CONNECT_SETUP_DIR
  || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Programs", NAME);

function reg(args: string[]): Promise<string | null> {
  if (!isWin) return Promise.resolve(null);
  return new Promise((r) => execFile("reg", args, { windowsHide: true, encoding: "utf8" }, (e, out) => r(e ? null : out)));
}
const regSet = (key: string, name: string | null, value: string, type = "REG_SZ") =>
  reg(["add", key, ...(name === null ? ["/ve"] : ["/v", name]), "/t", type, "/d", value, "/f"]);
async function regGet(key: string, name: string): Promise<string | null> {
  const out = await reg(["query", key, "/v", name]);
  const m = out && new RegExp(`\\s${name}\\s+REG_\\w+\\s+(.*)`).exec(out);
  return m ? m[1]!.trim() : null;
}

/** Electron se k .asar chová jako ke složce – při práci se soubory aplikace musí být vypnuté. */
function rawFs<T>(fn: () => T): T {
  const proc = process as unknown as { noAsar?: boolean };
  const prev = proc.noAsar;
  proc.noAsar = true;
  try { return fn(); } finally { proc.noAsar = prev; }
}
async function rawFsAsync<T>(fn: () => Promise<T>): Promise<T> {
  const proc = process as unknown as { noAsar?: boolean };
  const prev = proc.noAsar;
  proc.noAsar = true;
  try { return await fn(); } finally { proc.noAsar = prev; }
}

/**
 * Data Chromia / Electronu (profil prohlížeče), která nejsou součástí aplikace. Starší instalátory (do 0.6.2) si je
 * ukládaly přímo do složky rozbaleného balíku – nesmí se kopírovat do instalace (drží je otevřené běžící instalátor).
 */
const PROFILE_ENTRIES = new Set([
  "cookies", "cookies-journal", "network", "local storage", "session storage", "cache", "code cache", "gpucache",
  "dawncache", "dawngraphitecache", "dawnwebgpucache", "shared dictionary", "sharedstorage", "sharedstorage-wal",
  "preferences", "local state", "blob_storage", "crashpad", "indexeddb", "webstorage", "service worker", "trust tokens",
  "trust tokens-journal", "transportsecurity", "partitions", "logs", "lockfile", "databases", "file system",
  "shared proto db", "videodecodestats", "network persistent state", "quotamanager", "quotamanager-journal",
  "origin bound certs", "web data", "web data-journal", "history", "history-journal", "visited links",
  // data samotného Connectu (store.ts, auth.ts, catalog.ts, apps.ts)
  "settings.json", "downloads.json", "installs.json", "library.json", "account.bin", "catalog-cache.json", "setups",
]);
/** Patří položka nejvyšší úrovně rozbaleného balíku k aplikaci (ne k profilu / datům instalátoru)? */
function isAppEntry(root: string, full: string): boolean {
  if (path.dirname(full) !== root) return true;
  const name = path.basename(full).toLowerCase();
  if (PROFILE_ENTRIES.has(name)) return false;
  const userData = path.resolve(app.getPath("userData")).toLowerCase();
  return path.resolve(full).toLowerCase() !== userData;
}

function dirSize(dir: string, appOnly = false): number { return rawFs(() => dirSizeRaw(dir, appOnly)); }
function dirSizeRaw(dir: string, appOnly = false): number {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (appOnly && !isAppEntry(dir, p)) continue;
      if (e.isDirectory()) stack.push(p); else { try { total += fs.statSync(p).size; } catch { /* nic */ } }
    }
  }
  return total;
}
function freeBytes(target: string): number | null {
  let p = path.resolve(target);
  while (!fs.existsSync(p) && path.dirname(p) !== p) p = path.dirname(p);
  try { const s = fs.statfsSync(p); return s.bavail * s.bsize; } catch { return null; }
}
function assertSafe(dir: string) {
  const r = path.resolve(dir), root = path.parse(r).root;
  if (r === root || r === path.resolve(os.homedir()) || r.length < root.length + 6) throw new Error("Tuto složku nelze pro instalaci použít.");
  if (r.toLowerCase().startsWith(path.resolve(sourceDir()).toLowerCase())) throw new Error("Instalátor nemůže instalovat sám do sebe.");
}

async function installedDir(): Promise<string | null> {
  const fromReg = await regGet(KEY_INSTALL, "InstallLocation");
  for (const d of [fromReg, defaultDir()]) if (d && fs.existsSync(path.join(d, exeName()))) return d;
  return null;
}

export interface SetupInfo { mode: "install" | "uninstall"; version: string; defaultDir: string; installedDir: string | null; installedVersion: string | null; requiredBytes: number; freeBytes: number | null; platform: string }

async function info(): Promise<SetupInfo> {
  const inst = await installedDir();
  let installedVersion: string | null = await regGet(KEY_UNINSTALL, "DisplayVersion");
  if (!installedVersion && inst) { try { installedVersion = JSON.parse(fs.readFileSync(path.join(inst, "installer.json"), "utf8")).version; } catch { /* nic */ } }
  return {
    mode: isUninstallMode() ? "uninstall" : "install", version: app.getVersion(), defaultDir: inst ?? defaultDir(),
    installedDir: inst, installedVersion, requiredBytes: dirSize(sourceDir(), true), freeBytes: freeBytes(inst ?? defaultDir()), platform: process.platform,
  };
}

/** Ukončí běžící Connect z cílové složky (ne tento instalátor – ten běží z dočasné složky) a počká, až skončí. */
async function stopRunning(dir: string) {
  if (!isWin) return;
  const q = (v: string) => v.toLowerCase().replace(/'/g, "''");
  const self = q(sourceDir());
  // procesy z cílové složky + běžící Connect odjinud (lišta, starší instalace), kromě tohoto instalátoru
  const filter = `Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${process.pid} -and $_.Path -and `
    + `-not $_.Path.ToLower().StartsWith('${self}') -and ($_.Path.ToLower().StartsWith('${q(dir)}') -or $_.ProcessName -eq '${q(path.parse(exeName()).name)}') }`;
  const ps = `${filter} | Stop-Process -Force; for ($i = 0; $i -lt 40; $i++) { if (-not (${filter})) { break }; Start-Sleep -Milliseconds 250 }`;
  await new Promise((r) => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true, timeout: 20000 }, () => r(null)));
  await new Promise((r) => setTimeout(r, 500));   // systém ještě uvolní soubory ukončených procesů
}

async function copyTree(from: string, to: string, total: number, onBytes: (done: number) => void) {
  let done = 0;
  const walk = async (a: string, b: string) => {
    await fs.promises.mkdir(b, { recursive: true });
    for (const e of await fs.promises.readdir(a, { withFileTypes: true })) {
      const x = path.join(a, e.name), y = path.join(b, e.name);
      if (!isAppEntry(from, x)) continue;                 // profil prohlížeče / data instalátoru
      if (e.isDirectory() && !e.name.endsWith(".asar")) await walk(x, y);
      else if (e.isFile()) {
        await copyFileRobust(x, y);
        done += (await fs.promises.stat(y)).size;
        onBytes(done);
      }
    }
  };
  await rawFsAsync(() => walk(from, to));
  if (done < total * 0.99) throw new Error("Kopie aplikace není úplná.");
}

async function shortcutPaths() {
  const desktop = app.getPath("desktop");
  const startDir = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs", "StudioVoxario");
  return { desktop: path.join(desktop, `${NAME}.lnk`), startDir, start: path.join(startDir, `${NAME}.lnk`) };
}

export interface InstallOptions { dir: string; desktopShortcut: boolean; startMenu: boolean; autostart: boolean }

async function install(o: InstallOptions, send: (p: { phase: string; pct: number; line?: string }) => void) {
  const dir = path.resolve(o.dir || defaultDir());
  assertSafe(dir);
  const src = sourceDir();
  if (!fs.existsSync(path.join(src, exeName()))) throw new Error("Instalační balík je poškozený (chybí aplikace).");
  const total = dirSize(src, true);
  const free = freeBytes(dir);
  if (free !== null && free < total * 1.1) throw new Error("Na disku není dost místa.");
  send({ phase: "prepare", pct: 0.02, line: `Cíl: ${dir}` });
  await stopRunning(dir);
  // čistá instalace: stará verze aplikace pryč (data uživatele jsou jinde – %APPDATA%)
  if (fs.existsSync(dir)) {
    // co nejde smazat (drží to antivirus / dobíhající proces), se odsune stranou a smaže později
    rawFs(() => {
      for (const e of fs.readdirSync(dir)) {
        const p = path.join(dir, e);
        try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { moveAside(p); }
      }
    });
  }
  send({ phase: "copy", pct: 0.05, line: "Kopíruji jádro platformy…" });
  let last = 0;
  await copyTree(src, dir, total, (d) => {
    const pct = 0.05 + 0.82 * (d / Math.max(total, 1));
    if (pct - last > 0.004) { last = pct; send({ phase: "copy", pct }); }
  });
  const exe = path.join(dir, exeName());
  const res = path.join(dir, "resources");
  if (fs.existsSync(res) && !fs.existsSync(path.join(res, "app-update.yml"))) fs.writeFileSync(path.join(res, "app-update.yml"), UPDATE_YML);
  rawFs(() => cleanupAside(dir));
  fs.writeFileSync(path.join(dir, "installer.json"), JSON.stringify({ version: app.getVersion(), installedAt: new Date().toISOString(), custom: true }, null, 2));

  send({ phase: "register", pct: 0.9, line: "Zapisuji do systému…" });
  if (isWin) {
    await regSet(KEY_INSTALL, "InstallLocation", dir);
    await regSet(KEY_UNINSTALL, "DisplayName", NAME);
    await regSet(KEY_UNINSTALL, "DisplayVersion", app.getVersion());
    await regSet(KEY_UNINSTALL, "Publisher", "StudioVoxario");
    await regSet(KEY_UNINSTALL, "DisplayIcon", `${exe},0`);
    await regSet(KEY_UNINSTALL, "InstallLocation", dir);
    await regSet(KEY_UNINSTALL, "UninstallString", `"${exe}" --uninstall`);
    await regSet(KEY_UNINSTALL, "QuietUninstallString", `"${exe}" --uninstall --quiet`);
    await regSet(KEY_UNINSTALL, "EstimatedSize", String(Math.ceil(total / 1024)), "REG_DWORD");
    await regSet(KEY_UNINSTALL, "NoModify", "1", "REG_DWORD");
    await regSet(KEY_UNINSTALL, "NoRepair", "1", "REG_DWORD");
    await regSet(KEY_UNINSTALL, "URLInfoAbout", "https://studiovoxario.com/desktop");
    await regSet(KEY_PROTOCOL, null, "URL:StudioVoxario Connect");
    await regSet(KEY_PROTOCOL, "URL Protocol", "");
    await regSet(`${KEY_PROTOCOL}\\DefaultIcon`, null, `"${exe}",0`);
    await regSet(`${KEY_PROTOCOL}\\shell\\open\\command`, null, `"${exe}" "%1"`);
    send({ phase: "shortcuts", pct: 0.95, line: "Vytvářím zástupce…" });
    const sc = await shortcutPaths();
    const opts = { target: exe, cwd: dir, description: NAME, icon: exe, iconIndex: 0, appUserModelId: APP_ID };
    try {
      if (o.desktopShortcut) shell.writeShortcutLink(sc.desktop, "create", opts);
      if (o.startMenu) { fs.mkdirSync(sc.startDir, { recursive: true }); shell.writeShortcutLink(sc.start, "create", opts); }
    } catch { send({ phase: "shortcuts", pct: 0.96, line: "Zástupce se nepodařilo vytvořit (instalace pokračuje)." }); }
    app.setLoginItemSettings({ openAtLogin: o.autostart, path: exe, args: ["--hidden"] });
  }
  send({ phase: "done", pct: 1, line: "Hotovo." });
  return { ok: true, dir, exe };
}

async function uninstall(keepData: boolean, realUserData: string) {
  const dir = path.dirname(process.execPath);
  assertSafe(dir);
  if (isWin) {
    const sc = await shortcutPaths();
    for (const f of [sc.desktop, sc.start]) fs.rmSync(f, { force: true });
    try { if (!fs.readdirSync(sc.startDir).length) fs.rmdirSync(sc.startDir); } catch { /* nic */ }
    app.setLoginItemSettings({ openAtLogin: false, path: process.execPath, args: ["--hidden"] });
    for (const k of [KEY_UNINSTALL, KEY_UNINSTALL_NSIS, KEY_INSTALL, KEY_PROTOCOL]) await reg(["delete", k, "/f"]);
    // složku aplikace smaže až samostatný proces po ukončení (běžící .exe nejde smazat)
    const targets = [dir, ...(keepData ? [] : [realUserData])].map((d) => `"${d}"`).join(" ");
    spawn("cmd.exe", ["/c", `ping -n 3 127.0.0.1 >nul & for %d in (${targets}) do rmdir /s /q %d`], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
  return { ok: true };
}

/** Normální běh nainstalované aplikace: udržet záznam v „Aplikacích“ Windows (verze po aktualizaci, bez duplicity NSIS). */
export async function maintainInstall() {
  if (!isWin || !app.isPackaged) return;
  const dir = path.dirname(process.execPath);
  rawFs(() => cleanupAside(dir));                                   // zbytky odsunuté instalátorem / aktualizací
  if (!fs.existsSync(path.join(dir, "installer.json"))) return;   // instalace přes NSIS – nechat NSIS
  await regSet(KEY_UNINSTALL, "DisplayVersion", app.getVersion());
  await regSet(KEY_INSTALL, "InstallLocation", dir);
  await reg(["delete", KEY_UNINSTALL_NSIS, "/f"]);                 // aktualizace přes NSIS přidá vlastní záznam – stačí náš
}

/** Okno instalátoru / odinstalátoru. */
export function runSetup(realUserData: string) {
  // NSIS aktualizace volá starý odinstalátor tiše – nic nemazat, jen úspěšně skončit (soubory přepíše nová verze)
  if (isUninstallMode() && (process.argv.includes("/S") || process.argv.includes("--updated"))) { app.exit(0); return; }
  let win: BrowserWindow | null = null;
  app.whenReady().then(() => {
    win = new BrowserWindow({
      width: 1180, height: 700, minWidth: 980, minHeight: 600, frame: false, resizable: true, backgroundColor: "#03060b", show: false,
      title: isUninstallMode() ? `Odinstalovat ${NAME}` : `Instalace ${NAME}`,
      icon: path.join(__dirname, "../dist/icon.png"),
      webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    win.once("ready-to-show", () => win?.show());
    win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) void shell.openExternal(url); return { action: "deny" }; });
    win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file://")) e.preventDefault(); });
    void win.loadFile(path.join(__dirname, "../dist/index.html"), { hash: "/setup" });
    const send = (p: unknown) => win?.webContents.send("connect:setup-progress", p);
    ipcMain.handle("connect:setup-info", () => info());
    ipcMain.handle("connect:setup-pick", async (_e, current: string) => {
      const r = await dialog.showOpenDialog(win!, { title: "Složka instalace StudioVoxario Connect", defaultPath: current, properties: ["openDirectory", "createDirectory"] });
      if (r.canceled || !r.filePaths[0]) return null;
      const p = r.filePaths[0];
      return path.basename(p) === NAME ? p : path.join(p, NAME);
    });
    ipcMain.handle("connect:setup-free", (_e, dir: string) => freeBytes(String(dir)));
    ipcMain.handle("connect:setup-install", async (_e, o: InstallOptions) => {
      try { return await install(o, send); } catch (e) { return { ok: false, error: (e as Error).message }; }
    });
    ipcMain.handle("connect:setup-launch", (_e, dir: string) => {
      const exe = path.join(String(dir), exeName());
      if (fs.existsSync(exe)) spawn(exe, [], { detached: true, stdio: "ignore", cwd: String(dir) }).unref();
      setTimeout(() => app.quit(), 400);
    });
    ipcMain.handle("connect:setup-uninstall", async (_e, keepData: boolean) => {
      try { return await uninstall(!!keepData, realUserData); } catch (e) { return { ok: false, error: (e as Error).message }; }
    });
    ipcMain.on("connect:window", (_e, a: "minimize" | "maximize" | "close") => {
      if (a === "minimize") win?.minimize(); else if (a === "maximize") { if (win?.isMaximized()) win.unmaximize(); else win?.maximize(); } else app.quit();
    });
    ipcMain.handle("connect:app-info", () => ({ version: app.getVersion(), platform: process.platform, locale: app.getLocale() }));
    ipcMain.handle("connect:open-external", (_e, url: string) => (/^https:\/\//.test(url) ? shell.openExternal(url) : undefined));
  });
  app.on("window-all-closed", () => app.quit());
}
