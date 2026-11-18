import { Badge, Skeleton } from "@connect/ui";
import { Info, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "../components/Page";

type Tab = "all" | "games" | "software";

export function Store() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("all");
  const tabs: Tab[] = ["all", "games", "software"];
  return (
    <Page title={t("store.title")}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex rounded-[var(--radius)] border border-border bg-surface p-1">
          {tabs.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`rounded-[calc(var(--radius)-3px)] px-4 py-1.5 font-ui text-[15px] font-semibold transition ${tab === k ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}>
              {t(`store.${k}`)}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-sm text-muted hover:text-foreground">
          <SlidersHorizontal size={15} /> {t("store.filters")}
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm text-subtle">
          {t("store.sort")}: <Badge>{t("store.sortNewest")}</Badge>
        </div>
      </div>
      <div className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted">
        <Info size={16} className="mt-0.5 shrink-0 text-primary" /> {t("store.pending")}
      </div>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="group space-y-3">
            <Skeleton className="aspect-[2/3] w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="flex gap-2"><Skeleton className="h-5 w-14" /><Skeleton className="h-5 w-10" /></div>
          </div>
        ))}
      </div>
    </Page>
  );
}
