// Fáze 7: aktualizace samotného Connectu (electron-updater, GitHub Releases repozitáře StudioVoxario-Connect).
// Stahuje se na pozadí; instalace po potvrzení uživatele („Restartovat a aktualizovat“) nebo při příštím ukončení.
// Kanál: stable = vydání, beta = i předběžná vydání (Nastavení -> Obecné -> Kanál aplikace Connect).
import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { settings } from "./settings";

export interface UpdaterStatus {
  state: "idle" | "disabled" | "checking" | "available" | "downloading" | "ready" | "none" | "error";
  version?: string; percent?: number; error?: string; checkedAt?: string;
}
let status: UpdaterStatus = { state: app.isPackaged ? "idle" : "disabled" };
let log: (s: string) => void = () => undefined;

function emit(s: Partial<UpdaterStatus>) {
  status = { ...status, ...s };
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("connect:updater", status);
}
export const updaterStatus = () => status;

export function setupUpdater(logger: (s: string) => void) {
  log = logger;
  if (!app.isPackaged || process.env.CONNECT_NO_UPDATE === "1") return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  autoUpdater.on("checking-for-update", () => emit({ state: "checking", error: undefined }));
  autoUpdater.on("update-available", (i) => { emit({ state: "downloading", version: i.version, percent: 0 }); log(`Connect ${i.version} k dispozici`); });
  autoUpdater.on("update-not-available", () => emit({ state: "none", checkedAt: new Date().toISOString() }));
  autoUpdater.on("download-progress", (p) => emit({ state: "downloading", percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (i) => { emit({ state: "ready", version: i.version, percent: 100 }); log(`Connect ${i.version} stažen`); });
  autoUpdater.on("error", (e) => { emit({ state: "error", error: String(e?.message ?? e).slice(0, 200), checkedAt: new Date().toISOString() }); log(`Aktualizace Connectu: ${e?.message}`); });
  void checkNow();
  setInterval(() => void checkNow(), 6 * 3600_000).unref();
}

export async function checkNow(): Promise<UpdaterStatus> {
  if (status.state === "disabled" || status.state === "downloading" || status.state === "ready") return status;
  const beta = settings().launcherChannel === "beta";
  autoUpdater.allowPrerelease = beta;
  autoUpdater.channel = beta ? "beta" : "latest";
  autoUpdater.allowDowngrade = false;
  try { await autoUpdater.checkForUpdates(); } catch { /* stav nastaví událost error */ }
  return status;
}

/** Restartovat a nainstalovat stažené vydání (tiše, aplikace se znovu spustí). */
export function installNow() {
  if (status.state !== "ready") return;
  (app as unknown as { quittingForUpdate?: boolean }).quittingForUpdate = true;
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
}
