import type { Product } from "@connect/catalog-client";
import { Badge, Button, EmptyState, SectionTitle } from "@connect/ui";
import { ArrowRight, Download, Gamepad2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { InstallPanel } from "../components/InstallPanel";
import { OfflineNotice } from "../components/OfflineNotice";
import { ProductCard, ProductCardSkeleton, StatusBadge } from "../components/ProductCard";
import { formatPrice, useCatalog } from "../lib/catalog";
import { formatBytes, useInstalls } from "../lib/installs";

// Deck: velký holo panel vybraného produktu + výběr vpravo (01–05) jako menu ve hře; žádný automatický kolotoč.
function Deck({ items }: { items: Product[] }) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const p = items[i] ?? items[0];
  if (!p) return <div className="hud mb-8 h-[420px] animate-pulse" />;
  return (
    <section className="mb-9 grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="hud hud-brackets relative h-[420px] overflow-hidden [--ch:22px]">
        {items.map((x, k) => (
          <img key={x.id} src={x.media.hero} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === i ? "opacity-100" : "opacity-0"}`} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        <div className="hud-scan" />
        <div className="absolute right-12 top-4 font-mono text-[11px] tracking-[0.3em] text-primary/80">
          {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
        </div>
        <div className="relative flex h-full max-w-xl flex-col justify-end gap-3 p-9">
          <div className="hud-label">{t("home.featured")}</div>
          <div className="flex items-center gap-4">
            <img src={p.media.icon} alt="" className="h-14 w-14 border border-primary/50 bg-background/70 object-cover p-1" />
            <h1 className="font-display text-[40px] font-extrabold uppercase leading-none tracking-[0.06em] text-white">{p.name}</h1>
          </div>
          {p.tagline && <p className="max-w-lg text-[15px] text-white/80">{p.tagline}</p>}
          <div className="flex items-center gap-2"><StatusBadge p={p} />{p.latestVersion && <Badge>{t("home.version", { v: p.latestVersion })}</Badge>}</div>
          <div className="mt-2 flex items-center gap-4">
            <Button size="lg" onClick={() => nav(`/store/${p.id}`)}>{t("home.show")}<ArrowRight size={18} /></Button>
            <span className="font-display text-xl font-bold text-white">{formatPrice(p, t, i18n.language)}</span>
          </div>
        </div>
      </div>
      <ol className="hud flex flex-col p-2" aria-label={t("home.featured")}>
        {items.map((x, k) => (
          <li key={x.id} className="flex-1">
            <button onClick={() => setI(k)} aria-current={k === i}
              className={`group relative flex h-full w-full items-center gap-3 px-3 py-2 text-left transition ${k === i ? "bg-primary/10" : "hover:bg-surface-2"}`}>
              <span aria-hidden className={`absolute inset-y-2 left-0 w-[3px] ${k === i ? "bg-primary shadow-[0_0_10px_hsl(var(--primary))]" : "bg-transparent"}`} />
              <span className={`font-mono text-xs ${k === i ? "text-primary" : "text-subtle"}`}>{String(k + 1).padStart(2, "0")}</span>
              <img src={x.media.icon} alt="" className="h-10 w-10 border border-border object-cover" />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-display text-sm font-bold uppercase tracking-[0.06em] ${k === i ? "text-foreground" : "text-muted group-hover:text-foreground"}`}>{x.name}</span>
                <span className="block truncate text-xs text-subtle">{x.type === "game" ? (x.genres ?? x.tags).slice(0, 2).join(" · ") : t(`category.${x.category ?? "other"}`)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Home() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useCatalog();
  const products = useMemo(() => data?.products ?? [], [data]);
  const featured = useMemo(() => {
    const f = products.filter((p) => p.featured).sort((a, b) => a.featured! - b.featured!);
    return (f.length ? f : products).slice(0, 5);
  }, [products]);
  const updates = useMemo(() => products.filter((p) => p.latestVersion).slice(0, 4), [products]);
  const sales = products.filter((p) => p.pricing.discountPercent);
  const { data: inst } = useInstalls();
  const recent = useMemo(() => products.filter((p) => inst?.installs[p.id])
    .sort((a, b) => (inst!.installs[b.id]!.lastPlayedAt ?? inst!.installs[b.id]!.installedAt).localeCompare(inst!.installs[a.id]!.lastPlayedAt ?? inst!.installs[a.id]!.installedAt)).slice(0, 3), [products, inst]);
  const job = inst?.jobs[0];
  const jobName = job ? products.find((p) => p.id === job.productId)?.name : undefined;
  return (
    <div className="mx-auto w-full max-w-[1440px] px-8 py-7">
      <OfflineNotice />
      <Deck items={featured} />

      <div className="mb-9 grid gap-4 xl:grid-cols-[1fr_1fr_320px]">
        <section className="hud p-5 xl:col-span-2">
          <SectionTitle>{t("home.continue")}</SectionTitle>
          {recent.length ? (
            <div className="space-y-2">
              {recent.map((p) => {
                const r = inst!.installs[p.id]!;
                return (
                  <div key={p.id} className="flex items-center gap-4 border border-border/60 bg-background/40 p-2 pr-3">
                    <Link to={`/library?select=${p.id}`} className="block h-14 w-28 shrink-0 overflow-hidden"><img src={p.media.hero} alt="" className="h-full w-full object-cover" /></Link>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display font-bold uppercase tracking-[0.05em]">{p.name}</div>
                      <div className="font-mono text-[11px] text-subtle">
                        v{r.version} · {t("home.playtime", { h: Math.floor((r.playtimeSeconds ?? 0) / 3600), m: Math.floor(((r.playtimeSeconds ?? 0) % 3600) / 60) })}
                      </div>
                    </div>
                    <div className="w-44"><InstallPanel p={p} /></div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon={<Gamepad2 size={30} />} title={t("home.emptyContinue")} text={t("home.emptyContinueText")} />}
        </section>
        <section className="hud flex flex-col p-5">
          <SectionTitle>{t("nav.downloads")}</SectionTitle>
          {job ? (
            <Link to="/downloads" className="block">
              <div className="mb-1 flex justify-between text-sm"><span className="truncate font-display font-bold uppercase">{jobName ?? job.productId}</span><span className="font-mono text-primary">{job.totalBytes ? Math.round((job.doneBytes / job.totalBytes) * 100) : 0} %</span></div>
              <div className="h-1.5 bg-surface-3"><div className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" style={{ width: `${job.totalBytes ? Math.min(100, (job.doneBytes / job.totalBytes) * 100) : 0}%` }} /></div>
              <div className="mt-1 font-mono text-[11px] text-subtle">{t(`job.${job.phase}`)} · {formatBytes(inst?.speed ?? 0, i18n.language)}/s · {t("home.queue", { count: inst?.jobs.length ?? 0 })}</div>
            </Link>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center text-sm text-subtle"><Download size={24} className="text-primary/60" />{t("top.noDownloads")}</div>
          )}
        </section>
      </div>

      <SectionTitle action={<Link to="/store" className="hud-label hover:text-foreground">{t("home.all")}</Link>}>{t("home.recommended")}</SectionTitle>
      <div className="mb-9 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? Array.from({ length: 3 }, (_, i) => <ProductCardSkeleton key={i} />) : products.slice(0, 6).map((p) => <ProductCard key={p.id} p={p} />)}
      </div>

      {sales.length > 0 && (<>
        <SectionTitle>{t("home.sales")}</SectionTitle>
        <div className="mb-9 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{sales.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </>)}

      <SectionTitle>{t("home.news")}</SectionTitle>
      <ol className="hud relative p-5">
        <span aria-hidden className="absolute bottom-6 left-[29px] top-6 w-px bg-gradient-to-b from-primary/60 to-transparent" />
        {updates.map((p) => (
          <li key={p.id}>
            <Link to={`/store/${p.id}`} className="group relative flex items-center gap-4 py-2.5 pl-8">
              <span aria-hidden className="absolute left-[5px] h-2.5 w-2.5 rotate-45 border border-primary bg-background group-hover:bg-primary" />
              <span className="hud-btn [--ch:5px] w-24 shrink-0 bg-primary/15 px-2 py-0.5 text-center font-mono text-xs text-primary"><Sparkles size={11} className="mr-1 inline" />{p.latestVersion}</span>
              <span className="font-display font-bold uppercase tracking-[0.05em] group-hover:text-primary">{p.name}</span>
              <span className="hidden truncate text-sm text-muted md:inline">{p.tagline}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
