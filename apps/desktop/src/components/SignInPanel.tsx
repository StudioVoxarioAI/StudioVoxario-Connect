// Přihlášení v Connectu – vzhledem jako web StudioVoxario: obrázek her s logem vlevo, skleněný panel vpravo,
// primární tlačítko s přechodem azurová → fialová. Přihlášení samo probíhá na webu v prohlížeči (PKCE).
import { Button } from "@connect/ui";
import { ExternalLink, KeyRound, Loader2, Lock, LogIn, MonitorSmartphone, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/account";
import { bridge } from "../lib/bridge";

const WEB = "https://studiovoxario.com";

export function SignInPanel() {
  const { t } = useTranslation();
  const { data: auth } = useAuth();
  const pending = !!auth?.pending;
  const points = [
    { icon: MonitorSmartphone, text: t("signin.p1") },
    { icon: KeyRound, text: t("signin.p2") },
    { icon: Lock, text: t("signin.p3") },
  ];
  return (
    <div className="mx-auto grid min-h-full w-full max-w-[1200px] items-center gap-0 px-8 py-8 lg:grid-cols-[1.15fr_1fr]">
      {/* vlevo: obrázek her a představení */}
      <div className="hud relative hidden h-[540px] overflow-hidden [--ch:22px] lg:block">
        <img src="./catalog-media/ashes-of-eryon/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        <div className="hud-scan" />
        <div className="absolute inset-x-0 bottom-0 p-9">
          <img src="./logo.png" alt="" className="mb-4 h-14 w-14 drop-shadow-[0_0_20px_rgba(63,224,255,0.6)]" />
          <div className="font-brand text-[22px] font-extrabold tracking-[0.18em]">STUDIOVOXARIO</div>
          <div className="mb-5 font-brand text-xs tracking-[0.8em] text-gradient">CONNECT</div>
          <ul className="space-y-2.5">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm text-white/85"><p.icon size={16} className="shrink-0 text-primary" />{p.text}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* vpravo: přihlašovací panel */}
      <div className="relative lg:-ml-6">
        <div className="hud hud-brackets relative p-9 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur [--ch:18px]">
          <div className="hud-label mb-2">{t("eyebrow.account")}</div>
          <h1 className="font-display text-[28px] font-extrabold uppercase leading-tight tracking-[0.08em]">
            {pending ? t("account.pendingTitle") : t("signin.title")}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{pending ? t("account.pendingText") : t("signin.text")}</p>
          {auth?.error && <p role="alert" className="mt-4 border-l-2 border-danger bg-danger/10 px-3 py-2 text-sm text-danger">{auth.error}</p>}

          <div className="mt-7 space-y-3">
            {pending ? (<>
              <Button size="lg" className="w-full" onClick={() => bridge.auth.signIn()}><Loader2 size={18} className="animate-spin" />{t("account.reopen")}</Button>
              <Button size="lg" variant="secondary" className="w-full" onClick={() => bridge.auth.cancel()}><X size={16} />{t("key.cancel")}</Button>
            </>) : (<>
              <Button size="lg" className="w-full" onClick={() => bridge.auth.signIn()}><LogIn size={18} />{t("signin.button")}</Button>
              <Button size="lg" variant="secondary" className="w-full" onClick={() => bridge.openExternal(`${WEB}/auth?mode=signup`)}><ExternalLink size={16} />{t("signin.register")}</Button>
            </>)}
          </div>

          <div className="mt-7 flex items-start gap-3 border-t border-border/60 pt-5 text-xs leading-relaxed text-subtle">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
            <span>{t("signin.secure")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
