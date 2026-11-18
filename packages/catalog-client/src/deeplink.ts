// Deep linky studiovoxario:// (web -> Connect). Jen bílá listina cest, ID produktu jen [a-z0-9-].
//   product/<id> | store              -> obchod / detail
//   library[/<id>]                    -> knihovna (vybraná položka)
//   purchase-complete?product=<id>    -> po nákupu na webu: obnovit knihovnu
//   downloads | settings | account
export interface DeepLink { route: string; purchase?: boolean }

export function parseDeepLink(raw: string): DeepLink | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "studiovoxario:") return null;
  let parts: string[];
  try { parts = [u.hostname, ...u.pathname.split("/")].filter(Boolean).map(decodeURIComponent); } catch { return null; }
  const id = (s?: string | null) => (s && /^[a-z0-9-]{1,64}$/.test(s) ? s : undefined);
  switch (parts[0]) {
    case "product": case "store": { const p = id(parts[1]); return { route: p ? `/store/${p}` : "/store" }; }
    case "library": { const p = id(parts[1]); return { route: p ? `/library?select=${p}` : "/library" }; }
    case "purchase-complete": { const p = id(u.searchParams.get("product") ?? parts[1]); return { route: p ? `/library?select=${p}` : "/library", purchase: true }; }
    case "downloads": case "settings": case "account": return { route: `/${parts[0]}` };
    default: return { route: "/" };
  }
}
