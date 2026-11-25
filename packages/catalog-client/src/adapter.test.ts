import { describe, expect, it } from "vitest";
import { loadCatalog } from "./adapter";
import { searchProducts } from "./search";
import bundled from "../../../apps/desktop/public/catalog.json";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = { ok: false, status: 404, json: async () => ({}) };

function fakeFetch(routes: Record<string, unknown>) {
  return async (url: string) => {
    for (const [k, v] of Object.entries(routes)) if (url.includes(k)) return v === null ? fail : ok(v);
    throw new Error("offline");
  };
}

describe("loadCatalog", () => {
  it("bez webu použije snapshot, média vyřeší vůči aplikaci a doplní ceny a verze", async () => {
    const cat = await loadCatalog({
      fetcher: fakeFetch({
        "connect/catalog.json": null,
        "shop_items": [{ product_key: "voxario-studio-engine", price_czk: 790, price_year_czk: null, sale_mode: "license", file_version: "1.30.0", active: true }],
        "latest-fantasy.json": { version: "0.24.0", files: [{ size: 100 }, { size: 50 }] },
        "latest.json": { version: "0.13.2", files: [{ size: 10 }] },
      }),
      remoteUrl: "https://studiovoxario.com/connect/catalog.json",
      bundled, bundledBase: "file:///app/dist/index.html",
    });
    expect(cat.source).toBe("bundled");
    expect(cat.products.map((p) => p.id)).toEqual(["ashes-of-eryon", "fantasy", "voxario-studio-engine", "voxar-app", "voxario-protect", "voxario-browser"]);
    const engine = cat.products.find((p) => p.id === "voxario-studio-engine")!;
    expect(engine.pricing.price).toBe(790);
    expect(engine.latestVersion).toBe("1.30.0");
    const fantasy = cat.products.find((p) => p.id === "fantasy")!;
    expect(fantasy.latestVersion).toBe("0.24.0");
    expect(fantasy.sizeBytes).toBe(150);
    expect(fantasy.media.cover).toBe("file:///app/dist/catalog-media/fantasy/cover.webp");
    expect(cat.live).toEqual({ prices: true, versions: true });
  });
  it("úplně offline: nespadne, vrátí snapshot bez živých údajů", async () => {
    const cat = await loadCatalog({ fetcher: fakeFetch({}), bundled, bundledBase: "file:///app/dist/index.html" });
    expect(cat.products).toHaveLength(6);
    expect(cat.live).toEqual({ prices: false, versions: false });
  });
  it("bez webu: starší uložená kopie nepřebije přibalený katalog nové verze aplikace, novější ano", async () => {
    const products = bundled.products.map((p) => ({ ...p, name: p.name + " (stará kopie)" }));
    const old = { ...bundled, updatedAt: "2026-01-01T00:00:00Z", source: "web", fetchedAt: "2026-01-01T00:00:00Z", products };
    const a = await loadCatalog({ fetcher: fakeFetch({ "connect/catalog.json": null }), remoteUrl: "https://studiovoxario.com/connect/catalog.json",
                                  cached: old, bundled, bundledBase: "file:///x/" });
    expect(a.source).toBe("bundled");
    expect(a.products[0]!.name).not.toContain("stará kopie");
    const newer = { ...old, updatedAt: "2099-01-01T00:00:00Z" };
    const b = await loadCatalog({ fetcher: fakeFetch({ "connect/catalog.json": null }), remoteUrl: "https://studiovoxario.com/connect/catalog.json",
                                  cached: newer, bundled, bundledBase: "file:///x/" });
    expect(b.source).toBe("cache");
  });
  it("katalog z webu má přednost a skryté produkty se nezobrazí", async () => {
    const web = { ...bundled, products: [...bundled.products, { ...bundled.products[0], id: "tajna-hra", status: "hidden" }] };
    const cat = await loadCatalog({ fetcher: fakeFetch({ "connect/catalog.json": web }), remoteUrl: "https://studiovoxario.com/connect/catalog.json", bundled, bundledBase: "file:///x/" });
    expect(cat.source).toBe("web");
    expect(cat.products.some((p) => p.id === "tajna-hra")).toBe(false);
    expect(cat.products[0]!.media.cover).toBe("https://studiovoxario.com/connect/catalog-media/ashes-of-eryon/cover.webp");
  });
});

describe("searchProducts", () => {
  const products = (bundled.products as never[]).map((p) => ({ tags: [], description: "", ...(p as object) })) as never;
  it("najde podle názvu bez diakritiky i s překlepem", () => {
    expect(searchProducts(products, "ashes")[0]?.product.id).toBe("ashes-of-eryon");
    expect(searchProducts(products, "prohlizec")[0]?.product.id).toBe("voxario-browser");
    expect(searchProducts(products, "vxar")[0]?.product.id).toBe("voxar-app");
    expect(searchProducts(products, "qqzz")).toEqual([]);
    expect(searchProducts(products, "broswer")[0]?.product.id).toBe("voxario-browser");
    expect(searchProducts(products, "engine")[0]?.product.id).toBe("voxario-studio-engine");
  });
  it("zvýrazní shodu v názvu", () => {
    expect(searchProducts(products, "eryon")[0]?.nameMatch).toEqual([9, 14]);
  });
});
