// Čisté pomocné funkce pro aplikace s vlastním instalátorem (Windows): výstup `reg query`, proměnné prostředí,
// příkazový řádek odinstalátoru, porovnání verzí. Bez Node API – testuje se kdekoli.

/** `reg query <klíč>` -> { Název: hodnota } (jen přímé hodnoty klíče, ne podklíče). */
export function parseRegQuery(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s{2,}(.+?)\s{2,}(REG_[A-Z_]+)\s{2,}(.*)$/.exec(line) ?? /^\s{2,}(.+?)\s{2,}(REG_[A-Z_]+)\s*$/.exec(line);
    if (!m) continue;
    const [, name, type, raw = ""] = m;
    out[name!.trim()] = type === "REG_DWORD" && /^0x[0-9a-f]+$/i.test(raw.trim()) ? String(parseInt(raw.trim(), 16)) : raw.trim();
  }
  return out;
}

/** %LOCALAPPDATA%\x -> skutečná cesta; neznámá proměnná -> null (cesta se pak nepoužije). */
export function expandEnv(p: string, env: Record<string, string | undefined>): string | null {
  let missing = false;
  const lower = Object.fromEntries(Object.entries(env).map(([k, v]) => [k.toLowerCase(), v]));
  const s = p.replace(/%([^%]+)%/g, (_, k: string) => { const v = lower[k.toLowerCase()]; if (!v) missing = true; return v ?? ""; });
  return missing ? null : s;
}

/** Rozdělí příkazový řádek odinstalátoru na program a argumenty ("C:\a b\u.exe" --x /S). */
export function splitCommandLine(cmd: string): { file: string; args: string[] } | null {
  const parts: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd.trim()))) parts.push(m[1] ?? m[2]!);
  if (!parts.length) return null;
  return { file: parts[0]!, args: parts.slice(1) };
}

/** Porovnání verzí 1.10.0 vs 1.9.2 (číselně po částech); -1 / 0 / 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(/[.+-]/), pb = b.replace(/^v/i, "").split(/[.+-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "0", y = pb[i] ?? "0";
    const nx = Number(x), ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) { if (nx !== ny) return nx < ny ? -1 : 1; }
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
