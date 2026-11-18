import type { Product } from "@connect/catalog-client";
import { Badge } from "@connect/ui";
import { KeyRound, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatPrice } from "../lib/catalog";

export function StatusBadge({ p }: { p: Product }) {
  const { t } = useTranslation();
  if (p.status === "early_access") return <Badge tone="warning">{t("status.early_access")}</Badge>;
  if (p.status === "coming_soon") return <Badge tone="accent">{t("status.coming_soon")}</Badge>;
  return null;
}

export function AccessHint({ p, compact }: { p: Product; compact?: boolean }) {
  const { t } = useTranslation();
  if (p.access === "access_key") return <span className="inline-flex items-center gap-1 text-xs text-primary"><KeyRound size={13} />{!compact && t("access.access_key")}</span>;
  if (p.access === "account_permission") return <span className="inline-flex items-center gap-1 text-xs text-warning"><Lock size={13} />{!compact && t("access.account_permission")}</span>;
  return null;
}

// Karta produktu: naležato, zkosené rohy, vlasový neonový rám, rohové závorky, štítek kategorie a cena v „tagu“
export function ProductCard({ p }: { p: Product }) {
  const { t, i18n } = useTranslation();
  const kind = p.type === "game" ? (p.genres ?? p.tags).slice(0, 2).join(" · ") : t(`category.${p.category ?? "other"}`);
  return (
    <Link to={`/store/${p.id}`} className="hud-tile hud-brackets group block focus-visible:outline-none">
      <div className="relative aspect-[2/1] overflow-hidden">
        <img src={p.media.hero} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5"><StatusBadge p={p} /></div>
        <img src={p.media.icon} alt="" className="absolute bottom-2 left-3 h-10 w-10 border border-primary/40 bg-background/80 object-cover p-0.5" />
      </div>
      <div className="px-3.5 pb-3.5 pt-2.5">
        <div className="mb-0.5 truncate font-display text-[10px] uppercase tracking-[0.24em] text-primary/80">{kind}</div>
        <div className="truncate font-display text-[16px] font-bold uppercase tracking-[0.06em]">{p.name}</div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <AccessHint p={p} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {p.pricing.discountPercent ? <Badge tone="success">-{p.pricing.discountPercent} %</Badge> : null}
            <span className="hud-btn [--ch:6px] bg-primary/15 px-2.5 py-1 font-ui text-sm font-bold text-primary">{formatPrice(p, t, i18n.language)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-[16/9] w-full animate-pulse bg-surface-3/70" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-surface-3/70" />
    </div>
  );
}
