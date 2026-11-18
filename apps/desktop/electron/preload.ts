// Bezpečný most mezi rendererem a hlavním procesem (window.connect). Žádné obecné ipcRenderer do rendereru.
import type { Catalog } from "@connect/catalog-client";
import { contextBridge, ipcRenderer } from "electron";

import type { AuthStatus } from "./auth";
import type { LibraryState } from "./library";

export type CatalogState = Catalog & { offline: boolean };
export type { AuthStatus, LibraryState };
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
