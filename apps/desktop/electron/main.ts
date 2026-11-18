// StudioVoxario Connect – hlavní proces Electronu.
// Bezpečnost: contextIsolation, sandbox, bez nodeIntegration; renderer komunikuje jen přes preload (IPC).
// Jedna instance; deep link studiovoxario:// (nákup na webu, otevření produktu) se předá do okna.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { cancelSignIn, restore, signIn, signOut, status as authStatus } from "./auth";
import { catalogNow, refresh as refreshCatalog } from "./catalog";
import { applyLimits, cancel, enqueue, hooks, kick, syncApps, launch, move, openFolder, pause, resume, state as installsState, uninstall } from "./installer";
import { claim, libraryNow, licenses, redeemKey, refreshLibrary, setFavorite } from "./library";
import { settings, updateSettings, type Settings } from "./settings";
import { adoptFolder, adoptLegacy } from "./migrate";
import { checkNow, installNow, setupUpdater, updaterStatus } from "./updater";
import {
  addLibraryFolder, applyLoginItem, autoUpdate, clearDownloadCache, downloadAllowedNow, exportLogs, libraryFolders, log, moveInstall,
  notify, removeLibraryFolder, setDefaultLibrary, setupTray, verifyAll,
} from "./system";

const PROTOCOL = "studiovoxario";
// testy a náhledy: oddělená data aplikace (nikdy nesahá na skutečný profil uživatele)
if (process.env.CONNECT_USER_DATA) app.setPath("userData", process.env.CONNECT_USER_DATA);
const isDev = !app.isPackaged && !!process.env.CONNECT_DEV_URL;
let win: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;
let quitting = false;
const startHidden = process.argv.includes("--hidden");   // spuštění se systémem: jen do lišty
const iconPath = () => path.join(__dirname, "../dist/icon.png");

function deepLinkFrom(argv: string[]): string | null {
  return argv.find((a) => a.startsWith(`${PROTOCOL}://`)) ?? null;
}

