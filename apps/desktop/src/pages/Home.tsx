import { Badge, EmptyState, SectionTitle, Skeleton } from "@connect/ui";
import { Gamepad2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Page } from "../components/Page";

export function Home() {
  const { t } = useTranslation();
  return (
    <Page>
      <section className="relative mb-9 overflow-hidden rounded-[calc(var(--radius)*1.6)] border border-border bg-surface">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 right-40 h-[380px] w-[380px] rounded-full bg-violet/20 blur-3xl" />
        <div className="relative flex min-h-[300px] flex-col justify-end gap-4 p-10">
          <div className="w-fit"><Badge tone="primary">{t("home.eyebrow")}</Badge></div>
          <h1 className="max-w-3xl font-display text-[34px] font-extrabold leading-tight tracking-[0.04em]">{t("home.title")}</h1>
          <p className="max-w-2xl text-[15px] text-muted">{t("home.lead")}</p>
          <div className="flex items-center gap-2 text-sm text-subtle"><RefreshCw size={14} className="animate-spin text-primary" /> {t("home.catalogPending")}</div>
        </div>
      </section>

      <SectionTitle>{t("home.continue")}</SectionTitle>
      <div className="mb-9">
        <EmptyState icon={<Gamepad2 size={34} />} title={t("home.emptyContinue")} text={t("home.emptyContinueText")} />
      </div>

      <SectionTitle>{t("home.featured")}</SectionTitle>
      <div className="mb-9 grid grid-cols-2 gap-5 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[2/3] w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>

      <SectionTitle>{t("home.news")}</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    </Page>
  );
}
