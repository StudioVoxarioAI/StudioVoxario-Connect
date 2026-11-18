# DISCOVERY – průzkum repozitáře webu (Fáze 0)

Zdroj: `StudioVoxarioAI/Voxar.app` (jen čtení, nic se neměnilo). Cesty níže jsou v tomto repozitáři.

## Shrnutí

| Oblast | Stav na webu | Co použije Connect | Co chybí |
|---|---|---|---|
| Stack webu | Vite + React + TS + shadcn/Tailwind, react-router, TanStack Query, i18next, Supabase | stejný UI stack (React/TS/Vite/Tailwind), tokeny brandu | – |
| Katalog produktů | **neexistuje jednotný katalog**; nejblíž `shop_items` (obchod: software, pluginy, rámečky), herní data rozptýlená (`ashes_*`, `electron/products.cjs`, `Index.tsx`) | adaptér z `shop_items` + manifestů her | `GET /api/catalog` (sekce 12) |
| Účty | Supabase Auth (e-mail + heslo, Google OAuth přes Lovable) | **PKCE handoff z launcheru Ashes** (`launcher-auth`) | scope pro Connect, `me/library` |
| Platby | Stripe Checkout (`stripe-checkout`, `stripe-webhook`), QR platba / převod (SPAYD, ruční schválení) | otevření platby na webu, návrat deep linkem | redirect `studiovoxario://purchase-complete` |
| Licence | `shop_licenses`, RPC `shop_my_licenses()`, `shop_license_status(product)`, `shop_can_download(item)` | knihovna softwaru + licence enginu | – (existuje) |
| Přístup Voxar.app | **klíč**: edge `app-access` (`redeem` / `check`), tabulka `download_access_codes`, odemknutí na IP (`app_access_ips`) | zadání klíče v Connectu před instalací | navázání odemknutí na účet (ne IP) |
| Přístup Ashes of Eryon | **oprávnění účtu**: `ashes_access`, `ashes_can_play()` (admin/editor/řádek v `ashes_access`/`open_to_all`) | kontrola před instalací/spuštěním | klíč pro získání přístupu (volitelně, viz otázky) |
| Buildy her | veřejný bucket `game-updates/unity/`: `latest.json` (stable), `latest-beta.json`, `latest-fantasy.json` (Fantasy = Eryndor), `latest-candidate.json`; soubory > 45 MB jako `<url>.partN`; soukromý `game-builds/ashes/latest.json` (GameSetup, podepsané URL) | manifesty → `BuildManifest`, delta podle SHA-256 | podpis manifestu (spec `UPDATE_PROTOCOL.md` neimplementován), Range na CDN ověřit |
| Stávající launcher | `game/launcher/app` – Electron 31, „Ashes of Eryon Launcher“ 0.7.0: PKCE přihlášení, SHA-256 delta, `.staging` + `.rollback`, návrat při pádu do 20 s, self-update z `game-updates/launcher/stable.json` | **znovupoužití logiky** (auth, update, rollback) → `installer-core` | – |
| Voxar.app | `electron/` – „Voxar.app“ 0.0.58 (web shell + launcher modulů), electron-updater (GitHub `Sokolcz97-rgb/Voxar.app`), instalátor `StudioVoxarioSetup.exe` (7z SFX + HUD instalátor, `%LOCALAPPDATA%\Voxar.app`, HKCU Uninstall `StudioVoxario`), NSIS update balíček | instalace přes Setup (installer), `selfUpdates: true` | – |
| VoxarioProtect | **není samostatný build** – modul uvnitř Voxar.app (`electron/protect-*.cjs`), serverová atestace `protect-attestation` | produkt v katalogu, instalace = Voxar.app s modulem Protect | rozhodnout: samostatný build vs. modul (viz otázky) |
| VoxarioBrowser | build ze stejných zdrojů (`electron/browser-builder.json`), `VoxarioBrowserSetup.exe` / NSIS `VoxarioBrowserUpdate-*.exe`, vlastní updater (kanál `browser`) | installer + `selfUpdates: true` | – |
| Engine | Voxario Studio Engine – placený software v `shop_items` (`product_key`, `sale_mode`, licence s aktualizacemi), soubory v bucketu `shop-files` | produkt „software/engine“, licence z `shop_my_licenses` | manifest buildu enginu pro Connect |
| Brand | tokeny v `src/index.css` (neon cyan `184 100% 54%`, magenta `320 90% 60%`, tmavé pozadí), `docs/brand/README.md` (#3fe0ff → #4a7dff → #a45aff), fonty Orbitron / Oxanium / Rajdhani / Inter, loga `public/icon-512.png`, `docs/brand/voxar-logo-transparent.png` | `packages/ui/src/tokens.css` | – |

## Rozcestník (ruší se až ve Fázi 8 po schválení)
- `src/pages/Index.tsx` – pole `products` (Voxar.app `/app`, VoxarioBrowser `/browser`, Ashes `/ashes`) a `services` (VoxarioProtect → `/desktop`), stahuje poslední GitHub release.
- `src/pages/DownloadDesktop.tsx` – přímé odkazy `…/releases/latest/download/StudioVoxarioSetup.exe` a `VoxarioBrowserSetup.exe`.
- `src/components/download/AshesDownloadCard.tsx` – GameSetup.exe z `game-builds/ashes/latest.json`.
- `/launcher` (`GameLauncher.tsx`, `StudioHub.tsx`), přesměrování `/download`, `/stazeni`, `/hra` → `/desktop`.
- Uvnitř Voxar.app: výběr modulů `electron/launcher.html`.
Podrobný inventář (co se odstraní / co zůstane) vznikne ve Fázi 8 v `docs/WEB_CLEANUP.md`.

## Požadavky uživatele navíc (zadání Fáze 0)
1. **Voxar.app – přístup s klíčem zůstává**: kdo si ji chce v Connectu nainstalovat, musí zadat klíč (stejný mechanismus `app-access` / `download_access_codes`). Connect klíč ověří přes web a teprve pak povolí stažení a instalaci.
2. **Ashes of Eryon – přístup povinný**: instalace a spuštění jen s přístupem (`ashes_can_play()`); bez něj produkt v obchodě ukazuje „Přístup omezen“.
3. **Poslední fáze**: na webu nahradit současné instalátory jediným instalátorem Connectu.
4. Po každé fázi: shrnutí + náhledy obrazovek.

V datovém modelu je proto pole `Product.access`: `none` | `access_key` (Voxar.app) | `account_permission` (Ashes of Eryon) | `license` (engine).

## Data a endpointy, které Connect použije (bez změny webu)
- Supabase REST/RPC s veřejným (publishable) klíčem: `get_public_shop_config()`, `shop_items` (aktivní, `kind='software'`), po přihlášení `shop_my_licenses()`, `shop_license_status(p_product)`, `ashes_can_play()`.
- Edge funkce: `launcher-auth` (`start` / `redeem` – PKCE), `app-access` (`redeem` / `check` – klíč Voxar.app).
- Manifesty her: `game-updates/unity/latest.json`, `latest-beta.json`, `latest-fantasy.json` (veřejné).

## Co chybí (návrh rozšíření webu – sekce 12, jen po schválení)
1. **`GET /api/catalog` (+ `/:id`)** – jednotný katalog všech 6 produktů (jméno, texty, média, cena, status, platformy, požadavky, `access`). Návrh: tabulka `connect_products` + edge funkce `connect-catalog` (nebo statický `catalog.json` v bucketu). Do té doby adaptér skládá katalog z `shop_items` + manifestů + výchozích údajů.
2. **`GET /api/products/:id/builds?platform=&channel=`** – manifest ve tvaru `BuildManifest` (u her převod z `latest*.json`, u aplikací odkaz na instalátor + `installKind`, `silentInstallArgs`, `selfUpdates`).
3. **Klient „connect“ v `launcher-auth`** (stejný PKCE tok) a **`GET /api/me/library` + `/me/licenses`** (lze nahradit voláním existujících RPC).
4. **Odemknutí Voxar.app na účet** (dnes na IP): `app-access` redeem by uložil vazbu `user_id` → Connect ji pozná na jakémkoli počítači.
5. **Redirect po platbě** na `studiovoxario://purchase-complete?product=…`.
6. **HTTP Range** u hostingu buildů (Supabase Storage Range podporuje – ověřit ve Fázi 3).

## Otevřené otázky
- Ashes of Eryon: stačí oprávnění účtu (`ashes_access`), nebo má jít přístup získat i **klíčem** (jako Voxar.app)?
- VoxarioProtect je dnes modul Voxar.app – nabízet ho v Connectu jako samostatný produkt (= instalace Voxar.app s modulem Protect), nebo připravit samostatný build?
- Ceny / model: Voxar.app, VoxarioProtect, VoxarioBrowser zdarma (s klíčem u Voxar.app)?
- Platformy v1: jen Windows (předpoklad).
- Kódový podpisový certifikát: zatím není (TODO – SmartScreen).
- Finální název „Fantasy“ (dnes kanál Eryndor) – jen záznam v katalogu.
