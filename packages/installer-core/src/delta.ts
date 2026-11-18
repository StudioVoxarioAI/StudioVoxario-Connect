// Delta aktualizace (SPEC 6.8): z indexu nainstalovaných souborů a nového manifestu spočítá, co stáhnout,
// co ponechat a co smazat. Porovnává se SHA-256 (stejná logika jako launcher Ashes of Eryon: unityGame.cjs).
export interface ManifestFile { path: string; size: number; sha256: string; url: string; parts?: number }
export interface InstalledFile { path: string; size: number; sha256: string }

export interface UpdatePlan {
  download: ManifestFile[];
  keep: string[];
  remove: string[];
  downloadBytes: number;
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");

export function planUpdate(installed: InstalledFile[], next: ManifestFile[]): UpdatePlan {
  const have = new Map(installed.map((f) => [norm(f.path).toLowerCase(), f]));
  const wanted = new Set<string>();
  const download: ManifestFile[] = [];
  const keep: string[] = [];
  for (const f of next) {
    const key = norm(f.path).toLowerCase();
    wanted.add(key);
    const cur = have.get(key);
    if (cur && cur.sha256.toLowerCase() === f.sha256.toLowerCase() && cur.size === f.size) keep.push(norm(f.path));
    else download.push(f);
  }
  const remove = installed.filter((f) => !wanted.has(norm(f.path).toLowerCase())).map((f) => norm(f.path));
  return { download, keep, remove, downloadBytes: download.reduce((s, f) => s + f.size, 0) };
}

/** Bezpečná cesta souboru z manifestu: žádné absolutní cesty ani ".." (soubor nesmí ven z instalační složky). */
export function isSafeRelativePath(p: string): boolean {
  const n = norm(p);
  if (!n || n.startsWith("/") || /^[a-zA-Z]:/.test(n)) return false;
  return !n.split("/").some((seg) => seg === ".." || seg === "");
}
