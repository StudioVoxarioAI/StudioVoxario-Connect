# DECISIONS – rozhodnutí a odchylky od SPEC

## D1 – Electron místo Tauri 2 (odchylka od doporučení SPEC sekce 3)
**Rozhodnutí:** Shell aplikace = **Electron** (33), UI = React + TypeScript + Vite + Tailwind (podle doporučení).
**Proč:** SPEC: „pokud stávající launcher už používá konkrétní stack a funguje, preferuj jeho znovupoužití“.
Stávající launcher Ashes of Eryon (`Voxar.app/game/launcher/app`) i Voxar.app jsou Electron a mají ověřenou
logiku, kterou Connect převezme: PKCE přihlášení s předáním z webu a šifrováním tokenu přes `safeStorage` (DPAPI),
delta update podle SHA-256 se `.staging` / `.rollback` a návratem při pádu, self-update. Tým i CI (electron-builder,
NSIS) už s Electronem pracují. Cenou je větší instalátor (~80 MB) a vyšší paměť než u Tauri.

## D2 – Monorepo s pnpm workspaces (SPEC sekce 2)
`apps/desktop`, `packages/ui`, `packages/catalog-client`, `packages/installer-core`. Logika mimo UI (validace,
delta, fronta) je v balíčcích a testuje se bez Electronu (Vitest).

## D3 – Datový model rozšířen o `Product.access`
Hodnoty `none` | `access_key` | `account_permission` | `license`. Důvod: požadavek uživatele – Voxar.app jen s klíčem,
Ashes of Eryon jen s přístupem, engine s licencí. Cena (`pricing`) a přístup jsou nezávislé.

## D4 – Validace dat z webu (Zod)
Neznámá pole se zahazují, položka s chybějícím povinným polem se zaloguje a přeskočí (`parseProducts`), aplikace kvůli
jedné vadné položce nespadne.

## D5 – Identifikátory produktů
Stabilní slugy: `ashes-of-eryon`, `fantasy`, `voxario-studio-engine`, `voxar-app`, `voxario-protect`,
`voxario-browser`. Jména, texty, ceny a obrázky jen z webu – přejmenování „Fantasy“ = změna dat.

## D6 – Písma
Nadpisy **Oxanium** (web ho načítá, má české znaky), logo / wordmark **Orbitron** (jako web; nemá latin-ext, proto
jen pro text bez diakritiky), text Inter a Rajdhani (UI). Písma jsou přibalená (`@fontsource`), aplikace funguje offline.

## D7 – Bezpečnost okna
`contextIsolation`, `sandbox`, bez `nodeIntegration`, CSP v `index.html`, renderer volá jen úzké API z preloadu
(`window.connect`). Externí odkazy (platby, účet) jen `https://` v systémovém prohlížeči; navigace okna mimo aplikaci
zakázána. Jedna instance; protokol `studiovoxario://` registrovaný (deep linky pro Fázi 5).

## D8 – Lokální data
Předvolby UI (jazyk, téma) v `localStorage` (zustand persist). Knihovna, instalace a fronta stahování budou
v **SQLite** v hlavním procesu (Fáze 3, `better-sqlite3`), ne v rendereru.

## D9 – Repozitář a větve
Nový repozitář `StudioVoxarioAI/StudioVoxario-Connect`; web se nemění (jen čtení). Vývoj ve větvi
`claude/happy-bardeen-psq6y3`; výchozí větev repozitáře (`main`) založí vlastník nebo ji vytvoříme po schválení.

## D10 – Katalog: snapshot v aplikaci, dokud ho neservíruje web (Fáze 1)
Web zatím nemá jednotný katalog a jeho repozitář se bez schválení nemění. Connect proto čte katalog v pořadí:
`https://studiovoxario.com/connect/catalog.json` (návrh pro web, `docs/WEB_PROPOSAL.md`) → poslední uložená cache →
snapshot přibalený k aplikaci (`apps/desktop/public/catalog.json` + `catalog-media/`). Živé údaje se i tak berou
z webu: **cena** z obchodu (`shop_items` podle `shopKey`), **verze a velikost** z manifestů her (`game-updates`).
Jakmile web soubor zveřejní, Connect ho použije bez nového vydání (stejný formát). Média vyrábí
`tools/make-media.py` jen z obrázků webu, hry a enginu (obálky bez textu – přejmenování nevyžaduje nový obrázek).

## D11 – Síť hlavního procesu přes `net.fetch`
Hlavní proces stahuje přes síťový stack Chromia (`electron.net.fetch`) – respektuje systémové proxy a certifikáty
(firemní sítě), na rozdíl od `fetch` z Node.
