# WEB_CLEANUP – inventář rozcestníku a stránek aplikací (SPEC 11b)

Stav webu `StudioVoxarioAI/Voxar.app` k 18. 11. 2026. **Nic z toho jsem nesmazal ani nezměnil.** Připravené změny jsou
v `docs/web-patches/` (viz `WEB_PROPOSAL.md`) a provedou se až po tvém schválení. Zdrojový kód Voxar.app,
VoxarioProtect a VoxarioBrowser se nemaže nikdy.

## Rozcestník a nabídka instalátorů (mění se)
| Místo | Co je tam teď | Návrh | Patch |
| --- | --- | --- | --- |
| `src/pages/DownloadDesktop.tsx` (`/desktop`) | tlačítka StudioVoxarioSetup.exe (Voxar.app), VoxarioBrowserSetup.exe, karta Ashes (GameSetup.exe) | jen „Stáhnout StudioVoxario Connect“ + co v něm je a jaké přístupy platí | 0001 |
| `src/components/download/AshesDownloadCard.tsx` | stažení GameSetup.exe s přístupem + nahrávání pro správce | přestane se zobrazovat; **soubor zůstává** (případně později odstranit samostatným PR) | 0001 |
| `src/components/Navbar.tsx` – skupina „Platforma“ | Voxar.app, VoxarioBrowser (`/browser`), VoxarioProtect (`/desktop`), Ashes, Ke stažení | Connect, Voxar.app, Ashes, „VoxarioBrowser a VoxarioProtect – přes Connect“ | 0005 |
| `src/components/holo/SiteFooter.tsx` – sloupec „Platforma“ | stejné odkazy | Connect, Voxar.app, Ashes | 0005 |
| `src/pages/Index.tsx` – produkty, služby, důvěra | dlaždice VoxarioBrowser → `/browser`, VoxarioProtect → `/desktop`, „Ověřené instalátory“ | dlaždice Connect, Protect „přes Connect“, „Ověřené instalace“ | 0005 |

## Zůstává beze změny (nutné)
- **Účty a přihlášení:** `/auth`, `/reset-password`, `/game/auth/launcher` a `/auth/aplikace` (`LauncherAuth`, přibude `app=connect`), edge funkce `launcher-auth`.
- **Platby a obchod:** `/obchod` (`Shop`, `SoftwareTab`, `PurchaseDialog`), `stripe-checkout`, `stripe-webhook`, QR/převod, RPC `shop_*`, tabulky `shop_items`, `shop_licenses`, `shop_entitlements`, úložiště `shop-files`.
- **Přístupy:** `app-access` (klíč Voxar.app / VoxarioProtect), `download_access_codes`, `app_access_ips`, `ashes_can_play()`, `ashes_access`.
- **Buildy her a aplikací:** `game-updates` (manifesty Ashes/Fantasy + soubory), GitHub Releases Voxar.app (`StudioVoxarioSetup.exe`, `VoxarioBrowserSetup.exe`, `latest.yml`, `beta.yml`), `public/desktop-version.json`, `public/latest.yml`, `public/beta.yml` – aplikace se z nich aktualizují.
- **Stránky používané uvnitř desktop aplikací:** `/app` (Voxar.app), `/browser` (VoxarioBrowser), `/launcher` (StudioHub v Voxar.app), `/ashes`, `/hra/*` – `DesktopRouteGuard` je povoluje. Proto se **nepřesměrovávají**, jen se na ně přestane odkazovat z rozcestníku.
- **Právní a informační:** `/terms`, `/privacy`, `/obchodni-podminky`, `/licence`, `/verze`, `/novinky`.
- **Komunita:** fórum, zprávy, live, servery, žebříček, kontrakty, dashboard, administrace.

## Přesměrování
Staré adresy rozcestníku už dnes vedou na `/desktop` (`/download` → `/desktop#ashes`, `/stazeni` → `/desktop`,
`/hra` → `/desktop#ashes`); nová stránka má kotvy `#connect` a `#ashes`, takže fungují dál. Web je SPA (bez
serverových 301); pro vyhledávače stačí `sitemap.xml` – `/browser` z něj lze po schválení vyřadit.

## Přechod uživatelů
- Hry starého launcheru Ashes of Eryon Connect převezme sám (ověřeno E2E).
- Voxar.app a VoxarioBrowser nainstalované dřív Connect pozná z registru a zobrazí jako nainstalované.
- Oznámení uživatelům (v aplikaci / e-mailem): text navrhnu, až schválíš termín vydání Connectu.
