import type { Product } from "@connect/catalog-client";
import { Button } from "@connect/ui";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

// Instalace / spuštění / aktualizace – napojí se ve Fázi 3 (installer-core v hlavním procesu)
export function InstallPanel({ p: _p }: { p: Product }) {
  const { t } = useTranslation();
  return <Button size="lg" className="flex-1" disabled title={t("library.installSoon")}><Download size={17} />{t("library.install")}</Button>;
}
