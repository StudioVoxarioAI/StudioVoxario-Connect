import { Badge, Button } from "@connect/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, FolderPlus, HardDrive, ShieldCheck, Star, Trash2, Truck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LibraryFolder, Settings as MainSettings } from "../../electron/preload";
import { Page } from "../components/Page";
import { toast } from "../components/Toasts";
import { bridge, isDesktop } from "../lib/bridge";
import { useCatalog } from "../lib/catalog";
import { formatBytes, useInstalls, useMainSettings, useUpdater } from "../lib/installs";
import { useSettings } from "../lib/settings";

const sections = ["downloads", "general", "appearance", "notifications", "diagnostics"] as const;
type Section = (typeof sections)[number];

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-0">
      <div className="min-w-0"><div className="font-ui text-[15px] font-semibold">{label}</div>{hint && <div className="mt-0.5 text-sm text-subtle">{hint}</div>}</div>
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

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-surface-3 border border-border"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

const inputCls = "h-9 rounded-[var(--radius)] border border-border bg-surface-2 px-3 text-sm";

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mb-6 rounded-[calc(var(--radius)*1.4)] border border-border bg-surface px-6 py-4">
      <div className="mb-1 flex items-center justify-between"><h2 className="font-display text-base font-bold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function useLibraries() {
  const qc = useQueryClient();
  const q = useQuery<LibraryFolder[]>({ queryKey: ["libraries"], queryFn: () => bridge.system.libraries() });
  const set = (v: LibraryFolder[]) => { qc.setQueryData(["libraries"], v); void qc.invalidateQueries({ queryKey: ["installs"] }); };
  return { ...q, set };
}

