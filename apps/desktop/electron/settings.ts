// Nastavení stahování a umístění (SPEC 6.7) – hlavní proces, trvale v userData/settings.json.
import { BrowserWindow } from "electron";
import { JsonStore } from "./store";

export interface Settings {
  libraries: string[];                       // knihovní složky (první = výchozí cíl instalace)
  speedLimitKBps: number;                    // 0 = bez omezení
  connections: number;                       // paralelní stahování souborů (1–8)
  autoUpdate: boolean;                       // automatické aktualizace her
  autoUpdateOnlyIdle: boolean;               // jen když nic neběží
  schedule: { enabled: boolean; from: string; to: string };   // stahovat jen v čase od–do (HH:MM)
  channels: Record<string, "stable" | "beta">;                 // kanál podle produktu
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  notifications: { done: boolean; update: boolean; sale: boolean };
  launcherChannel: "stable" | "beta";
  telemetry: boolean;
}

const DEFAULTS: Settings = {
  libraries: [], speedLimitKBps: 0, connections: 3, autoUpdate: true, autoUpdateOnlyIdle: true,
  schedule: { enabled: false, from: "01:00", to: "07:00" }, channels: {}, launchOnStartup: false, minimizeToTray: true,
  notifications: { done: true, update: true, sale: true }, launcherChannel: "stable", telemetry: false,
};
const store = new JsonStore<Settings>("settings", DEFAULTS);

export function settings(): Settings { return store.get(); }

export function updateSettings(patch: Partial<Settings>): Settings {
  const s = store.update((d) => {
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in DEFAULTS) || v === undefined) continue;
      (d as unknown as Record<string, unknown>)[k] = v;
    }
    d.connections = Math.max(1, Math.min(8, Math.round(Number(d.connections) || 3)));
    d.speedLimitKBps = Math.max(0, Math.round(Number(d.speedLimitKBps) || 0));
    d.libraries = [...new Set(d.libraries.filter((x) => typeof x === "string" && x.length > 0))];
  });
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("connect:settings", s);
  return s;
}
