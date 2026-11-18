import { Button, EmptyState } from "@connect/ui";
import { ExternalLink, LogIn, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Page } from "../components/Page";
import { bridge } from "../lib/bridge";

export function Account() {
  const { t } = useTranslation();
  return (
    <Page title={t("account.title")}>
      <EmptyState icon={<ShieldCheck size={38} />} title={t("account.guestTitle")} text={t("account.guestText")}
        action={
          <div className="mt-2 flex gap-3">
            <Button size="lg" disabled title={t("common.phase", { n: 2 })}><LogIn size={18} />{t("top.signIn")}</Button>
            <Button variant="secondary" size="lg" onClick={() => bridge.openExternal("https://studiovoxario.com/auth")}>
              <ExternalLink size={16} />{t("account.manage")}
            </Button>
          </div>
        } />
    </Page>
  );
}
