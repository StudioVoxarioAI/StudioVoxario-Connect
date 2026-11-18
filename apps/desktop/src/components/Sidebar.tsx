import { Download, Home, Library, Settings, Store, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", key: "home", icon: Home },
  { to: "/store", key: "store", icon: Store },
  { to: "/library", key: "library", icon: Library },
  { to: "/downloads", key: "downloads", icon: Download },
] as const;

export function Sidebar() {
  const { t } = useTranslation();
  const link = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 font-ui text-[15px] font-semibold tracking-wide transition ${
      isActive ? "bg-primary/10 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"}`;
  const bar = (active: boolean) => `absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary transition ${active ? "opacity-100" : "opacity-0"}`;
  return (
    <nav aria-label="Hlavní navigace" className="flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border/60 bg-surface/70 px-3 py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <img src="./logo.png" alt="" className="h-9 w-9 drop-shadow-[0_0_12px_rgba(63,224,255,0.45)]" />
        <div className="leading-tight">
          <div className="font-brand text-[13px] font-extrabold tracking-[0.14em]">STUDIOVOXARIO</div>
          <div className="font-brand text-[11px] tracking-[0.42em] text-gradient">CONNECT</div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {items.map(({ to, key, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className={link}>
            {({ isActive }) => (<><span className={bar(isActive)} /><Icon size={18} className={isActive ? "text-primary" : ""} />{t(`nav.${key}`)}</>)}
          </NavLink>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-1 border-t border-border/60 pt-3">
        <NavLink to="/account" className={link}>{({ isActive }) => (<><span className={bar(isActive)} /><User size={18} />{t("nav.account")}</>)}</NavLink>
        <NavLink to="/settings" className={link}>{({ isActive }) => (<><span className={bar(isActive)} /><Settings size={18} />{t("nav.settings")}</>)}</NavLink>
      </div>
    </nav>
  );
}
