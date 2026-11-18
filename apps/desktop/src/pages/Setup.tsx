// Celoobrazovkový instalátor StudioVoxario Connect: obrázky her přes celé okno, logo, průběh, volby vlevo dole,
// hlavní tlačítko vpravo dole. Stejná obrazovka slouží k odinstalaci (--uninstall).
import { Check, FolderOpen, Loader2, Minus, Play, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SetupInfo } from "../../electron/preload";
import { bridge } from "../lib/bridge";
import { formatBytes } from "../lib/installs";

const SLIDES = [
  { img: "./catalog-media/ashes-of-eryon/hero.webp", name: "Ashes of Eryon" },
  { img: "./catalog-media/fantasy/hero.webp", name: "Fantasy" },
  { img: "./catalog-media/voxario-studio-engine/hero.webp", name: "Voxario Studio Engine" },
  { img: "./catalog-media/voxar-app/hero.webp", name: "Voxar.app" },
  { img: "./catalog-media/voxario-browser/hero.webp", name: "VoxarioBrowser" },
];

type Stage = "ready" | "installing" | "done" | "error";

function Check2({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/85">
      <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange(!on)}
        className={`hud-btn [--ch:4px] grid h-[18px] w-[18px] place-items-center border ${on ? "border-primary bg-primary text-primary-foreground" : "border-white/40 bg-black/30"}`}>
        {on && <Check size={13} strokeWidth={3} />}
      </button>
      {label}
    </label>
  );
}

