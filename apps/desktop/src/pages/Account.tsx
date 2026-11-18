import { Badge, Button, SectionTitle } from "@connect/ui";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../components/Avatar";
import { Page } from "../components/Page";
import { SignInPanel } from "../components/SignInPanel";
import { useAuth } from "../lib/account";
import { bridge } from "../lib/bridge";

const WEB = "https://studiovoxario.com";

export function Account() {
  const { t, i18n } = useTranslation();
  const { data: auth } = useAuth();
  const lic = useQuery({ queryKey: ["licenses", auth?.user?.id], queryFn: () => bridge.library.licenses(), enabled: !!auth?.signedIn, retry: 0 });
  const date = (s?: string) => (s ? new Date(s).toLocaleDateString(i18n.language === "cs" ? "cs-CZ" : "en-US") : "—");
  if (!auth?.signedIn) return <SignInPanel />;
  const u = auth.user!;
  return (
    <Page title={t("account.title")}>
      <section className="mb-8 flex items-center gap-5 hud p-6">
        <Avatar src={u.avatar} name={u.name} size={72} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl font-extrabold">{u.name}</div>
          <div className="text-muted">{u.email}</div>
          <div className="mt-1 text-sm text-subtle">{t("account.member", { d: date(u.createdAt) })}</div>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => bridge.openExternal(`${WEB}/profile`)}><ExternalLink size={15} />{t("account.manage")}</Button>
          <Button variant="ghost" onClick={() => bridge.auth.signOut()}><LogOut size={15} />{t("account.signOut")}</Button>
        </div>
      </section>
      {!auth.secureStorage && (
        <div className="mb-6 flex items-center gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning"><ShieldAlert size={16} />{t("account.noSecureStorage")}</div>
      )}
      <SectionTitle>{t("account.licenses")}</SectionTitle>
      <div className="mb-8 overflow-hidden hud">
        {lic.isLoading ? <div className="p-5 text-sm text-subtle"><Loader2 size={16} className="inline animate-spin" /></div>
          : lic.data?.length ? lic.data.map((l) => (
            <div key={l.productId} className="flex items-center justify-between border-b border-border/60 px-5 py-4 last:border-0">
              <div><div className="font-ui font-semibold">{l.title}</div><div className="text-sm text-subtle">{t("account.purchased", { d: date(l.purchasedAt) })}</div></div>
              <div className="text-right">
                <Badge tone={l.updatesActive ? "success" : "warning"}>{l.updatesActive ? t("account.updatesActive") : t("account.updatesEnded")}</Badge>
                <div className="mt-1 text-xs text-subtle">{t("account.updatesUntil", { d: date(l.updatesUntil) })}</div>
              </div>
            </div>
          )) : <div className="p-5 text-sm text-subtle">{lic.isError ? t("account.licensesError") : t("account.noLicenses")}</div>}
      </div>
      <SectionTitle>{t("account.purchases")}</SectionTitle>
      <Button variant="secondary" onClick={() => bridge.openExternal(`${WEB}/obchod`)}><ExternalLink size={15} />{t("account.purchasesWeb")}</Button>
    </Page>
  );
}
