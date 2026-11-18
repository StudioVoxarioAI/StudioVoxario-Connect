import type { Product } from "@connect/catalog-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { TFunction } from "i18next";
import type { CatalogState } from "../../electron/preload";
import { bridge } from "./bridge";

export function useCatalog() {
  const qc = useQueryClient();
  useEffect(() => bridge.catalog.onUpdate((c) => qc.setQueryData(["catalog"], c)), [qc]);
  return useQuery<CatalogState>({ queryKey: ["catalog"], queryFn: () => bridge.catalog.get(), staleTime: Infinity });
}

export function useProduct(id: string | undefined): { product?: Product; loading: boolean } {
  const q = useCatalog();
  return { product: q.data?.products.find((p) => p.id === id), loading: q.isLoading };
}

export function formatPrice(p: Product, t: TFunction, lang: string): string {
  if (p.pricing.model === "free" || !p.pricing.price) return t("price.free");
  const v = p.pricing.discountPercent ? p.pricing.price * (1 - p.pricing.discountPercent / 100) : p.pricing.price;
  const s = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { style: "currency", currency: p.pricing.currency ?? "CZK", maximumFractionDigits: 0 }).format(v);
  return p.pricing.model === "subscription" ? `${s} ${t("price.perMonth")}` : s;
}

export function formatSize(bytes: number | undefined, lang: string): string | undefined {
  if (!bytes) return undefined;
  const gb = bytes / 1024 ** 3;
  const f = new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-US", { maximumFractionDigits: 1 });
  return gb >= 1 ? `${f.format(gb)} GB` : `${f.format(bytes / 1024 ** 2)} MB`;
}
