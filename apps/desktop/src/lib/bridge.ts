// Přístup k hlavnímu procesu (window.connect z preloadu); v prohlížeči (náhledy, testy) bezpečná náhrada.
import { loadCatalog } from "@connect/catalog-client";
import type { CatalogState, ConnectApi } from "../../electron/preload";

declare global { interface Window { connect?: ConnectApi } }

const browserFallback: ConnectApi = {
  appInfo: async () => ({ version: "0.1.0", platform: "web", locale: navigator.language }),
  window: () => undefined,
  openExternal: async (url: string) => { window.open(url, "_blank", "noopener"); },
  catalog: {
    // prohlížeč (vývoj bez Electronu): přímé načtení snapshotu a živých údajů
    get: async (): Promise<CatalogState> => {
      const bundled = await (await fetch("./catalog.json")).json();
      const c = await loadCatalog({ fetcher: (u, i) => fetch(u, i as RequestInit), bundled, bundledBase: location.href });
      return { ...c, offline: !c.live.prices && !c.live.versions };
    },
    refresh: async () => browserFallback.catalog.get(),
    onUpdate: () => () => undefined,
  },
  auth: {
    status: async () => ({ signedIn: false, pending: false, user: null, error: null, secureStorage: false, offline: false }),
    signIn: async () => browserFallback.auth.status(),
    cancel: async () => browserFallback.auth.status(),
    signOut: async () => browserFallback.auth.status(),
    onChange: () => () => undefined,
  },
  library: {
    get: async () => ({ signedIn: false, items: [], offline: false }),
    refresh: async () => ({ signedIn: false, items: [], offline: false }),
    claim: async () => ({ signedIn: false, items: [], offline: false }),
    redeemKey: async () => ({ ok: false, reason: "web", library: { signedIn: false, items: [], offline: false } }),
    favorite: async () => ({ signedIn: false, items: [], offline: false }),
    licenses: async () => [],
    onChange: () => () => undefined,
  },
  onDeepLink: () => () => undefined,
  onWindowState: () => () => undefined,
};

export const bridge: ConnectApi = typeof window !== "undefined" && window.connect ? window.connect : browserFallback;
export const isDesktop = typeof window !== "undefined" && !!window.connect;
