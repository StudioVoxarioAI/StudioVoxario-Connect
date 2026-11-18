// Katalog v hlavním procesu: okamžitě vrátí poslední cache (nebo přibalený snapshot), na pozadí ho obnoví
// z webu (stale-while-revalidate) a poslední dobrý výsledek uloží do userData – Obchod a hledání fungují i offline.
import { loadCatalog, parseCatalog, type Catalog } from "@connect/catalog-client";
import { app, BrowserWindow, net } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REMOTE_CATALOG_URL = process.env.CONNECT_CATALOG_URL ?? "https://studiovoxario.com/connect/catalog.json";
const cacheFile = () => path.join(app.getPath("userData"), "catalog-cache.json");
let current: Catalog | null = null;
let refreshing: Promise<Catalog> | null = null;

function rendererBase(): string {
  return process.env.CONNECT_DEV_URL ?? pathToFileURL(path.join(__dirname, "../dist/index.html")).toString();
}

function readJson(file: string): unknown {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return undefined; }
}

function bundled(): unknown {
  return readJson(path.join(__dirname, "../dist/catalog.json")) ?? readJson(path.join(__dirname, "../public/catalog.json"));
}

function writeCache(c: Catalog) {
  try {
    const tmp = cacheFile() + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(c));
    fs.renameSync(tmp, cacheFile());   // atomicky – při pádu zůstane stará cache
  } catch { /* cache je jen urychlení */ }
}

export function currentCatalog(): Catalog | null { return current; }

/** Okamžitá odpověď bez sítě (cache -> snapshot). */
export function catalogNow(): Catalog & { offline: boolean } {
  if (!current) {
    const cached = readJson(cacheFile()) as Catalog | undefined;
    if (cached?.products?.length) current = { ...cached, source: "cache" };
  }
  if (!current) {
    // první spuštění: přibalený snapshot hned (bez čekání na síť), refresh() doplní ceny a verze
    try { current = parseCatalog(bundled(), "bundled", rendererBase()); } catch { /* poškozený snapshot */ }
  }
  if (!current) {
    return { products: [], source: "bundled", fetchedAt: new Date().toISOString(), issues: [], live: { prices: false, versions: false }, offline: true };
  }
  return { ...current, offline: !current.live.prices && !current.live.versions && current.source !== "web" };
}

export function refresh(): Promise<Catalog> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const cat = await loadCatalog({
      fetcher: (url, init) => net.fetch(url, init as RequestInit),   // síť Chromia: systémové proxy a certifikáty
      remoteUrl: REMOTE_CATALOG_URL,
      cached: current ?? readJson(cacheFile()),
      bundled: bundled(),
      bundledBase: rendererBase(),
    });
    // média snapshotu / cache se vždy řeší vůči aktuální cestě aplikace (po aktualizaci se může změnit)
    if (cat.source !== "web") {
      const base = new URL("catalog-media/", rendererBase()).toString();
      cat.products = cat.products.map((p) => ({ ...p, media: relocate(p.media, base) }));
    }
    const online = cat.live.prices || cat.live.versions || cat.source === "web";
    if (online) writeCache(cat);
    current = cat;
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send("connect:catalog", { ...cat, offline: !online });
    return cat;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

function relocate<T extends { icon: string; cover: string; hero: string; screenshots: string[] }>(m: T, base: string): T {
  const fix = (u: string) => { const i = u.indexOf("catalog-media/"); return i >= 0 && !u.startsWith("https:") ? base + u.slice(i + 14) : u; };
  return { ...m, icon: fix(m.icon), cover: fix(m.cover), hero: fix(m.hero), screenshots: m.screenshots.map(fix) };
}
