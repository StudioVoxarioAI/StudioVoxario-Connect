// Uživatelské předvolby UI (jazyk, téma, akcent) – lokálně (persist). Data stahování a knihovny budou v SQLite (Fáze 3).
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";
export type Lang = "cs" | "en";
interface Settings {
  theme: Theme;
  lang: Lang;
  afterLaunch: "minimize" | "close" | "keep";
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  setAfterLaunch: (v: Settings["afterLaunch"]) => void;
}

export const useSettings = create<Settings>()(persist((set) => ({
  theme: "dark",
  lang: "cs",
  afterLaunch: "minimize",
  setTheme: (theme) => set({ theme }),
  setLang: (lang) => set({ lang }),
  setAfterLaunch: (afterLaunch) => set({ afterLaunch }),
}), { name: "connect-settings" }));
