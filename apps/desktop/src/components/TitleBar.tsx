import { Minus, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { bridge } from "../lib/bridge";

// Vlastní titulková lišta (okno bez rámu): tahání oknem, minimalizace, maximalizace, zavření
export function TitleBar() {
  const { t } = useTranslation();
  const btn = "no-drag grid h-8 w-11 place-items-center text-subtle transition hover:bg-surface-3 hover:text-foreground";
  return (
    <div className="drag flex h-8 shrink-0 items-center justify-between border-b border-border/60 bg-background">
      <div className="flex items-center gap-2 pl-3 font-brand text-[11px] uppercase tracking-[0.22em] text-subtle">
        <img src="./logo.png" alt="" className="h-4 w-4" />
        StudioVoxario <span className="text-gradient">Connect</span>
      </div>
      <div className="flex">
        <button aria-label={t("window.minimize")} className={btn} onClick={() => bridge.window("minimize")}><Minus size={14} /></button>
        <button aria-label={t("window.maximize")} className={btn} onClick={() => bridge.window("maximize")}><Square size={12} /></button>
        <button aria-label={t("window.close")} className={`${btn} hover:!bg-danger hover:!text-white`} onClick={() => bridge.window("close")}><X size={15} /></button>
      </div>
    </div>
  );
}
