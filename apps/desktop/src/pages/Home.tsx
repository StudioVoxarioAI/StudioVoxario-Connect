import type { Product } from "@connect/catalog-client";
import { Badge, Button, EmptyState, SectionTitle } from "@connect/ui";
import { ArrowRight, Gamepad2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { OfflineNotice } from "../components/OfflineNotice";
import { Page } from "../components/Page";
import { ProductCard, ProductCardSkeleton, StatusBadge } from "../components/ProductCard";
import { formatPrice, useCatalog } from "../lib/catalog";
import { useInstalls } from "../lib/installs";
import { InstallPanel } from "../components/InstallPanel";

function Hero({ items }: { items: Product[] }) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % items.length), 8000);
    return () => clearInterval(id);
  }, [items.length]);
  const p = items[i % Math.max(items.length, 1)];
  if (!p) return <div className="mb-9 h-[360px] animate-pulse rounded-[calc(var(--radius)*1.6)] bg-surface" />;
  return (
    <section className="relative mb-9 h-[380px] overflow-hidden rounded-[calc(var(--radius)*1.6)] border border-border shadow-card">
      {items.map((x, k) => (
        <img key={x.id} src={x.media.hero} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === i ? "opacity-100" : "opacity-0"}`} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
      <div className="relative flex h-full max-w-2xl flex-col justify-end gap-3 p-10">
        <div className="flex gap-2"><Badge tone="primary">{t("home.featured")}</Badge><StatusBadge p={p} /></div>
        <h1 className="font-display text-[38px] font-extrabold leading-tight tracking-[0.03em] text-white">{p.name}</h1>
        {p.tagline && <p className="text-[15px] text-white/80">{p.tagline}</p>}
        <div className="mt-2 flex items-center gap-4">
          <Button size="lg" onClick={() => nav(`/store/${p.id}`)}>{t("home.show")}<ArrowRight size={18} /></Button>
          <span className="font-ui text-lg font-bold text-white">{formatPrice(p, t, i18n.language)}</span>
        </div>
      </div>
      <div className="absolute bottom-5 right-6 flex gap-2">
        {items.map((x, k) => (
          <button key={x.id} aria-label={x.name} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-8 bg-primary" : "w-3 bg-white/40 hover:bg-white/70"}`} />
        ))}
      </div>
    </section>
  );
}

export function Home() {
  const { t } = useTranslation();
  const { data, isLoading } = useCatalog();
  const products = useMemo(() => data?.products ?? [], [data]);
  const featured = useMemo(() => products.filter((p) => p.featured).sort((a, b) => a.featured! - b.featured!), [products]);
  const updates = useMemo(() => products.filter((p) => p.latestVersion).slice(0, 3), [products]);
  const sales = products.filter((p) => p.pricing.discountPercent);
  const { data: inst } = useInstalls();
  const recent = useMemo(() => products.filter((p) => inst?.installs[p.id])
    .sort((a, b) => (inst!.installs[b.id]!.lastPlayedAt ?? inst!.installs[b.id]!.installedAt).localeCompare(inst!.installs[a.id]!.lastPlayedAt ?? inst!.installs[a.id]!.installedAt)).slice(0, 3), [products, inst]);
  return (
    <Page>
      <OfflineNotice />
      <Hero items={featured.slice(0, 5)} />

      <SectionTitle>{t("home.continue")}</SectionTitle>
      <div className="mb-9">
        {recent.length ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {recent.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-[calc(var(--radius)*1.2)] border border-border bg-surface">
                <Link to={`/library?select=${p.id}`} className="block aspect-[21/9] overflow-hidden"><img src={p.media.hero} alt="" className="h-full w-full object-cover" /></Link>
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1"><div className="truncate font-display font-bold">{p.name}</div>
                    <div className="text-xs text-subtle">{t("home.playtime", { h: Math.floor((inst!.installs[p.id]!.playtimeSeconds ?? 0) / 3600), m: Math.floor(((inst!.installs[p.id]!.playtimeSeconds ?? 0) % 3600) / 60) })}</div></div>
                  <div className="w-36"><InstallPanel p={p} /></div>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={<Gamepad2 size={34} />} title={t("home.emptyContinue")} text={t("home.emptyContinueText")} />}
      </div>

      <SectionTitle action={<Link to="/store" className="text-sm text-primary hover:underline">{t("home.all")}</Link>}>{t("home.recommended")}</SectionTitle>
      <div className="mb-9 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
        {isLoading ? Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />) : products.slice(0, 6).map((p) => <ProductCard key={p.id} p={p} />)}
      </div>

      {sales.length > 0 && (<>
        <SectionTitle>{t("home.sales")}</SectionTitle>
        <div className="mb-9 grid grid-cols-2 gap-5 md:grid-cols-4">{sales.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </>)}

      <SectionTitle>{t("home.news")}</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-3">
        {updates.map((p) => (
          <Link key={p.id} to={`/store/${p.id}`} className="group overflow-hidden rounded-[calc(var(--radius)*1.2)] border border-border bg-surface transition hover:border-primary/40">
            <div className="aspect-[21/9] overflow-hidden"><img src={p.media.hero} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div>
            <div className="p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-primary"><Sparkles size={13} />{t("home.version", { v: p.latestVersion })}</div>
              <div className="font-display text-base font-bold">{p.name}</div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{p.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
