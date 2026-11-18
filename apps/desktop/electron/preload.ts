// Bezpečný most mezi rendererem a hlavním procesem (window.connect). Žádné obecné ipcRenderer do rendereru.
import type { Catalog } from "@connect/catalog-client";
import { contextBridge, ipcRenderer } from "electron";

import type { AuthStatus } from "./auth";
import type { InstallsState } from "./installer";
import type { LibraryState } from "./library";
import type { Settings } from "./settings";
import type { LibraryFolder } from "./system";

export type CatalogState = Catalog & { offline: boolean };
export type { AuthStatus, InstallsState, LibraryFolder, LibraryState, Settings };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type Unsub = () => void;
function on<T>(channel: string, cb: (v: T) => void): Unsub {
  const fn = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, fn);
  return () => { ipcRenderer.removeListener(channel, fn); };
}

const api = {
  appInfo: (): Promise<{ version: string; platform: string; locale: string }> => ipcRenderer.invoke("connect:app-info"),
  window: (action: "minimize" | "maximize" | "close") => ipcRenderer.send("connect:window", action),
  openExternal: (url: string) => ipcRenderer.invoke("connect:open-external", url),
  catalog: {
    get: (): Promise<CatalogState> => ipcRenderer.invoke("connect:catalog-get"),
    refresh: (): Promise<CatalogState> => ipcRenderer.invoke("connect:catalog-refresh"),
    onUpdate: (cb: (c: CatalogState) => void) => {
      const fn = (_e: unknown, c: CatalogState) => cb(c);
      ipcRenderer.on("connect:catalog", fn);
      return () => { ipcRenderer.removeListener("connect:catalog", fn); };
    },
  },
  auth: {
    status: (): Promise<AuthStatus> => ipcRenderer.invoke("connect:auth-status"),
    signIn: (): Promise<AuthStatus> => ipcRenderer.invoke("connect:auth-sign-in"),
    cancel: (): Promise<AuthStatus> => ipcRenderer.invoke("connect:auth-cancel"),
    signOut: (): Promise<AuthStatus> => ipcRenderer.invoke("connect:auth-sign-out"),
    onChange: (cb: (s: AuthStatus) => void): Unsub => on("connect:auth", cb),
  },
  library: {
    get: (): Promise<LibraryState> => ipcRenderer.invoke("connect:library-get"),
    refresh: (): Promise<LibraryState> => ipcRenderer.invoke("connect:library-refresh"),
    claim: (id: string): Promise<LibraryState> => ipcRenderer.invoke("connect:library-claim", id),
    redeemKey: (id: string, code: string): Promise<{ ok: boolean; reason?: string; library: LibraryState }> => ipcRenderer.invoke("connect:library-redeem", id, code),
    favorite: (id: string, on: boolean): Promise<LibraryState> => ipcRenderer.invoke("connect:library-favorite", id, on),
    licenses: (): Promise<Array<{ productId: string; title: string; purchasedAt?: string; updatesUntil?: string; updatesActive: boolean }>> => ipcRenderer.invoke("connect:library-licenses"),
    onChange: (cb: (s: LibraryState) => void): Unsub => on("connect:library", cb),
  },
  installs: {
    get: (): Promise<InstallsState> => ipcRenderer.invoke("connect:installs-get"),
    install: (id: string, mode: "install" | "update" | "repair" = "install", dir?: string): Promise<Result<InstallsState>> => ipcRenderer.invoke("connect:install", id, mode, dir),
    pause: (id: string): Promise<InstallsState> => ipcRenderer.invoke("connect:download-pause", id),
    resume: (id: string): Promise<InstallsState> => ipcRenderer.invoke("connect:download-resume", id),
    cancel: (id: string): Promise<InstallsState> => ipcRenderer.invoke("connect:download-cancel", id),
    move: (id: string, index: number): Promise<InstallsState> => ipcRenderer.invoke("connect:download-move", id, index),
    uninstall: (id: string, keepUserData: boolean): Promise<Result<InstallsState>> => ipcRenderer.invoke("connect:uninstall", id, keepUserData),
    launch: (id: string, after: "minimize" | "close" | "keep"): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("connect:launch", id, after),
    openFolder: (id: string): Promise<void> => ipcRenderer.invoke("connect:open-folder", id),
    onChange: (cb: (s: InstallsState) => void): Unsub => on("connect:installs", cb),
    onNotify: (cb: (n: { kind: "done" | "verified" | "rollback" | "crash"; name: string }) => void): Unsub => on("connect:notify", cb),
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke("connect:settings-get"),
    set: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke("connect:settings-set", patch),
    onChange: (cb: (s: Settings) => void): Unsub => on("connect:settings", cb),
  },
  system: {
    libraries: (): Promise<LibraryFolder[]> => ipcRenderer.invoke("connect:libraries-get"),
    addLibrary: (): Promise<LibraryFolder[]> => ipcRenderer.invoke("connect:libraries-add"),
    removeLibrary: (dir: string): Promise<Result<LibraryFolder[]>> => ipcRenderer.invoke("connect:libraries-remove", dir),
    setDefaultLibrary: (dir: string): Promise<LibraryFolder[]> => ipcRenderer.invoke("connect:libraries-default", dir),
    relocate: (id: string, dir: string): Promise<Result<LibraryFolder[]>> => ipcRenderer.invoke("connect:install-relocate", id, dir),
    onRelocate: (cb: (p: { id: string; done: number; total: number }) => void): Unsub => on("connect:relocate-progress", cb),
    verifyAll: (): Promise<number> => ipcRenderer.invoke("connect:verify-all"),
    clearCache: (): Promise<number> => ipcRenderer.invoke("connect:clear-cache"),
    exportLogs: (): Promise<string | null> => ipcRenderer.invoke("connect:export-logs"),
    openLogs: (): Promise<string> => ipcRenderer.invoke("connect:open-logs"),
  },
  onNavigate: (cb: (route: string) => void): Unsub => on("connect:navigate", cb),
  onDeepLink: (cb: (url: string) => void) => {
    const fn = (_e: unknown, url: string) => cb(url);
    ipcRenderer.on("connect:deep-link", fn);
    return () => { ipcRenderer.removeListener("connect:deep-link", fn); };
  },
  onWindowState: (cb: (s: { maximized: boolean }) => void) => {
    const fn = (_e: unknown, s: { maximized: boolean }) => cb(s);
    ipcRenderer.on("connect:window-state", fn);
    return () => { ipcRenderer.removeListener("connect:window-state", fn); };
  },
};

contextBridge.exposeInMainWorld("connect", api);
export type ConnectApi = typeof api;
