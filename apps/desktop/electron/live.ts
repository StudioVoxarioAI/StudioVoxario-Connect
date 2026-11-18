// Živá vysílání (sekce „Živě“): YouTube kanály streamerů StudioVoxario.
//
// Data: tabulka webu public.live_youtube (veřejně čitelná) – plní ji serverová funkce connect-live každou minutu
// z oficiálních rozhraní YouTube (RSS kanálu + YouTube Data API): kdo je živě, naplánovaná vysílání, diváci,
// miniatura, kterou si streamer nastavil na YouTube. Connect stav obnovuje každých 30 s (na pozadí každé 2 min),
// při zastaralých datech funkci sám popostrčí. Když streamer začne vysílat, přijde oznámení (lze vypnout).
//
// Přehrávač a chat jsou oficiální vložené stránky YouTube (embed a live_chat). Okno Connectu běží ze souboru,
// proto jim hlavní proces doplní hlavičku Referer (jinak YouTube vložení odmítne – chyba 153 / „chat nedostupný“).
// Psát do chatu jde po přihlášení k YouTube v okně Connectu (cookies jen v jeho úložišti, nikam se neposílají).
import { BrowserWindow, net, session, shell } from "electron";

import { api } from "./api";
import { isDemo } from "./demo";
import { settings, updateSettings } from "./settings";
import { log, notify } from "./system";

export interface LiveStream {
  userId: string;
  handle: string;
  channelId: string | null;
  channelTitle: string;
  channelAvatar: string | null;
  status: "live" | "upcoming" | "offline";
  videoId: string | null;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  viewers: number;
  likes: number | null;
  startedAt: string | null;
  scheduledAt: string | null;
  chatEnabled: boolean;
  lastLiveAt: string | null;
}
export interface LiveState {
  streams: LiveStream[];
  checkedAt: string | null;   // kdy server naposledy ověřil YouTube
  loadedAt: string | null;    // kdy Connect naposledy načetl stav
  error: string | null;
  youtube: { signedIn: boolean; name: string | null };
}

const EMBED_ORIGIN = "https://studiovoxario.com";
const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
let state: LiveState = { streams: [], checkedAt: null, loadedAt: null, error: null, youtube: { signedIn: false, name: null } };
const listeners: Array<(s: LiveState) => void> = [];
let timer: NodeJS.Timeout | null = null;
let fast = false;
let loading: Promise<LiveState> | null = null;
let lastKick = 0;
const known = new Map<string, string>();   // userId -> status (pro oznámení „právě začal vysílat“)

export function onLive(cb: (s: LiveState) => void) { listeners.push(cb); }
const emit = () => listeners.forEach((l) => l(state));
export function liveNow(): LiveState { return state; }

// ------------------------------------------------------------------ ukázková data (CONNECT_DEMO=1, náhledy obrazovek)
function demoStreams(): LiveStream[] {
  const now = Date.now();
  const base = (i: number, o: Partial<LiveStream>): LiveStream => ({
    userId: `demo-${i}`, handle: `@demo${i}`, channelId: null, channelTitle: "Demo", channelAvatar: null, status: "offline",
    videoId: null, title: null, description: null, thumbnail: null, viewers: 0, likes: null, startedAt: null, scheduledAt: null,
    chatEnabled: false, lastLiveAt: null, ...o,
  });
  const img = (n: string) => `./demo/live/${n}.jpg`;   // dist/demo (jen náhledy)
  return [
    base(1, { channelTitle: "Sokolcz", handle: "@sokolcz", status: "live", videoId: "demo1", title: "Ashes of Eryon – noční raid na Stínovou trhlinu s komunitou", description: "Hrajeme uzavřený test Ashes of Eryon. Pravidla chatu: buďte na sebe hodní.", thumbnail: img("t1"), channelAvatar: img("a1"), viewers: 1284, likes: 342, startedAt: new Date(now - 2.3 * 3600_000).toISOString(), chatEnabled: true }),
    base(2, { channelTitle: "Lyra Plays", handle: "@lyraplays", status: "live", videoId: "demo2", title: "Fantasy (Eryndor) – stavím mitrilový důl a jdu na démona!", thumbnail: img("t2"), channelAvatar: img("a2"), viewers: 412, startedAt: new Date(now - 47 * 60_000).toISOString(), chatEnabled: true }),
    base(3, { channelTitle: "VoxDev", handle: "@voxdev", status: "live", videoId: "demo3", title: "Voxario Studio Engine – živé programování objemových mraků", thumbnail: img("t3"), channelAvatar: img("a3"), viewers: 96, startedAt: new Date(now - 15 * 60_000).toISOString(), chatEnabled: true }),
    base(4, { channelTitle: "Kraken CZ", handle: "@krakencz", status: "upcoming", videoId: "demo4", title: "Turnaj v aréně – finále sezóny", thumbnail: img("t4"), channelAvatar: img("a4"), scheduledAt: new Date(now + 2.25 * 3600_000).toISOString() }),
    base(5, { channelTitle: "Mira", handle: "@mira", status: "upcoming", videoId: "demo5", title: "První pohled na nový update platformy", thumbnail: img("t5"), channelAvatar: img("a5"), scheduledAt: new Date(now + 26 * 3600_000).toISOString() }),
    base(6, { channelTitle: "NightOwl", handle: "@nightowl", channelAvatar: img("a6"), lastLiveAt: new Date(now - 20 * 3600_000).toISOString() }),
  ];
}

