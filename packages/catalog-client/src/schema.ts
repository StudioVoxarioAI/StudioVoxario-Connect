// Cílový datový model Connectu (SPEC sekce 5). Data z webu se na něj mapují adaptérem; neznámá pole se
// ignorují (zod .strip), položka s chybějícím povinným polem se zaloguje a bezpečně přeskočí.
import { z } from "zod";

export const Platform = z.enum(["windows", "linux", "macos"]);
export type Platform = z.infer<typeof Platform>;

export const ProductType = z.enum(["game", "software"]);
export type ProductType = z.infer<typeof ProductType>;

export const ProductCategory = z.enum(["engine", "communication", "security", "browser", "other"]);
export type ProductCategory = z.infer<typeof ProductCategory>;

/** Jak se k produktu získá přístup (vedle ceny): klíč (Voxar.app), oprávnění účtu (Ashes of Eryon), licence (engine). */
export const AccessRequirement = z.enum(["none", "access_key", "account_permission", "license"]);
export type AccessRequirement = z.infer<typeof AccessRequirement>;

export const BuildSource = z.object({
  kind: z.enum(["voxario-manifest", "installer", "shop-file", "module"]),
  /** voxario-manifest: URL manifestu kanálu stable ({version, exe, files[{path,url,size,sha256,parts}]}), url souborů relativně k němu */
  manifestUrl: z.string().optional(),
  channels: z.record(z.string(), z.string()).optional(),          // kanál -> URL manifestu (beta…)
  /** installer: instalátor aplikace (Setup.exe), verze z JSON {version}, aplikace se aktualizuje sama */
  installerUrl: z.string().optional(),
  versionUrl: z.string().optional(),
  silentArgs: z.array(z.string()).optional(),
  installDir: z.string().optional(),                   // kam instalátor instaluje (%LOCALAPPDATA%\…) – detekce instalace
  executable: z.string().optional(),
  /** klíče Uninstall v registru Windows (HKCU\… / HKLM\…) – zdroj verze, složky a odinstalace */
  registryKeys: z.array(z.string()).optional(),
  selfUpdates: z.boolean().optional(),
  requiresElevation: z.boolean().optional(),
  /** module: produkt je součást jiné aplikace (VoxarioProtect v Voxar.app) */
  moduleOf: z.string().optional(),
  /** převzetí existující instalace (starý launcher, Fáze 7): %PROMĚNNÁ% a %REG:<klíč Uninstall>% = jeho InstallLocation */
  legacyPaths: z.array(z.string()).optional(),
});
export type BuildSource = z.infer<typeof BuildSource>;

export const Product = z.object({
  id: z.string().min(1),
  type: ProductType,
  name: z.string().min(1),
  category: ProductCategory.optional(),
  tagline: z.string().optional(),
  description: z.string().default(""),
  media: z.object({
    icon: z.string(),
    cover: z.string(),
    hero: z.string(),
    screenshots: z.array(z.string()).default([]),
    trailerUrl: z.string().optional(),
  }),
  tags: z.array(z.string()).default([]),
  genres: z.array(z.string()).optional(),
  pricing: z.object({
    model: z.enum(["free", "paid", "subscription"]),
    price: z.number().nonnegative().optional(),
    currency: z.string().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountEndsAt: z.string().optional(),
  }),
  access: AccessRequirement.default("none"),
  status: z.enum(["released", "early_access", "coming_soon", "hidden"]),
  releaseDate: z.string().optional(),
  platforms: z.array(Platform).min(1),
  systemRequirements: z.object({ min: z.string(), recommended: z.string().optional() }).optional(),
  latestVersion: z.string().optional(),
  changelog: z.array(z.object({ version: z.string(), date: z.string(), notes: z.string() })).optional(),
  storeUrl: z.string().optional(),
  featured: z.number().optional(),          // pořadí v doporučených (menší = výš), bez hodnoty = nedoporučeno
  developer: z.string().optional(),
  /** související produkty (Fantasy ↔ Ashes of Eryon) – zobrazí se v detailu */
  related: z.array(z.string()).optional(),
  /** Odkud se bere cena: záznam obchodu webu (shop_items.product_key) – cena z obchodu má přednost. */
  shopKey: z.string().optional(),
  /** Odkud se stahuje (Fáze 3 a 6): manifest hry, instalátor aplikace, soubor z obchodu, nebo modul jiné aplikace. */
  build: BuildSource.optional(),
  sizeBytes: z.number().optional(),          // velikost poslední verze (z manifestu)
});
export type Product = z.infer<typeof Product>;

export const BuildManifest = z.object({
  productId: z.string(),
  version: z.string(),
  platform: Platform,
  channel: z.enum(["stable", "beta"]),
  totalSize: z.number().nonnegative(),
  files: z.array(z.object({
    path: z.string(),
    size: z.number().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/i),
    url: z.string(),
    parts: z.number().int().positive().optional(),   // web dělí soubory > 45 MB na <url>.partN
  })),
  executable: z.string(),
  installKind: z.enum(["portable", "installer", "msi"]),
  silentInstallArgs: z.array(z.string()).optional(),
  requiresElevation: z.boolean().optional(),
  selfUpdates: z.boolean().optional(),
  launchArgs: z.array(z.string()).optional(),
});
export type BuildManifest = z.infer<typeof BuildManifest>;

export const LibraryEntry = z.object({
  productId: z.string(),
  owned: z.boolean(),
  acquiredAt: z.string().optional(),
  install: z.object({
    version: z.string(),
    path: z.string(),
    sizeOnDisk: z.number(),
    installedAt: z.string(),
    lastPlayedAt: z.string().optional(),
    playtimeSeconds: z.number().default(0),
  }).optional(),
  updateAvailable: z.boolean().optional(),
});
export type LibraryEntry = z.infer<typeof LibraryEntry>;

export const License = z.object({
  productId: z.string(),
  type: z.enum(["perpetual", "subscription", "trial"]),
  key: z.string().optional(),
  validUntil: z.string().optional(),
  seats: z.number().optional(),
});
export type License = z.infer<typeof License>;

export const UserAccount = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatarUrl: z.string().optional(),
  createdAt: z.string(),
});
export type UserAccount = z.infer<typeof UserAccount>;

export interface ParseIssue { index: number; id?: string; message: string }

/** Validuje seznam produktů: platné vrátí, neplatné přeskočí a popíše (nic nespadne kvůli jedné vadné položce). */
export function parseProducts(input: unknown): { products: Product[]; issues: ParseIssue[] } {
  const list = Array.isArray(input) ? input : [];
  const products: Product[] = [];
  const issues: ParseIssue[] = [];
  list.forEach((raw, index) => {
    const r = Product.safeParse(raw);
    if (r.success) products.push(r.data);
    else {
      const id = typeof raw === "object" && raw && "id" in raw ? String((raw as { id: unknown }).id) : undefined;
      issues.push({ index, id, message: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    }
  });
  return { products, issues };
}
