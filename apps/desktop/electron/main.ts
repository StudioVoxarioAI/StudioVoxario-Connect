// StudioVoxario Connect – hlavní proces Electronu.
// Bezpečnost: contextIsolation, sandbox, bez nodeIntegration; renderer komunikuje jen přes preload (IPC).
// Jedna instance; deep link studiovoxario:// (nákup na webu, otevření produktu) se předá do okna.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { cancelSignIn, restore, signIn, signOut, status as authStatus } from "./auth";
import { catalogNow, refresh as refreshCatalog } from "./catalog";
import { cancel, enqueue, launch, move, openFolder, pause, resume, state as installsState, uninstall } from "./installer";
import { claim, libraryNow, licenses, redeemKey, refreshLibrary, setFavorite } from "./library";
import { settings, updateSettings, type Settings } from "./settings";

const PROTOCOL = "studiovoxario";
// testy a náhledy: oddělená data aplikace (nikdy nesahá na skutečný profil uživatele)
if (process.env.CONNECT_USER_DATA) app.setPath("userData", process.env.CONNECT_USER_DATA);
const isDev = !app.isPackaged && !!process.env.CONNECT_DEV_URL;
let win: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;

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
  win.once("ready-to-show", () => win?.show());
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
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
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
    ipcMain.handle("connect:installs-get", () => installsState());
    ipcMain.handle("connect:install", (_e, id: string, mode: "install" | "update" | "repair", dir?: string) => wrap(() => enqueue(String(id), mode, dir)));
    ipcMain.handle("connect:download-pause", (_e, id: string) => pause(String(id)));
    ipcMain.handle("connect:download-resume", (_e, id: string) => resume(String(id)));
    ipcMain.handle("connect:download-cancel", (_e, id: string) => cancel(String(id)));
    ipcMain.handle("connect:download-move", (_e, id: string, i: number) => move(String(id), Number(i)));
    ipcMain.handle("connect:uninstall", (_e, id: string, keep: boolean) => wrap(() => uninstall(String(id), !!keep)));
    ipcMain.handle("connect:launch", (_e, id: string, after: "minimize" | "close" | "keep") => launch(String(id), after));
    ipcMain.handle("connect:open-folder", (_e, id: string) => openFolder(String(id)));
    ipcMain.handle("connect:settings-get", () => settings());
    ipcMain.handle("connect:settings-set", (_e, patch: Partial<Settings>) => updateSettings(patch ?? {}));
    ipcMain.handle("connect:open-external", (_e, url: string) => {
      if (typeof url === "string" && /^https:\/\//.test(url)) return shell.openExternal(url);
      return undefined;
    });
    createWindow();
    // po startu: obnovit přihlášení, katalog a knihovnu (nic z toho neblokuje okno)
    void (async () => {
      await refreshCatalog().catch(() => undefined);
      await restore();
      await refreshLibrary().catch(() => undefined);
    })();
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
