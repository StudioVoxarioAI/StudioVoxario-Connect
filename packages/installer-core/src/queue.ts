// Fronta stahování (SPEC 6.4): pořadí, pauza / obnovení, přesun, odebrání – čistý stav bez I/O.
export type JobPhase = "queued" | "downloading" | "paused" | "installing" | "done" | "error";
export interface DownloadJob {
  productId: string;
  version: string;
  phase: JobPhase;
  totalBytes: number;
  doneBytes: number;
  error?: string;
}

export class DownloadQueue {
  private jobs: DownloadJob[] = [];

  list(): readonly DownloadJob[] { return this.jobs; }

  add(job: Omit<DownloadJob, "phase" | "doneBytes">): void {
    if (this.jobs.some((j) => j.productId === job.productId && j.phase !== "done")) return;
    this.jobs.push({ ...job, phase: "queued", doneBytes: 0 });
  }

  /** Aktivní úloha = první nepozastavená nedokončená. */
  active(): DownloadJob | undefined {
    return this.jobs.find((j) => j.phase === "queued" || j.phase === "downloading" || j.phase === "installing");
  }

  pause(id: string): void { this.update(id, (j) => (j.phase === "downloading" || j.phase === "queued" ? { ...j, phase: "paused" } : j)); }
  resume(id: string): void { this.update(id, (j) => (j.phase === "paused" ? { ...j, phase: "queued" } : j)); }
  remove(id: string): void { this.jobs = this.jobs.filter((j) => j.productId !== id); }

  move(id: string, toIndex: number): void {
    const from = this.jobs.findIndex((j) => j.productId === id);
    if (from < 0) return;
    const [job] = this.jobs.splice(from, 1);
    this.jobs.splice(Math.max(0, Math.min(toIndex, this.jobs.length)), 0, job!);
  }

  progress(id: string, doneBytes: number): void {
    this.update(id, (j) => ({ ...j, phase: "downloading", doneBytes: Math.min(doneBytes, j.totalBytes) }));
  }

  private update(id: string, fn: (j: DownloadJob) => DownloadJob): void {
    this.jobs = this.jobs.map((j) => (j.productId === id ? fn(j) : j));
  }
}

export function formatBytes(n: number, locale = "cs-CZ"): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString(locale, { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}

export function etaSeconds(remainingBytes: number, bytesPerSecond: number): number | null {
  return bytesPerSecond > 0 ? Math.ceil(remainingBytes / bytesPerSecond) : null;
}
