// Fáze 5–6: aplikace a software s vlastním instalátorem (Voxar.app, VoxarioBrowser, Voxario Studio Engine).
// Connect instalátor stáhne (navázání, kontrolní součet), spustí ho a instalaci pozná podle registru Windows
// (klíč Uninstall: verze, složka, odinstalace) nebo podle složky aplikace. Aplikace se pak aktualizují samy
// (selfUpdates) nebo novým instalátorem. VoxarioProtect je modul Voxar.app (bez vlastní instalace).
//
// Zdroje instalátoru:
//   installer  – veřejná URL (GitHub Releases), verze a SHA-256 z versionUrl, pokud popisuje stejný soubor
//   shop-file  – soubor z obchodu webu (soukromé úložiště shop-files, části do 45 MB), jen s platnou licencí;
//                stahuje se jménem uživatele (jeho token), web ověří licenci (shop_can_download + RLS úložiště)
import type { Product } from "@connect/catalog-client";
import { expandEnv, parseRegQuery, splitCommandLine } from "@connect/installer-core";
import { downloadResumable, hashFile, type DownloadCtx } from "@connect/installer-core/node";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { app, net } from "electron";
import { accessToken } from "./auth";
import { api } from "./api";

export interface Detected { dir: string; exe: string; version?: string; uninstall?: string; machine: boolean }

const isWin = process.platform === "win32";

function regQuery(key: string): Promise<Record<string, string> | null> {
  if (!isWin) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile("reg", ["query", key], { windowsHide: true, encoding: "utf8" }, (err, out) => resolve(err ? null : parseRegQuery(out)));
  });
}

