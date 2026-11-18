import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatBytes, useInstalls } from "../lib/installs";

// Stav stahování v horní liště: aktivní úloha s průběhem a rychlostí
export function DownloadIndicator({ fallback }: { fallback: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { data } = useInstalls();
  const job = data?.jobs.find((j) => j.phase === "downloading" || j.phase === "verifying" || j.phase === "installing") ?? data?.jobs[0];
  if (!job) return <>{fallback}</>;
  const pct = job.totalBytes ? Math.min(100, (job.doneBytes / job.totalBytes) * 100) : 0;
  return (
    <Link to="/downloads" className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-1.5 text-sm hover:bg-surface-2" title={t("nav.downloads")}>
      <Download size={17} className="text-primary" />
      <div className="w-36">
        <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{t(`job.${job.phase}`)}</span><span className="font-mono text-subtle">{formatBytes(data?.speed ?? 0, i18n.language)}/s</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      </div>
      {data!.jobs.length > 1 && <span className="rounded-full bg-primary/20 px-1.5 text-xs text-primary">{data!.jobs.length}</span>}
    </Link>
  );
}
