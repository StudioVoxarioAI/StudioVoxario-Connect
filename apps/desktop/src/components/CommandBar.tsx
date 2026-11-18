import { Loader2, Minus, RefreshCw, Search, Settings, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/account";
import { bridge } from "../lib/bridge";
import { useInstalls, useUpdater } from "../lib/installs";
import { Avatar } from "./Avatar";

const tabs = [
  { to: "/", key: "home", code: "01" },
  { to: "/store", key: "store", code: "02" },
  { to: "/library", key: "library", code: "03" },
  { to: "/downloads", key: "downloads", code: "04" },
] as const;

// Velitelská lišta: logo, záložky (horní navigace místo bočního panelu), hledání, účet, nastavení, okno.
// Celá lišta slouží k tahání okna (okno je bez rámu), ovládací prvky jsou no-drag.
export function CommandBar({ onSearch }: { onSearch: () => void }) {
  const { t } = useTranslation();
  const { data: auth } = useAuth();
  const { data: upd } = useUpdater();
  const { data: inst } = useInstalls();
  const jobs = inst?.jobs.length ?? 0;
  const win = "no-drag grid h-full w-11 place-items-center text-subtle transition hover:bg-surface-3 hover:text-foreground";
  return (
    <header className="drag relative flex h-[58px] shrink-0 items-stretch border-b border-primary/20 bg-background/95">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <Link to="/" className="no-drag flex items-center gap-3 pl-5 pr-7" aria-label="StudioVoxario Connect">
        <img src="./logo.png" alt="" className="h-8 w-8 drop-shadow-[0_0_12px_rgba(63,224,255,0.5)]" />
        <div className="leading-[1.05]">
          <div className="font-brand text-[12px] font-extrabold tracking-[0.16em]">STUDIOVOXARIO</div>
          <div className="font-brand text-[10px] tracking-[0.5em] text-gradient">CONNECT</div>
        </div>
      </Link>
      <nav aria-label="Hlavní navigace" className="no-drag flex items-stretch">
        {tabs.map((x) => (
          <NavLink key={x.to} to={x.to} end={x.to === "/"}
            className={({ isActive }) => `group relative flex items-center gap-2 px-5 font-display text-[13px] font-semibold uppercase tracking-[0.2em] transition ${isActive ? "text-foreground" : "text-muted hover:text-foreground"}`}>
            {({ isActive }) => (<>
              <span className={`font-mono text-[10px] ${isActive ? "text-primary" : "text-subtle"}`}>{x.code}</span>
              {t(`nav.${x.key}`)}
              {x.key === "downloads" && jobs > 0 && <span className="hud-btn [--ch:4px] bg-primary px-1.5 text-[10px] text-primary-foreground">{jobs}</span>}
              <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[2px] bg-primary shadow-[0_0_10px_hsl(var(--primary))] transition ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`} />
              {isActive && <span aria-hidden className="absolute left-2 top-2 h-2 w-2 border-l border-t border-primary/80" />}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 pr-2">
        <button onClick={onSearch} className="no-drag hud-btn flex h-9 w-64 items-center gap-2 border border-border bg-surface-2/80 px-3 text-left text-sm text-muted transition hover:text-foreground xl:w-80">
          <Search size={15} /><span className="flex-1 truncate">{t("top.search")}</span>
          <kbd className="font-mono text-[10px] text-subtle">CTRL K</kbd>
        </button>
        {upd?.state === "ready" && (
          <button onClick={() => bridge.updater.install()} title={t("updater.readyText", { v: upd.version })}
            className="no-drag hud-btn flex h-9 items-center gap-2 bg-success/15 px-3 text-xs font-semibold uppercase tracking-wider text-success hover:bg-success/25">
            <RefreshCw size={14} />{t("updater.restart")}
          </button>
        )}
        {auth?.user ? (
          <Link to="/account" className="no-drag hud-btn flex h-9 items-center gap-2 border border-border bg-surface-2/80 pl-1 pr-3 text-sm hover:border-primary/50">
            <Avatar src={auth.user.avatar} name={auth.user.name} />
            <span className="max-w-[140px] truncate font-ui font-semibold">{auth.user.name}</span>
          </Link>
        ) : (
          <button onClick={() => bridge.auth.signIn()} disabled={auth?.pending}
            className="no-drag hud-btn flex h-9 items-center gap-2 bg-primary px-4 text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground hover:bg-primary-glow">
            {auth?.pending ? <Loader2 size={14} className="animate-spin" /> : null}{auth?.pending ? t("account.pendingShort") : t("top.signIn")}
          </button>
        )}
        <NavLink to="/settings" aria-label={t("nav.settings")} className={({ isActive }) => `no-drag grid h-9 w-9 place-items-center transition ${isActive ? "text-primary" : "text-muted hover:text-foreground"}`}>
          <Settings size={18} />
        </NavLink>
      </div>
      <div className="flex items-stretch border-l border-border/60">
        <button aria-label={t("window.minimize")} className={win} onClick={() => bridge.window("minimize")}><Minus size={14} /></button>
        <button aria-label={t("window.maximize")} className={win} onClick={() => bridge.window("maximize")}><Square size={12} /></button>
        <button aria-label={t("window.close")} className={`${win} hover:!bg-danger hover:!text-white`} onClick={() => bridge.window("close")}><X size={15} /></button>
      </div>
    </header>
  );
}