export function Setup() {
  const { t, i18n } = useTranslation();
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [dir, setDir] = useState("");
  const [free, setFree] = useState<number | null>(null);
  const [opts, setOpts] = useState({ desktopShortcut: true, startMenu: true, autostart: false });
  const [keepData, setKeepData] = useState(true);
  const [stage, setStage] = useState<Stage>("ready");
  const [pct, setPct] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [slide, setSlide] = useState(0);

  useEffect(() => { void bridge.setup.info().then((i) => { setInfo(i); setDir(i.defaultDir); setFree(i.freeBytes); }); }, []);
  useEffect(() => { const id = setInterval(() => setSlide((v) => (v + 1) % SLIDES.length), 6000); return () => clearInterval(id); }, []);
  useEffect(() => bridge.setup.onProgress((p) => {
    setPct(p.pct);
    if (p.line) setLines((l) => [...l.slice(-4), p.line!]);
  }), []);

  const uninstallMode = info?.mode === "uninstall";
  const enough = free === null || !info || free >= info.requiredBytes * 1.1;
  const reinstall = !!info?.installedDir && !uninstallMode;

  const pick = async () => { const d = await bridge.setup.pick(dir); if (d) { setDir(d); setFree(await bridge.setup.free(d)); } };
  const start = async () => {
    setStage("installing"); setPct(0.01); setLines([]); setError("");
    const r = await bridge.setup.install({ dir, ...opts });
    if (r.ok) { setStage("done"); setPct(1); } else { setStage("error"); setError(r.error ?? ""); }
  };
  const remove = async () => {
    setStage("installing"); setPct(0.5);
    const r = await bridge.setup.uninstall(keepData);
    if (r.ok) { setStage("done"); setPct(1); } else { setStage("error"); setError(r.error ?? ""); }
  };

  const title = uninstallMode ? t("setup.uninstallTitle") : stage === "done" ? t("setup.doneTitle") : stage === "installing" ? t("setup.installingTitle") : reinstall ? t("setup.reinstallTitle") : t("setup.title");
  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-white">
      {/* obrázky her přes celé okno (pomalé přiblížení) */}
      {SLIDES.map((s, k) => (
        <img key={s.img} src={s.img} alt="" className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1600ms] ${k === slide ? "scale-105 opacity-100" : "scale-100 opacity-0"}`}
          style={{ transitionTimingFunction: "ease-in-out" }} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-[#03060b] via-[#03060b]/55 to-[#03060b]/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#03060b]/80 via-transparent to-[#03060b]/60" />
      <div className="hud-scan" />

      {/* lišta okna */}
      <div className="drag absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between pl-5">
        <div className="font-mono text-[11px] tracking-[0.3em] text-white/50">STUDIOVOXARIO · SETUP · v{info?.version}</div>
        <div className="no-drag flex">
          <button aria-label={t("window.minimize")} onClick={() => bridge.window("minimize")} className="grid h-10 w-12 place-items-center text-white/60 hover:bg-white/10 hover:text-white"><Minus size={15} /></button>
          <button aria-label={t("window.close")} disabled={stage === "installing"} onClick={() => bridge.window("close")} className="grid h-10 w-12 place-items-center text-white/60 hover:bg-danger hover:text-white disabled:opacity-30"><X size={16} /></button>
        </div>
      </div>

      {/* název produktu na obrázku */}
      <div className="absolute right-8 top-14 z-10 text-right font-display text-xs uppercase tracking-[0.3em] text-white/60">
        {String(slide + 1).padStart(2, "0")} · {SLIDES[slide]!.name}
      </div>

      {/* střed: logo, nadpis, průběh */}
      <div className="absolute inset-x-0 top-[22%] z-10 flex flex-col items-center px-8 text-center">
        <img src="./logo.png" alt="" className="mb-5 h-24 w-24 drop-shadow-[0_0_30px_rgba(63,224,255,0.65)]" />
        <div className="font-brand text-[34px] font-extrabold tracking-[0.2em]">STUDIOVOXARIO</div>
        <div className="font-brand text-lg tracking-[0.9em] text-gradient">CONNECT</div>
        <div className="hud-label mt-6">{title}</div>
        <p className="mt-2 max-w-xl text-[15px] text-white/75">{uninstallMode ? t("setup.uninstallText") : t("setup.lead")}</p>

        {stage !== "ready" && (
          <div className="mt-8 w-full max-w-2xl">
            <div className="mb-2 flex justify-between font-mono text-xs text-white/70">
              <span>{stage === "error" ? t("setup.failed") : stage === "done" ? t("setup.complete") : lines[lines.length - 1] ?? t("setup.preparing")}</span>
              <span className="text-primary">{Math.round(pct * 100)} %</span>
            </div>
            <div className="relative h-2 overflow-hidden bg-white/10">
              <div className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${stage === "error" ? "bg-danger" : "bg-primary shadow-[0_0_14px_hsl(var(--primary))]"}`} style={{ width: `${pct * 100}%` }} />
            </div>
            {stage === "error" && <p role="alert" className="mt-3 flex items-center justify-center gap-2 text-sm text-danger"><TriangleAlert size={15} />{error}</p>}
          </div>
        )}
      </div>

      {/* spodní panel: volby vlevo, akce vpravo */}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-primary/25 bg-[#03060b]/80 px-8 py-5 backdrop-blur">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="flex items-end justify-between gap-8">
          <div className="min-w-0 flex-1">
            {uninstallMode ? (
              stage === "ready" && <Check2 on={keepData} onChange={setKeepData} label={t("setup.keepData")} />
            ) : stage === "ready" || stage === "error" ? (<>
              <div className="hud-label mb-2">{t("setup.location")}</div>
              <div className="mb-3 flex items-center gap-2">
                <div className="hud-btn [--ch:6px] min-w-0 max-w-[560px] flex-1 truncate border border-white/20 bg-black/40 px-3 py-2 font-mono text-xs text-white/85" title={dir}>{dir}</div>
                <button onClick={() => void pick()} className="hud-btn [--ch:6px] flex items-center gap-1.5 border border-white/25 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:border-primary/60"><FolderOpen size={14} />{t("setup.change")}</button>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Check2 on={opts.desktopShortcut} onChange={(v) => setOpts({ ...opts, desktopShortcut: v })} label={t("setup.desktop")} />
                <Check2 on={opts.startMenu} onChange={(v) => setOpts({ ...opts, startMenu: v })} label={t("setup.startMenu")} />
                <Check2 on={opts.autostart} onChange={(v) => setOpts({ ...opts, autostart: v })} label={t("setup.autostart")} />
              </div>
              <div className="mt-3 font-mono text-[11px] text-white/45">
                {t("setup.space", { need: formatBytes(info?.requiredBytes ?? 0, i18n.language), free: free === null ? "—" : formatBytes(free, i18n.language) })}
                {reinstall && info?.installedVersion ? ` · ${t("setup.installed", { v: info.installedVersion })}` : ""}
              </div>
            </>) : stage === "installing" ? (
              <div className="space-y-0.5 font-mono text-[11px] text-white/55">{lines.map((l, i) => <div key={i}>&gt; {l}</div>)}</div>
            ) : (
              <div className="text-sm text-white/70">{uninstallMode ? t("setup.uninstalled") : t("setup.doneText")}</div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {!uninstallMode && stage === "ready" && <a href="https://studiovoxario.com/obchodni-podminky" target="_blank" rel="noreferrer" className="text-[11px] text-white/45 hover:text-white/80">{t("setup.terms")}</a>}
            {uninstallMode ? (
              stage === "done" ? <BigButton onClick={() => bridge.window("close")}>{t("setup.close")}</BigButton>
                : <BigButton danger busy={stage === "installing"} onClick={() => void remove()}>{t("setup.uninstall")}</BigButton>
            ) : stage === "done" ? (
              <BigButton onClick={() => void bridge.setup.launch(dir)}><Play size={18} fill="currentColor" />{t("setup.launch")}</BigButton>
            ) : (
              <BigButton busy={stage === "installing"} disabled={!enough || !dir} onClick={() => void start()}>
                {stage === "error" ? t("setup.retry") : reinstall ? t("setup.reinstall") : t("setup.install")}
              </BigButton>
            )}
            {!enough && stage === "ready" && <span className="text-xs text-danger">{t("setup.noSpace")}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function BigButton({ children, onClick, busy, disabled, danger }: { children: React.ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy || disabled}
      className={`hud-btn [--ch:12px] flex h-14 min-w-[260px] items-center justify-center gap-2.5 px-10 font-display text-base font-bold uppercase tracking-[0.24em] transition disabled:opacity-60 ${danger ? "bg-danger text-white hover:bg-danger/85" : "bg-primary text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.45)] hover:bg-primary-glow"}`}>
      {busy && <Loader2 size={18} className="animate-spin" />}{children}
    </button>
  );
}