function sendDeepLink(url: string) {
  if (win && !win.webContents.isLoading()) win.webContents.send("connect:deep-link", url);
  else pendingDeepLink = url;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    backgroundColor: "#05070b",
    show: false,
    icon: path.join(__dirname, "../dist/icon.png"),
    title: "StudioVoxario Connect",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => { if (!(startHidden && settings().minimizeToTray)) win?.show(); });
  // zavření okna s lištou = schovat (stahování pokračuje); Ukončit v liště aplikaci opravdu ukončí
  win.on("close", (e) => {
    if (!quitting && settings().minimizeToTray && process.env.CONNECT_NO_TRAY !== "1") { e.preventDefault(); win?.hide(); }
  });
  // návrat z prohlížeče (nákup, klíč, účet na webu): obnovit knihovnu, nejvýš jednou za 20 s
  let lastFocusRefresh = 0;
  win.on("focus", () => {
    if (Date.now() - lastFocusRefresh < 20_000) return;
    lastFocusRefresh = Date.now();
    void refreshLibrary().catch(() => undefined);
    void syncApps();
  });
  win.on("maximize", () => win?.webContents.send("connect:window-state", { maximized: true }));
  win.on("unmaximize", () => win?.webContents.send("connect:window-state", { maximized: false }));
  win.webContents.on("did-finish-load", () => {
    if (pendingDeepLink) { win?.webContents.send("connect:deep-link", pendingDeepLink); pendingDeepLink = null; }
  });
  // externí odkazy jen v systémovém prohlížeči (platby a účet na webu)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    const allowed = isDev ? url.startsWith(process.env.CONNECT_DEV_URL!) : url.startsWith("file://");
    if (!allowed) e.preventDefault();
  });
  if (isDev) void win.loadURL(process.env.CONNECT_DEV_URL!);
  else void win.loadFile(path.join(__dirname, "../dist/index.html"));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const link = deepLinkFrom(argv);
    if (link) sendDeepLink(link);
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });
  app.on("open-url", (e, url) => { e.preventDefault(); sendDeepLink(url); });   // macOS
  if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  else app.setAsDefaultProtocolClient(PROTOCOL);

  app.whenReady().then(() => {
    pendingDeepLink = deepLinkFrom(process.argv);
    ipcMain.handle("connect:app-info", () => ({ version: app.getVersion(), platform: process.platform, locale: app.getLocale() }));
    ipcMain.on("connect:window", (_e, action: "minimize" | "maximize" | "close") => {
      if (!win) return;
      if (action === "minimize") win.minimize();
      else if (action === "maximize") { if (win.isMaximized()) win.unmaximize(); else win.maximize(); }
      else win.close();
    });
    ipcMain.handle("connect:catalog-get", () => { void refreshCatalog(); return catalogNow(); });
    ipcMain.handle("connect:catalog-refresh", () => refreshCatalog());
    // účet a knihovna
    ipcMain.handle("connect:auth-status", () => authStatus());
    ipcMain.handle("connect:auth-sign-in", () => signIn());
    ipcMain.handle("connect:auth-cancel", () => cancelSignIn());
    ipcMain.handle("connect:auth-sign-out", async () => { const s = await signOut(); void refreshLibrary(); return s; });
    ipcMain.handle("connect:library-get", () => { void refreshLibrary(); return libraryNow(); });
    ipcMain.handle("connect:library-refresh", () => refreshLibrary());
    ipcMain.handle("connect:library-claim", (_e, id: string) => claim(String(id)));
    ipcMain.handle("connect:library-redeem", (_e, id: string, code: string) => redeemKey(String(id), String(code)));
    ipcMain.handle("connect:library-favorite", (_e, id: string, on: boolean) => setFavorite(String(id), !!on));
    ipcMain.handle("connect:library-licenses", () => licenses());
    // instalace a stahování
    const wrap = <T>(fn: () => T) => { try { return { ok: true as const, value: fn() }; } catch (e) { return { ok: false as const, error: (e as Error).message }; } };
    const wrapA = async <T>(fn: () => Promise<T>) => { try { return { ok: true as const, value: await fn() }; } catch (e) { return { ok: false as const, error: (e as Error).message }; } };
    ipcMain.handle("connect:installs-get", () => { void syncApps(); return installsState(); });
    ipcMain.handle("connect:install", (_e, id: string, mode: "install" | "update" | "repair", dir?: string) => wrap(() => enqueue(String(id), mode, dir)));
    ipcMain.handle("connect:download-pause", (_e, id: string) => pause(String(id)));
    ipcMain.handle("connect:download-resume", (_e, id: string) => resume(String(id)));
    ipcMain.handle("connect:download-cancel", (_e, id: string) => cancel(String(id)));
    ipcMain.handle("connect:download-move", (_e, id: string, i: number) => move(String(id), Number(i)));
    ipcMain.handle("connect:uninstall", (_e, id: string, keep: boolean) => wrapA(() => uninstall(String(id), !!keep)));
    ipcMain.handle("connect:launch", (_e, id: string, after: "minimize" | "close" | "keep") => launch(String(id), after));
    ipcMain.handle("connect:open-folder", (_e, id: string) => openFolder(String(id)));
    ipcMain.handle("connect:settings-get", () => settings());
    ipcMain.handle("connect:settings-set", (_e, patch: Partial<Settings>) => {
      const s = updateSettings(patch ?? {});
      applyLimits();
      applyLoginItem();
      setupTray(() => win, iconPath());
      return s;
    });
    // Fáze 4: knihovní složky, přesun instalace, diagnostika
    ipcMain.handle("connect:libraries-get", () => libraryFolders());
    ipcMain.handle("connect:libraries-add", () => addLibraryFolder(win));
    ipcMain.handle("connect:libraries-remove", (_e, dir: string) => wrap(() => removeLibraryFolder(String(dir))));
    ipcMain.handle("connect:libraries-default", (_e, dir: string) => setDefaultLibrary(String(dir)));
    ipcMain.handle("connect:install-relocate", (e, id: string, dir: string) => wrapA(async () => {
      await moveInstall(String(id), String(dir), (done, total) => e.sender.send("connect:relocate-progress", { id, done, total }));
      return libraryFolders();
    }));
    ipcMain.handle("connect:verify-all", () => verifyAll());
    ipcMain.handle("connect:clear-cache", () => clearDownloadCache());
    ipcMain.handle("connect:export-logs", () => exportLogs(win));
    const announce = (found: Array<{ productId: string }>) => {
      for (const f of found) {
        const name = catalogNow()?.products.find((p) => p.id === f.productId)?.name ?? f.productId;
        win?.webContents.send("connect:notify", { kind: "adopted", name });
        log(`Převzata instalace ${f.productId}`);
      }
      return found.length;
    };
    ipcMain.handle("connect:legacy-adopt", async () => announce(await adoptLegacy()));
    ipcMain.handle("connect:adopt-folder", (_e, id: string) => adoptFolder(win, String(id)));
    ipcMain.handle("connect:updater-status", () => updaterStatus());
    ipcMain.handle("connect:updater-check", () => checkNow());
    ipcMain.handle("connect:updater-install", () => { quitting = true; installNow(); });
    ipcMain.handle("connect:open-logs", () => shell.openPath(path.join(app.getPath("userData"), "logs")));
    ipcMain.handle("connect:open-external", (_e, url: string) => {
      if (typeof url === "string" && /^https:\/\//.test(url)) return shell.openExternal(url);
      return undefined;
    });
    hooks.allowed = downloadAllowedNow;
    hooks.log = log;
    hooks.onNotify = (kind, name) => {
      const n = settings().notifications;
      if (kind === "done" && n.done) notify("Stahování dokončeno", `${name} je připraveno ke hraní.`);
      if (kind === "installed" && n.done) notify("Instalace dokončena", `${name} je nainstalováno.`);
      if (kind === "rollback") notify("Aktualizace vrácena", `${name} po aktualizaci spadl – vrátili jsme předchozí verzi.`);
    };
    log(`Start ${app.getVersion()} ${process.platform}`);
    createWindow();
    applyLimits();
    applyLoginItem();
    setupTray(() => win, iconPath());
    setupUpdater(log);
    // plánovač: každou minutu zkusit frontu; každých 30 min obnovit katalog a hledat aktualizace
    setInterval(() => kick(), 60_000).unref();
    setInterval(() => { void refreshCatalog().then(() => autoUpdate()).catch(() => undefined); }, 30 * 60_000).unref();
    // po startu: obnovit přihlášení, katalog a knihovnu (nic z toho neblokuje okno)
    void (async () => {
      await refreshCatalog().catch(() => undefined);
      await restore();
      await refreshLibrary().catch(() => undefined);
      await syncApps();
      // hry ze starého launcheru Ashes of Eryon převzít bez stahování (jen poprvé – pak už je Connect má)
      const adopted = await adoptLegacy().catch(() => []);
      for (const f of adopted) {
        const name = catalogNow()?.products.find((p) => p.id === f.productId)?.name ?? f.productId;
        setTimeout(() => win?.webContents.send("connect:notify", { kind: "adopted", name }), 1500);
        log(`Převzata instalace ${f.productId} z ${f.dir}`);
      }
      autoUpdate();
    })();
  });
  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
