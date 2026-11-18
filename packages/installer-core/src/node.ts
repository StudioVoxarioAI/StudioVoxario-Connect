// Stahování a instalace her podle manifestu (Node; fetch se předává – Electron net.fetch, testy fetch z Node).
// Převzato a rozšířeno z launcheru Ashes of Eryon (unityGame.cjs):
//  - soubory > 45 MB jsou na serveru jako <url>.part1…N, skládají se a ověří SHA-256,
//  - stahuje se do <hra>/.staging (nainstalovaná verze zůstane netknutá), navazuje se po přerušení (HTTP Range),
//  - přepnutí: přepisované a nepotřebné soubory staré verze do .rollback, nové na místo, pak install.json,
//  - delta: stáhnou se jen změněné soubory (planUpdate), oprava: přehashování a stažení poškozených.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { isSafeRelativePath, planUpdate, type InstalledFile, type ManifestFile } from "./delta";

export type Fetcher = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean; status: number; headers: { get(name: string): string | null }; body: unknown; json(): Promise<unknown>;
}>;

export interface VoxManifest { version: string; exe: string; engine?: string; publishedAt?: string; files: ManifestFile[] }
export interface InstallState {
  productId: string; version: string; exe: string; engine?: string; installedAt: string;
  files: InstalledFile[]; verified: boolean; previous?: { version: string; exe: string; files: InstalledFile[] };
}

export const STATE_FILE = "install.json";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function hashFile(file: string): Promise<string | null> {
  return new Promise((resolve) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(file);
    s.on("error", () => resolve(null));
    s.on("data", (d) => h.update(d));
    s.on("end", () => resolve(h.digest("hex")));
  });
}

export function readState(dir: string): InstallState | null {
  try { return JSON.parse(fs.readFileSync(path.join(dir, STATE_FILE), "utf8")) as InstallState; } catch { return null; }
}
export function writeState(dir: string, s: InstallState) {
  const f = path.join(dir, STATE_FILE);
  fs.writeFileSync(f + ".tmp", JSON.stringify(s));
  fs.renameSync(f + ".tmp", f);
}

/** Omezovač rychlosti (bajty / s, 0 = bez omezení) – sdílený všemi spojeními. */
export class RateLimiter {
  private allowance = 0;
  private last = Date.now();
  constructor(public bytesPerSecond = 0) {}
  async take(n: number) {
    if (this.bytesPerSecond <= 0) return;
    for (;;) {
      const now = Date.now();
      this.allowance = Math.min(this.bytesPerSecond, this.allowance + ((now - this.last) / 1000) * this.bytesPerSecond);
      this.last = now;
      if (this.allowance >= n || this.allowance >= this.bytesPerSecond * 0.5) { this.allowance -= n; return; }
      await sleep(Math.min(250, ((n - this.allowance) / this.bytesPerSecond) * 1000));
    }
  }
}

export interface DownloadCtx {
  fetch: Fetcher;
  signal?: AbortSignal;
  limiter?: RateLimiter;
  onBytes?: (n: number) => void;           // přírůstek stažených bajtů (pro rychlost a průběh)
  onWait?: (ms: number, status: number) => void;
}

/**
 * Stáhne URL do souboru s navázáním: když `dest` už část obsahuje, pošle Range a připojí zbytek.
 * Opakuje při 429 / 5xx / výpadku sítě (Retry-After nebo 2, 4, 8… s), max. 8 pokusů.
 */
export async function downloadResumable(url: string, dest: string, size: number | undefined, ctx: DownloadCtx): Promise<void> {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (ctx.signal?.aborted) throw new Error("aborted");
    let have = 0;
    try { have = fs.statSync(dest).size; } catch { have = 0; }
    if (size !== undefined && have === size) return;
    if (size !== undefined && have > size) { fs.rmSync(dest, { force: true }); have = 0; }
    try {
      const res = await ctx.fetch(url, { headers: have > 0 ? { range: `bytes=${have}-` } : {}, signal: ctx.signal });
      if (res.status === 416) { fs.rmSync(dest, { force: true }); continue; }
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        if (res.status !== 429 && res.status < 500) throw lastError;
        const ra = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(60_000, 2000 * 2 ** attempt);
        ctx.onWait?.(wait, res.status);
        await sleep(wait);
        continue;
      }
      const append = have > 0 && res.status === 206;
      if (have > 0 && !append) ctx.onBytes?.(-have);   // server Range neumí -> celé znovu
      const out = fs.createWriteStream(dest, { flags: append ? "a" : "w" });
      const src = Readable.fromWeb(res.body as WebReadableStream<Uint8Array>);
      const meter = async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          await ctx.limiter?.take(chunk.length);
          ctx.onBytes?.(chunk.length);
          yield chunk;
        }
      };
      await pipeline(src, meter, out, { signal: ctx.signal });
      if (size !== undefined && fs.statSync(dest).size !== size) throw new Error("incomplete");
      return;
    } catch (e) {
      if (ctx.signal?.aborted) throw new Error("aborted");
      if (e === lastError && !/HTTP (429|5\d\d)/.test(String((e as Error).message))) throw e;
      lastError = e;
      const wait = Math.min(60_000, 2000 * 2 ** attempt);
      ctx.onWait?.(wait, 0);
      await sleep(wait);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Stažení selhalo");
}

