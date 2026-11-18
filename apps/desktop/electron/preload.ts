// Bezpečný most mezi rendererem a hlavním procesem (window.connect). Žádné obecné ipcRenderer do rendereru.
import { contextBridge, ipcRenderer } from "electron";

const api = {
  appInfo: (): Promise<{ version: string; platform: string; locale: string }> => ipcRenderer.invoke("connect:app-info"),
  window: (action: "minimize" | "maximize" | "close") => ipcRenderer.send("connect:window", action),
  openExternal: (url: string) => ipcRenderer.invoke("connect:open-external", url),
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