// ------------------------------------------------------------------ načtení stavu
type DbRow = {
  user_id: string; handle: string; channel_id: string | null; channel_title: string | null; channel_avatar: string | null;
  status: "live" | "upcoming" | "offline"; video_id: string | null; title: string | null; description: string | null;
  thumbnail_url: string | null; viewer_count: number | null; like_count: number | null; started_at: string | null;
  scheduled_start_at: string | null; chat_enabled: boolean | null; last_live_at: string | null; checked_at: string | null;
};

async function anonGet<T>(pathAndQuery: string): Promise<T> {
  const a = api();
  const res = await net.fetch(`${a.supabaseUrl}${pathAndQuery}`, { headers: { apikey: a.publishableKey, accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// serverovou kontrolu popostrčit, když jsou data starší než 90 s (např. když plánovač na webu ještě neběží)
function kickServer() {
  if (Date.now() - lastKick < 60_000) return;
  lastKick = Date.now();
  const a = api();
  void net.fetch(`${a.supabaseUrl}/functions/v1/connect-live`, {
    method: "POST", headers: { apikey: a.publishableKey, "content-type": "application/json" }, body: "{}",
  }).then(() => setTimeout(() => void refreshLive(), 4000)).catch(() => undefined);
}

function announce(next: LiveStream[]) {
  const first = known.size === 0;
  const on = settings().notifications.live !== false;
  const reminders = new Set(settings().liveReminders ?? []);
  for (const s of next) {
    const was = known.get(s.userId);
    if (!first && on && s.status === "live" && was !== "live") {
      notify(`${s.channelTitle} je živě`, s.title ?? "Právě začalo živé vysílání na YouTube.");
    } else if (!first && s.status === "live" && was !== "live" && s.videoId && reminders.has(s.videoId)) {
      notify(`${s.channelTitle} začíná`, s.title ?? "Připomínané vysílání právě začalo.");
    }
    known.set(s.userId, s.status);
  }
}

export async function refreshLive(): Promise<LiveState> {
  if (loading) return loading;
  loading = (async () => {
    try {
      let streams: LiveStream[];
      let checkedAt: string | null = null;
      if (isDemo) {
        streams = demoStreams();
        checkedAt = new Date(Date.now() - 12_000).toISOString();
      } else {
        const rows = await anonGet<DbRow[]>("/rest/v1/live_youtube?select=*");
        streams = rows.map((r) => ({
          userId: r.user_id, handle: r.handle, channelId: r.channel_id, channelTitle: r.channel_title ?? r.handle.replace(/^@/, ""),
          channelAvatar: r.channel_avatar, status: r.status, videoId: r.video_id, title: r.title, description: r.description,
          thumbnail: r.thumbnail_url, viewers: r.viewer_count ?? 0, likes: r.like_count, startedAt: r.started_at,
          scheduledAt: r.scheduled_start_at, chatEnabled: !!r.chat_enabled, lastLiveAt: r.last_live_at,
        }));
        checkedAt = rows.reduce<string | null>((m, r) => (r.checked_at && (!m || r.checked_at > m) ? r.checked_at : m), null);
        if (!checkedAt || Date.now() - Date.parse(checkedAt) > 90_000) kickServer();
      }
      // pořadí: živě podle diváků, naplánované podle času, ostatní podle posledního vysílání
      const rank = { live: 0, upcoming: 1, offline: 2 } as const;
      streams.sort((a, b) => rank[a.status] - rank[b.status] ||
        (a.status === "live" ? b.viewers - a.viewers : a.status === "upcoming"
          ? Date.parse(a.scheduledAt ?? "") - Date.parse(b.scheduledAt ?? "")
          : Date.parse(b.lastLiveAt ?? "0") - Date.parse(a.lastLiveAt ?? "0")));
      announce(streams);
      state = { ...state, streams, checkedAt, loadedAt: new Date().toISOString(), error: null };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      state = { ...state, loadedAt: new Date().toISOString(),
        error: /HTTP 404/.test(msg) ? "Web ještě nemá živá vysílání pro Connect (migrace 20261119120000_connect_live.sql a funkce connect-live)." : "Živá vysílání se nepodařilo načíst. Zkusíme to znovu." };
      log(`live: ${msg}`);
    }
    state.youtube = await youtubeStatus();
    emit();
    return state;
  })().finally(() => { loading = null; });
  return loading;
}

function schedule() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => void refreshLive(), fast ? 30_000 : 120_000);
  timer.unref();
}
/** Sekce Živě je otevřená -> obnovovat častěji. */
export function setLiveFocus(on: boolean) {
  if (fast === on) return;
  fast = on;
  schedule();
  if (on) void refreshLive();
}

export function remind(videoId: string, on: boolean): string[] {
  const set = new Set(settings().liveReminders ?? []);
  if (on) set.add(videoId); else set.delete(videoId);
  return updateSettings({ liveReminders: [...set].slice(-50) }).liveReminders ?? [];
}

// ------------------------------------------------------------------ YouTube: vložený přehrávač a chat, přihlášení
async function youtubeStatus(): Promise<{ signedIn: boolean; name: string | null }> {
  try {
    const cookies = await session.defaultSession.cookies.get({ domain: ".youtube.com" });
    const signedIn = cookies.some((c) => c.name === "SAPISID" || c.name === "__Secure-3PAPISID");
    return { signedIn, name: null };
  } catch {
    return { signedIn: false, name: null };
  }
}

/** Přihlášení k YouTube (Google) v okně Connectu – cookies zůstanou jen v úložišti Connectu. */
export function youtubeSignIn(parent: BrowserWindow | null): Promise<LiveState> {
  return new Promise((resolve) => {
    const w = new BrowserWindow({
      width: 520, height: 720, parent: parent ?? undefined, modal: false, autoHideMenuBar: true, backgroundColor: "#0f0f0f",
      title: "Přihlášení k YouTube", webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    w.webContents.setUserAgent(CHROME_UA);
    w.webContents.setWindowOpenHandler(({ url }) => { void w.loadURL(url); return { action: "deny" }; });
    const done = async () => { state.youtube = await youtubeStatus(); emit(); resolve(state); };
    // po přihlášení Google přesměruje na youtube.com -> hotovo
    w.webContents.on("did-navigate", async (_e, url) => {
      if (/^https:\/\/(www|m)\.youtube\.com\//.test(url) && (await youtubeStatus()).signedIn) w.close();
    });
    w.on("closed", () => void done());
    void w.loadURL("https://accounts.google.com/ServiceLogin?service=youtube&hl=cs&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2F");
  });
}

export async function youtubeSignOut(): Promise<LiveState> {
  const ses = session.defaultSession;
  for (const domain of [".youtube.com", ".google.com", "accounts.google.com", "www.youtube.com"]) {
    const cookies = await ses.cookies.get({ domain });
    for (const c of cookies) {
      const host = (c.domain ?? "").replace(/^\./, "");
      await ses.cookies.remove(`https://${host}${c.path ?? "/"}`, c.name).catch(() => undefined);
    }
  }
  state.youtube = await youtubeStatus();
  emit();
  return state;
}

/** Chat v samostatném okně (vedle hry, na druhém monitoru). */
export function popoutChat(videoId: string) {
  if (!/^[\w-]{11}$/.test(videoId)) return;
  const w = new BrowserWindow({
    width: 420, height: 760, autoHideMenuBar: true, backgroundColor: "#0f0f0f", title: "Živý chat – StudioVoxario Connect",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  w.webContents.setUserAgent(CHROME_UA);
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) void shell.openExternal(url); return { action: "deny" }; });
  void w.loadURL(`https://www.youtube.com/live_chat?v=${videoId}&is_popout=1&dark_theme=1`);
}

/**
 * Hlavičky pro vložený přehrávač a chat YouTube v okně Connectu: Referer webu StudioVoxario (embed_domain chatu)
 * a běžný prohlížeč v User-Agent. Týká se jen požadavků na youtube.com / youtube-nocookie.com.
 */
export function setupYouTubeEmbeds() {
  const filter = { urls: ["https://www.youtube.com/*", "https://www.youtube-nocookie.com/*", "https://youtube.com/*"] };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, cb) => {
    const h = details.requestHeaders;
    const fromApp = !h.Referer || h.Referer.startsWith("file://") ||
      (process.env.CONNECT_DEV_URL && h.Referer.startsWith(process.env.CONNECT_DEV_URL));
    if (fromApp && (details.resourceType === "subFrame" || /\/(embed|live_chat)/.test(details.url))) {
      h.Referer = `${EMBED_ORIGIN}/`;
      if (details.method !== "GET") h.Origin = EMBED_ORIGIN;
    }
    h["User-Agent"] = CHROME_UA;
    cb({ requestHeaders: h });
  });
  schedule();
  void refreshLive();
}
