import type { Product } from "@connect/catalog-client";
import { Button } from "@connect/ui";
import { KeyRound, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { bridge } from "../lib/bridge";

// Zadání přístupového klíče (Voxar.app, VoxarioProtect) – klíč ověří web (app-access), Connect ho nikam neukládá
export function KeyDialog({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await bridge.library.redeemKey(product.id, code);
      if (r.ok) onDone();
      else setError(t(`key.err_${r.reason === "empty" ? "empty" : r.reason === "invalid" ? "invalid" : "error"}`));
    } catch { setError(t("key.err_error")); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="key-title" onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); void submit(); }} onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="w-full max-w-md rounded-[calc(var(--radius)*1.4)] border border-border bg-surface p-6 shadow-glow">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary"><KeyRound size={22} /></span>
          <div><h2 id="key-title" className="font-display text-lg font-bold">{t("key.title")}</h2><p className="text-sm text-muted">{t("key.for", { name: product.name })}</p></div>
        </div>
        <p className="mb-4 text-sm text-muted">{t("key.text")}</p>
        <input ref={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" maxLength={120} autoComplete="off" spellCheck={false}
          aria-invalid={!!error} className="h-12 w-full rounded-[var(--radius)] border border-border bg-surface-2 px-4 font-mono text-base tracking-wider outline-none focus:border-primary" />
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>{t("key.cancel")}</Button>
          <Button type="submit" disabled={busy || !code.trim()}>{busy && <Loader2 size={16} className="animate-spin" />}{t("key.unlock")}</Button>
        </div>
      </form>
    </div>
  );
}
