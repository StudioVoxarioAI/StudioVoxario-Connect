import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { InstallsState, Settings } from "../../electron/preload";
import { bridge } from "./bridge";

export function useInstalls() {
  const qc = useQueryClient();
  useEffect(() => bridge.installs.onChange((s) => qc.setQueryData(["installs"], s)), [qc]);
  return useQuery<InstallsState>({ queryKey: ["installs"], queryFn: () => bridge.installs.get(), staleTime: Infinity });
}

export function useMainSettings() {
  const qc = useQueryClient();
  useEffect(() => bridge.settings.onChange((s) => qc.setQueryData(["main-settings"], s)), [qc]);
  return useQuery<Settings>({ queryKey: ["main-settings"], queryFn: () => bridge.settings.get(), staleTime: Infinity });
}

export function formatBytes(n: number, lang = "cs"): string {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = Math.max(0, n);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString(lang === "cs" ? "cs-CZ" : "en-US", { maximumFractionDigits: i ? 1 : 0 })} ${u[i]}`;
}

export function formatDuration(sec: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? t("time.hm", { h, m }) : m ? t("time.ms", { m, s }) : t("time.s", { s });
}

export function useUpdater() {
  const qc = useQueryClient();
  useEffect(() => bridge.updater.onChange((s) => qc.setQueryData(["updater"], s)), [qc]);
  return useQuery({ queryKey: ["updater"], queryFn: () => bridge.updater.status(), staleTime: Infinity });
}
