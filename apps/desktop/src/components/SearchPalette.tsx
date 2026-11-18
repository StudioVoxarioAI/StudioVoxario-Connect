import { searchProducts } from "@connect/catalog-client";
import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { formatPrice, useCatalog } from "../lib/catalog";

// Globální hledání (Ctrl+K): obchod (hry, software) a knihovna nad lokální cache katalogu – i offline
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const { data } = useCatalog();
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);
  const hits = useMemo(() => searchProducts(data?.products ?? [], q), [data, q]);
  const groups = [
    { key: "games", label: t("search.games"), items: hits.filter((h) => h.product.type === "game") },
    { key: "software", label: t("search.software"), items: hits.filter((h) => h.product.type === "software") },
  ].filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);
  if (!open) return null;
  const go = (id: string) => { onClose(); nav(`/store/${id}`); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t("search.placeholder")}
        className="w-full max-w-2xl overflow-hidden rounded-[calc(var(--radius)*1.4)] border border-border bg-surface shadow-glow"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          else if (e.key === "Enter" && flat[sel]) go(flat[sel]!.product.id);
        }}>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} className="text-primary" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder={t("search.placeholder")}
            role="combobox" aria-expanded={flat.length > 0} aria-controls="search-results"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-subtle" />
          <kbd className="rounded border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-subtle">Esc</kbd>
        </div>
        <div id="search-results" role="listbox" className="max-h-[52vh] overflow-auto p-3">
          {!q && <p className="px-2 py-3 text-sm text-subtle">{t("search.hintText")}</p>}
          {q && !flat.length && <p className="px-2 py-3 text-sm text-subtle">{t("search.none", { q })}</p>}
          {groups.map((g) => (
            <div key={g.key} className="mb-2">
              <div className="px-2 pb-1 pt-2 font-display text-[11px] uppercase tracking-[0.2em] text-subtle">{g.label}</div>
              {g.items.map((h) => {
                const idx = flat.indexOf(h);
                const n = h.product.name;
                const m = h.nameMatch;
                return (
                  <button key={h.product.id} role="option" aria-selected={idx === sel} onMouseEnter={() => setSel(idx)} onClick={() => go(h.product.id)}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius)] px-2 py-2 text-left ${idx === sel ? "bg-primary/10" : ""}`}>
                    <img src={h.product.media.icon} alt="" className="h-10 w-10 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-ui text-[15px] font-semibold">
                        {m ? <>{n.slice(0, m[0])}<mark className="rounded bg-primary/25 px-0.5 text-foreground">{n.slice(m[0], m[1])}</mark>{n.slice(m[1])}</> : n}
                      </div>
                      <div className="truncate text-xs text-subtle">{h.product.tagline}</div>
                    </div>
                    <span className="text-sm font-semibold text-muted">{formatPrice(h.product, t, i18n.language)}</span>
                    {idx === sel && <CornerDownLeft size={14} className="text-subtle" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
