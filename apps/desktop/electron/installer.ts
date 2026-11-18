// Instalace, aktualizace, oprava, spuštění a odinstalace her (SPEC 6.4, 6.8) – hlavní proces.
// Fronta stahování je trvalá (přežije restart aplikace i pád): rozpracované soubory zůstávají v <hra>/.staging
// a runInstall na ně naváže (HTTP Range). Najednou běží jedna úloha (pořadí ve frontě), ostatní čekají.
import type { Product } from "@connect/catalog-client";
import { markVerified, readState, rollbackInstall, runInstall, uninstall as removeInstall, dirSize, RateLimiter, type VoxManifest } from "@connect/installer-core/node";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, net, shell } from "electron";
import { gameTicket } from "./auth";
import { currentCatalog } from "./catalog";
import { libraryNow } from "./library";
import { settings } from "./settings";
import { JsonStore } from "./store";

const VERIFY_SECONDS = 20;
export type JobPhase = "queued" | "downloading" | "verifying" | "installing" | "paused" | "error";
export interface Job {
  productId: string; mode: "install" | "update" | "repair"; version: string; dir: string;
  totalBytes: number; doneBytes: number; phase: JobPhase; error?: string; addedAt: string;
}
export interface InstallRecord {
  dir: string; version: string; installedAt: string; sizeOnDisk: number; lastPlayedAt?: string; playtimeSeconds: number;
}
export interface InstallsState {
  installs: Record<string, InstallRecord & { updateAvailable: boolean; running: boolean }>;
  jobs: Job[];
  speed: number;                 // B/s aktuální
  history: number[];             // posledních 60 vzorků (1 s) pro graf
  diskFree?: number;
  defaultLibrary: string;
}

const installs = new JsonStore<Record<string, InstallRecord>>("installs", {});
// po restartu: rozpracované úlohy čekají (pozastavené), ať se nic nestahuje bez vědomí uživatele
const queueStore = new JsonStore<{ jobs: Job[] }>("downloads", { jobs: [] }, (q) => {
  for (const j of q.jobs) if (j.phase !== "error") j.phase = j.phase === "queued" ? "queued" : "paused";
});

let active: { productId: string; ctrl: AbortController } | null = null;
const running = new Map<string, ChildProcess>();
const limiter = new RateLimiter(0);
let speed = 0;
const history: number[] = [];
let windowBytes = 0;

function products(): Product[] { return currentCatalog()?.products ?? []; }
function product(id: string): Product | undefined { return products().find((p) => p.id === id); }

export function defaultLibraryDir(): string {
  const base = process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "StudioVoxario", "Connect")
    : path.join(app.getPath("home"), ".local", "share", "StudioVoxario", "Connect");
  return path.join(base, "Library");
}

export function state(): InstallsState {
  const out: InstallsState["installs"] = {};
  for (const [id, r] of Object.entries(installs.get())) {
    const p = product(id);
    out[id] = { ...r, updateAvailable: !!p?.latestVersion && p.latestVersion !== r.version, running: running.has(id) };
  }
  let diskFree: number | undefined;
  try { const dir = settings().libraries[0] || defaultLibraryDir(); fs.mkdirSync(dir, { recursive: true }); const s = fs.statfsSync(dir); diskFree = s.bavail * s.bsize; } catch { /* nic */ }
  return { installs: out, jobs: queueStore.get().jobs, speed, history: [...history], diskFree, defaultLibrary: settings().libraries[0] || defaultLibraryDir() };
}

let emitTimer: NodeJS.Timeout | null = null;
function emit(now = false) {
  const send = () => { emitTimer = null; const s = state(); for (const w of BrowserWindow.getAllWindows()) w.webContents.send("connect:installs", s); };
  if (now) { if (emitTimer) clearTimeout(emitTimer); send(); return; }
  if (!emitTimer) emitTimer = setTimeout(send, 250);
}

// měření rychlosti: každou sekundu vzorek do grafu
setInterval(() => {
  speed = speed * 0.4 + windowBytes * 0.6;
  windowBytes = 0;
  if (active || history.some((v) => v > 0)) { history.push(Math.round(speed)); if (history.length > 60) history.shift(); }
  if (active) emit();
}, 1000).unref();

function setJob(id: string, fn: (j: Job) => void) {
  queueStore.update((q) => { const j = q.jobs.find((x) => x.productId === id); if (j) fn(j); });
  emit();
}

async function fetchManifest(url: string): Promise<VoxManifest> {
  const res = await net.fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`Manifest nedostupný (HTTP ${res.status})`);
  const m = (await res.json()) as VoxManifest;
  if (!m?.version || !Array.isArray(m.files) || !m.exe) throw new Error("Neplatný manifest buildu");
  return m;
}

function ensureWritable(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, `.probe-${process.pid}`);
  fs.writeFileSync(probe, "ok");
  fs.rmSync(probe, { force: true });
}

