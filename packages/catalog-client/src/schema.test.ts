import { describe, expect, it } from "vitest";
import { parseProducts } from "./schema";

const base = {
  id: "ashes-of-eryon", type: "game", name: "Ashes of Eryon", description: "", tags: [],
  media: { icon: "i.png", cover: "c.png", hero: "h.png", screenshots: [] },
  pricing: { model: "free" }, status: "early_access", platforms: ["windows"], unknownField: 42,
};

describe("parseProducts", () => {
  it("přijme platný produkt a zahodí neznámá pole", () => {
    const { products, issues } = parseProducts([base]);
    expect(issues).toHaveLength(0);
    expect(products[0]?.id).toBe("ashes-of-eryon");
    expect(products[0]?.access).toBe("none");
    expect(products[0]).not.toHaveProperty("unknownField");
  });
  it("vadnou položku přeskočí a popíše, ostatní ponechá", () => {
    const bad = { ...base, id: "broken", platforms: [] };
    const { products, issues } = parseProducts([bad, { ...base, id: "fantasy" }]);
    expect(products.map((p) => p.id)).toEqual(["fantasy"]);
    expect(issues[0]?.id).toBe("broken");
  });
  it("nepole vrátí prázdný seznam", () => {
    expect(parseProducts(null).products).toEqual([]);
  });
});
