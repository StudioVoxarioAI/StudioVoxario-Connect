import { describe, expect, it } from "vitest";
import { DownloadQueue, etaSeconds, formatBytes, isSafeRelativePath, planUpdate } from "./index";

const h = (c: string) => c.repeat(64);

describe("planUpdate (delta)", () => {
  it("stáhne jen změněné a nové soubory, staré smaže", () => {
    const plan = planUpdate(
      [{ path: "Game.exe", size: 10, sha256: h("a") }, { path: "data/old.pak", size: 5, sha256: h("b") },
       { path: "data/same.pak", size: 7, sha256: h("c") }],
      [{ path: "Game.exe", size: 11, sha256: h("d"), url: "u1" }, { path: "data\\same.pak", size: 7, sha256: h("c"), url: "u2" },
       { path: "data/new.pak", size: 3, sha256: h("e"), url: "u3" }],
    );
    expect(plan.download.map((f) => f.path)).toEqual(["Game.exe", "data/new.pak"]);
    expect(plan.keep).toEqual(["data/same.pak"]);
    expect(plan.remove).toEqual(["data/old.pak"]);
    expect(plan.downloadBytes).toBe(14);
  });
  it("odmítne cesty mimo instalační složku", () => {
    expect(isSafeRelativePath("a/b.pak")).toBe(true);
    for (const p of ["../x", "a/../../x", "/etc/passwd", "C:/Windows/x", ""]) expect(isSafeRelativePath(p)).toBe(false);
  });
});

describe("DownloadQueue", () => {
  it("řadí, pozastavuje, obnovuje a přesouvá", () => {
    const q = new DownloadQueue();
    q.add({ productId: "a", version: "1", totalBytes: 100 });
    q.add({ productId: "b", version: "1", totalBytes: 50 });
    q.add({ productId: "a", version: "1", totalBytes: 100 });
    expect(q.list()).toHaveLength(2);
    q.pause("a");
    expect(q.active()?.productId).toBe("b");
    q.resume("a");
    q.move("b", 0);
    expect(q.list()[0]?.productId).toBe("b");
    q.progress("b", 80);
    expect(q.list()[0]?.doneBytes).toBe(50);
    q.remove("b");
    expect(q.list().map((j) => j.productId)).toEqual(["a"]);
  });
  it("formátuje velikost a odhad času", () => {
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(etaSeconds(1000, 300)).toBe(4);
    expect(etaSeconds(1000, 0)).toBeNull();
  });
});