function Libraries() {
  const { t, i18n } = useTranslation();
  const libs = useLibraries();
  const { data: inst } = useInstalls();
  const { data: catalog } = useCatalog();
  const [moving, setMoving] = useState<{ id: string; done: number; total: number } | null>(null);
  useEffect(() => bridge.system.onRelocate((p) => setMoving(p)), []);
  // hry ve složce počítá UI z živého stavu instalací (po instalaci/přesunu se hned změní)
  const parent = (d: string) => d.slice(0, Math.max(d.lastIndexOf("/"), d.lastIndexOf("\\")));
  const gamesIn = (dir: string) => Object.entries(inst?.installs ?? {}).filter(([, r]) => parent(r.dir) === dir).map(([k]) => k);
  const name = (id: string) => catalog?.products.find((p) => p.id === id)?.name ?? id;
  const relocate = async (id: string, dir: string) => {
    setMoving({ id, done: 0, total: inst?.installs[id]?.sizeOnDisk ?? 0 });
    const r = await bridge.system.relocate(id, dir);
    setMoving(null);
    if (r.ok) { libs.set(r.value); toast("info", t("settings.moved", { name: name(id) })); } else toast("error", r.error);
  };
  return (
    <Card title={t("settings.libraries")} action={<Button size="sm" variant="secondary" disabled={!isDesktop} onClick={async () => libs.set(await bridge.system.addLibrary())}><FolderPlus size={15} />{t("settings.addLibrary")}</Button>}>
      <p className="mb-3 text-sm text-subtle">{t("settings.librariesText")}</p>
      <ul className="space-y-3">
        {(libs.data ?? []).map((l) => {
          const games = gamesIn(l.path);
          const used = l.total && l.free !== undefined ? 1 - l.free / l.total : 0;
          return (
            <li key={l.path} className="rounded-[var(--radius)] border border-border bg-surface-2 p-4">
              <div className="flex items-center gap-3">
                <HardDrive size={18} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm" title={l.path}>{l.path}</div>
                  <div className="mt-0.5 text-xs text-subtle">
                    {l.free !== undefined ? t("settings.free", { free: formatBytes(l.free, i18n.language), total: formatBytes(l.total ?? 0, i18n.language) }) : t("settings.unavailable")}
                    {" · "}{t("settings.games", { count: games.length })}
                  </div>
                </div>
                {l.isDefault ? <Badge tone="primary"><span className="inline-flex items-center gap-1"><Star size={12} />{t("settings.default")}</span></Badge>
                  : <Button size="sm" variant="ghost" onClick={async () => libs.set(await bridge.system.setDefaultLibrary(l.path))}>{t("settings.makeDefault")}</Button>}
                {!l.isDefault && (
                  <Button size="sm" variant="ghost" aria-label={t("settings.removeLibrary")} disabled={games.length > 0}
                    onClick={async () => { const r = await bridge.system.removeLibrary(l.path); if (r.ok) libs.set(r.value); else toast("error", r.error); }}><Trash2 size={15} /></Button>
                )}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className={`h-full ${used > 0.9 ? "bg-danger" : "bg-primary"}`} style={{ width: `${Math.round(used * 100)}%` }} /></div>
              {!l.writable && <p className="mt-2 text-xs text-danger">{t("settings.notWritable")}</p>}
              {games.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {games.map((id) => (
                    <li key={id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 font-semibold">{name(id)}</span>
                      <span className="text-subtle">{formatBytes(inst?.installs[id]?.sizeOnDisk ?? 0, i18n.language)}</span>
                      {moving?.id === id ? (
                        <span className="w-40 text-right text-xs text-primary">{t("settings.moving", { p: moving.total ? Math.round((moving.done / moving.total) * 100) : 0 })}</span>
                      ) : (libs.data ?? []).length > 1 ? (
                        <select aria-label={t("settings.moveTo")} value="" disabled={!!moving || inst?.installs[id]?.running}
                          onChange={(e) => e.target.value && void relocate(id, e.target.value)} className={`${inputCls} w-40`}>
                          <option value="">{t("settings.moveTo")}</option>
                          {(libs.data ?? []).filter((x) => x.path !== l.path && x.writable).map((x) => <option key={x.path} value={x.path}>{x.path}</option>)}
                        </select>
                      ) : null}
                      <Button size="sm" variant="ghost" aria-label={t("library.openFolder")} onClick={() => void bridge.installs.openFolder(id)}><FolderOpen size={15} /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// 24hodinový čas nezávisle na jazyku systému (input type=time by v anglickém Windows ukázal AM/PM)
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
function TimeSelect({ value, onChange, label, disabled }: { value: string; onChange: (v: string) => void; label: string; disabled?: boolean }) {
  const opts = TIMES.includes(value) ? TIMES : [value, ...TIMES];
  return (
    <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${inputCls} w-24 font-mono disabled:opacity-50`}>
      {opts.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>
  );
}

const SPEEDS = [0, 1024, 5120, 10240, 25600, 51200];

function Downloads({ s, set }: { s: MainSettings; set: (p: Partial<MainSettings>) => void }) {
  const { t, i18n } = useTranslation();
  const { data: catalog } = useCatalog();
  const beta = (catalog?.products ?? []).filter((p) => p.build?.channels?.beta);
  return (<>
    <Libraries />
    <Card title={t("settings.limits")}>
      <Row label={t("settings.speedLimit")} hint={t("settings.speedLimitText")}>
        <select aria-label={t("settings.speedLimit")} value={SPEEDS.includes(s.speedLimitKBps) ? s.speedLimitKBps : 0} onChange={(e) => set({ speedLimitKBps: Number(e.target.value) })} className={`${inputCls} w-44`}>
          {SPEEDS.map((v) => <option key={v} value={v}>{v ? `${formatBytes(v * 1024, i18n.language)}/s` : t("settings.unlimited")}</option>)}
        </select>
      </Row>
      <Row label={t("settings.connections")} hint={t("settings.connectionsText")}>
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={8} value={s.connections} aria-label={t("settings.connections")} onChange={(e) => set({ connections: Number(e.target.value) })} className="w-36 accent-[hsl(var(--primary))]" />
          <span className="w-4 text-right font-mono">{s.connections}</span>
        </div>
      </Row>
      <Row label={t("settings.schedule")} hint={t("settings.scheduleText")}>
        <div className="flex items-center gap-3">
          <TimeSelect label={t("settings.from")} value={s.schedule.from} disabled={!s.schedule.enabled} onChange={(v) => set({ schedule: { ...s.schedule, from: v } })} />
          <span className="text-subtle">–</span>
          <TimeSelect label={t("settings.to")} value={s.schedule.to} disabled={!s.schedule.enabled} onChange={(v) => set({ schedule: { ...s.schedule, to: v } })} />
          <Toggle label={t("settings.schedule")} on={s.schedule.enabled} onChange={(v) => set({ schedule: { ...s.schedule, enabled: v } })} />
        </div>
      </Row>
    </Card>
    <Card title={t("settings.updates")}>
      <Row label={t("settings.autoUpdate")} hint={t("settings.autoUpdateText")}><Toggle label={t("settings.autoUpdate")} on={s.autoUpdate} onChange={(v) => set({ autoUpdate: v })} /></Row>
      <Row label={t("settings.onlyIdle")} hint={t("settings.onlyIdleText")}><Toggle label={t("settings.onlyIdle")} on={s.autoUpdateOnlyIdle} onChange={(v) => set({ autoUpdateOnlyIdle: v })} /></Row>
      {beta.map((p) => (
        <Row key={p.id} label={t("settings.channel", { name: p.name })} hint={t("settings.channelText")}>
          <Segmented value={s.channels[p.id] ?? "stable"} onChange={(v) => set({ channels: { ...s.channels, [p.id]: v } })}
            options={[{ v: "stable", label: t("settings.stable") }, { v: "beta", label: "Beta" }]} />
        </Row>
      ))}
    </Card>
  </>);
}

function LegacyRow() {
  const { t } = useTranslation();
  const { data: catalog } = useCatalog();
  const { data: inst } = useInstalls();
  const games = (catalog?.products ?? []).filter((p) => p.build?.kind === "voxario-manifest" && !inst?.installs[p.id]);
  const [pick, setPick] = useState("");
  return (
    <Row label={t("settings.legacy")} hint={t("settings.legacyText")}>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" disabled={!isDesktop} onClick={async () => { const n = await bridge.system.adoptLegacy(); if (!n) toast("info", t("settings.legacyNone")); }}>{t("settings.legacyScan")}</Button>
        {games.length > 0 && (
          <select aria-label={t("settings.legacyPick")} value={pick} disabled={!isDesktop} className={`${inputCls} w-44`}
            onChange={async (e) => { const id = e.target.value; setPick(""); if (!id) return; const r = await bridge.system.adoptFolder(id); if (r.ok) toast("adopted", t("notify.adopted", { name: games.find((g) => g.id === id)?.name })); else if (r.error) toast("error", r.error); }}>
            <option value="">{t("settings.legacyPick")}</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </div>
    </Row>
  );
}

function UpdaterRow() {
  const { t } = useTranslation();
  const { data: u } = useUpdater();
  const info = useQuery({ queryKey: ["app-info"], queryFn: () => bridge.appInfo() });
  const st = u?.state ?? "disabled";
  return (
    <Row label={t("updater.title", { v: info.data?.version ?? "…" })} hint={t(`updater.${st}`, { v: u?.version, p: u?.percent ?? 0, e: u?.error ?? "" })}>
      {st === "ready" ? <Button size="sm" onClick={() => bridge.updater.install()}>{t("updater.restart")}</Button>
        : <Button size="sm" variant="secondary" disabled={st === "disabled" || st === "checking" || st === "downloading"} onClick={() => void bridge.updater.check()}>{t("updater.check")}</Button>}
    </Row>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const [sec, setSec] = useState<Section>(() => (new URLSearchParams(location.hash.split("?")[1]).get("s") as Section) || "downloads");
  const ui = useSettings();
  const { data: s } = useMainSettings();
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["app-info"], queryFn: () => bridge.appInfo() });
  const set = (patch: Partial<MainSettings>) => { if (s) qc.setQueryData(["main-settings"], { ...s, ...patch }); void bridge.settings.set(patch); };
  return (
    <Page title={t("settings.title")}>
      <div className="flex gap-8">
        <nav className="w-60 shrink-0 space-y-1">
          {sections.map((k) => (
            <button key={k} onClick={() => setSec(k)} aria-current={sec === k}
              className={`w-full rounded-[var(--radius)] px-3 py-2 text-left font-ui text-[15px] font-semibold ${sec === k ? "bg-primary/10 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"}`}>
              {t(`settings.sections.${k}`)}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {sec === "downloads" && s && <Downloads s={s} set={set} />}
          {sec === "general" && s && (
            <Card title={t("settings.sections.general")}>
              <Row label={t("settings.language")}><Segmented value={ui.lang} onChange={ui.setLang} options={[{ v: "cs", label: "Čeština" }, { v: "en", label: "English" }]} /></Row>
              <Row label={t("settings.afterLaunch")}>
                <Segmented value={ui.afterLaunch} onChange={ui.setAfterLaunch}
                  options={[{ v: "minimize", label: t("settings.minimize") }, { v: "close", label: t("settings.close") }, { v: "keep", label: t("settings.keep") }]} />
              </Row>
              <Row label={t("settings.startup")} hint={t("settings.startupText")}><Toggle label={t("settings.startup")} on={s.launchOnStartup} onChange={(v) => set({ launchOnStartup: v })} /></Row>
              <Row label={t("settings.tray")} hint={t("settings.trayText")}><Toggle label={t("settings.tray")} on={s.minimizeToTray} onChange={(v) => set({ minimizeToTray: v })} /></Row>
              <Row label={t("settings.launcherChannel")} hint={t("settings.launcherChannelText")}>
                <Segmented value={s.launcherChannel} onChange={(v) => { set({ launcherChannel: v }); setTimeout(() => void bridge.updater.check(), 300); }} options={[{ v: "stable", label: t("settings.stable") }, { v: "beta", label: "Beta" }]} />
              </Row>
              <UpdaterRow />
            </Card>
          )}
          {sec === "appearance" && (
            <Card title={t("settings.sections.appearance")}>
              <Row label={t("settings.theme")}><Segmented value={ui.theme} onChange={ui.setTheme} options={[{ v: "dark", label: t("settings.dark") }, { v: "light", label: t("settings.light") }]} /></Row>
            </Card>
          )}
          {sec === "notifications" && s && (
            <Card title={t("settings.sections.notifications")}>
              <p className="mb-1 text-sm text-subtle">{t("settings.notifText")}</p>
              {(["done", "update", "sale"] as const).map((k) => (
                <Row key={k} label={t(`settings.notif_${k}`)}><Toggle label={t(`settings.notif_${k}`)} on={s.notifications[k]} onChange={(v) => set({ notifications: { ...s.notifications, [k]: v } })} /></Row>
              ))}
            </Card>
          )}
          {sec === "diagnostics" && s && (
            <Card title={t("settings.sections.diagnostics")}>
              <Row label={t("settings.version")}><span className="font-mono text-muted">{info.data?.version ?? "…"}</span></Row>
              <Row label={t("settings.platform")}><span className="font-mono text-muted">{info.data?.platform ?? "…"}</span></Row>
              <Row label={t("settings.verifyAll")} hint={t("settings.verifyAllText")}>
                <Button size="sm" variant="secondary" disabled={!isDesktop} onClick={async () => toast("info", t("settings.verifyQueued", { count: await bridge.system.verifyAll() }))}><ShieldCheck size={15} />{t("settings.verify")}</Button>
              </Row>
              <LegacyRow />
              <Row label={t("settings.clearCache")} hint={t("settings.clearCacheText")}>
                <Button size="sm" variant="secondary" disabled={!isDesktop} onClick={async () => toast("info", t("settings.cleared", { v: formatBytes(await bridge.system.clearCache()) }))}><Trash2 size={15} />{t("settings.clear")}</Button>
              </Row>
              <Row label={t("settings.exportLogs")} hint={t("settings.exportLogsText")}>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={!isDesktop} onClick={() => void bridge.system.openLogs()}><FolderOpen size={15} />{t("settings.openLogs")}</Button>
                  <Button size="sm" variant="secondary" disabled={!isDesktop} onClick={async () => { const p = await bridge.system.exportLogs(); if (p) toast("info", t("settings.exported")); }}><Truck size={15} />{t("settings.export")}</Button>
                </div>
              </Row>
              <Row label={t("settings.telemetry")} hint={t("settings.telemetryText")}><Toggle label={t("settings.telemetry")} on={s.telemetry} onChange={(v) => set({ telemetry: v })} /></Row>
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}
