import type { Product } from "@connect/catalog-client";
import { EmptyState } from "@connect/ui";
import { SearchX, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { OfflineNotice } from "../components/OfflineNotice";
import { Page } from "../components/Page";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { useCatalog } from "../lib/catalog";

type Tab = "all" | "games" | "software";
type Sort = "featured" | "newest" | "price" | "name";
interface Filters { genres: string[]; price: "" | "free" | "paid"; status: "" | Product["status"]; category: string }

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-sm font-semibold transition ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted hover:border-primary/40 hover:text-foreground"}`;

export function Store() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "all";
  const [sort, setSort] = useState<Sort>("featured");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Filters>({ genres: [], price: "", status: "", category: "" });
  const { data, isLoading } = useCatalog();
  const products = useMemo(() => data?.products ?? [], [data]);
  const genres = useMemo(() => [...new Set(products.flatMap((p) => p.genres ?? []))].sort((a, b) => a.localeCompare(b, "cs")), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))] as string[], [products]);

  const list = useMemo(() => {
    const out = products.filter((p) =>
      (tab === "all" || (tab === "games" ? p.type === "game" : p.type === "software")) &&
      (!f.genres.length || f.genres.some((g) => p.genres?.includes(g))) &&
      (!f.price || (f.price === "free" ? p.pricing.model === "free" : p.pricing.model !== "free")) &&
      (!f.status || p.status === f.status) && (!f.category || p.category === f.category));
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      featured: (a, b) => (a.featured ?? 99) - (b.featured ?? 99),
      newest: (a, b) => (b.releaseDate ?? b.latestVersion ?? "").localeCompare(a.releaseDate ?? a.latestVersion ?? ""),
      price: (a, b) => (a.pricing.price ?? 0) - (b.pricing.price ?? 0),
      name: (a, b) => a.name.localeCompare(b.name, "cs"),
    };
    return out.sort(by[sort]);
  }, [products, tab, f, sort]);
  const active = f.genres.length + (f.price ? 1 : 0) + (f.status ? 1 : 0) + (f.category ? 1 : 0);

  return (
    <Page eyebrow={t("eyebrow.store")} title={t("store.title")}>
      <OfflineNotice />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex rounded-[var(--radius)] border border-border bg-surface p-1">
          {(["all", "games", "software"] as Tab[]).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams(k === "all" ? {} : { tab: k })}
              className={`rounded-[calc(var(--radius)-3px)] px-4 py-1.5 font-ui text-[15px] font-semibold transition ${tab === k ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}>
              {t(`store.${k}`)}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className={`flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-sm ${open || active ? "border-primary/50 text-foreground" : "border-border text-muted hover:text-foreground"}`}>
          <SlidersHorizontal size={15} /> {t("store.filters")}{active ? <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{active}</span> : null}
        </button>
        {active > 0 && <button onClick={() => setF({ genres: [], price: "", status: "", category: "" })} className="flex items-center gap-1 text-sm text-subtle hover:text-foreground"><X size={14} />{t("store.clear")}</button>}
        <label className="ml-auto flex items-center gap-2 text-sm text-subtle">
          {t("store.sort")}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-[var(--radius)] border border-border bg-surface px-2 py-1.5 text-foreground">
            {(["featured", "newest", "price", "name"] as Sort[]).map((s) => <option key={s} value={s}>{t(`store.sort_${s}`)}</option>)}
          </select>
        </label>
      </div>
      {open && (
        <div className="mb-6 grid gap-4 hud p-5 md:grid-cols-2">
          {genres.length > 0 && (
            <div><div className="mb-2 font-display text-[11px] uppercase tracking-[0.2em] text-subtle">{t("store.genre")}</div>
              <div className="flex flex-wrap gap-2">{genres.map((g) => (
                <button key={g} className={chip(f.genres.includes(g))} onClick={() => setF({ ...f, genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g] })}>{g}</button>
              ))}</div></div>)}
          <div><div className="mb-2 font-display text-[11px] uppercase tracking-[0.2em] text-subtle">{t("store.price")}</div>
            <div className="flex flex-wrap gap-2">{(["free", "paid"] as const).map((v) => (
              <button key={v} className={chip(f.price === v)} onClick={() => setF({ ...f, price: f.price === v ? "" : v })}>{t(`store.price_${v}`)}</button>
            ))}</div></div>
          <div><div className="mb-2 font-display text-[11px] uppercase tracking-[0.2em] text-subtle">{t("store.state")}</div>
            <div className="flex flex-wrap gap-2">{(["released", "early_access", "coming_soon"] as const).map((v) => (
              <button key={v} className={chip(f.status === v)} onClick={() => setF({ ...f, status: f.status === v ? "" : v })}>{t(`status.${v}`)}</button>
            ))}</div></div>
          {categories.length > 0 && (
            <div><div className="mb-2 font-display text-[11px] uppercase tracking-[0.2em] text-subtle">{t("store.category")}</div>
              <div className="flex flex-wrap gap-2">{categories.map((c) => (
                <button key={c} className={chip(f.category === c)} onClick={() => setF({ ...f, category: f.category === c ? "" : c })}>{t(`category.${c}`)}</button>
              ))}</div></div>)}
        </div>
      )}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
      ) : list.length ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <EmptyState icon={<SearchX size={34} />} title={t("store.noResults")} text={t("store.noResultsText")} />
      )}
    </Page>
  );
}