/** Jeden soubor manifestu do .staging (i rozdělený na části), ověření SHA-256. Hotový ověřený soubor se přeskočí. */
export async function fetchManifestFile(file: ManifestFile, baseUrl: string, staging: string, ctx: DownloadCtx): Promise<void> {
  if (!isSafeRelativePath(file.path)) throw new Error(`Nebezpečná cesta v manifestu: ${file.path}`);
  const target = path.join(staging, ...file.path.split("/"));
  const done = target + ".ok";
  if (fs.existsSync(done) && fs.existsSync(target)) return;
  const url = new URL(file.url, baseUrl).toString();
  const parts = Math.max(1, Number(file.parts) || 1);
  if (parts === 1) {
    await downloadResumable(url, target + ".partial", file.size, ctx);
    fs.renameSync(target + ".partial", target);
  } else {
    // části neznají přesnou velikost předem (poslední je menší) – každá se stahuje celá, hotové se přeskočí
    const pieces: string[] = [];
    for (let i = 1; i <= parts; i++) {
      const piece = `${target}.part${i}`;
      if (!fs.existsSync(piece + ".ok")) {
        await downloadResumable(`${url}.part${i}`, piece, undefined, ctx);
        fs.writeFileSync(piece + ".ok", "");
      }
      pieces.push(piece);
    }
    const out = fs.createWriteStream(target);
    for (const p of pieces) await pipeline(fs.createReadStream(p), out, { end: false });
    await new Promise<void>((r, j) => out.end((e?: Error | null) => (e ? j(e) : r())));
    for (const p of pieces) { fs.rmSync(p, { force: true }); fs.rmSync(p + ".ok", { force: true }); }
  }
  const h = await hashFile(target);
  if (h?.toLowerCase() !== file.sha256.toLowerCase()) {
    fs.rmSync(target, { force: true });
    throw new Error(`Soubor ${file.path} je poškozený (SHA-256 nesouhlasí) – stáhne se znovu.`);
  }
  fs.writeFileSync(done, "");
}

/**
 * Přepnutí na novou verzi: soubory z .staging na místo, přepisované / nepotřebné staré do .rollback,
 * install.json s indexem souborů. Vrátí nový stav.
 */
export function commitStaging(dir: string, productId: string, m: VoxManifest, plan: { download: ManifestFile[]; remove: string[] }, prev: InstallState | null): InstallState {
  const staging = path.join(dir, ".staging");
  const rollback = path.join(dir, ".rollback");
  fs.rmSync(rollback, { recursive: true, force: true });
  const move = (from: string, to: string) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    try { fs.renameSync(from, to); } catch { fs.copyFileSync(from, to); fs.rmSync(from, { force: true }); }
  };
  for (const f of plan.download) {
    const rel = f.path.split("/");
    const target = path.join(dir, ...rel);
    if (fs.existsSync(target)) move(target, path.join(rollback, ...rel));
    move(path.join(staging, ...rel), target);
  }
  for (const rel of plan.remove) {
    if (!isSafeRelativePath(rel)) continue;
    const p = path.join(dir, ...rel.split("/"));
    if (fs.existsSync(p)) move(p, path.join(rollback, ...rel.split("/")));
  }
  fs.rmSync(staging, { recursive: true, force: true });
  const state: InstallState = {
    productId, version: m.version, exe: m.exe, engine: m.engine, installedAt: new Date().toISOString(),
    files: m.files.map((f) => ({ path: f.path, size: f.size, sha256: f.sha256 })),
    verified: !prev,          // první instalace se neověřuje spuštěním; aktualizace ano (návrat při pádu)
    previous: prev ? { version: prev.version, exe: prev.exe, files: prev.files } : undefined,
  };
  writeState(dir, state);
  return state;
}

/** Návrat předchozí verze z .rollback (nová verze nešla spustit). */
export function rollbackInstall(dir: string): InstallState | null {
  const s = readState(dir);
  const back = path.join(dir, ".rollback");
  if (!s?.previous || !fs.existsSync(back)) return null;
  const prevPaths = new Set(s.previous.files.map((f) => f.path.toLowerCase()));
  // nové soubory, které předchozí verze neměla, pryč; ze zálohy vrátit vše
  for (const f of s.files) {
    if (!prevPaths.has(f.path.toLowerCase()) && isSafeRelativePath(f.path)) fs.rmSync(path.join(dir, ...f.path.split("/")), { force: true });
  }
  const walk = (d: string, rel: string[] = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), [...rel, e.name]);
      else {
        const to = path.join(dir, ...rel, e.name);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(path.join(d, e.name), to);
      }
    }
  };
  walk(back);
  fs.rmSync(back, { recursive: true, force: true });
  const restored: InstallState = { ...s, version: s.previous.version, exe: s.previous.exe, files: s.previous.files, verified: true, previous: undefined };
  writeState(dir, restored);
  return restored;
}

