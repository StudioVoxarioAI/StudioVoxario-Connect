import { EmptyState } from "@connect/ui";
import { Grid2x2, Library as LibraryIcon, List } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const cats = ["all", "games", "software", "installed", "favorites"] as const;

export function Library() {
  const { t } = useTranslation();
  const [cat, setCat] = useState<(typeof cats)[number]>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r border-border/60 bg-surface/40 p-4">
        <h1 className="mb-4 px-2 font-display text-lg font-extrabold tracking-[0.08em]">{t("library.title")}</h1>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`flex w-full items-center justify-between rounded-[var(--radius)] px-3 py-2 text-left font-ui text-[15px] font-semibold ${cat === c ? "bg-primary/10 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"}`}>
            {t(`library.${c}`)} <span className="text-xs text-subtle">0</span>
          </button>
        ))}
      </aside>
      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="mb-6 flex justify-end gap-1">
          <button aria-label={t("library.grid")} onClick={() => setView("grid")} className={`rounded p-2 ${view === "grid" ? "bg-surface-3 text-foreground" : "text-subtle"}`}><Grid2x2 size={16} /></button>
          <button aria-label={t("library.list")} onClick={() => setView("list")} className={`rounded p-2 ${view === "list" ? "bg-surface-3 text-foreground" : "text-subtle"}`}><List size={16} /></button>
        </div>
        <EmptyState icon={<LibraryIcon size={36} />} title={t("library.emptyTitle")} text={t("library.emptyText")} />
      </div>
    </div>
  );
}
