// Knihovna uživatele: co vlastní a k čemu má přístup – podle typu přístupu produktu (Product.access):
//  none + zdarma  -> po „Získat“ (lokální záznam k účtu),
//  access_key     -> klíč ověřený na webu (edge app-access „redeem“; Voxar.app i VoxarioProtect),
//  account_permission -> přístup udělený k účtu (RPC ashes_can_play – Ashes of Eryon),
//  license        -> licence z obchodu (RPC shop_license_status, seznam shop_my_licenses).
// Poslední známý stav se pamatuje – knihovna se ukáže i offline.
import type { Product } from "@connect/catalog-client";
import { BrowserWindow } from "electron";
import { edge, rest, status as authStatus } from "./auth";
import { currentCatalog } from "./catalog";
import { demoStates, isDemo } from "./demo";
import { JsonStore } from "./store";

export type AccessState = "owned" | "claimable" | "needs_key" | "no_access" | "needs_license" | "signed_out";
export interface LibraryItem {
  productId: string;
  owned: boolean;
  state: AccessState;
  acquiredAt?: string;
  favorite: boolean;
  license?: { type: "perpetual" | "subscription" | "trial"; validUntil?: string; updatesActive?: boolean; buyUrl?: string; latestAllowed?: boolean };
}
export interface LibraryState { signedIn: boolean; items: LibraryItem[]; checkedAt?: string; offline: boolean; error?: string }

interface UserData {
  claims: Record<string, string>;        // productId -> kdy získáno
  unlocks: Record<string, string>;       // skupina klíče (voxar-app) -> kdy odemčeno
  favorites: string[];
  remote: Record<string, { owned: boolean; license?: LibraryItem["license"]; at: string }>;   // poslední stav z webu
}
const store = new JsonStore<Record<string, UserData>>("library", {});
const blank = (): UserData => ({ claims: {}, unlocks: {}, favorites: [], remote: {} });
function userData(uid: string): UserData {
  const all = store.get();
  return all[uid] ?? blank();
}
function save(uid: string, fn: (d: UserData) => void) {
  store.update((all) => { const d = all[uid] ?? blank(); fn(d); all[uid] = d; });
}

/** Skupina klíče: VoxarioProtect je modul Voxar.app -> stejný klíč. */
const keyGroup = (p: Product) => p.build?.moduleOf ?? p.id;

let last: LibraryState = { signedIn: false, items: [], offline: false };
function emit(s: LibraryState) {
  last = s;
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("connect:library", s);
}

export function libraryNow(): LibraryState { return last; }

export async function refreshLibrary(): Promise<LibraryState> {
  const products = currentCatalog()?.products ?? [];
  const a = authStatus();
  if (!a.signedIn || !a.user) {
    return (emit({ signedIn: false, items: products.map((p) => ({ productId: p.id, owned: false, state: "signed_out", favorite: false })), offline: false }), last);
  }
  if (isDemo) {
    const items = products.map((p) => {
      const st = demoStates[p.id] ?? "claimable";
      return { productId: p.id, owned: st === "owned", state: st, favorite: p.id === "fantasy", acquiredAt: "2026-11-01T12:00:00Z" } as LibraryItem;
    });
    return (emit({ signedIn: true, items, checkedAt: new Date().toISOString(), offline: false }), last);
  }
  const uid = a.user.id;
  let offline = false;
  // dotazy na web (paralelně, každý samostatně – výpadek jednoho nevadí)
  const needsAshes = products.some((p) => p.access === "account_permission");
  const licensed = products.filter((p) => p.access === "license" && p.shopKey);
  const keyed = products.filter((p) => p.access === "access_key");
  const [ashes, licenses, keyCheck] = await Promise.allSettled([
    needsAshes ? rest<boolean>("/rest/v1/rpc/ashes_can_play", { method: "POST", body: {} }) : Promise.resolve(false),
    Promise.all(licensed.map(async (p) => [p.id, await rest<Record<string, unknown>>("/rest/v1/rpc/shop_license_status", { method: "POST", body: { p_product: p.shopKey } })] as const)),
    keyed.length ? edge<{ allowed?: boolean }>("app-access", { action: "check" }) : Promise.resolve(null),
  ]);
  const now = new Date().toISOString();
  save(uid, (d) => {
    if (ashes.status === "fulfilled") for (const p of products.filter((x) => x.access === "account_permission")) d.remote[p.id] = { owned: ashes.value === true, at: now };
    else offline = true;
    if (licenses.status === "fulfilled") {
      for (const [id, s] of licenses.value) {
        d.remote[id] = {
          owned: s.owned === true, at: now,
          license: { type: "perpetual", validUntil: (s.updates_until as string) ?? undefined, updatesActive: s.updates_active === true,
                     buyUrl: (s.buy_url as string) ?? undefined, latestAllowed: s.latest_allowed === true },
        };
      }
    } else offline = true;
    // klíč: web pozná odemčení podle IP (app_access_ips) – při shodě se odemkne i lokálně
    if (keyCheck.status === "fulfilled" && keyCheck.value?.data?.allowed) for (const p of keyed) d.unlocks[keyGroup(p)] ??= now;
  });
  const d = userData(uid);
  const items: LibraryItem[] = products.map((p) => {
    const favorite = d.favorites.includes(p.id);
    const r = d.remote[p.id];
    switch (p.access) {
      case "account_permission":
        return { productId: p.id, owned: !!r?.owned, state: r?.owned ? "owned" : "no_access", acquiredAt: r?.owned ? d.claims[p.id] ?? r.at : undefined, favorite };
      case "license":
        return { productId: p.id, owned: !!r?.owned, state: r?.owned ? "owned" : "needs_license", license: r?.license, favorite };
      case "access_key": {
        const u = d.unlocks[keyGroup(p)];
        const claimed = d.claims[p.id];
        return { productId: p.id, owned: !!u && !!claimed, state: !u ? "needs_key" : claimed ? "owned" : "claimable", acquiredAt: claimed, favorite };
      }
      default: {
        if (p.pricing.model !== "free") return { productId: p.id, owned: !!r?.owned, state: r?.owned ? "owned" : "needs_license", favorite };
        const c = d.claims[p.id];
        return { productId: p.id, owned: !!c, state: c ? "owned" : "claimable", acquiredAt: c, favorite };
      }
    }
  });
  emit({ signedIn: true, items, checkedAt: now, offline });
  return last;
}

