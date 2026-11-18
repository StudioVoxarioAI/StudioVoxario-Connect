import { CheckCircle2, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { bridge } from "../lib/bridge";

interface Toast { id: number; kind: "done" | "verified" | "rollback" | "crash" | "error" | "info"; text: string }
let push: ((t: Omit<Toast, "id">) => void) | null = null;
export const toast = (kind: Toast["kind"], text: string) => push?.({ kind, text });

// Oznámení v aplikaci (dokončená instalace, návrat verze, pád hry, chyby)
export function Toasts() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    push = (x) => { const id = ++n; setItems((v) => [...v, { ...x, id }]); setTimeout(() => setItems((v) => v.filter((i) => i.id !== id)), 7000); };
    const off = bridge.installs.onNotify((e) => push?.({ kind: e.kind, text: t(`notify.${e.kind}`, { name: e.name }) }));
    return () => { push = null; off(); };
  }, [t]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[360px] flex-col gap-2">
      {items.map((i) => (
        <div key={i.id} className="pointer-events-auto flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface p-3 shadow-card">
          {i.kind === "done" || i.kind === "verified" || i.kind === "info" ? <CheckCircle2 size={18} className="text-success" /> : i.kind === "rollback" ? <RotateCcw size={18} className="text-warning" /> : <TriangleAlert size={18} className="text-danger" />}
          <p className="flex-1 text-sm">{i.text}</p>
          <button aria-label="Zavřít" onClick={() => setItems((v) => v.filter((x) => x.id !== i.id))} className="text-subtle hover:text-foreground"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}
