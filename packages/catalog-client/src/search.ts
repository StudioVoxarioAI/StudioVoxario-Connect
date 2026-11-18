// Vyhledávání nad lokálním katalogem (SPEC 6.5): bez diakritiky, s tolerancí překlepů, se zvýrazněním shody v názvu.
import type { Product } from "./schema";

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Damerau-Levenshtein omezený na max (rychlé zahození delších vzdáleností). */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

export interface SearchHit { product: Product; score: number; nameMatch?: [number, number] }

const words = (s: string) => fold(s).split(/[^a-z0-9.]+/).filter(Boolean);

export function searchProducts(products: Product[], query: string): SearchHit[] {
  const q = words(query);
  if (!q.length) return [];
  const hits: SearchHit[] = [];
  for (const p of products) {
    const name = fold(p.name);
    const nameWords = words(p.name);
    const tagWords = p.tags.flatMap(words).concat((p.genres ?? []).flatMap(words), p.category ? [p.category] : []);
    const textWords = words(`${p.tagline ?? ""} ${p.description}`);
    let score = 0;
    let all = true;
    for (const t of q) {
      let best = 0;
      if (name.includes(t)) best = name.startsWith(t) ? 100 : 80;
      for (const w of nameWords) {
        if (w.startsWith(t)) best = Math.max(best, 90);
        else if (t.length >= 4 && editDistance(t, w.slice(0, t.length + 1)) <= (t.length >= 7 ? 2 : 1)) best = Math.max(best, 60);
      }
      for (const w of tagWords) {
        if (w.startsWith(t)) best = Math.max(best, 50);
        else if (t.length >= 4 && editDistance(t, w) <= 1) best = Math.max(best, 35);
      }
      if (!best && textWords.some((w) => w.startsWith(t))) best = 20;
      if (!best) { all = false; break; }
      score += best;
    }
    if (!all) continue;
    const i = name.indexOf(q[0]!);
    hits.push({ product: p, score, nameMatch: i >= 0 ? [i, i + q[0]!.length] : undefined });
  }
  return hits.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "cs"));
}
