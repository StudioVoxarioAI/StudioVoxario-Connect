// Aktualizace samotného Connectu (electron-updater, GitHub Releases repozitáře StudioVoxario-Connect).
//
// Chování (0.3.2): kontrola při startu, každých 15 minut a při návratu do okna (nejvýš 1× za 5 min); nová verze se
// stáhne na pozadí a **nainstaluje sama, jakmile je klid** (nic se nehraje ani nestahuje):
//   – okno schované v liště / minimalizované / v pozadí → hned (tichá instalace, Connect se znovu spustí),
//   – okno otevřené a aktivní → 30 s odpočet s možností „Později“ (odklad o 2 h; jinak se instaluje při ukončení).
// Kanál: stable = vydání, beta = i předběžná vydání (Nastavení → Obecné → Kanál aplikace Connect).
import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { settings } from "./settings";

export interface UpdaterStatus {
  state: "idle" | "disabled" | "checking" | "available" | "downloading" | "ready" | "none" | "error";
  version?: string; percent?: number; error?: string; checkedAt?: string;
  restartAt?: number;            // kdy se Connect sám restartuje (odpočet), ms od epochy
}
let status: UpdaterStatus = { state: app.isPackaged ? "idle" : "disabled" };
let log: (s: string) => void = () => undefined;
let busy: () => boolean = () => false;       // hraje se / stahuje se → neinstalovat
let postponedUntil = 0;
let countdown: NodeJS.Timeout | null = null;
let lastCheck = 0;

const COUNTDOWN_MS = 30_000;
const POSTPONE_MS = 2 * 3600_000;

function emit(s: Partial<UpdaterStatus>) {
  status = { ...status, ...s };
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("connect:updater", status);
}
export const updaterStatus = () => status;

export function setupUpdater(logger: (s: string) => void, isBusy: () => boolean) {
  log = logger;
  busy = isBusy;
  if (!app.isPackaged || process.env.CONNECT_NO_UPDATE === "1") return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  autoUpdater.on("checking-for-update", () => emit({ state: "checking", error: undefined }));
  autoUpdater.on("update-available", (i) => { emit({ state: "downloading", version: i.version, percent: 0 }); log(`Connect ${i.version} k dispozici`); });
  autoUpdater.on("update-not-available", () => emit({ state: "none", checkedAt: new Date().toISOString() }));
  autoUpdater.on("download-progress", (p) => emit({ state: "downloading", percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (i) => {
    emit({ state: "ready", version: i.version, percent: 100 });
    log(`Connect ${i.version} stažen`);
    maybeInstall();
  });
  autoUpdater.on("error", (e) => { emit({ state: "error", error: String(e?.message ?? e).slice(0, 200), checkedAt: new Date().toISOString() }); log(`Aktualizace Connectu: ${e?.message}`); });
  void checkNow();
  setInterval(() => { void checkNow(); maybeInstall(); }, 15 * 60_000).unref();
  setInterval(() => maybeInstall(), 60_000).unref();             // po dohrání / dostažení nainstalovat
}

/** Návrat do okna: zkontrolovat (nejvýš jednou za 5 minut). */
export function onWindowFocus() {
  if (Date.now() - lastCheck > 5 * 60_000) void checkNow();
}

export async function checkNow(): Promise<UpdaterStatus> {
  if (status.state === "disabled" || status.state === "downloading" || status.state === "ready") return status;
  lastCheck = Date.now();
  const beta = settings().launcherChannel === "beta";
  autoUpdater.allowPrerelease = beta;
  autoUpdater.channel = beta ? "beta" : "latest";
  autoUpdater.allowDowngrade = false;
  try { await autoUpdater.checkForUpdates(); } catch { /* stav nastaví událost error */ }
  return status;
}

/** Je-li stažená verze a klid, nainstalovat (případně po odpočtu, když se uživatel právě dívá). */
function maybeInstall() {
  if (status.state !== "ready" || countdown || Date.now() < postponedUntil || busy()) return;
  const wins = BrowserWindow.getAllWindows();
  const watching = wins.some((w) => w.isVisible() && !w.isMinimized() && w.isFocused());
  if (!watching) { log(`Automatická aktualizace na ${status.version} (aplikace v pozadí)`); installNow(); return; }
  emit({ restartAt: Date.now() + COUNTDOWN_MS });
  countdown = setTimeout(() => {
    countdown = null;
    if (busy()) { emit({ restartAt: undefined }); return; }
    log(`Automatická aktualizace na ${status.version}`);
    installNow();
  }, COUNTDOWN_MS);
}

/** „Později“: odložit automatickou instalaci o 2 hodiny (při ukončení se nainstaluje tak jako tak). */
export function postpone() {
  if (countdown) { clearTimeout(countdown); countdown = null; }
  postponedUntil = Date.now() + POSTPONE_MS;
  emit({ restartAt: undefined });
}

/** Restartovat a nainstalovat stažené vydání (tiše, aplikace se znovu spustí). */
export function installNow() {
  if (status.state !== "ready") return;
  if (countdown) { clearTimeout(countdown); countdown = null; }
  (app as unknown as { quittingForUpdate?: boolean }).quittingForUpdate = true;
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
}
