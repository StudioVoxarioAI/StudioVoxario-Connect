// „Co je nového“: po aktualizaci Connectu ukáže skutečné poznámky k nové verzi (src/changelog.json – stejné
// poznámky jsou v GitHub Release i na webu). Znovu otevřít: Nastavení → Obecné.
import { Button } from "@connect/ui";
import { Rocket, ShieldCheck, Sparkles, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import changelog from "../changelog.json";
import { bridge } from "../lib/bridge";

type Entry = { version: string; date: string; title: string; titleEn?: string; changes: Array<{ type: string; text: string; textEn?: string }> };
const LOG = changelog as Entry[];
const KEY = "connect.seenVersion";
const icons: Record<string, typeof Rocket> = { feature: Rocket, improvement: Sparkles, fix: Wrench, security: ShieldCheck };

let open: ((v?: string) => void) | null = null;
/** Otevře okno s poznámkami (výchozí: aktuální verze). */
export const openWhatsNew = (v?: string) => open?.(v);

export function WhatsNew() {
  const { t, i18n } = useTranslation();
  const [entry, setEntry] = useState<Entry | null>(null);
  useEffect(() => {
    let current = "";
    open = (v) => setEntry(LOG.find((e) => e.version === (v ?? current)) ?? LOG[0] ?? null);
    void bridge.appInfo().then(({ version }) => {
      current = version;
      let seen: string | null = null;
      try { seen = localStorage.getItem(KEY); localStorage.setItem(KEY, version); } catch { /* bez úložiště */ }
      // jen po aktualizaci (ne při první instalaci)
      if (seen && seen !== version) { const e = LOG.find((x) => x.version === version); if (e) setEntry(e); }
    });
    return () => { open = null; };
  }, []);
  if (!entry) return null;
  const en = i18n.language === "en";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm" onMouseDown={() => setEntry(null)}>
      <div role="dialog" aria-modal="true" aria-label={t("whatsNew.title")} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && setEntry(null)}
        className="hud hud-brackets w-full max-w-xl p-7 [--ch:20px]">
        <button aria-label={t("window.close")} onClick={() => setEntry(null)} className="absolute right-4 top-4 text-subtle hover:text-foreground"><X size={18} /></button>
        <div className="hud-label mb-1">{t("whatsNew.title")} · v{entry.version}</div>
        <h2 className="mb-1 font-display text-xl font-extrabold uppercase tracking-[0.06em]">{en ? entry.titleEn ?? entry.title : entry.title}</h2>
        <div className="mb-5 font-mono text-xs text-subtle">{new Date(entry.date).toLocaleDateString(en ? "en-US" : "cs-CZ")}</div>
        <ul className="mb-6 max-h-[50vh] space-y-3 overflow-auto pr-1">
          {entry.changes.map((c, i) => {
            const Icon = icons[c.type] ?? Sparkles;
            return (
              <li key={i} className="flex gap-3 text-sm">
                <span className={`hud-btn [--ch:5px] mt-0.5 flex h-6 shrink-0 items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-wider ${c.type === "security" ? "bg-danger/15 text-danger" : c.type === "fix" ? "bg-surface-3 text-muted" : "bg-primary/15 text-primary"}`}>
                  <Icon size={12} />{t(`whatsNew.${c.type}`)}
                </span>
                <span className="text-muted">{en ? c.textEn ?? c.text : c.text}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between gap-3">
          <Button variant="ghost" onClick={() => void bridge.openExternal("https://studiovoxario.com/novinky")}>{t("whatsNew.all")}</Button>
          <Button onClick={() => setEntry(null)}>{t("whatsNew.ok")}</Button>
        </div>
      </div>
    </div>
  );
}