/** Je aplikace nainstalovaná? Registr (všechny klíče z katalogu), jinak známá složka + spustitelný soubor. */
export async function detectApp(p: Product): Promise<Detected | null> {
  const b = p.build;
  if (!b?.executable) return null;
  for (const key of b.registryKeys ?? []) {
    const v = await regQuery(key);
    if (!v) continue;
    const dir = v.InstallLocation || (v.DisplayIcon ? path.dirname(v.DisplayIcon.replace(/,\d+$/, "").replace(/"/g, "")) : "");
    if (!dir || !fs.existsSync(path.join(dir, b.executable))) continue;
    return { dir, exe: b.executable, version: v.DisplayVersion || undefined, uninstall: v.QuietUninstallString && b.silentArgs ? v.QuietUninstallString : v.UninstallString, machine: key.toUpperCase().startsWith("HKLM") };
  }
  if (b.installDir) {
    const raw = expandEnv(b.installDir, process.env);
    const dir = raw && !isWin ? raw.replace(/\\/g, "/") : raw;   // katalog píše cesty Windows
    if (dir && fs.existsSync(path.join(dir, b.executable))) return { dir, exe: b.executable, machine: /program ?files/i.test(b.installDir) };
  }
  return null;
}

interface SetupSource { file: string; size?: number; sha256?: string; version?: string; urls: string[]; headers: Record<string, string> }

async function json<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const r = await net.fetch(url, { headers: { accept: "application/json", "cache-control": "no-cache", ...headers } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Kde vzít instalátor a jak ho ověřit. */
/** Nejnovější soubor vydání na GitHubu podle adresy https://github.com/<owner>/<repo>/releases/latest/download/<soubor>. */
async function githubLatestAsset(url: string): Promise<{ url: string; size?: number; sha256?: string; version?: string } | null> {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/latest\/download\/([^/?#]+)$/.exec(url);
  if (!m) return null;
  const rel = await json<{ tag_name?: string; assets?: Array<{ name: string; size: number; digest?: string | null; browser_download_url: string }> }>(
    `https://api.github.com/repos/${m[1]}/${m[2]}/releases/latest`, { accept: "application/vnd.github+json" });
  const a = rel.assets?.find((x) => x.name === decodeURIComponent(m[3]!));
  if (!a) return null;
  const sha = /^sha256:([0-9a-f]{64})$/i.exec(a.digest ?? "")?.[1];
  return { url: a.browser_download_url, size: a.size, sha256: sha?.toLowerCase(), version: rel.tag_name?.replace(/^v/, "") };
}

async function resolveSource(p: Product): Promise<SetupSource> {
  const b = p.build!;
  if (b.kind === "installer") {
    if (!b.installerUrl) throw new Error("Katalog neuvádí instalátor.");
    const file = b.installerUrl.split("/").pop() || `${p.id}-setup.exe`;
    // Přesná velikost, SHA-256 a verze z GitHub Releases (adresa …/releases/latest/download/<soubor>). Metadata
    // z versionUrl (desktop-version.json na webu) se k ověření nepoužívají: web je neaktualizuje s každým vydáním
    // a starý kontrolní součet by správně stažený instalátor odmítl („poškozený“).
    const gh = await githubLatestAsset(b.installerUrl).catch(() => null);
    return { file, urls: [gh?.url ?? b.installerUrl], headers: {}, size: gh?.size, sha256: gh?.sha256, version: gh?.version };
  }
  if (b.kind === "shop-file") {
    const token = await accessToken();
    if (!token) throw new Error("Pro stažení se přihlaste.");
    const a = api();
    const headers = { apikey: a.publishableKey, authorization: `Bearer ${token}` };
    const rows = await json<Array<{ id: string; file_name: string | null; file_size: number | null; file_sha256: string | null; file_parts: string[] | null; file_version: string | null }>>(
      `${a.supabaseUrl}/rest/v1/shop_items?select=id,file_name,file_size,file_sha256,file_parts,file_version&product_key=eq.${encodeURIComponent(p.shopKey ?? p.id)}`, headers);
    const it = rows[0];
    if (!it?.file_parts?.length) throw new Error("Instalátor zatím není v obchodě nahraný.");
    const can = await net.fetch(`${a.supabaseUrl}/rest/v1/rpc/shop_can_download`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ p_item: it.id }) });
    if (can.ok && (await can.json()) === false) throw new Error("Licence nezahrnuje tuto verzi (aktualizace vypršely) – prodlužte je Upgrade passem na webu.");
    return {
      file: it.file_name || `${p.id}-setup.exe`, size: it.file_size ?? undefined, sha256: it.file_sha256 ?? undefined, version: it.file_version ?? undefined, headers,
      urls: it.file_parts.map((x) => `${a.supabaseUrl}/storage/v1/object/authenticated/shop-files/${x.split("/").map(encodeURIComponent).join("/")}`),
    };
  }
  throw new Error("Tento produkt se neinstaluje samostatně.");
}

export interface SetupProgress { onPlan: (total: number) => void; onBytes: (n: number) => void; onPhase: (ph: "downloading" | "verifying" | "installing") => void }

/** Stáhne instalátor (navazuje po přerušení) a ověří ho. Vrací cestu k souboru a verzi. */
export async function downloadSetup(p: Product, ctx: Omit<DownloadCtx, "fetch" | "onBytes">, prog: SetupProgress): Promise<{ file: string; version?: string }> {
  const src = await resolveSource(p);
  const dir = path.join(app.getPath("userData"), "setups", p.id);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, path.basename(src.file));
  prog.onPlan(src.size ?? p.sizeBytes ?? 0);
  prog.onPhase("downloading");
  const fetcher: DownloadCtx["fetch"] = (url, init) => net.fetch(url, { ...(init as RequestInit), headers: { ...((init?.headers as Record<string, string>) ?? {}), ...src.headers } }) as never;
  const dctx: DownloadCtx = { ...ctx, fetch: fetcher, onBytes: prog.onBytes };
  if (src.urls.length === 1) {
    await downloadResumable(src.urls[0]!, target + ".partial", src.size, dctx);
    fs.renameSync(target + ".partial", target);
  } else {
    const pieces: string[] = [];
    for (let i = 0; i < src.urls.length; i++) {
      const piece = `${target}.part${i}`;
      if (!fs.existsSync(piece + ".ok")) { await downloadResumable(src.urls[i]!, piece, undefined, dctx); fs.writeFileSync(piece + ".ok", ""); }
      pieces.push(piece);
    }
    const out = fs.createWriteStream(target);
    for (const x of pieces) await pipeline(fs.createReadStream(x), out, { end: false });
    await new Promise<void>((r, j) => out.end((e?: Error | null) => (e ? j(e) : r())));
    for (const x of pieces) { fs.rmSync(x, { force: true }); fs.rmSync(x + ".ok", { force: true }); }
  }
  prog.onPhase("verifying");
  if (src.size !== undefined && fs.statSync(target).size !== src.size) { fs.rmSync(target, { force: true }); throw new Error("Instalátor se nestáhl celý – zkuste to znovu."); }
  if (src.sha256 && (await hashFile(target)) !== src.sha256.toLowerCase()) { fs.rmSync(target, { force: true }); throw new Error("Instalátor se stáhl poškozený (kontrolní součet nesouhlasí) – zkuste to znovu."); }
  return { file: target, version: src.version };
}

/** Spustí program a počká na konec; se zvýšenými právy přes UAC (PowerShell Start-Process -Verb RunAs). */
function runAndWait(file: string, args: string[], elevate: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    let child;
    if (elevate) {
      const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
      const argList = args.length ? ` -ArgumentList ${args.map((a) => q(a)).join(",")}` : "";
      const ps = `try { $p = Start-Process -FilePath ${q(file)}${argList} -Verb RunAs -Wait -PassThru; exit $p.ExitCode } catch { exit 1223 }`;
      child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true, stdio: "ignore" });
    } else {
      child = spawn(file, args, { stdio: "ignore", windowsHide: false });
    }
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

/** Spustí stažený instalátor a ověří, že se aplikace nainstalovala. */
export async function runSetup(p: Product, file: string): Promise<Detected> {
  if (!isWin) throw new Error("Instalátor aplikace lze spustit jen ve Windows.");
  const b = p.build!;
  const code = await runAndWait(file, b.silentArgs ?? [], !!b.requiresElevation);
  if (code === 1223) throw new Error("Instalace byla zrušena (oprávnění správce nebylo uděleno).");
  // vlastní instalátor Voxar.app zapisuje registr asynchronně – chvíli počkat
  for (let i = 0; i < 10; i++) {
    const d = await detectApp(p);
    if (d) { fs.rmSync(file, { force: true }); return d; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(code ? `Instalátor skončil s chybou (${code}).` : "Instalace nebyla dokončena – aplikace se nenašla.");
}

/** Odinstalace odinstalátorem aplikace (z registru). Vrací true, když aplikace zmizela. */
export async function uninstallApp(p: Product, d: { uninstall?: string; machine: boolean }): Promise<boolean> {
  if (!isWin) throw new Error("Odinstalace aplikace je jen ve Windows.");
  const cmd = d.uninstall ? splitCommandLine(d.uninstall) : null;
  if (!cmd) throw new Error("Odinstalátor nebyl nalezen – odinstalujte aplikaci v Nastavení Windows.");
  await runAndWait(cmd.file, cmd.args, d.machine);
  for (let i = 0; i < 10; i++) {
    if (!(await detectApp(p))) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
