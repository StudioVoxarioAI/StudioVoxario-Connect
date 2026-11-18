import { Badge, EmptyState } from "@connect/ui";
import { ArrowDown, ArrowUp, DownloadCloud, Pause, Play, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Page } from "../components/Page";
import { bridge } from "../lib/bridge";
import { useCatalog } from "../lib/catalog";
import { formatBytes, formatDuration, useInstalls } from "../lib/installs";

export function Downloads() {
  const { t, i18n } = useTranslation();
  const { data } = useInstalls();
  const { data: cat } = useCatalog();
  const jobs = data?.jobs ?? [];
  const hist = data?.history ?? [];
  const max = Math.max(1, ...hist);
  const bars = Array.from({ length: 60 }, (_, i) => hist[hist.length - 60 + i] ?? 0);
  const name = (id: string) => cat?.products.find((p) => p.id === id);
  return (
    <Page title={t("downloads.title")}>
      <div className="mb-7 rounded-[calc(var(--radius)*1.4)] border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-display text-[11px] uppercase tracking-[0.2em] text-subtle">{t("downloads.speed")}</span>
          <span className="font-mono text-primary">{formatBytes(data?.speed ?? 0, i18n.language)}/s</span>
        </div>
        <div className="flex h-24 items-end gap-[3px]" aria-hidden>
          {bars.map((v, i) => <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary" style={{ height: `${Math.max(2, (v / max) * 100)}%`, opacity: v ? 1 : 0.15 }} />)}
        </div>
        {data?.diskFree !== undefined && <div className="mt-3 text-xs text-subtle">{t("downloads.diskFree", { v: formatBytes(data.diskFree, i18n.language) })}</div>}
      </div>
      {!jobs.length ? (
        <EmptyState icon={<DownloadCloud size={36} />} title={t("downloads.emptyTitle")} text={t("downloads.emptyText2")} action={<Link to="/library" className="text-primary hover:underline">{t("nav.library")}</Link>} />
      ) : (
        <div className="space-y-3">
          {jobs.map((j, i) => {
            const p = name(j.productId);
            const pct = j.totalBytes ? Math.min(100, (j.doneBytes / j.totalBytes) * 100) : 0;
            const activeJob = j.phase === "downloading" || j.phase === "verifying" || j.phase === "installing";
            const eta = activeJob && data?.speed ? (j.totalBytes - j.doneBytes) / data.speed : NaN;
            return (
              <div key={j.productId} className={`flex items-center gap-4 rounded-[calc(var(--radius)*1.2)] border p-4 ${activeJob ? "border-primary/40 bg-primary/5" : "border-border bg-surface"}`}>
                {p && <img src={p.media.icon} alt="" className="h-14 w-14 rounded-[var(--radius)] object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate font-ui text-[15px] font-bold">{p?.name ?? j.productId}</span>
                    <Badge tone={j.phase === "error" ? "accent" : activeJob ? "primary" : "neutral"}>{t(`job.${j.phase}`)}</Badge>
                    <span className="text-xs text-subtle">{t(`job.mode_${j.mode}`)} · {j.version}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
                  <div className="mt-1.5 flex justify-between text-xs text-subtle">
                    <span>{formatBytes(j.doneBytes, i18n.language)} / {formatBytes(j.totalBytes, i18n.language)} ({pct.toFixed(0)} %)</span>
                    {j.error ? <span className="text-danger">{j.error}</span> : activeJob ? <span>{t("downloads.eta", { v: formatDuration(eta, t) })}</span> : null}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button aria-label={t("downloads.up")} disabled={i === 0} onClick={() => bridge.installs.move(j.productId, i - 1)} className="rounded p-2 text-subtle hover:bg-surface-2 hover:text-foreground disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button aria-label={t("downloads.down")} disabled={i === jobs.length - 1} onClick={() => bridge.installs.move(j.productId, i + 1)} className="rounded p-2 text-subtle hover:bg-surface-2 hover:text-foreground disabled:opacity-30"><ArrowDown size={16} /></button>
                  {j.phase === "error" ? (
                    <button aria-label={t("job.retry")} onClick={() => bridge.installs.resume(j.productId)} className="rounded p-2 text-subtle hover:bg-surface-2 hover:text-foreground"><RotateCcw size={16} /></button>
                  ) : j.phase === "paused" ? (
                    <button aria-label={t("job.resume")} onClick={() => bridge.installs.resume(j.productId)} className="rounded p-2 text-subtle hover:bg-surface-2 hover:text-foreground"><Play size={16} /></button>
                  ) : (
                    <button aria-label={t("job.pause")} onClick={() => bridge.installs.pause(j.productId)} className="rounded p-2 text-subtle hover:bg-surface-2 hover:text-foreground"><Pause size={16} /></button>
                  )}
                  <button aria-label={t("job.cancel")} onClick={() => bridge.installs.cancel(j.productId)} className="rounded p-2 text-subtle hover:bg-surface-2 hover:text-danger"><X size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
