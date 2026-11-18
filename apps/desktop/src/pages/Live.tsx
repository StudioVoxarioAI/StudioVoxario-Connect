import { Button, EmptyState, SectionTitle } from "@connect/ui";
import { Bell, BellRing, CalendarClock, Eye, Play, Radio, RefreshCw, Youtube } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { bridge } from "../lib/bridge";
import { useMainSettings } from "../lib/installs";
import { checkThumb, countdown, thumbFallback, uptime, useLive, useLiveFocus, useNow, viewers, type LiveStream } from "../lib/live";

/** Červený štítek ŽIVĚ (pulzující tečka) jako na YouTube. */
export function LivePill({ small }: { small?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1.5 bg-[#e8132b] font-display font-bold uppercase tracking-[0.14em] text-white shadow-[0_0_14px_rgba(232,19,43,0.55)] ${small ? "px-1.5 py-[1px] text-[10px]" : "px-2 py-0.5 text-[11px]"}`}>
      <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
      {t("live.badge")}
    </span>
  );
}

export function ChannelAvatar({ s, size = 40 }: { s: LiveStream; size?: number }) {
  const ring = s.status === "live" ? "ring-2 ring-[#e8132b] ring-offset-2 ring-offset-background" : "ring-1 ring-border";
  return s.channelAvatar
    ? <img src={s.channelAvatar} alt="" style={{ width: size, height: size }} className={`shrink-0 rounded-full object-cover ${ring}`} />
    : <span style={{ width: size, height: size }} className={`grid shrink-0 place-items-center rounded-full bg-surface-3 font-display font-bold text-muted ${ring}`}>{s.channelTitle.slice(0, 1).toUpperCase()}</span>;
}

/** Miniatura, kterou si streamer nastavil na YouTube (s automatickou zálohou). */
export function Thumb({ s, className }: { s: LiveStream; className?: string }) {
  return s.thumbnail
    ? <img src={s.thumbnail} alt="" loading="lazy" onLoad={(e) => checkThumb(e, s.videoId)} onError={(e) => thumbFallback(e, s.videoId)} className={`h-full w-full object-cover ${className ?? ""}`} />
    : <div className="grid h-full w-full place-items-center bg-surface-2 text-subtle"><Youtube size={42} /></div>;
}

function StreamCard({ s, now }: { s: LiveStream; now: number }) {
  const { t, i18n } = useTranslation();
  return (
    <Link to={`/live/${s.videoId}`} className="group block">
      <div className="hud relative aspect-video overflow-hidden [--ch:12px]">
        <Thumb s={s} className="transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <div className="absolute left-2 top-2"><LivePill small /></div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white"><Eye size={12} />{t("live.viewers", { n: viewers(s.viewers, i18n.language) })}</div>
        <div className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">{uptime(s.startedAt, now)}</div>
        <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/90 text-primary-foreground shadow-[0_0_30px_hsl(var(--primary))]"><Play size={24} className="ml-1" /></span>
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        <ChannelAvatar s={s} size={38} />
        <div className="min-w-0">
          <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground group-hover:text-primary">{s.title}</div>
          <div className="mt-0.5 truncate text-sm text-muted">{s.channelTitle}</div>
        </div>
      </div>
    </Link>
  );
}

function UpcomingCard({ s, now, reminded, onRemind }: { s: LiveStream; now: number; reminded: boolean; onRemind: () => void }) {
  const { t, i18n } = useTranslation();
  const when = s.scheduledAt ? new Date(s.scheduledAt) : null;
  return (
    <div className="hud flex gap-4 p-3 [--ch:12px]">
      <button onClick={() => void bridge.openExternal(`https://www.youtube.com/watch?v=${s.videoId}`)} className="relative aspect-video w-48 shrink-0 overflow-hidden">
        <Thumb s={s} />
        <span className="absolute left-1.5 top-1.5 bg-black/75 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-white">{t("live.upcomingBadge")}</span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><ChannelAvatar s={s} size={22} /><span className="truncate text-sm text-muted">{s.channelTitle}</span></div>
        <div className="mt-1 line-clamp-2 font-semibold leading-snug">{s.title}</div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="flex items-center gap-1 font-mono text-primary"><CalendarClock size={13} />{countdown(s.scheduledAt, now, i18n.language)}</span>
          {when && <span className="text-subtle">{when.toLocaleString(i18n.language.startsWith("cs") ? "cs-CZ" : "en-US", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </div>
      <Button variant={reminded ? "primary" : "secondary"} size="sm" onClick={onRemind} className="self-center">
        {reminded ? <BellRing size={14} /> : <Bell size={14} />}{reminded ? t("live.reminded") : t("live.remind")}
      </Button>
    </div>
  );
}

export function Live() {
  const { t, i18n } = useTranslation();
  useLiveFocus();
  const { data, isLoading } = useLive();
  const { data: ms } = useMainSettings();
  const nav = useNavigate();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState<string[] | null>(null);
  const reminded = new Set(reminders ?? ms?.liveReminders ?? []);
  const streams = useMemo(() => data?.streams ?? [], [data]);
  const live = useMemo(() => streams.filter((s) => s.status === "live" && s.videoId), [streams]);
  const upcoming = useMemo(() => streams.filter((s) => s.status === "upcoming" && s.videoId), [streams]);
  const offline = useMemo(() => streams.filter((s) => s.status === "offline"), [streams]);
  const hero = live[0];
  const checked = data?.checkedAt ? Math.max(0, Math.round((now - Date.parse(data.checkedAt)) / 1000)) : null;

  const refresh = async () => { setBusy(true); try { await bridge.live.refresh(); } finally { setBusy(false); } };
  const toggleRemind = async (s: LiveStream) => { if (s.videoId) setReminders(await bridge.live.remind(s.videoId, !reminded.has(s.videoId))); };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-8 py-7">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="hud-label flex items-center gap-2"><Radio size={13} className="text-[#ff3048]" />{t("live.eyebrow")}</div>
          <h1 className="mt-1 font-display text-[34px] font-extrabold uppercase tracking-[0.06em]">{t("live.title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("live.lead")}</p>
        </div>
        <div className="flex items-center gap-3">
          {checked !== null && <span className="font-mono text-xs text-subtle">{t("live.checked", { s: checked })}</span>}
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} />{t("live.refresh")}</Button>
        </div>
      </div>

      {data?.error && <div className="hud mb-6 border-warning/40 p-4 text-sm text-warning">{data.error}</div>}

      {hero && (
        <section className="hud hud-brackets relative mb-9 h-[440px] overflow-hidden [--ch:22px]">
          <div className="absolute inset-0"><Thumb s={hero} /></div>
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-transparent" />
          <div className="hud-scan" />
          <div className="relative flex h-full max-w-2xl flex-col justify-end gap-3 p-9">
            <div className="flex items-center gap-3"><LivePill /><span className="flex items-center gap-1.5 font-mono text-sm text-white/90"><Eye size={15} />{t("live.watching", { n: viewers(hero.viewers, i18n.language) })}</span><span className="font-mono text-sm text-white/70">{uptime(hero.startedAt, now)}</span></div>
            <h2 className="line-clamp-2 font-display text-[32px] font-extrabold leading-tight text-white">{hero.title}</h2>
            <div className="flex items-center gap-3"><ChannelAvatar s={hero} size={44} /><div><div className="font-semibold text-white">{hero.channelTitle}</div><div className="text-sm text-white/60">{hero.handle}</div></div></div>
            <div className="mt-2 flex items-center gap-3">
              <Button size="lg" onClick={() => nav(`/live/${hero.videoId}`)}><Play size={18} />{t("live.watch")}</Button>
              <Button variant="secondary" size="lg" onClick={() => void bridge.openExternal(`https://www.youtube.com/watch?v=${hero.videoId}`)}><Youtube size={18} />YouTube</Button>
            </div>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="mb-9 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="hud aspect-video animate-pulse" />)}</div>
      ) : live.length > 0 ? (<>
        <SectionTitle>{t("live.nowLive", { count: live.length })}</SectionTitle>
        <div className="mb-10 grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3">{live.map((s) => <StreamCard key={s.userId} s={s} now={now} />)}</div>
      </>) : (
        <div className="hud mb-9 p-6"><EmptyState icon={<Radio size={32} />} title={t("live.emptyTitle")} text={t("live.emptyText")} /></div>
      )}

      {upcoming.length > 0 && (<>
        <SectionTitle>{t("live.upcoming")}</SectionTitle>
        <div className="mb-10 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {upcoming.map((s) => <UpcomingCard key={s.userId} s={s} now={now} reminded={!!s.videoId && reminded.has(s.videoId)} onRemind={() => void toggleRemind(s)} />)}
        </div>
      </>)}

      {offline.length > 0 && (<>
        <SectionTitle>{t("live.streamers")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {offline.map((s) => (
            <button key={s.userId} onClick={() => void bridge.openExternal(s.channelId ? `https://www.youtube.com/channel/${s.channelId}` : `https://www.youtube.com/${s.handle}`)}
              className="hud flex flex-col items-center gap-2 p-4 text-center transition hover:border-primary/50 [--ch:10px]">
              <ChannelAvatar s={s} size={56} />
              <div className="w-full truncate text-sm font-semibold">{s.channelTitle}</div>
              <div className="text-[11px] text-subtle">{s.lastLiveAt ? t("live.lastLive", { d: new Date(s.lastLiveAt).toLocaleDateString(i18n.language.startsWith("cs") ? "cs-CZ" : "en-US") }) : t("live.offline")}</div>
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}
