import type { Dict } from "./cs";

export const en: Dict = {
  nav: { home: "Home", store: "Store", library: "Library", downloads: "Downloads", settings: "Settings", account: "Account" },
  top: { search: "Search games and software…", signIn: "Sign in", guest: "Guest", noDownloads: "No active downloads" },
  window: { minimize: "Minimize", maximize: "Maximize", close: "Close" },
  common: { retry: "Try again", soon: "Coming soon", openWeb: "Open on the web", phase: "Phase {{n}}" },
  home: {
    eyebrow: "StudioVoxario Connect",
    title: "All StudioVoxario games and software in one place",
    lead: "Store, library, downloads and updates – Ashes of Eryon, Fantasy, Voxario Studio Engine, Voxar.app, VoxarioProtect and VoxarioBrowser.",
    continue: "Continue playing", news: "News and updates", featured: "Featured", sales: "Deals",
    emptyContinue: "Nothing played yet", emptyContinueText: "Installed games appear here after their first launch.",
    catalogPending: "Loading the catalog from the StudioVoxario website",
  },
  store: {
    title: "Store", games: "Games", software: "Software", all: "All", filters: "Filters", sort: "Sort",
    sortNewest: "Newest", sortPrice: "Price", sortName: "Name",
    pending: "Products, prices and images come from the StudioVoxario website (source of truth) – catalog integration is Phase 1.",
  },
  library: {
    title: "Library", all: "All", games: "Games", software: "Software", installed: "Installed", favorites: "Favorites",
    emptyTitle: "Your library is empty", emptyText: "After signing in, your games, software and licenses appear here (Phase 2).",
    grid: "Grid", list: "List",
  },
  downloads: {
    title: "Downloads", queue: "Queue", speed: "Speed", emptyTitle: "The download queue is empty",
    emptyText: "Installs, updates and file repairs appear here – with pause, ordering and resume after restart (Phase 3).",
  },
  settings: {
    title: "Settings",
    sections: { downloads: "Downloads & locations", general: "General", appearance: "Appearance", notifications: "Notifications", diagnostics: "Diagnostics" },
    language: "Language", theme: "Theme", dark: "Dark", light: "Light", afterLaunch: "After launching a game",
    minimize: "Minimize", close: "Close", keep: "Keep open", version: "Version", platform: "Platform",
    libraries: "Library folders", librariesText: "Multiple folders on different drives, choose the target on install (Phase 4).",
    limits: "Speed limit and scheduler", autoUpdate: "Automatic updates", exportLogs: "Export logs",
    notifDone: "Download finished", notifUpdate: "New update", notifSale: "Deal on a followed product",
  },
  account: {
    title: "Account", guestTitle: "You are not signed in",
    guestText: "Sign-in uses your StudioVoxario website account in the system browser (safely – Connect never sees your password). You can browse the store without signing in.",
    manage: "Manage account on the web", licenses: "Licenses", purchases: "Purchase history",
  },
  search: { placeholder: "Search the store and your library…", hint: "Ctrl+K", inLibrary: "In your library", inStore: "In the store", empty: "The catalog is not loaded yet – search will run over the local cache (offline too)." },
};
