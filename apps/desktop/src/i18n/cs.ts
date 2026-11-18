export const cs = {
  nav: { home: "Domů", store: "Obchod", library: "Knihovna", downloads: "Stahování", settings: "Nastavení", account: "Účet" },
  top: { search: "Hledat hry a software…", signIn: "Přihlásit se", guest: "Host", noDownloads: "Nic se nestahuje" },
  window: { minimize: "Minimalizovat", maximize: "Maximalizovat", close: "Zavřít" },
  common: { retry: "Zkusit znovu", soon: "Připravujeme", openWeb: "Otevřít na webu", phase: "Fáze {{n}}" },
  home: {
    eyebrow: "StudioVoxario Connect",
    title: "Všechny hry a software studia na jednom místě",
    lead: "Obchod, knihovna, stahování a aktualizace – Ashes of Eryon, Fantasy, Voxario Studio Engine, Voxar.app, VoxarioProtect a VoxarioBrowser.",
    continue: "Pokračovat ve hře", news: "Novinky a aktualizace", featured: "Doporučené", sales: "Slevy",
    emptyContinue: "Zatím jste nic nehráli", emptyContinueText: "Nainstalované hry se tu objeví po prvním spuštění.",
    catalogPending: "Katalog se načítá z webu StudioVoxario",
  },
  store: {
    title: "Obchod", games: "Hry", software: "Software", all: "Vše", filters: "Filtry", sort: "Řazení",
    sortNewest: "Nejnovější", sortPrice: "Cena", sortName: "Název",
    pending: "Produkty, ceny a obrázky se berou z webu StudioVoxario (zdroj pravdy) – napojení katalogu je Fáze 1.",
  },
  library: {
    title: "Knihovna", all: "Vše", games: "Hry", software: "Software", installed: "Nainstalováno", favorites: "Oblíbené",
    emptyTitle: "Knihovna je prázdná", emptyText: "Po přihlášení se tu zobrazí vaše hry, software a licence (Fáze 2).",
    grid: "Mřížka", list: "Seznam",
  },
  downloads: {
    title: "Stahování", queue: "Fronta", speed: "Rychlost", emptyTitle: "Fronta stahování je prázdná",
    emptyText: "Instalace, aktualizace a opravy souborů se zobrazí tady – s pauzou, pořadím a obnovením po restartu (Fáze 3).",
  },
  settings: {
    title: "Nastavení",
    sections: { downloads: "Stahování a umístění", general: "Obecné", appearance: "Vzhled", notifications: "Oznámení", diagnostics: "Diagnostika" },
    language: "Jazyk", theme: "Téma", dark: "Tmavé", light: "Světlé", afterLaunch: "Po spuštění hry",
    minimize: "Minimalizovat", close: "Zavřít", keep: "Nechat otevřené", version: "Verze", platform: "Platforma",
    libraries: "Knihovní složky", librariesText: "Více složek na různých discích, volba cíle při instalaci (Fáze 4).",
    limits: "Omezení rychlosti a plánovač", autoUpdate: "Automatické aktualizace", exportLogs: "Exportovat logy",
    notifDone: "Dokončené stahování", notifUpdate: "Nová aktualizace", notifSale: "Sleva na sledovaný produkt",
  },
  account: {
    title: "Účet", guestTitle: "Nejste přihlášeni",
    guestText: "Přihlášení probíhá přes účet webu StudioVoxario v systémovém prohlížeči (bezpečně, heslo Connect nikdy nevidí). Obchod lze procházet i bez přihlášení.",
    manage: "Spravovat účet na webu", licenses: "Licence", purchases: "Historie nákupů",
  },
  search: { placeholder: "Hledat v obchodě a knihovně…", hint: "Ctrl+K", inLibrary: "Ve vaší knihovně", inStore: "V obchodě", empty: "Katalog zatím není načtený – hledání poběží nad lokální cache (i offline)." },
};
export type Dict = typeof cs;
