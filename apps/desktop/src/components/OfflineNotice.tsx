import { CloudOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { bridge } from "../lib/bridge";
import { useCatalog } from "../lib/catalog";
import { useQueryClient } from "@tanstack/react-query";

export function OfflineNotice() {
  const { t } = useTranslation();
  const { data } = useCatalog();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!data?.offline) return null;
  return (
    <div role="status" className="mb-5 flex items-center gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
      <CloudOff size={16} /> {t("catalog.offline")}
      <button disabled={busy} onClick={async () => { setBusy(true); try { qc.setQueryData(["catalog"], await bridge.catalog.refresh()); } finally { setBusy(false); } }}
        className="ml-auto flex items-center gap-1.5 rounded px-2 py-1 font-semibold hover:bg-warning/15">
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} />{t("catalog.refresh")}
      </button>
    </div>
  );
}
