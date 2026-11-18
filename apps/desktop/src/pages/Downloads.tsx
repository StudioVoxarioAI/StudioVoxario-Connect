import { EmptyState } from "@connect/ui";
import { DownloadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Page } from "../components/Page";

export function Downloads() {
  const { t } = useTranslation();
  const bars = Array.from({ length: 48 }, (_, i) => 6 + Math.round(6 * Math.sin(i / 4) + 6));
  return (
    <Page title={t("downloads.title")}>
      <div className="mb-7 rounded-[calc(var(--radius)*1.4)] border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-display text-[11px] uppercase tracking-[0.2em] text-subtle">{t("downloads.speed")}</span>
          <span className="font-mono text-muted">0 B/s</span>
        </div>
        <div className="flex h-20 items-end gap-1 opacity-30">
          {bars.map((h, i) => <div key={i} className="flex-1 rounded-t bg-primary/40" style={{ height: `${h * 4}%` }} />)}
        </div>
      </div>
      <EmptyState icon={<DownloadCloud size={36} />} title={t("downloads.emptyTitle")} text={t("downloads.emptyText")} />
    </Page>
  );
}
