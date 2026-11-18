import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/account";
import { bridge } from "../lib/bridge";
import { useUpdater } from "../lib/installs";
import { Avatar } from "./Avatar";
import { DownloadIndicator } from "./DownloadIndicator";

export function TopBar({ onSearch }: { onSearch: () => void }) {
  const { t } = useTranslation();
  const { data: auth } = useAuth();
  const { data: upd } = useUpdater();
  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-4 border-b border-border/60 bg-background/80 px-6 backdrop-blur">
      <button onClick={onSearch}
        className="flex h-10 w-full max-w-xl items-center gap-3 rounded-[var(--radius)] border border-border bg-surface-2/70 px-3 text-left text-muted transition hover:border-primary/40 hover:text-foreground">
        <Search size={17} />
        <span className="flex-1 truncate">{t("top.search")}</span>
        <kbd className="rounded border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-subtle">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-3">
        {upd?.state === "ready" && (
          <button onClick={() => bridge.updater.install()} title={t("updater.readyText", { v: upd.version })}
            className="flex items-center gap-2 rounded-full border border-success/50 bg-success/10 px-3 py-1.5 text-sm font-semibold text-success hover:bg-success/20">
            <RefreshCw size={15} />{t("updater.restart")}
          </button>
        )}
        <DownloadIndicator fallback={<Link to="/downloads" className="flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground" title={t("top.noDownloads")}>
          <Download size={17} /><span className="hidden xl:inline">{t("top.noDownloads")}</span>
        </Link>} />
        {auth?.user ? (
          <Link to="/account" className="flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-3 text-sm hover:border-primary/40">
            <Avatar src={auth.user.avatar} name={auth.user.name} />
            <span className="max-w-[160px] truncate font-ui font-semibold">{auth.user.name}</span>
          </Link>
        ) : auth?.pending ? (
          <Link to="/account" className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-1.5 pl-2 pr-3 text-sm text-primary">
            <Loader2 size={16} className="animate-spin" /><span className="font-ui font-semibold">{t("account.pendingShort")}</span>
          </Link>
        ) : (
          <button onClick={() => bridge.auth.signIn()} className="flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-3 text-sm hover:border-primary/40">
            <Avatar /><span className="font-ui font-semibold">{t("top.signIn")}</span>
          </button>
        )}
      </div>
    </header>
  );
}
