import { Loader2, LogIn, Minus, RefreshCw, Search, Settings, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";
import { useAuth, useLibrary } from "../lib/account";
import { bridge } from "../lib/bridge";
import { useInstalls, useUpdater } from "../lib/installs";
import { useLive } from "../lib/live";
import { Avatar } from "./Avatar";

const tabs = [
  { to: "/", key: "home" },
  { to: "/store", key: "store" },
  { to: "/live", key: "live" },
  { to: "/library", key: "library" },
  { to: "/downloads", key: "downloads" },
] as const;

/** Stažená aktualizace Connectu: odpočet automatického restartu (s „Později“), jinak tlačítko restartu. */
function UpdateChip({ version, restartAt }: { version?: string; restartAt?: number }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!restartAt) return; const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, [restartAt]);
  const left = restartAt ? Math.max(0, Math.ceil((restartAt - now) / 1000)) : 0;
  return (
    <div className="no-drag flex items-center gap-1">
      <button onClick={() => bridge.updater.install()} title={t("updater.readyText", { v: version })}
        className="hud-btn flex h-9 items-center gap-2 whitespace-nowrap bg-success/15 px-3 text-xs font-semibold uppercase tracking-wider text-success hover:bg-success/25">
        <RefreshCw size={14} className={restartAt ? "animate-spin" : ""} />{restartAt ? t("updater.restartIn", { s: left }) : t("updater.restart")}
      </button>
      {restartAt && <button onClick={() => bridge.updater.postpone()} className="h-9 px-2 text-xs text-muted hover:text-foreground">{t("updater.later")}</button>}
    </div>
  );
}

// Velitelská lišta: logo, záložky (horní navigace místo bočního panelu), hledání, účet, nastavení, okno.
// Celá lišta slouží k tahání okna (okno je bez rámu), ovládací prvky jsou no-drag.
export function CommandBar({ onSearch }: { onSearch: () => void }) {
  const { t } = useTranslation();
  const { data: auth } = useAuth();
  const { data: lib } = useLibrary();
  const { data: upd } = useUpdater();
  const { data: inst } = useInstalls();
  const jobs = inst?.jobs.length ?? 0;
  const { data: live } = useLive();
  const liveCount = live?.streams.filter((s) => s.status === "live").length ?? 0;
  const win = "no-drag grid h-full w-11 place-items-center text-subtle transition hover:bg-surface-3 hover:text-foreground";
  return (
    <header className="drag relative flex h-[58px] shrink-0 items-stretch overflow-hidden border-b border-primary/20 bg-background/95">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <Link to="/" className="no-drag flex shrink-0 items-center gap-3 pl-5 pr-4 xl:pr-7" aria-label="StudioVoxario Connect">
        <img src="./logo.png" alt="" className="h-8 w-8 drop-shadow-[0_0_12px_rgba(63,224,255,0.5)]" />
        <div className="hidden leading-[1.05] lg:block">
          <div className="font-brand text-[12px] font-extrabold tracking-[0.16em]">STUDIOVOXARIO</div>
          <div className="font-brand text-[10px] tracking-[0.5em] text-gradient">CONNECT</div>
        </div>
      </Link>
      <nav aria-label="Hlavní navigace" className="no-drag flex min-w-0 items-stretch">
        {[...tabs, ...(lib?.manages?.length ? [{ to: "/admin", key: "admin" } as const] : [])].map((x) => (
          <NavLink key={x.to} to={x.to} end={x.to === "/"}
            className={({ isActive }) => `group relative flex shrink-0 items-center gap-2 px-2.5 font-display text-[12px] font-semibold uppercase tracking-[0.14em] transition xl:px-4 xl:text-[13px] xl:tracking-[0.2em] 2xl:px-5 ${isActive ? "text-foreground" : "text-muted hover:text-foreground"}`}>
            {({ isActive }) => (<>
              {t(`nav.${x.key}`)}
              {x.key === "live" && liveCount > 0 && <span className="flex items-center gap-1 bg-[#e8132b] px-1.5 text-[10px] text-white shadow-[0_0_10px_rgba(232,19,43,0.6)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />{liveCount}</span>}
              {x.key === "downloads" && jobs > 0 && <span className="hud-btn [--ch:4px] bg-primary px-1.5 text-[10px] text-primary-foreground">{jobs}</span>}
              <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[2px] bg-primary shadow-[0_0_10px_hsl(var(--primary))] transition ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`} />
              {isActive && <span aria-hidden className="absolute left-2 top-2 h-2 w-2 border-l border-t border-primary/80" />}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2 pr-2">
        <button onClick={onSearch} aria-label={t("top.search")} title={t("top.search")} className="no-drag hud-btn flex h-9 w-9 items-center justify-center gap-2 border border-border bg-surface-2/80 text-left text-sm text-muted transition hover:text-foreground 2xl:w-72 2xl:justify-start 2xl:px-3">
          <Search size={15} /><span className="hidden flex-1 truncate 2xl:inline">{t("top.search")}</span>
          <kbd className="hidden font-mono text-[10px] text-subtle 2xl:inline">CTRL K</kbd>
        </button>
        {upd?.state === "ready" && <UpdateChip version={upd.version} restartAt={upd.restartAt} />}
        {auth?.user ? (
          <Link to="/account" className="no-drag hud-btn flex h-9 items-center gap-2 border border-border bg-surface-2/80 pl-1 pr-3 text-sm hover:border-primary/50">
            <Avatar src={auth.user.avatar} name={auth.user.name} />
            <span className="hidden max-w-[140px] truncate font-ui font-semibold xl:inline">{auth.user.name}</span>
            {lib?.role && lib.role !== "player" && (
              <span className={`hud-btn hidden [--ch:4px] px-1.5 py-0.5 text-[10px] xl:inline font-bold uppercase tracking-wider ${lib.role === "admin" ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary"}`}>{t(`role.${lib.role}`)}</span>
            )}
          </Link>
        ) : (
          <button onClick={() => bridge.auth.signIn()} disabled={auth?.pending}
            className="no-drag hud-btn holo-primary flex h-9 shrink-0 items-center gap-2 whitespace-nowrap px-4 font-ui text-[14px] tracking-wide">
            {auth?.pending ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}<span className="hidden lg:inline">{auth?.pending ? t("account.pendingShort") : t("top.signIn")}</span>
          </button>
        )}
        <NavLink to="/settings" aria-label={t("nav.settings")} className={({ isActive }) => `no-drag grid h-9 w-9 place-items-center transition ${isActive ? "text-primary" : "text-muted hover:text-foreground"}`}>
          <Settings size={18} />
        </NavLink>
      </div>
      <div className="flex shrink-0 items-stretch border-l border-border/60">
        <button aria-label={t("window.minimize")} className={win} onClick={() => bridge.window("minimize")}><Minus size={14} /></button>
        <button aria-label={t("window.maximize")} className={win} onClick={() => bridge.window("maximize")}><Square size={12} /></button>
        <button aria-label={t("window.close")} className={`${win} hover:!bg-danger hover:!text-white`} onClick={() => bridge.window("close")}><X size={15} /></button>
      </div>
    </header>
  );
}