/** Zařadí instalaci / aktualizaci / opravu do fronty. */
export function enqueue(productId: string, mode: Job["mode"], libraryDir?: string): InstallsState {
  const p = product(productId);
  if (!p || p.build?.kind !== "voxario-manifest" || !p.build.manifestUrl) throw new Error("Tento produkt zatím nejde instalovat přes Connect.");
  const item = libraryNow().items.find((i) => i.productId === productId);
  if (!item?.owned) throw new Error("Produkt není ve vaší knihovně (nebo k němu nemáte přístup).");
  if (running.has(productId)) throw new Error("Hra běží – aktualizace proběhne po jejím ukončení.");
  const rec = installs.get()[productId];
  const dir = rec?.dir ?? path.join(libraryDir || settings().libraries[0] || defaultLibraryDir(), productId);
  ensureWritable(dir);
  queueStore.update((q) => {
    const existing = q.jobs.find((j) => j.productId === productId);
    if (existing) { existing.mode = mode; existing.phase = "queued"; existing.error = undefined; return; }
    q.jobs.push({ productId, mode, version: p.latestVersion ?? "?", dir, totalBytes: p.sizeBytes ?? 0, doneBytes: 0, phase: "queued", addedAt: new Date().toISOString() });
  });
  emit(true);
  void pump();
  return state();
}

/** Spouští úlohy z fronty jednu po druhé. */
async function pump() {
  if (active) return;
  const job = queueStore.get().jobs.find((j) => j.phase === "queued");
  if (!job) return;
  const p = product(job.productId);
  const ctrl = new AbortController();
  active = { productId: job.productId, ctrl };
  limiter.bytesPerSecond = settings().speedLimitKBps * 1024;
  try {
    if (!p?.build?.manifestUrl) throw new Error("Produkt už v katalogu není.");
    const manifestUrl = settings().channels[job.productId] === "beta" && p.build.channels?.beta ? p.build.channels.beta : p.build.manifestUrl;
    const m = await fetchManifest(manifestUrl);
    setJob(job.productId, (j) => { j.version = m.version; j.doneBytes = 0; j.phase = "downloading"; });
    let done = 0;
    const st = await runInstall({
      fetch: (url, init) => net.fetch(url, init as RequestInit) as never,
      productId: job.productId, dir: job.dir, manifestUrl, manifest: m, mode: job.mode, signal: ctrl.signal, limiter,
      concurrency: settings().connections,
      onPlan: (total) => setJob(job.productId, (j) => { j.totalBytes = total; }),
      onPhase: (ph) => setJob(job.productId, (j) => { j.phase = ph; }),
      onBytes: (n) => {
        done += n;
        if (n > 0) windowBytes += n;
        const q = queueStore.get().jobs.find((x) => x.productId === job.productId);
        if (q) { q.doneBytes = Math.max(0, done); emit(); }
      },
    });
    const prev = installs.get()[job.productId];
    installs.update((all) => {
      all[job.productId] = { dir: job.dir, version: st.version, installedAt: st.installedAt, sizeOnDisk: dirSize(job.dir),
                            lastPlayedAt: prev?.lastPlayedAt, playtimeSeconds: prev?.playtimeSeconds ?? 0 };
    });
    queueStore.update((q) => { q.jobs = q.jobs.filter((x) => x.productId !== job.productId); });
    notify("done", p.name);
  } catch (e) {
    const msg = (e as Error).message;
    if (ctrl.signal.aborted) setJob(job.productId, (j) => { if (j.phase !== "queued") j.phase = "paused"; });
    else setJob(job.productId, (j) => { j.phase = "error"; j.error = msg; });
  } finally {
    active = null;
    emit(true);
    void pump();
  }
}

export function pause(id: string) {
  if (active?.productId === id) { setJob(id, (j) => { j.phase = "paused"; }); active.ctrl.abort(); }
  else setJob(id, (j) => { if (j.phase === "queued") j.phase = "paused"; });
  return state();
}
export function resume(id: string) {
  setJob(id, (j) => { if (j.phase === "paused" || j.phase === "error") { j.phase = "queued"; j.error = undefined; } });
  void pump();
  return state();
}
export function cancel(id: string) {
  const job = queueStore.get().jobs.find((j) => j.productId === id);
  if (active?.productId === id) active.ctrl.abort();
  queueStore.update((q) => { q.jobs = q.jobs.filter((j) => j.productId !== id); });
  // zrušená první instalace: smazat rozpracované (aktualizace ponechá nainstalovanou verzi)
  if (job && !installs.get()[id]) setTimeout(() => fs.rmSync(job.dir, { recursive: true, force: true }), 300);
  else if (job) setTimeout(() => fs.rmSync(path.join(job.dir, ".staging"), { recursive: true, force: true }), 300);
  emit(true);
  return state();
}
export function move(id: string, toIndex: number) {
  queueStore.update((q) => {
    const from = q.jobs.findIndex((j) => j.productId === id);
    if (from < 0) return;
    const [j] = q.jobs.splice(from, 1);
    q.jobs.splice(Math.max(0, Math.min(toIndex, q.jobs.length)), 0, j!);
  });
  emit(true);
  return state();
}