export async function claim(productId: string): Promise<LibraryState> {
  const a = authStatus();
  if (!a.user) throw new Error("not_signed_in");
  const item = last.items.find((i) => i.productId === productId);
  if (!item || item.state !== "claimable") throw new Error("not_claimable");
  save(a.user.id, (d) => { d.claims[productId] ??= new Date().toISOString(); });
  return refreshLibrary();
}

/** Klíč k Voxar.app (a jejímu modulu VoxarioProtect): ověří web (app-access „redeem“, s účtem). */
export async function redeemKey(productId: string, code: string): Promise<{ ok: boolean; reason?: string; library: LibraryState }> {
  const a = authStatus();
  if (!a.user) throw new Error("not_signed_in");
  const p = currentCatalog()?.products.find((x) => x.id === productId);
  if (!p || p.access !== "access_key") throw new Error("no_key_needed");
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 120) return { ok: false, reason: "empty", library: last };
  const r = await edge<{ allowed?: boolean; reason?: string }>("app-access", { action: "redeem", code: trimmed });
  if (!r.data?.allowed) return { ok: false, reason: r.data?.reason ?? (r.ok ? "invalid" : "error"), library: last };
  const now = new Date().toISOString();
  save(a.user.id, (d) => { d.unlocks[keyGroup(p)] = now; d.claims[p.id] ??= now; });
  return { ok: true, library: await refreshLibrary() };
}

export function setFavorite(productId: string, on: boolean): LibraryState {
  const a = authStatus();
  if (!a.user) return last;
  save(a.user.id, (d) => { d.favorites = on ? [...new Set([...d.favorites, productId])] : d.favorites.filter((x) => x !== productId); });
  const items = last.items.map((i) => (i.productId === productId ? { ...i, favorite: on } : i));
  emit({ ...last, items });
  return last;
}

/** Licence pro stránku účtu. */
export async function licenses(): Promise<Array<{ productId: string; title: string; purchasedAt?: string; updatesUntil?: string; updatesActive: boolean }>> {
  if (isDemo) return [{ productId: "voxario-studio-engine", title: "Voxario Studio Engine", purchasedAt: "2026-10-28T10:00:00Z", updatesUntil: "2027-10-28T10:00:00Z", updatesActive: true }];
  const products = currentCatalog()?.products ?? [];
  const rows = await rest<Array<{ item_id: string; purchased_at?: string; updates_until?: string; updates_active?: boolean }>>("/rest/v1/rpc/shop_my_licenses", { method: "POST", body: {} });
  const items = await rest<Array<{ id: string; product_key: string | null; title: string }>>("/rest/v1/shop_items?select=id,product_key,title");
  return rows.map((r) => {
    const it = items.find((i) => i.id === r.item_id);
    const p = products.find((x) => x.shopKey && x.shopKey === it?.product_key);
    return { productId: p?.id ?? r.item_id, title: p?.name ?? it?.title ?? "Licence", purchasedAt: r.purchased_at, updatesUntil: r.updates_until, updatesActive: !!r.updates_active };
  });
}
