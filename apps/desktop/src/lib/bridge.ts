// Přístup k hlavnímu procesu (window.connect z preloadu); v prohlížeči (náhledy, testy) bezpečná náhrada.
import type { ConnectApi } from "../../electron/preload";

declare global { interface Window { connect?: ConnectApi } }

const browserFallback: ConnectApi = {
  appInfo: async () => ({ version: "0.1.0", platform: "web", locale: navigator.language }),
  window: () => undefined,
  openExternal: async (url: string) => { window.open(url, "_blank", "noopener"); },
  onDeepLink: () => () => undefined,
  onWindowState: () => () => undefined,
};

export const bridge: ConnectApi = typeof window !== "undefined" && window.connect ? window.connect : browserFallback;
export const isDesktop = typeof window !== "undefined" && !!window.connect;
