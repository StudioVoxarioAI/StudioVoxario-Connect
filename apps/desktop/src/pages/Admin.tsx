// Správa (jen správce / editor): kdo smí stáhnout a hrát Ashes of Eryon a Fantasy.
// Stejná data jako na webu (Administrace → Přístupy ke hrám); oprávnění ověřuje web.
import { Button, EmptyState } from "@connect/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AccessRow } from "../../electron/preload";
import { Page } from "../components/Page";
import { toast } from "../components/Toasts";
import { useLibrary } from "../lib/account";
import { bridge } from "../lib/bridge";
import { useCatalog } from "../lib/catalog";

const clean = (e: string) => e.replace(/^HTTP \d+:?\s*/, "") || e;

export function Admin() {
  const { t, i18n } = useTranslation();
  const { data: lib } = useLibrary();
  const { data: catalog } = useCatalog();
  const games = lib?.manages ?? [];
  const [game, setGame] = useState<string>("");
  const current = game || games[0] || "";
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-access", current], enabled: !!current,
    queryFn: async () => { const r = await bridge.admin.list(current); if (!r.ok) throw new Error(clean(r.error)); return r.value; },
  });
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (rows: AccessRow[]) => qc.setQueryData(["admin-access", current], rows);
  const name = (id: string) => catalog?.products.find((p) => p.id === id)?.name ?? id;

  if (!games.length) {
    return <Page eyebrow={t("eyebrow.admin")} title={t("admin.title")}><EmptyState icon={<ShieldCheck size={34} />} title={t("admin.noRights")} text={t("admin.noRightsText")} /></Page>;
  }
  const grant = async () => {
    setBusy(true);
    const r = await bridge.admin.grant(current, who, note);
    setBusy(false);
    if (r.ok) { set(r.value); setWho(""); setNote(""); toast("done", t("admin.granted", { who, game: name(current) })); } else toast("error", clean(r.error));
  };
  const revoke = async (row: AccessRow) => {
    setBusy(true);
    const r = await bridge.admin.revoke(current, row.user_id);
    setBusy(false);
    if (r.ok) { set(r.value); toast("info", t("admin.revoked", { who: row.name ?? row.email ?? "", game: name(current) })); } else toast("error", clean(r.error));
  };
  const inputCls = "hud-btn [--ch:6px] h-11 w-full border border-border bg-surface-2 px-3 text-sm";
  return (
    <Page eyebrow={t("eyebrow.admin")} title={t("admin.title")}>
      <p className="-mt-3 mb-6 max-w-3xl text-sm text-muted">{t("admin.lead")}</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {games.map((g) => (
          <Button key={g} variant={g === current ? "primary" : "secondary"} onClick={() => setGame(g)}>{name(g)}</Button>
        ))}
      </div>

      <section className="hud mb-6 p-5">
        <div className="hud-label mb-3">{t("admin.grantTitle", { game: name(current) })}</div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block text-xs text-subtle">{t("admin.who")}<input value={who} onChange={(e) => setWho(e.target.value)} placeholder="hrac@example.com" className={`${inputCls} mt-1 text-foreground`} /></label>
          <label className="block text-xs text-subtle">{t("admin.note")}<input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("admin.notePh")} className={`${inputCls} mt-1 text-foreground`} /></label>
          <Button size="lg" disabled={busy || who.trim().length < 2} onClick={() => void grant()}>{busy ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}{t("admin.grant")}</Button>
        </div>
      </section>

      <section className="hud">
        <div className="flex items-center justify-between px-5 pt-4"><div className="hud-label">{t("admin.list", { count: list.data?.length ?? 0 })}</div></div>
        {list.isLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          : list.error ? <p role="alert" className="p-5 text-sm text-danger">{(list.error as Error).message}</p>
          : !list.data?.length ? <p className="p-6 text-sm text-subtle">{t("admin.empty")}</p>
          : (
            <ul className="divide-y divide-border/60 p-2">
              {list.data.map((r) => (
                <li key={r.user_id} className="flex items-center gap-4 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-ui font-semibold">{r.name ?? r.email ?? r.user_id}</div>
                    <div className="truncate font-mono text-[11px] text-subtle">{r.email}{r.note ? ` · ${r.note}` : ""} · {new Date(r.created_at).toLocaleDateString(i18n.language === "cs" ? "cs-CZ" : "en-US")}</div>
                  </div>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void revoke(r)}><Trash2 size={14} />{t("admin.revoke")}</Button>
                </li>
              ))}
            </ul>
          )}
      </section>
      <p className="mt-4 text-xs text-subtle">{t("admin.note2")}</p>
    </Page>
  );
}
