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

export function ProductCard({ p }: { p: Product }) {
  const { t, i18n } = useTranslation();
  return (
    <Link to={`/store/${p.id}`} className="group block focus-visible:outline-none">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius)] border border-border bg-surface-2 shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-glow group-focus-visible:shadow-glow">
        <img src={p.media.cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-12">
          <div className="mb-1 flex flex-wrap gap-1.5"><StatusBadge p={p} /></div>
          <div className="font-display text-[15px] font-bold leading-tight text-white drop-shadow">{p.name}</div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 px-0.5">
        <span className="truncate text-xs text-subtle">{p.type === "game" ? (p.genres ?? p.tags).slice(0, 2).join(" · ") : t(`category.${p.category ?? "other"}`)}</span>
        <div className="flex shrink-0 items-center gap-2">
          <AccessHint p={p} compact />
          {p.pricing.discountPercent ? <Badge tone="success">-{p.pricing.discountPercent} %</Badge> : null}
          <span className="font-ui text-sm font-bold">{formatPrice(p, t, i18n.language)}</span>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-[2/3] w-full animate-pulse rounded-[var(--radius)] bg-surface-3/70" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-surface-3/70" />
    </div>
  );
}
