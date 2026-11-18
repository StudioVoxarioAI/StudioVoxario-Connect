// Navigace z hlavního procesu: deep linky studiovoxario:// (web, nákup) a nabídka ikony v liště.
//   studiovoxario://product/<id>                  -> detail produktu v obchodě
//   studiovoxario://library[/<id>]                -> knihovna (případně vybraná položka)
//   studiovoxario://purchase-complete?product=<id> -> obnovit knihovnu a licence, otevřít položku v knihovně
//   studiovoxario://downloads | settings | account
import { parseDeepLink } from "@connect/catalog-client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { bridge } from "../lib/bridge";
import { toast } from "./Toasts";

export function Navigator() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  useEffect(() => {
    const offNav = bridge.onNavigate((r) => nav(r));
    const offLink = bridge.onDeepLink((url) => {
      const d = parseDeepLink(url);
      if (!d) return;
      if (d.purchase) {
        void bridge.library.refresh().then((lib) => { qc.setQueryData(["library"], lib); void qc.invalidateQueries({ queryKey: ["licenses"] }); });
        toast("done", t("notify.purchase"));
      }
      nav(d.route);
    });
    return () => { offNav(); offLink(); };
  }, [nav, qc, t]);
  return null;
}
