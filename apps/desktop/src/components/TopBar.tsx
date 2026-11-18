import { Download, Search, UserCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function TopBar({ onSearch }: { onSearch: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-4 border-b border-border/60 bg-background/80 px-6 backdrop-blur">
      <button onClick={onSearch}
        className="flex h-10 w-full max-w-xl items-center gap-3 rounded-[var(--radius)] border border-border bg-surface-2/70 px-3 text-left text-muted transition hover:border-primary/40 hover:text-foreground">
        <Search size={17} />
        <span className="flex-1 truncate">{t("top.search")}</span>
        <kbd className="rounded border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-subtle">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-3">
        <Link to="/downloads" className="flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground" title={t("top.noDownloads")}>
          <Download size={17} /><span className="hidden xl:inline">{t("top.noDownloads")}</span>
        </Link>
        <Link to="/account" className="flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-3 text-sm hover:border-primary/40">
          <UserCircle2 size={26} className="text-subtle" />
          <span className="font-ui font-semibold">{t("top.signIn")}</span>
        </Link>
      </div>
    </header>
  );
}
