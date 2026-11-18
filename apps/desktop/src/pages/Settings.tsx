import { Badge, Button } from "@connect/ui";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "../components/Page";
import { bridge } from "../lib/bridge";
import { useSettings } from "../lib/settings";

const sections = ["downloads", "general", "appearance", "notifications", "diagnostics"] as const;

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-0">
      <div><div className="font-ui text-[15px] font-semibold">{label}</div>{hint && <div className="mt-0.5 text-sm text-subtle">{hint}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ v: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-[var(--radius)] border border-border bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={value === o.v}
          className={`rounded-[calc(var(--radius)-3px)] px-3 py-1 text-sm font-semibold ${value === o.v ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const [sec, setSec] = useState<(typeof sections)[number]>("general");
  const s = useSettings();
  const info = useQuery({ queryKey: ["app-info"], queryFn: () => bridge.appInfo() });
  return (
    <Page title={t("settings.title")}>
      <div className="flex gap-8">
        <div className="w-60 shrink-0 space-y-1">
          {sections.map((k) => (
            <button key={k} onClick={() => setSec(k)}
              className={`w-full rounded-[var(--radius)] px-3 py-2 text-left font-ui text-[15px] font-semibold ${sec === k ? "bg-primary/10 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"}`}>
              {t(`settings.sections.${k}`)}
            </button>
          ))}
        </div>
        <div className="flex-1 rounded-[calc(var(--radius)*1.4)] border border-border bg-surface px-6 py-2">
          {sec === "general" && (<>
            <Row label={t("settings.language")}><Segmented value={s.lang} onChange={s.setLang} options={[{ v: "cs", label: "Čeština" }, { v: "en", label: "English" }]} /></Row>
            <Row label={t("settings.afterLaunch")}>
              <Segmented value={s.afterLaunch} onChange={s.setAfterLaunch}
                options={[{ v: "minimize", label: t("settings.minimize") }, { v: "close", label: t("settings.close") }, { v: "keep", label: t("settings.keep") }]} />
            </Row>
          </>)}
          {sec === "appearance" && (
            <Row label={t("settings.theme")}><Segmented value={s.theme} onChange={s.setTheme} options={[{ v: "dark", label: t("settings.dark") }, { v: "light", label: t("settings.light") }]} /></Row>
          )}
          {sec === "downloads" && (<>
            <Row label={t("settings.libraries")} hint={t("settings.librariesText")}><Badge>{t("common.phase", { n: 4 })}</Badge></Row>
            <Row label={t("settings.limits")}><Badge>{t("common.phase", { n: 4 })}</Badge></Row>
            <Row label={t("settings.autoUpdate")}><Badge>{t("common.phase", { n: 4 })}</Badge></Row>
          </>)}
          {sec === "notifications" && (<>
            {(["notifDone", "notifUpdate", "notifSale"] as const).map((k) => <Row key={k} label={t(`settings.${k}`)}><Badge>{t("common.phase", { n: 4 })}</Badge></Row>)}
          </>)}
          {sec === "diagnostics" && (<>
            <Row label={t("settings.version")}><span className="font-mono text-muted">{info.data?.version ?? "…"}</span></Row>
            <Row label={t("settings.platform")}><span className="font-mono text-muted">{info.data?.platform ?? "…"}</span></Row>
            <Row label={t("settings.exportLogs")}><Button variant="secondary" size="sm" disabled>{t("common.phase", { n: 4 })}</Button></Row>
          </>)}
        </div>
      </div>
    </Page>
  );
}
