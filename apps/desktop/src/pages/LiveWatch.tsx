import { Button } from "@connect/ui";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Eye, LogIn, LogOut, MessageSquare, MessageSquareOff, PanelRightClose, PanelRightOpen, ThumbsUp, Youtube } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { bridge } from "../lib/bridge";
import { uptime, useLive, useLiveFocus, useNow, viewers, type LiveStream } from "../lib/live";
import { ChannelAvatar, LivePill, Thumb } from "./Live";

const isDemoId = (id: string) => /^demo\d$/.test(id);

/** Oficiální přehrávač YouTube (embed). Hlavní proces doplní Referer webu – jinak by YouTube vložení odmítl. */
function Player({ s, videoId }: { s?: LiveStream; videoId: string }) {
  const { t } = useTranslation();
  if (isDemoId(videoId) && s) {
    return (
      <div className="relative h-full w-full">
        <Thumb s={s} />
        <div className="absolute inset-0 grid place-items-center bg-black/35">
          <span className="bg-black/70 px-3 py-1.5 font-mono text-xs text-white/80">{t("live.demoPlayer")}</span>
        </div>
      </div>
    );
  }
  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&hl=cs&cc_lang_pref=cs&color=white`;
  return <iframe key={videoId} src={src} title="YouTube" className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
}

// ------------------------------------------------------------------ ukázkový chat (náhledy bez sítě) – vzhled jako YouTube
const DEMO_CHAT: Array<{ n: string; c: string; m: string; badge?: "owner" | "mod" | "member"; sc?: [string, string] }> = [
  { n: "Ozvěna_88", c: "#ffb74d", m: "Ten démon z meteoru je šílenej 🔥" },
  { n: "Sokolcz", c: "#ffd600", m: "Vítejte všichni! Dneska jdeme na Stínovou trhlinu.", badge: "owner" },
  { n: "Lyra", c: "#7ec8ff", m: "kolik má ten boss HP?", badge: "member" },
  { n: "Moderátor Vox", c: "#5e84f1", m: "Připomínám pravidla chatu: žádný spam, díky ❤️", badge: "mod" },
  { n: "TrpaslíkKarel", c: "#a3e635", m: "mitril jsem právě vytěžil na 225 😎" },
  { n: "Mira", c: "#f472b6", m: "Díky za stream!", sc: ["100 Kč", "#1de9b6"] },
  { n: "NightOwl", c: "#c4b5fd", m: "GG" },
  { n: "Kraken CZ", c: "#fb923c", m: "zítra turnaj v aréně, kdo jde? ⚔️", badge: "member" },
  { n: "Elfka_Nia", c: "#86efac", m: "ta okna ve Valorii v noci vypadají nádherně" },
];
function DemoChat() {
  const { t } = useTranslation();
  const [n, setN] = useState(6);
  useEffect(() => { const id = setInterval(() => setN((x) => x + 1), 1800); return () => clearInterval(id); }, []);
  const items = Array.from({ length: n }, (_, i) => DEMO_CHAT[i % DEMO_CHAT.length]!).slice(-40);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [n]);
  return (
    <div className="flex h-full flex-col bg-[#0f0f0f] text-[13px] text-[#f1f1f1]">
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#181818] px-3 py-2 text-[12px] text-white/80">📌 <span className="font-semibold">Sokolcz</span> Raid začíná ve 21:00!</div>
      <div ref={ref} className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {items.map((x, i) => x.sc ? (
          <div key={i} className="overflow-hidden rounded-md" style={{ background: x.sc[1] }}>
            <div className="flex items-center gap-2 px-3 py-2 text-black"><span className="h-6 w-6 rounded-full bg-black/25" /><div><div className="text-[12px] font-semibold opacity-80">{x.n}</div><div className="font-bold">{x.sc[0]}</div></div></div>
            <div className="bg-black/10 px-3 py-1.5 text-black">{x.m}</div>
          </div>
        ) : (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full" style={{ background: x.c, opacity: 0.85 }} />
            <div className="leading-[1.45]">
              <span className={`mr-1.5 font-medium ${x.badge === "owner" ? "rounded-sm bg-[#ffd600] px-1 text-black" : x.badge === "mod" ? "text-[#5e84f1]" : x.badge === "member" ? "text-[#2ba640]" : "text-white/60"}`}>{x.n}{x.badge === "mod" ? " 🔧" : x.badge === "member" ? " ★" : ""}</span>
              <span>{x.m}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 bg-[#181818] p-3 text-center text-[12px] text-white/50">{t("live.demoChat")}</div>
    </div>
  );
}

/** Oficiální živý chat YouTube (live_chat, tmavý vzhled) – psaní po přihlášení k YouTube v Connectu. */
function Chat({ videoId, enabled, signedIn, reloadKey }: { videoId: string; enabled: boolean; signedIn: boolean; reloadKey: number }) {
  const { t } = useTranslation();
  if (isDemoId(videoId)) return <DemoChat />;
  if (!enabled) return <div className="grid h-full place-items-center p-6 text-center text-sm text-muted"><div><MessageSquareOff className="mx-auto mb-2" />{t("live.chatOff")}</div></div>;
  const src = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=studiovoxario.com&dark_theme=1&hl=cs`;
  return <iframe key={`${videoId}-${reloadKey}-${signedIn}`} src={src} title={t("live.chat")} className="h-full w-full bg-[#0f0f0f]" />;
}

