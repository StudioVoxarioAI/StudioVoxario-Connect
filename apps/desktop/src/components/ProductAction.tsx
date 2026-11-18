import type { Product } from "@connect/catalog-client";
import { Button } from "@connect/ui";
import { Check, KeyRound, Library, Loader2, Lock, LogIn, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth, useLibraryItem } from "../lib/account";
import { bridge } from "../lib/bridge";
import { InstallPanel } from "./InstallPanel";
import { KeyDialog } from "./KeyDialog";

// Hlavní tlačítko produktu podle stavu účtu a přístupu (Fáze 2); instalace se doplní ve Fázi 3
export function ProductAction({ p, size = "lg" }: { p: Product; size?: "md" | "lg" }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data: auth } = useAuth();
  const item = useLibraryItem(p.id);
  const [busy, setBusy] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const cls = "w-full";
  if (p.status === "coming_soon") return <Button size={size} className={cls} variant="secondary" disabled>{t("detail.follow")}</Button>;
  if (!auth?.signedIn) {
    return (
      <Button size={size} className={cls} disabled={auth?.pending} onClick={() => bridge.auth.signIn()}>
        {auth?.pending ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}{auth?.pending ? t("account.pendingShort") : t("detail.signInToGet")}
      </Button>
    );
  }
  const state = item?.state;
  if (state === "owned" && p.build?.kind === "voxario-manifest") return <div className="flex"><InstallPanel p={p} /></div>;
  if (state === "owned") return <Button size={size} className={cls} variant="secondary" onClick={() => nav(`/library?select=${p.id}`)}><Check size={17} />{t("detail.inLibrary")}</Button>;
  if (state === "claimable") {
    return (
      <Button size={size} className={cls} disabled={busy} onClick={async () => { setBusy(true); try { await bridge.library.claim(p.id); } finally { setBusy(false); } }}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Library size={17} />}{t("detail.addToLibrary")}
      </Button>
    );
  }
  if (state === "needs_key") {
    return (<>
      <Button size={size} className={cls} onClick={() => setKeyOpen(true)}><KeyRound size={17} />{t("detail.enterKey")}</Button>
      {keyOpen && <KeyDialog product={p} onClose={() => setKeyOpen(false)} onDone={() => setKeyOpen(false)} />}
    </>);
  }
  if (state === "needs_license") {
    const url = item?.license?.buyUrl ?? p.storeUrl;
    return <Button size={size} className={cls} onClick={() => url && bridge.openExternal(url)}><ShoppingCart size={17} />{t("detail.buy")}</Button>;
  }
  if (state === "no_access") return <Button size={size} className={cls} variant="secondary" disabled><Lock size={17} />{t("detail.noAccess")}</Button>;
  return <Button size={size} className={cls} disabled><Loader2 size={17} className="animate-spin" /></Button>;
}
