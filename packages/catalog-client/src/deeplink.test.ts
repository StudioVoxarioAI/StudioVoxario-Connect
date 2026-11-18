import { describe, expect, it } from "vitest";
import { parseDeepLink } from "./deeplink";

describe("parseDeepLink", () => {
  it("produkt, knihovna, nákup", () => {
    expect(parseDeepLink("studiovoxario://product/ashes-of-eryon")).toEqual({ route: "/store/ashes-of-eryon" });
    expect(parseDeepLink("studiovoxario://library/voxar-app")).toEqual({ route: "/library?select=voxar-app" });
    expect(parseDeepLink("studiovoxario://purchase-complete?product=voxario-studio-engine")).toEqual({ route: "/library?select=voxario-studio-engine", purchase: true });
    expect(parseDeepLink("studiovoxario://downloads")).toEqual({ route: "/downloads" });
  });
  it("odmítne cizí protokol a podezřelé ID", () => {
    expect(parseDeepLink("https://evil.example/product/x")).toBeNull();
    expect(parseDeepLink("studiovoxario://product/..%2F..%2Fx")).toEqual({ route: "/store" });
    expect(parseDeepLink("studiovoxario://product/<script>")).toEqual({ route: "/store" });
    expect(parseDeepLink("nesmysl")).toBeNull();
  });
});
