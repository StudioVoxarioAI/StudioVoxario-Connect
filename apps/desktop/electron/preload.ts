// Bezpečný most mezi rendererem a hlavním procesem (window.connect). Žádné obecné ipcRenderer do rendereru.
import type { Catalog } from "@connect/catalog-client";
import { contextBridge, ipcRenderer } from "electron";

export type CatalogState = Catalog & { offline: boolean };

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
