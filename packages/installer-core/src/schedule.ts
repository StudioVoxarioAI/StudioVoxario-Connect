// Plánovač stahování: okno od–do (HH:MM), může přecházet přes půlnoc.
export interface Schedule { enabled: boolean; from: string; to: string }

const toMin = (x: string) => { const [h, m] = x.split(":").map(Number); return ((h ?? 0) % 24) * 60 + ((m ?? 0) % 60); };

export function inSchedule(s: Schedule, d: Date): boolean {
  if (!s.enabled) return true;
  const m = d.getHours() * 60 + d.getMinutes();
  const a = toMin(s.from), b = toMin(s.to);
  if (a === b) return true;
  return a < b ? m >= a && m < b : m >= a || m < b;
}