export function LiveWatch() {
  const { t, i18n } = useTranslation();
  const { id = "" } = useParams();
  useLiveFocus();
  const { data } = useLive();
  const now = useNow();
  const s = useMemo(() => data?.streams.find((x) => x.videoId === id), [data, id]);
  const others = useMemo(() => (data?.streams ?? []).filter((x) => x.status === "live" && x.videoId && x.videoId !== id), [data, id]);
  const [theater, setTheater] = useState(false);
  const [desc, setDesc] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);
  const yt = data?.youtube ?? { signedIn: false, name: null };
  const url = `https://www.youtube.com/watch?v=${id}`;
  const ended = s ? s.status !== "live" : false;

  const copy = async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const signIn = async () => { await bridge.live.youtubeSignIn(); setReload((x) => x + 1); };
  const signOut = async () => { await bridge.live.youtubeSignOut(); setReload((x) => x + 1); };

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="min-w-0 flex-1 overflow-y-auto px-7 py-5">
        <Link to="/live" className="hud-label mb-3 inline-flex items-center gap-1.5 hover:text-foreground"><ArrowLeft size={13} />{t("live.back")}</Link>
        <div className={`hud relative mx-auto aspect-video w-full overflow-hidden bg-black [--ch:16px] ${theater ? "max-w-none" : "max-w-[1280px]"}`}>
          <Player s={s} videoId={id} />
        </div>

        <div className={`mx-auto mt-4 w-full ${theater ? "" : "max-w-[1280px]"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[22px] font-bold leading-snug">{s?.title ?? t("live.loading")}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                {s?.status === "live" && <LivePill />}
                {ended && <span className="bg-surface-3 px-2 py-0.5 font-display text-[11px] uppercase tracking-[0.14em] text-muted">{t("live.ended")}</span>}
                {s && s.status === "live" && <span className="flex items-center gap-1.5 font-mono text-muted"><Eye size={14} />{t("live.watching", { n: viewers(s.viewers, i18n.language) })}</span>}
                {s?.startedAt && s.status === "live" && <span className="font-mono text-muted">{t("live.since", { t: uptime(s.startedAt, now) })}</span>}
                {s?.likes != null && <span className="flex items-center gap-1.5 font-mono text-muted"><ThumbsUp size={14} />{viewers(s.likes, i18n.language)}</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("live.copied") : t("live.copy")}</Button>
              <Button variant="secondary" size="sm" onClick={() => setTheater((x) => !x)}>{theater ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}{theater ? t("live.showChat") : t("live.theater")}</Button>
              <Button variant="secondary" size="sm" onClick={() => void bridge.openExternal(url)}><Youtube size={14} />YouTube</Button>
            </div>
          </div>

          {s && (
            <div className="hud mt-4 p-4 [--ch:12px]">
              <div className="flex items-center gap-3">
                <ChannelAvatar s={s} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.channelTitle}</div>
                  <div className="text-sm text-subtle">{s.handle}</div>
                </div>
                <Button size="sm" onClick={() => void bridge.openExternal(s.channelId ? `https://www.youtube.com/channel/${s.channelId}?sub_confirmation=1` : `https://www.youtube.com/${s.handle}?sub_confirmation=1`)}>
                  <Youtube size={14} />{t("live.subscribe")}
                </Button>
              </div>
              {s.description && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className={`whitespace-pre-line text-sm text-muted ${desc ? "" : "line-clamp-3"}`}>{s.description}</p>
                  <button onClick={() => setDesc((x) => !x)} className="mt-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">{desc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{desc ? t("live.less") : t("live.more")}</button>
                </div>
              )}
            </div>
          )}

          {others.length > 0 && (
            <div className="mt-6">
              <div className="hud-label mb-3">{t("live.more_streams")}</div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
                {others.map((o) => (
                  <Link key={o.userId} to={`/live/${o.videoId}`} className="group">
                    <div className="hud relative aspect-video overflow-hidden [--ch:10px]"><Thumb s={o} className="transition group-hover:scale-[1.04]" /><div className="absolute left-1.5 top-1.5"><LivePill small /></div>
                      <div className="absolute bottom-1.5 left-1.5 bg-black/70 px-1.5 font-mono text-[10px] text-white">{viewers(o.viewers, i18n.language)}</div></div>
                    <div className="mt-2 line-clamp-1 text-sm font-semibold group-hover:text-primary">{o.title}</div>
                    <div className="truncate text-xs text-muted">{o.channelTitle}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!theater && (
        <aside className="flex w-[380px] shrink-0 flex-col border-l border-primary/20 bg-background/80">
          <div className="flex h-12 items-center gap-2 border-b border-border px-4">
            <MessageSquare size={16} className="text-primary" />
            <span className="font-display text-[13px] font-bold uppercase tracking-[0.16em]">{t("live.chat")}</span>
            <button onClick={() => void bridge.live.popoutChat(id)} title={t("live.popout")} className="ml-auto grid h-8 w-8 place-items-center text-muted hover:text-foreground"><ExternalLink size={15} /></button>
            <button onClick={() => setTheater(true)} title={t("live.hideChat")} className="grid h-8 w-8 place-items-center text-muted hover:text-foreground"><PanelRightClose size={15} /></button>
          </div>
          <div className="min-h-0 flex-1"><Chat videoId={id} enabled={!s || s.chatEnabled || isDemoId(id)} signedIn={yt.signedIn} reloadKey={reload} /></div>
          <div className="flex items-center gap-2 border-t border-border bg-surface-1/80 px-3 py-2.5 text-xs">
            {yt.signedIn ? (<>
              <span className="flex items-center gap-1.5 text-success"><Youtube size={14} />{t("live.ytSignedIn")}</span>
              <button onClick={() => void signOut()} className="ml-auto flex items-center gap-1 text-muted hover:text-foreground"><LogOut size={13} />{t("live.ytSignOut")}</button>
            </>) : (<>
              <span className="text-muted">{t("live.ytToWrite")}</span>
              <Button size="sm" className="ml-auto" onClick={() => void signIn()}><LogIn size={13} />{t("live.ytSignIn")}</Button>
            </>)}
          </div>
        </aside>
      )}
    </div>
  );
}
