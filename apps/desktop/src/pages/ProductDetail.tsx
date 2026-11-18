import { Badge, Button, EmptyState } from "@connect/ui";
import { ArrowLeft, ChevronLeft, ChevronRight, Cpu, ExternalLink, HardDrive, KeyRound, Lock, Monitor, PackageSearch, ShieldCheck, Tag, User } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Markdown } from "../components/Markdown";
import { ProductAction } from "../components/ProductAction";
import { StatusBadge } from "../components/ProductCard";
import { bridge } from "../lib/bridge";
import { formatPrice, formatSize, useCatalog, useProduct } from "../lib/catalog";

function Info({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0">
      <span className="mt-0.5 text-subtle">{icon}</span>
      <div className="min-w-0"><div className="text-xs uppercase tracking-wider text-subtle">{label}</div><div className="text-sm text-foreground">{children}</div></div>
    </div>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { product: p, loading } = useProduct(id);
  const { data: catalog } = useCatalog();
  const [shot, setShot] = useState(0);
  if (!p) return loading ? <div className="h-[420px] animate-pulse bg-surface" /> : (
    <div className="p-8"><EmptyState icon={<PackageSearch size={34} />} title={t("detail.notFound")} action={<Link to="/store" className="text-primary">{t("detail.back")}</Link>} /></div>
  );
  const shots = p.media.screenshots.length ? p.media.screenshots : [p.media.hero];
  return (
    <div>
      <section className="relative h-[420px] overflow-hidden">
        <img src={p.media.hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
        <button onClick={() => nav(-1)} className="absolute left-8 top-6 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/65">
          <ArrowLeft size={15} />{t("detail.back")}
        </button>
        <div className="absolute bottom-8 left-8 right-8 flex items-end gap-5">
          <img src={p.media.icon} alt="" className="h-20 w-20 rounded-[calc(var(--radius)*1.2)] border border-white/15 shadow-card" />
          <div>
            <div className="mb-2 flex flex-wrap gap-2"><StatusBadge p={p} /><Badge>{p.type === "game" ? t("store.games") : t(`category.${p.category ?? "other"}`)}</Badge></div>
            <h1 className="font-display text-4xl font-extrabold uppercase tracking-[0.08em] text-white drop-shadow-lg">{p.name}</h1>
            {p.tagline && <p className="mt-1 text-[15px] text-white/80">{p.tagline}</p>}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1400px] gap-8 px-8 pb-12 pt-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <div>
            <div className="relative aspect-video overflow-hidden hud">
              <img src={shots[shot]} alt={`${p.name} – ${shot + 1}`} className="h-full w-full object-cover" />
              {shots.length > 1 && (<>
                <button aria-label={t("detail.prev")} onClick={() => setShot((shot + shots.length - 1) % shots.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><ChevronLeft size={20} /></button>
                <button aria-label={t("detail.next")} onClick={() => setShot((shot + 1) % shots.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><ChevronRight size={20} /></button>
              </>)}
            </div>
            {shots.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {shots.map((s, i) => (
                  <button key={s} onClick={() => setShot(i)} aria-label={`${i + 1}`}
                    className={`h-16 w-28 shrink-0 overflow-hidden rounded-[var(--radius)] border-2 transition ${i === shot ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}>
                    <img src={s} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <section>
            <h2 className="mb-3 font-display text-sm uppercase tracking-[0.18em] text-muted">{t("detail.about")}</h2>
            <Markdown text={p.description} />
            {p.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{p.tags.map((g) => <Badge key={g}>{g}</Badge>)}</div>}
          </section>
          {(p.related ?? []).length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm uppercase tracking-[0.18em] text-muted">{t("detail.related")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(p.related ?? []).map((rid) => catalog?.products.find((x) => x.id === rid)).filter((x): x is NonNullable<typeof x> => !!x).map((r) => (
                  <Link key={r.id} to={`/store/${r.id}`} className="hud-tile group flex items-center gap-3 p-2 pr-4">
                    <img src={r.media.hero} alt="" className="h-14 w-24 object-cover" />
                    <div className="min-w-0">
                      <div className="truncate font-display text-sm font-bold uppercase tracking-[0.05em] group-hover:text-primary">{r.name}</div>
                      <div className="truncate text-xs text-subtle">{r.tagline}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {p.systemRequirements && (
            <section>
              <h2 className="mb-3 font-display text-sm uppercase tracking-[0.18em] text-muted">{t("detail.requirements")}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[var(--radius)] border border-border bg-surface p-4"><div className="mb-1 text-xs uppercase tracking-wider text-subtle">{t("detail.minimum")}</div><p className="text-sm text-muted">{p.systemRequirements.min}</p></div>
                {p.systemRequirements.recommended && <div className="rounded-[var(--radius)] border border-border bg-surface p-4"><div className="mb-1 text-xs uppercase tracking-wider text-subtle">{t("detail.recommended")}</div><p className="text-sm text-muted">{p.systemRequirements.recommended}</p></div>}
              </div>
            </section>
          )}
          {p.changelog && p.changelog.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm uppercase tracking-[0.18em] text-muted">{t("detail.changelog")}</h2>
              <div className="space-y-3">{p.changelog.map((c) => (
                <div key={c.version} className="rounded-[var(--radius)] border border-border bg-surface p-4"><div className="mb-1 font-ui font-bold">{c.version} <span className="text-xs font-normal text-subtle">{c.date}</span></div><Markdown text={c.notes} /></div>
              ))}</div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="hud p-5 shadow-card">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="font-display text-2xl font-extrabold">{formatPrice(p, t, i18n.language)}</span>
              {p.pricing.discountPercent ? <Badge tone="success">-{p.pricing.discountPercent} %</Badge> : null}
            </div>
            {p.access !== "none" && (
              <div className={`mb-4 flex gap-3 rounded-[var(--radius)] border p-3 text-sm ${p.access === "access_key" ? "border-primary/30 bg-primary/5" : "border-warning/30 bg-warning/5"}`}>
                {p.access === "access_key" ? <KeyRound size={18} className="mt-0.5 shrink-0 text-primary" /> : p.access === "license" ? <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" /> : <Lock size={18} className="mt-0.5 shrink-0 text-warning" />}
                <div><div className="font-semibold">{t(`access.${p.access}`)}</div><div className="text-muted">{t(`access.${p.access}_text`)}</div></div>
              </div>
            )}
            <ProductAction p={p} />
            {p.storeUrl && (
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => bridge.openExternal(p.storeUrl!)}><ExternalLink size={14} />{t("common.openWeb")}</Button>
            )}
            <div className="mt-4 border-t border-border pt-1">
              {p.developer && <Info icon={<User size={16} />} label={t("detail.developer")}>{p.developer}</Info>}
              {p.latestVersion && <Info icon={<Tag size={16} />} label={t("detail.version")}>{p.latestVersion}</Info>}
              {p.sizeBytes ? <Info icon={<HardDrive size={16} />} label={t("detail.size")}>{formatSize(p.sizeBytes, i18n.language)}</Info> : null}
              <Info icon={<Monitor size={16} />} label={t("detail.platforms")}>{p.platforms.map((x) => t(`platform.${x}`)).join(", ")}</Info>
              {p.genres && <Info icon={<Cpu size={16} />} label={t("store.genre")}>{p.genres.join(", ")}</Info>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
