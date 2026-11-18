import { useQuery } from "@tanstack/react-query";
import { HardDrive, Wifi, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/account";
import { bridge } from "../lib/bridge";
import { useCatalog } from "../lib/catalog";
import { formatBytes, useInstalls } from "../lib/installs";

// Stavová lišta dole (HUD): spojení s webem, aktuální stahování, rychlost, volné místo, verze.
export function StatusDock() {
  const { t, i18n } = useTranslation();
  const { data: cat } = useCatalog();
  const { data: auth } = useAuth();
  const { data: inst } = useInstalls();
  const info = useQuery({ queryKey: ["app-info"], queryFn: () => bridge.appInfo() });
  const online = !cat?.offline && !auth?.offline;
  const job = inst?.jobs.find((j) => j.phase === "downloading" || j.phase === "verifying" || j.phase === "installing") ?? inst?.jobs[0];
  const name = job ? cat?.products.find((p) => p.id === job.productId)?.name ?? job.productId : "";
  const pct = job?.totalBytes ? Math.min(100, (job.doneBytes / job.totalBytes) * 100) : 0;
  return (
    <footer className="flex h-7 shrink-0 items-center gap-5 border-t border-border/70 bg-background px-4 font-mono text-[11px] text-subtle">
      <span className={`flex items-center gap-1.5 ${online ? "text-success" : "text-warning"}`}>
        {online ? <Wifi size={12} /> : <WifiOff size={12} />}{online ? t("dock.online") : t("dock.offline")}
      </span>
      <Link to="/downloads" className="flex min-w-0 items-center gap-2 hover:text-foreground">
        {job ? (<>
          <span className="truncate text-muted">{t(`job.${job.phase}`)} · {name}</span>
          <span className="relative h-1 w-28 overflow-hidden bg-surface-3"><span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${pct}%` }} /></span>
          <span>{pct.toFixed(0)} %</span>
          {job.phase === "downloading" && <span className="text-primary">{formatBytes(inst?.speed ?? 0, i18n.language)}/s</span>}
        </>) : <span>{t("top.noDownloads")}</span>}
      </Link>
      <span className="ml-auto flex items-center gap-1.5"><HardDrive size={12} />{inst?.diskFree !== undefined ? t("dock.free", { v: formatBytes(inst.diskFree, i18n.language) }) : "—"}</span>
      <span>CONNECT {info.data?.version ?? ""}</span>
    </footer>
  );
}