export function uninstall(id: string, keepUserData: boolean) {
  if (running.has(id)) throw new Error("Hra běží – nejdřív ji ukončete.");
  const rec = installs.get()[id];
  if (!rec) return state();
  cancel(id);
  removeInstall(rec.dir, keepUserData);
  installs.update((all) => { delete all[id]; });
  emit(true);
  return state();
}

export function openFolder(id: string) {
  const rec = installs.get()[id];
  if (rec) void shell.openPath(rec.dir);
}

/** Spuštění hry: lístek přihlášení (ASHES_LAUNCHER_TICKET), doba hraní, návrat verze při pádu do 20 s. */
export async function launch(id: string, after: "minimize" | "close" | "keep"): Promise<{ ok: boolean; error?: string }> {
  const rec = installs.get()[id];
  if (!rec) return { ok: false, error: "Hra není nainstalovaná." };
  if (running.has(id)) return { ok: true };
  const st = readState(rec.dir);
  if (!st) return { ok: false, error: "Instalace je poškozená – použijte Ověřit soubory." };
  const exe = path.join(rec.dir, st.exe);
  if (!fs.existsSync(exe)) return { ok: false, error: "Chybí spustitelný soubor – použijte Ověřit soubory." };
  const env: Record<string, string> = {};
  const ticket = await gameTicket();
  if (ticket) env.ASHES_LAUNCHER_TICKET = ticket;   // hra si z lístku udělá vlastní relaci (heslo ani token Connectu nedostane)
  const args = id === "ashes-of-eryon" ? ["-ashes-launcher"] : [];
  const verifying = !st.verified && !!st.previous;
  const startedAt = Date.now();
  let child: ChildProcess;
  try {
    child = spawn(exe, args, { cwd: path.dirname(exe), detached: false, stdio: "ignore", env: { ...process.env, ...env } });
  } catch (e) {
    if (verifying && rollbackInstall(rec.dir)) refreshRecord(id);
    return { ok: false, error: `Hru se nepodařilo spustit (${(e as Error).message}).` };
  }
  running.set(id, child);
  installs.update((all) => { all[id]!.lastPlayedAt = new Date().toISOString(); });
  const verifyTimer = verifying ? setTimeout(() => markVerified(rec.dir), VERIFY_SECONDS * 1000) : null;
  child.on("exit", (code) => {
    running.delete(id);
    if (verifyTimer) clearTimeout(verifyTimer);
    const secs = Math.round((Date.now() - startedAt) / 1000);
    installs.update((all) => { if (all[id]) all[id]!.playtimeSeconds += secs; });
    if (verifying) {
      if (code !== 0 && secs < VERIFY_SECONDS) { if (rollbackInstall(rec.dir)) { refreshRecord(id); notify("rollback", product(id)?.name ?? id); } }
      else markVerified(rec.dir);
    } else if (code !== 0 && secs < 5) notify("crash", product(id)?.name ?? id);
    for (const w of BrowserWindow.getAllWindows()) { if (w.isMinimized()) w.restore(); }
    emit(true);
  });
  child.on("error", () => { running.delete(id); emit(true); });
  emit(true);
  for (const w of BrowserWindow.getAllWindows()) {
    if (after === "minimize") w.minimize();
    else if (after === "close") w.hide();
  }
  return { ok: true };
}

function refreshRecord(id: string) {
  const rec = installs.get()[id];
  const st = rec && readState(rec.dir);
  if (rec && st) installs.update((all) => { all[id] = { ...rec, version: st.version, sizeOnDisk: dirSize(rec.dir) }; });
}

function notify(kind: "done" | "rollback" | "crash", name: string) {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("connect:notify", { kind, name });
}

/** Převzetí existující instalace (stávající launcher Ashes, Fáze 7): složka s install.json -> záznam bez stahování. */
export function adopt(id: string, dir: string): boolean {
  const st = readState(dir);
  if (!st?.version || !st.exe || !fs.existsSync(path.join(dir, st.exe))) return false;
  installs.update((all) => { all[id] = { dir, version: st.version, installedAt: st.installedAt ?? new Date().toISOString(), sizeOnDisk: dirSize(dir), playtimeSeconds: 0 }; });
  emit(true);
  return true;
}

export function isRunning(id: string) { return running.has(id); }
export function installsRaw() { return installs.get(); }
export function setInstallRecord(id: string, rec: InstallRecord | null) {
  installs.update((all) => { if (rec) all[id] = rec; else delete all[id]; });
  emit(true);
}
