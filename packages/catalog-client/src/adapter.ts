// Adaptér katalogu webu -> datový model Connectu (SPEC sekce 8).
// Pořadí zdrojů: katalog z webu (remoteUrl) -> poslední uložená cache -> výchozí snapshot přibalený k aplikaci.
// Potom se živě doplní: cena z obchodu webu (shop_items podle shopKey) a verze + velikost z manifestu buildu.
// Každý krok je samostatný – výpadek jednoho zdroje nezastaví ostatní (Promise.allSettled), nic nespadne.
import { z } from "zod";
import { parseProducts, type ParseIssue, type Product } from "./schema";

export const RawCatalog = z.object({
  schemaVersion: z.number().int(),
  updatedAt: z.string().optional(),
  api: z.object({ supabaseUrl: z.string().url(), publishableKey: z.string(), web: z.string().url() }).partial().optional(),
  mediaBase: z.string().optional(),
  products: z.array(z.unknown()),
});
export type RawCatalog = z.infer<typeof RawCatalog>;

export type CatalogSource = "web" | "cache" | "bundled";
export interface Catalog {
  products: Product[];
  source: CatalogSource;
  fetchedAt: string;
  updatedAt?: string;
  api?: RawCatalog["api"];
  issues: ParseIssue[];
  /** proběhlo živé doplnění z webu (ceny, verze) */
  live: { prices: boolean; versions: boolean };
}

type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

async function fetchJson(fetcher: FetchLike, url: string, timeoutMs: number, headers?: Record<string, string>): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Relativní cesty médií -> absolutní podle mediaBase (u webu vůči URL katalogu, u snapshotu vůči aplikaci). */
export function resolveMedia(products: Product[], base: string): Product[] {
  const abs = (p: string) => (/^(https?:|data:|file:|\.?\/)/.test(p) ? p : base + p);
  return products.map((p) => ({
    ...p,
    media: { ...p.media, icon: abs(p.media.icon), cover: abs(p.media.cover), hero: abs(p.media.hero), screenshots: p.media.screenshots.map(abs) },
  }));
}

export function parseCatalog(input: unknown, source: CatalogSource, baseUrl: string): Catalog {
  const raw = RawCatalog.parse(input);
  const { products, issues } = parseProducts(raw.products);
  const mediaBase = raw.mediaBase ?? "";
  const base = /^https?:/.test(mediaBase) ? mediaBase : new URL(mediaBase, baseUrl).toString();
  return {
    products: resolveMedia(products.filter((p) => p.status !== "hidden"), base),
    source, fetchedAt: new Date().toISOString(), updatedAt: raw.updatedAt, api: raw.api, issues,
    live: { prices: false, versions: false },
  };
}

interface ShopRow { product_key: string | null; price_czk: number | null; price_year_czk: number | null; sale_mode: string | null; file_version: string | null; file_size?: number | null; active: boolean }
interface VoxManifest { version?: string; files?: Array<{ size?: number }> }

/** Živé doplnění: ceny z obchodu (veřejné REST shop_items) a verze / velikosti z manifestů her. */
export async function enrichCatalog(cat: Catalog, fetcher: FetchLike, timeoutMs = 8000): Promise<Catalog> {
  const api = cat.api;
  const out = cat.products.map((p) => ({ ...p }));
  const tasks: Array<Promise<void>> = [];
  const live = { ...cat.live };
  const keys = out.map((p) => p.shopKey).filter((k): k is string => !!k);
  if (api?.supabaseUrl && api.publishableKey && keys.length) {
    tasks.push((async () => {
      const url = `${api.supabaseUrl}/rest/v1/shop_items?select=product_key,price_czk,price_year_czk,sale_mode,file_version,file_size,active&product_key=in.(${keys.map(encodeURIComponent).join(",")})`;
      const rows = (await fetchJson(fetcher, url, timeoutMs, { apikey: api.publishableKey! })) as ShopRow[];
      for (const p of out) {
        const r = rows.find((x) => x.product_key === p.shopKey && x.active);
        if (!r) continue;
        if (typeof r.price_czk === "number") {
          p.pricing = { ...p.pricing, model: r.sale_mode === "subscription" ? "subscription" : r.price_czk > 0 ? "paid" : "free", price: r.price_czk, currency: "CZK" };
        }
        if (r.file_version) p.latestVersion = r.file_version;
        if (p.build?.kind === "shop-file" && r.file_size) p.sizeBytes = r.file_size;
      }
      live.prices = true;
    })());
  }
  for (const p of out) {
    const url = p.build?.kind === "voxario-manifest" ? p.build.manifestUrl : undefined;
    if (!url) continue;
    tasks.push((async () => {
      const m = (await fetchJson(fetcher, url, timeoutMs)) as VoxManifest;
      if (m.version) p.latestVersion = m.version;
      if (Array.isArray(m.files)) p.sizeBytes = m.files.reduce((s, f) => s + (Number(f.size) || 0), 0);
      live.versions = true;
    })());
  }
  // aplikace s instalátorem: {version, size, filename} – platí jen když popisuje právě tento instalátor
  for (const p of out) {
    const b = p.build;
    if (b?.kind !== "installer" || !b.versionUrl || !b.installerUrl) continue;
    const file = b.installerUrl.split("/").pop();
    tasks.push((async () => {
      const v = (await fetchJson(fetcher, b.versionUrl!, timeoutMs)) as { version?: string; size?: number; filename?: string };
      if (v.filename && v.filename !== file) return;
      if (v.version) p.latestVersion = v.version;
      if (typeof v.size === "number") p.sizeBytes = v.size;
    })());
  }
  await Promise.allSettled(tasks);
  return { ...cat, products: out, live };
}

export interface LoadOptions {
  fetcher: FetchLike;
  remoteUrl?: string;                 // katalog na webu (až bude – docs/WEB_PROPOSAL.md)
  cached?: unknown;                   // poslední uložený katalog (JSON z Catalog)
  bundled: unknown;                   // přibalený snapshot
  bundledBase: string;                // URL, vůči které se řeší média snapshotu
  timeoutMs?: number;
}

/** Načte katalog: web -> cache -> snapshot; pak živé ceny a verze. Nikdy nevyhodí výjimku kvůli síti. */
export async function loadCatalog(o: LoadOptions): Promise<Catalog> {
  let cat: Catalog | null = null;
  if (o.remoteUrl) {
    try { cat = parseCatalog(await fetchJson(o.fetcher, o.remoteUrl, o.timeoutMs ?? 8000), "web", o.remoteUrl); } catch { cat = null; }
  }
  if (!cat && o.cached) {
    try {
      const c = o.cached as Catalog;
      if (Array.isArray(c.products) && c.products.length) cat = { ...c, source: "cache" };
    } catch { cat = null; }
  }
  if (!cat) cat = parseCatalog(o.bundled, "bundled", o.bundledBase);
  return enrichCatalog(cat, o.fetcher, o.timeoutMs);
}