export function markVerified(dir: string) {
  const s = readState(dir);
  if (!s || s.verified) return;
  writeState(dir, { ...s, verified: true, previous: undefined });
  fs.rm(path.join(dir, ".rollback"), { recursive: true, force: true }, () => undefined);
}

export interface RunOptions extends DownloadCtx {
  productId: string;
  dir: string;
  manifestUrl: string;
  manifest: VoxManifest;
  mode: "install" | "update" | "repair";
  concurrency?: number;
  onPlan?: (totalBytes: number, files: number) => void;
  onPhase?: (phase: "downloading" | "verifying" | "installing") => void;
}

/** Instalace / aktualizace / oprava podle manifestu. Opakované spuštění po přerušení naváže. */
export async function runInstall(o: RunOptions): Promise<InstallState> {
  fs.mkdirSync(o.dir, { recursive: true });
  const prev = readState(o.dir);
  let installed: InstalledFile[] = o.mode === "install" ? [] : prev?.files ?? [];
  if (o.mode === "repair") {
    // oprava: skutečný stav na disku (přehashovat), ne index
    o.onPhase?.("verifying");
    const real: InstalledFile[] = [];
    for (const f of installed) {
      if (!isSafeRelativePath(f.path)) continue;
      const p = path.join(o.dir, ...f.path.split("/"));
      const h = fs.existsSync(p) ? await hashFile(p) : null;
      if (h) real.push({ path: f.path, size: fs.statSync(p).size, sha256: h });
    }
    installed = real;
  }
  const plan = planUpdate(installed, o.manifest.files);
  o.onPlan?.(plan.downloadBytes, plan.download.length);
  o.onPhase?.("downloading");
  const staging = path.join(o.dir, ".staging");
  // už stažené (navázání po restartu) se započtou do průběhu
  for (const f of plan.download) {
    const t = path.join(staging, ...f.path.split("/"));
    if (fs.existsSync(t + ".ok")) o.onBytes?.(f.size);
    else { try { o.onBytes?.(fs.statSync(t + ".partial").size); } catch { /* nic */ } }
  }
  const queue = [...plan.download];
  const workers = Array.from({ length: Math.max(1, o.concurrency ?? 3) }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const t = path.join(staging, ...f.path.split("/"));
      if (fs.existsSync(t + ".ok")) continue;
      let before = 0;
      try { before = fs.statSync(t + ".partial").size; } catch { before = 0; }
      try {
        await fetchManifestFile(f, o.manifestUrl, staging, { ...o, onBytes: (n) => o.onBytes?.(n) });
      } catch (e) {
        if (/poškozený/.test(String((e as Error).message))) {   // jeden pokus znovu
          o.onBytes?.(-(f.size - before));
          await fetchManifestFile(f, o.manifestUrl, staging, o);
        } else throw e;
      }
    }
  });
  await Promise.all(workers);
  o.onPhase?.("installing");
  if (o.mode === "repair") {
    const state = commitStaging(o.dir, o.productId, o.manifest, { download: plan.download, remove: [] }, null);
    fs.rmSync(path.join(o.dir, ".rollback"), { recursive: true, force: true });
    return { ...state, verified: true, previous: undefined };
  }
  return commitStaging(o.dir, o.productId, o.manifest, plan, o.mode === "install" ? null : prev);
}

/** Velikost složky na disku. */
export function dirSize(dir: string): number {
  let total = 0;
  const walk = (d: string) => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { try { total += fs.statSync(p).size; } catch { /* nic */ } }
    }
  };
  walk(dir);
  return total;
}

/**
 * Odinstalace: keepUserData = smažou se jen soubory z manifestu (uložené pozice a nastavení zůstanou),
 * jinak celá složka.
 */
export function uninstall(dir: string, keepUserData: boolean) {
  const s = readState(dir);
  if (!keepUserData || !s) { fs.rmSync(dir, { recursive: true, force: true }); return; }
  for (const f of s.files) if (isSafeRelativePath(f.path)) fs.rmSync(path.join(dir, ...f.path.split("/")), { force: true });
  for (const x of [STATE_FILE, ".staging", ".rollback"]) fs.rmSync(path.join(dir, x), { recursive: true, force: true });
  // prázdné složky po hře pryč
  const prune = (d: string): boolean => {
    let empty = true;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory() && prune(path.join(d, e.name))) fs.rmdirSync(path.join(d, e.name));
      else empty = false;
    }
    return empty;
  };
  try { if (prune(dir)) fs.rmdirSync(dir); } catch { /* složka už neexistuje */ }
}
