// Živá vysílání (sekce Živě): stav z hlavního procesu (electron/live.ts), čas a formátování.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { LiveState } from "../../electron/preload";
import { bridge } from "./bridge";

export type LiveStream = LiveState["streams"][number];

export function useLive() {
  const qc = useQueryClient();
  useEffect(() => bridge.live.onChange((s) => qc.setQueryData(["live"], s)), [qc]);
  return useQuery<LiveState>({ queryKey: ["live"], queryFn: () => bridge.live.get(), staleTime: Infinity });
}

/** Sekce je otevřená: hlavní proces obnovuje stav každých 30 s. */
export function useLiveFocus() {
  useEffect(() => { void bridge.live.focus(true); return () => { void bridge.live.focus(false); }; }, []);
}

/** Tikající „teď“ pro odpočty a délku vysílání. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

export function uptime(startedAt: string | null, now: number): string {
  if (!startedAt) return "";
  const s = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function countdown(at: string | null, now: number, lang: string): string {
  if (!at) return "";
  const s = Math.floor((Date.parse(at) - now) / 1000);
  const cs = lang.startsWith("cs");
  if (s <= 0) return cs ? "začíná každou chvíli" : "starting any moment";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return cs ? `za ${d} d ${h} h` : `in ${d}d ${h}h`;
  if (h) return cs ? `za ${h} h ${m} min` : `in ${h}h ${m}m`;
  return cs ? `za ${m} min ${s % 60} s` : `in ${m}m ${s % 60}s`;
}

export function viewers(n: number, lang: string): string {
  const cs = lang.startsWith("cs");
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString(cs ? "cs-CZ" : "en-US", { maximumFractionDigits: 1 })} mil.`;
  if (n >= 10_000) return `${(n / 1000).toLocaleString(cs ? "cs-CZ" : "en-US", { maximumFractionDigits: 1 })} tis.`;
  return n.toLocaleString(cs ? "cs-CZ" : "en-US");
}

/** Miniatura nastavená streamerem; když maxres neexistuje (YouTube vrátí 120×90 šedý obrázek / 404), záloha hqdefault. */
export function thumbFallback(e: React.SyntheticEvent<HTMLImageElement>, videoId: string | null) {
  const img = e.currentTarget;
  if (!videoId || img.dataset.fallback) return;
  img.dataset.fallback = "1";
  img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
export function checkThumb(e: React.SyntheticEvent<HTMLImageElement>, videoId: string | null) {
  // YouTube u chybějící maxres miniatury vrací 120×90 zástupný obrázek místo chyby
  if (e.currentTarget.naturalWidth === 120 && e.currentTarget.naturalHeight === 90) thumbFallback(e, videoId);
}
