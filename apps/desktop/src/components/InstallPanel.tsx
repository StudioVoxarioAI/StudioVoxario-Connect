import type { Product } from "@connect/catalog-client";
import { Button } from "@connect/ui";
import { Download, FolderOpen, Loader2, MoreHorizontal, Pause, Play, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLibraryItem } from "../lib/account";
import { bridge } from "../lib/bridge";
import { formatBytes, useInstalls, useMainSettings } from "../lib/installs";
import { useSettings } from "../lib/settings";
import { toast } from "./Toasts";

const installable = (p: Product) => p.build?.kind === "voxario-manifest";

// Instalace / průběh / Hrát / Aktualizovat / Spravovat podle stavu (SPEC 6.3, 6.8)
export function InstallPanel({ p }: { p: Product }) {
  const { t, i18n } = useTranslation();
  const { data } = useInstalls();
  const item = useLibraryItem(p.id);
  const after = useSettings((s) => s.afterLaunch);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<"install" | "uninstall" | null>(null);
  const rec = data?.installs[p.id];
  const job = data?.jobs.find((j) => j.productId === p.id);
  const run = async (mode: "install" | "update" | "repair", dir?: string) => {
    const r = await bridge.installs.install(p.id, mode, dir);
    if (!r.ok) toast("error", r.error);
  };
  if (!installable(p)) return <Button size="lg" className="flex-1" disabled title={t("library.appSoon")}><Download size={17} />{t("library.install")}</Button>;
  if (!item?.owned) return <Button size="lg" className="flex-1" disabled><Download size={17} />{t("library.install")}</Button>;
  if (job && job.phase !== "error") {
    const pct = job.totalBytes ? Math.min(100, (job.doneBytes / job.totalBytes) * 100) : 0;
    const paused = job.phase === "paused";
    return (
      <div className="flex flex-1 items-center gap-2">
        <div className="relative h-12 flex-1 overflow-hidden rounded-[var(--radius)] border border-primary/40 bg-surface">
          <div className="absolute inset-y-0 left-0 bg-primary/25 transition-all" style={{ width: `${pct}%` }} />
          <div className="relative flex h-full items-center justify-between px-3 text-sm">
            <span className="font-ui font-semibold">{t(`job.${job.phase}`)} {job.phase === "downloading" || paused ? `${pct.toFixed(0)} %` : ""}</span>
            <span className="text-xs text-muted">{formatBytes(job.doneBytes, i18n.language)} / {formatBytes(job.totalBytes, i18n.language)}</span>
          </div>
        </div>
        <button aria-label={paused ? t("job.resume") : t("job.pause")} onClick={() => (paused ? bridge.installs.resume(p.id) : bridge.installs.pause(p.id))}
          className="grid h-12 w-12 place-items-center rounded-[var(--radius)] border border-border bg-surface hover:border-primary/40">{paused ? <Play size={17} /> : <Pause size={17} />}</button>
        <button aria-label={t("job.cancel")} onClick={() => bridge.installs.cancel(p.id)} className="grid h-12 w-12 place-items-center rounded-[var(--radius)] border border-border bg-surface hover:border-danger/50 hover:text-danger"><X size={17} /></button>
      </div>
    );
  }
  return (
    <div className="relative flex flex-1 items-center gap-2">
      {!rec ? (
        <Button size="lg" className="flex-1" onClick={() => setDialog("install")}><Download size={17} />{job?.phase === "error" ? t("job.retry") : t("library.install")}</Button>
      ) : rec.running ? (
        <Button size="lg" className="flex-1" variant="secondary" disabled><Loader2 size={17} className="animate-spin" />{t("library.running")}</Button>
      ) : rec.updateAvailable ? (
        <Button size="lg" className="flex-1" onClick={() => run("update")}><RefreshCw size={17} />{t("library.update")}</Button>
      ) : (
        <Button size="lg" className="flex-1" onClick={async () => { const r = await bridge.installs.launch(p.id, after); if (!r.ok) toast("error", r.error ?? ""); }}>
          <Play size={17} fill="currentColor" />{p.type === "game" ? t("library.play") : t("library.launch")}
        </Button>
      )}
      {rec && (
        <button aria-label={t("library.manage")} aria-expanded={menu} onClick={() => setMenu((v) => !v)}
          className="grid h-12 w-12 place-items-center rounded-[var(--radius)] border border-border bg-surface/90 hover:border-primary/40"><MoreHorizontal size={18} /></button>
      )}
      {menu && rec && (
        <div role="menu" className="absolute right-0 top-14 z-30 w-60 overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-card" onMouseLeave={() => setMenu(false)}>
          {[
            { icon: <ShieldCheck size={15} />, label: t("library.verify"), fn: () => run("repair") },
            { icon: <FolderOpen size={15} />, label: t("library.openFolder"), fn: () => bridge.installs.openFolder(p.id) },
            { icon: <Trash2 size={15} />, label: t("library.uninstall"), fn: () => setDialog("uninstall"), danger: true },
          ].map((m) => (
            <button key={m.label} role="menuitem" disabled={rec.running} onClick={() => { setMenu(false); m.fn(); }}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-surface-2 disabled:opacity-40 ${m.danger ? "text-danger" : ""}`}>{m.icon}{m.label}</button>
          ))}
        </div>
      )}
      {dialog === "install" && <InstallDialog p={p} onClose={() => setDialog(null)} onConfirm={(dir) => { setDialog(null); void run("install", dir); }} />}
      {dialog === "uninstall" && <UninstallDialog p={p} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Modal({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="w-full max-w-lg rounded-[calc(var(--radius)*1.4)] border border-border bg-surface p-6 text-left shadow-glow">{children}</div>
    </div>
  );
}

function InstallDialog({ p, onClose, onConfirm }: { p: Product; onClose: () => void; onConfirm: (dir: string) => void }) {
  const { t, i18n } = useTranslation();
  const { data: s } = useMainSettings();
  const { data } = useInstalls();
  const libs = s?.libraries.length ? s.libraries : [data?.defaultLibrary ?? ""];
  const [dir, setDir] = useState(libs[0] ?? "");
  const need = (p.sizeBytes ?? 0) * 1.05;
  const enough = data?.diskFree === undefined || data.diskFree >= need;
  return (
    <Modal onClose={onClose} label={t("install.title", { name: p.name })}>
      <h2 className="mb-1 font-display text-lg font-bold">{t("install.title", { name: p.name })}</h2>
      <p className="mb-5 text-sm text-muted">{t("install.text")}</p>
      <label className="mb-1 block text-xs uppercase tracking-wider text-subtle">{t("install.target")}</label>
      <select value={dir} onChange={(e) => setDir(e.target.value)} className="mb-4 h-11 w-full rounded-[var(--radius)] border border-border bg-surface-2 px-3">
        {libs.map((l) => <option key={l} value={l}>{l || t("install.defaultLibrary")}</option>)}
      </select>
      <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[var(--radius)] bg-surface-2 p-3"><div className="text-xs text-subtle">{t("install.size")}</div><div className="font-semibold">{p.sizeBytes ? formatBytes(p.sizeBytes, i18n.language) : "—"}</div></div>
        <div className="rounded-[var(--radius)] bg-surface-2 p-3"><div className="text-xs text-subtle">{t("install.free")}</div><div className={`font-semibold ${enough ? "" : "text-danger"}`}>{data?.diskFree !== undefined ? formatBytes(data.diskFree, i18n.language) : "—"}</div></div>
      </div>
      {!enough && <p role="alert" className="mb-4 text-sm text-danger">{t("install.noSpace")}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>{t("key.cancel")}</Button>
        <Button disabled={!enough} onClick={() => onConfirm(dir)}><Download size={16} />{t("library.install")}</Button>
      </div>
    </Modal>
  );
}

function UninstallDialog({ p, onClose }: { p: Product; onClose: () => void }) {
  const { t } = useTranslation();
  const [keep, setKeep] = useState(true);
  return (
    <Modal onClose={onClose} label={t("uninstall.title", { name: p.name })}>
      <h2 className="mb-2 font-display text-lg font-bold">{t("uninstall.title", { name: p.name })}</h2>
      <p className="mb-4 text-sm text-muted">{t("uninstall.text")}</p>
      <label className="mb-6 flex items-center gap-3 text-sm"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />{t("uninstall.keep")}</label>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>{t("key.cancel")}</Button>
        <Button variant="danger" onClick={async () => { const r = await bridge.installs.uninstall(p.id, keep); if (!r.ok) toast("error", r.error); onClose(); }}><Trash2 size={16} />{t("library.uninstall")}</Button>
      </div>
    </Modal>
  );
}
