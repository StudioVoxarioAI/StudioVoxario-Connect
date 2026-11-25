import { Button } from "@connect/ui";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { bridge } from "../lib/bridge";
import { useCatalog } from "../lib/catalog";
import { useInstalls } from "../lib/installs";
import { toast } from "./Toasts";

// Lišta pod horním menu: nainstalovaný software / hry mají novější verzi -> rovnou nabídnout „Aktualizovat“
// (engine se instaluje pro celý počítač, proto se jeho instalátor nespouští sám na pozadí).
export function UpdatesBar() {
  const { t } = useTranslation();
  const { data } = useInstalls();
  const { data: catalog } = useCatalog();
  const [hidden, setHidden] = useState<Record<string, string>>({});
  const items = Object.entries(data?.installs ?? {})
    .filter(([id, r]) => r.updateAvailable && !r.running && !data?.jobs.some((j) => j.productId === id))
    .map(([id, r]) => ({ id, from: r.version, p: catalog?.products.find((x) => x.id === id) }))
    .filter((x) => x.p && hidden[x.id] !== x.p.latestVersion);
  if (!items.length) return null;
  return (
    <div className="shrink-0 border-b border-primary/30 bg-primary/10">
      {items.map(({ id, from, p }) => (
        <div key={id} className="flex items-center gap-3 px-5 py-2 text-sm">
          <img src={p!.media.icon} alt="" className="h-7 w-7 border border-primary/40 object-cover" />
          <span className="min-w-0 flex-1 truncate">
            <b className="font-semibold">{t("updates.available", { name: p!.name })}</b>
            <span className="ml-2 text-muted">{from ? `${from} → ${p!.latestVersion}` : p!.latestVersion}</span>
          </span>
          <Button size="sm" onClick={async () => {
            const r = await bridge.installs.install(id, "update");
            if (!r.ok) toast("error", r.error);
            else toast("info", t("updates.started", { name: p!.name }));
          }}><RefreshCw size={14} />{t("library.update")}</Button>
          <button aria-label={t("updates.later")} title={t("updates.later")} onClick={() => setHidden((h) => ({ ...h, [id]: p!.latestVersion ?? "" }))}
            className="grid h-8 w-8 place-items-center text-muted hover:text-foreground"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}
