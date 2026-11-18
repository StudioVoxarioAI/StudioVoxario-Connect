import type { Product } from "@connect/catalog-client";
import { Badge, Button, EmptyState } from "@connect/ui";
import { Grid2x2, Library as LibraryIcon, List, LogIn, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { InstallPanel } from "../components/InstallPanel";
import { useAuth, useLibrary } from "../lib/account";
import { bridge } from "../lib/bridge";
import { formatSize, useCatalog } from "../lib/catalog";
import { useInstalls } from "../lib/installs";

const cats = ["all", "games", "software", "installed", "favorites"] as const;
type Cat = (typeof cats)[number];

export function Library() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [cat, setCat] = useState<Cat>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const { data: auth } = useAuth();
  const { data: lib } = useLibrary();
  const { data: catalog } = useCatalog();
  const { data: inst } = useInstalls();
  const isInstalled = (id: string) => !!inst?.installs[id];
  const owned = useMemo(() => {
    const items = new Map((lib?.items ?? []).filter((i) => i.owned).map((i) => [i.productId, i]));
    return (catalog?.products ?? []).filter((p) => items.has(p.id)).map((p) => ({ p, item: items.get(p.id)! }));
  }, [lib, catalog]);
  const filtered = owned.filter(({ p, item }) =>
    cat === "all" || (cat === "games" ? p.type === "game" : cat === "software" ? p.type === "software" : cat === "favorites" ? item.favorite : isInstalled(p.id)));
  const count = (c: Cat) => owned.filter(({ p, item }) =>
    c === "all" || (c === "games" ? p.type === "game" : c === "software" ? p.type === "software" : c === "favorites" ? item.favorite : isInstalled(p.id))).length;
  const selId = params.get("select") ?? filtered[0]?.p.id;
  const sel = owned.find((o) => o.p.id === selId);
  const select = (p: Product) => setParams({ select: p.id });

  if (!auth?.signedIn) {
    return (
      <div className="p-8">
        <EmptyState icon={<LibraryIcon size={36} />} title={t("library.signedOutTitle")} text={t("library.signedOutText")}
          action={<Button size="lg" onClick={() => bridge.auth.signIn()}><LogIn size={18} />{t("top.signIn")}</Button>} />
      </div>
    );
  }
  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r border-border/60 bg-surface/40 p-4">
        <h1 className="mb-4 px-2 font-display text-lg font-extrabold tracking-[0.08em]">{t("library.title")}</h1>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
            className={`flex w-full items-center justify-between rounded-[var(--radius)] px-3 py-2 text-left font-ui text-[15px] font-semibold ${cat === c ? "bg-primary/10 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"}`}>
            {t(`library.${c}`)} <span className="text-xs text-subtle">{count(c)}</span>
          </button>
        ))}
        <div className="mt-6 space-y-1 border-t border-border/60 pt-4">
          {owned.map(({ p }) => (
            <button key={p.id} onClick={() => select(p)}
              className={`flex w-full items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5 text-left text-sm ${sel?.p.id === p.id ? "bg-surface-3 text-foreground" : "text-muted hover:bg-surface-2"}`}>
              <img src={p.media.icon} alt="" className="h-6 w-6 rounded object-cover" /><span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">
        {sel ? (
          <section className="relative z-10 h-[300px] border-b border-border/60">
            <div className="absolute inset-0 overflow-hidden">
              <img src={sel.p.media.hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
            </div>
            <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between gap-6">
              <div className="flex items-end gap-4">
                <img src={sel.p.media.icon} alt="" className="h-16 w-16 rounded-[var(--radius)] border border-white/15" />
                <div>
                  <h2 className="font-display text-3xl font-extrabold text-white drop-shadow">{sel.p.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-white/75">
                    {sel.p.latestVersion && <span>{t("detail.version")} {sel.p.latestVersion}</span>}
                    {sel.p.sizeBytes ? <span>{formatSize(sel.p.sizeBytes, i18n.language)}</span> : null}
                    {sel.item.license?.validUntil && <span>{t("account.updatesUntil", { d: new Date(sel.item.license.validUntil).toLocaleDateString("cs-CZ") })}</span>}
                  </div>
                </div>
              </div>
              <div className="flex w-[440px] shrink-0 items-center gap-2">
                <InstallPanel p={sel.p} />
                <button aria-label={t("library.favorite")} aria-pressed={sel.item.favorite} onClick={() => bridge.library.favorite(sel.p.id, !sel.item.favorite)}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius)] border border-border bg-surface/80 ${sel.item.favorite ? "text-warning" : "text-subtle hover:text-foreground"}`}>
                  <Star size={18} fill={sel.item.favorite ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </section>
        ) : null}
        <div className="px-8 py-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="font-display text-sm uppercase tracking-[0.18em] text-muted">{t(`library.${cat}`)} · {filtered.length}</div>
            <div className="flex gap-1">
              <button aria-label={t("library.grid")} onClick={() => setView("grid")} className={`rounded p-2 ${view === "grid" ? "bg-surface-3 text-foreground" : "text-subtle"}`}><Grid2x2 size={16} /></button>
              <button aria-label={t("library.list")} onClick={() => setView("list")} className={`rounded p-2 ${view === "list" ? "bg-surface-3 text-foreground" : "text-subtle"}`}><List size={16} /></button>
            </div>
          </div>
          {!filtered.length ? (
            <EmptyState icon={<LibraryIcon size={36} />} title={owned.length ? t("library.emptyCat") : t("library.emptyTitle")} text={owned.length ? undefined : t("library.emptyText")}
              action={owned.length ? undefined : <Link to="/store" className="text-primary hover:underline">{t("home.all")}</Link>} />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4 xl:grid-cols-6">
              {filtered.map(({ p }) => (
                <button key={p.id} onClick={() => select(p)} className={`group text-left`}>
                  <div className={`aspect-[2/3] overflow-hidden rounded-[var(--radius)] border-2 transition ${sel?.p.id === p.id ? "border-primary shadow-glow" : "border-transparent"}`}>
                    <img src={p.media.cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                  <div className="mt-2 truncate font-ui text-sm font-semibold">{p.name}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius)] border border-border">
              {filtered.map(({ p, item }) => (
                <button key={p.id} onClick={() => select(p)} className={`flex w-full items-center gap-4 border-b border-border/60 px-4 py-3 text-left last:border-0 ${sel?.p.id === p.id ? "bg-primary/10" : "hover:bg-surface-2"}`}>
                  <img src={p.media.icon} alt="" className="h-10 w-10 rounded object-cover" />
                  <div className="flex-1"><div className="font-ui font-semibold">{p.name}</div><div className="text-xs text-subtle">{p.type === "game" ? t("store.games") : t(`category.${p.category ?? "other"}`)}</div></div>
                  {item.favorite && <Star size={14} className="text-warning" fill="currentColor" />}
                  {p.latestVersion && <Badge>{p.latestVersion}</Badge>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
