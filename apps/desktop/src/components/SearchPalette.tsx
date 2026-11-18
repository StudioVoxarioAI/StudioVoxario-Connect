import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

// Globální hledání (Ctrl+K): obchod i knihovna nad lokální cache katalogu – výsledky ve Fázi 1
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 10); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t("search.placeholder")}
        className="w-full max-w-2xl overflow-hidden rounded-[calc(var(--radius)*1.4)] border border-border bg-surface shadow-glow"
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} className="text-primary" />
          <input ref={input} placeholder={t("search.placeholder")} className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-subtle" />
          <kbd className="rounded border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-subtle">Esc</kbd>
        </div>
        <div className="space-y-4 p-5">
          {[t("search.inLibrary"), t("search.inStore")].map((g) => (
            <div key={g}>
              <div className="mb-2 font-display text-[11px] uppercase tracking-[0.2em] text-subtle">{g}</div>
              <div className="rounded-[var(--radius)] border border-dashed border-border px-4 py-3 text-sm text-muted">{t("search.empty")}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
