import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commitStaging, markVerified, readState, rollbackInstall, runInstall, uninstall, type Fetcher, type VoxManifest } from "./node";

// lokální „CDN“: soubory v paměti, podpora HTTP Range, počítání požadavků
const files = new Map<string, Buffer>();
const hits: string[] = [];
let server: http.Server;
let base = "";
beforeAll(async () => {
  server = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? "/").slice(1));
    hits.push(u);
    const body = files.get(u);
    if (!body) { res.writeHead(404); res.end(); return; }
    const m = /^bytes=(\d+)-$/.exec(String(req.headers.range ?? ""));
    if (m) {
      const start = Number(m[1]);
      if (start >= body.length) { res.writeHead(416); res.end(); return; }
      res.writeHead(206, { "content-length": body.length - start, "content-range": `bytes ${start}-${body.length - 1}/${body.length}` });
      res.end(body.subarray(start));
    } else {
      res.writeHead(200, { "content-length": body.length });
      res.end(body);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}/`;
});
afterAll(() => server.close());

const fetcher: Fetcher = (url, init) => fetch(url, init as RequestInit) as never;
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
const rand = (n: number, seed: number) => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed * 7) & 255; return b; };

function publish(version: string, content: Record<string, Buffer>, split: string[] = []): VoxManifest {
  const out: VoxManifest = { version, exe: "Game.exe", engine: "voxario", files: [] };
  for (const [p, b] of Object.entries(content)) {
    const url = `${version}/${p}`;
    if (split.includes(p)) {
      const half = Math.ceil(b.length / 2);
      files.set(`${url}.part1`, b.subarray(0, half));
      files.set(`${url}.part2`, b.subarray(half));
      out.files.push({ path: p, url, size: b.length, sha256: sha(b), parts: 2 });
    } else {
      files.set(url, b);
      out.files.push({ path: p, url, size: b.length, sha256: sha(b) });
    }
  }
  files.set("latest.json", Buffer.from(JSON.stringify(out)));
  return out;
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "connect-inst-"));

describe("runInstall", () => {
  it("nainstaluje (i soubor po částech), aktualizuje jen změny, opraví poškozený soubor", async () => {
    const dir = tmp();
    const v1 = publish("1.0.0", { "Game.exe": rand(5000, 1), "Data/big.pak": rand(200_000, 2), "Data/old.pak": rand(800, 3) }, ["Data/big.pak"]);
    let bytes = 0;
    const s1 = await runInstall({ fetch: fetcher, productId: "fantasy", dir, manifestUrl: base + "latest.json", manifest: v1, mode: "install", onBytes: (n) => (bytes += n) });
    expect(s1.version).toBe("1.0.0");
    expect(fs.readFileSync(path.join(dir, "Data/big.pak")).equals(rand(200_000, 2))).toBe(true);
    expect(bytes).toBe(5000 + 200_000 + 800);
    expect(fs.existsSync(path.join(dir, ".staging"))).toBe(false);

    // aktualizace: Game.exe změněn, old.pak odstraněn, nový soubor; big.pak beze změny -> nestahuje se
    hits.length = 0;
    const v2 = publish("1.1.0", { "Game.exe": rand(5100, 9), "Data/big.pak": rand(200_000, 2), "Data/new.pak": rand(300, 4) });
    v2.files.find((f) => f.path === "Data/big.pak")!.url = "1.0.0/Data/big.pak";
    v2.files.find((f) => f.path === "Data/big.pak")!.parts = 2;
    const s2 = await runInstall({ fetch: fetcher, productId: "fantasy", dir, manifestUrl: base + "latest.json", manifest: v2, mode: "update" });
    expect(hits.sort()).toEqual(["1.1.0/Data/new.pak", "1.1.0/Game.exe"]);
    expect(fs.existsSync(path.join(dir, "Data/old.pak"))).toBe(false);
    expect(s2.verified).toBe(false);
    expect(s2.previous?.version).toBe("1.0.0");

    // nová verze padá -> návrat předchozí
    const back = rollbackInstall(dir)!;
    expect(back.version).toBe("1.0.0");
    expect(fs.readFileSync(path.join(dir, "Game.exe")).equals(rand(5000, 1))).toBe(true);
    expect(fs.existsSync(path.join(dir, "Data/old.pak"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "Data/new.pak"))).toBe(false);

    // poškozený soubor -> oprava stáhne jen ten
    fs.writeFileSync(path.join(dir, "Data/old.pak"), "rozbité");
    publish("1.0.0", { "Game.exe": rand(5000, 1), "Data/big.pak": rand(200_000, 2), "Data/old.pak": rand(800, 3) }, ["Data/big.pak"]);
    hits.length = 0;
    const s3 = await runInstall({ fetch: fetcher, productId: "fantasy", dir, manifestUrl: base + "latest.json", manifest: v1, mode: "repair" });
    expect(hits).toEqual(["1.0.0/Data/old.pak"]);
    expect(s3.verified).toBe(true);
    expect(fs.readFileSync(path.join(dir, "Data/old.pak")).equals(rand(800, 3))).toBe(true);
  });

  it("naváže přerušené stahování (HTTP Range)", async () => {
    const dir = tmp();
    const big = rand(1_000_000, 5);
    const m = publish("2.0.0", { "Game.exe": big });
    // předchozí běh skončil uprostřed: půlka souboru v .staging
    fs.mkdirSync(path.join(dir, ".staging"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".staging", "Game.exe.partial"), big.subarray(0, 400_000));
    let fetched = 0;
    await runInstall({ fetch: fetcher, productId: "x", dir, manifestUrl: base + "latest.json", manifest: m, mode: "install", onBytes: (n) => (fetched += n) });
    expect(fs.readFileSync(path.join(dir, "Game.exe")).equals(big)).toBe(true);
    expect(fetched).toBe(1_000_000);   // 400 000 započteno z disku + 600 000 staženo
  });

  it("přerušení signálem nechá rozpracovaný soubor k navázání", async () => {
    const dir = tmp();
    const m = publish("3.0.0", { "Game.exe": rand(3_000_000, 6) });
    const ctrl = new AbortController();
    let n = 0;
    await expect(runInstall({ fetch: fetcher, productId: "x", dir, manifestUrl: base + "latest.json", manifest: m, mode: "install", signal: ctrl.signal,
      onBytes: (b) => { n += b; if (n > 500_000) ctrl.abort(); } })).rejects.toThrow();
    expect(fs.statSync(path.join(dir, ".staging", "Game.exe.partial")).size).toBeGreaterThan(0);
    expect(readState(dir)).toBeNull();
    const s = await runInstall({ fetch: fetcher, productId: "x", dir, manifestUrl: base + "latest.json", manifest: m, mode: "install" });
    expect(s.version).toBe("3.0.0");
  });

  it("odmítne manifest s cestou mimo složku hry", async () => {
    const dir = tmp();
    const m = publish("4.0.0", { "Game.exe": rand(10, 1) });
    m.files.push({ path: "../evil.dll", url: "4.0.0/Game.exe", size: 10, sha256: m.files[0]!.sha256 });
    await expect(runInstall({ fetch: fetcher, productId: "x", dir, manifestUrl: base + "latest.json", manifest: m, mode: "install" })).rejects.toThrow(/Nebezpečná/);
  });

  it("ověření po spuštění a odinstalace se zachováním uložených dat", async () => {
    const dir = tmp();
    const m = publish("5.0.0", { "Game.exe": rand(100, 1), "Data/a.pak": rand(100, 2) });
    await runInstall({ fetch: fetcher, productId: "x", dir, manifestUrl: base + "latest.json", manifest: m, mode: "install" });
    const s = commitStaging(dir, "x", m, { download: [], remove: [] }, readState(dir));
    expect(s.verified).toBe(false);
    markVerified(dir);
    expect(readState(dir)?.verified).toBe(true);
    fs.mkdirSync(path.join(dir, "Saves"));
    fs.writeFileSync(path.join(dir, "Saves", "slot1.sav"), "postup");
    uninstall(dir, true);
    expect(fs.existsSync(path.join(dir, "Game.exe"))).toBe(false);
    expect(fs.readFileSync(path.join(dir, "Saves", "slot1.sav"), "utf8")).toBe("postup");
    uninstall(dir, false);
    expect(fs.existsSync(dir)).toBe(false);
  });
});
