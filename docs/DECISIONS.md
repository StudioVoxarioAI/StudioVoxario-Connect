# DECISIONS – rozhodnutí a odchylky od SPEC

## D1 – Electron místo Tauri 2 (odchylka od doporučení SPEC sekce 3)
**Rozhodnutí:** Shell aplikace = **Electron** (45; původně 33), UI = React + TypeScript + Vite + Tailwind (podle doporučení).
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

## D12 – Přihlášení: stávající tok launcheru (Fáze 2)
Connect používá beze změny webu edge funkci `launcher-auth` a stránku `/game/auth/launcher` (PKCE, lokální
callback 127.0.0.1, výměna `token_hash` za vlastní relaci přes `/auth/v1/verify`) s parametrem `app=connect`.
Web zatím pro `connect` ukáže text launcheru Ashes (neznámá aplikace -> výchozí); vlastní text je v návrhu pro web.
Obnovovací token šifrovaně přes `safeStorage` (DPAPI / Keychain / libsecret); bez bezpečného úložiště se neukládá.

## D13 – Knihovna podle typu přístupu (Fáze 2)
`none` + zdarma -> „Přidat do knihovny“ (lokálně k účtu); `access_key` -> klíč ověří web (`app-access` redeem, s účtem);
odemčení platí pro skupinu (VoxarioProtect = modul Voxar.app); `account_permission` -> `ashes_can_play()`;
`license` -> `shop_license_status(product_key)` (vlastnictví, aktualizace, odkaz na koupi). Poslední stav z webu se
pamatuje (offline knihovna). `CONNECT_DEMO=1` = ukázkový účet jen pro vývoj a náhledy.

## D14 – Instalace, stahování a lokální data (Fáze 3)
Jádro stahování a instalace je v `installer-core/node` (čistý Node, `fetch` předávaný – Electron `net.fetch`,
v testech `fetch` z Node proti lokálnímu serveru s HTTP Range). Převzatá logika launcheru Ashes: části `<url>.partN`,
`.staging` -> `.rollback`, `install.json` (kompatibilní se starým launcherem – migrace ve Fázi 7), návrat verze při
pádu do 20 s. Navíc: navazování přes HTTP Range (`.partial`), paralelní spojení, omezovač rychlosti, oprava
přehashováním, bezpečné cesty. Místo SQLite (D8) **JSON úložiště s atomickým zápisem** (`electron/store.ts`,
líné načtení): data jsou malá (desítky záznamů), odpadá nativní modul (`better-sqlite3` by se musel sestavovat pro
každou verzi Electronu a platformu). Ověřeno E2E (`scripts/e2e-install.mjs`, `e2e-resume.mjs`): skutečný build
Ashes of Eryon (102,8 MB, 107 souborů) se stáhne, ověří, opraví i odinstaluje; stahování přežije zavření aplikace.

## D15 – Nastavení a systém (Fáze 4)
Nastavení stahování a systému žije v hlavním procesu (`settings.json`), UI ho jen čte a mění přes IPC. **Knihovní
složky:** první = výchozí cíl, další na jiných discích (`dialog.showOpenDialog`, podsložka `StudioVoxarioLibrary`),
volné místo přes `statfs`, složku s hrami nejde odebrat. **Přesun instalace:** na stejném disku přejmenováním, mezi
disky kopií s kontrolou velikosti a `install.json`, původní se maže až po úspěšné kopii (ověřeno E2E: /tmp ↔
/dev/shm, následné ověření nestáhlo nic). **Plánovač:** okno od–do i přes půlnoc (`inSchedule`, testy); mimo okno
fronta čeká, ruční oprava běží vždy. **Omezení rychlosti** platí hned i pro běžící stahování (opravena chyba, kdy
vypnutí limitu během čekání omezovač zasekl). **Hlídač spojení:** bez dat 30 s -> pokus se přeruší a naváže přes Range
(zaseknuté spojení s CDN se dřív nikdy neobnovilo). **Automatické aktualizace:** při startu a každých 30 min (obnova
katalogu), volitelně jen když nic neběží; kanál stable/beta podle produktu (manifest `channels.beta`). **Systém:**
spouštění se systémem (`setLoginItemSettings`, `--hidden`), ikona v oznamovací oblasti (zavření okna = schovat,
stahování běží dál), systémová oznámení (dokončení, aktualizace, návrat verze vždy), log `userData/logs/connect.log`
bez tokenů a klíčů, export pro podporu. Telemetrie výchozí vypnutá a zatím nic neodesílá. Deep linky
`studiovoxario://product|library|purchase-complete|downloads|settings|account` (bílá listina, `parseDeepLink`, testy).

## D16 – Nákup a aplikace s vlastním instalátorem (Fáze 5–6)
**Nákup** zůstává na webu (Stripe / QR, faktury, DPH – jedno místo pravdy): Connect otevře `buy_url` / `pass_url`
z `shop_license_status` v systémovém prohlížeči. Po návratu do okna (focus, nejvýš 1× za 20 s) se knihovna obnoví;
deep link `studiovoxario://purchase-complete?product=<id>` je připravený pro web (návrh v `WEB_PROPOSAL.md`).
**Aplikace** (Voxar.app, VoxarioBrowser, Voxario Studio Engine) se nepřebalují – Connect stáhne jejich oficiální
instalátor, ověří ho a spustí: `installer` = veřejná URL (GitHub Releases), velikost a SHA-256 z `versionUrl`, jen když
popisuje stejný soubor; `shop-file` = soubor z obchodu (soukromé úložiště, části do 45 MB) stahovaný jménem uživatele,
web ověří licenci (`shop_can_download`, RLS). Instalaci Connect pozná z **registru Windows** (`Uninstall\StudioVoxario.app`,
`StudioVoxario.browser`, HKLM `VoxarioStudio`: verze, složka, odinstalátor) nebo ze složky aplikace – i když byla
nainstalovaná dřív mimo Connect. Engine (NSIS, pro všechny uživatele) se instaluje tiše `/S` s UAC (PowerShell
`Start-Process -Verb RunAs`), Voxar.app a VoxarioBrowser mají vlastní okenní instalátor (bez tichého režimu).
Aplikace se dál aktualizují samy (electron-updater) – Connect u nich nenabízí aktualizaci, jen přeinstalaci.
**Voxar.app jen s klíčem:** instalace (i VoxarioProtect) jde až po odemčení klíčem (stav knihovny `owned`), jinak
Connect instalátor vůbec nestáhne. **VoxarioProtect** je modul Voxar.app: „Otevřít ve Voxar.app“, případně
„Nainstalovat Voxar.app“. Ověřeno E2E na Linuxu: rozpoznání instalace, modul, skutečné stažení VoxarioBrowserSetup.exe
(173 MB, PE) z GitHub Releases; samotné spuštění instalátoru a registr ověří Windows (CI build + ruční test).
**Zjištění na webu:** politika úložiště `shop_files_buyer_read` pouští jen předplatitele (`shop_entitlements`), ne
držitele licence (`shop_licenses`) – návrh opravy v `WEB_PROPOSAL.md` (Connect i web pak stáhnou engine s licencí).

## D17 – Vydávání, aktualizace Connectu a převzetí starých instalací (Fáze 7)
**Aktualizace Connectu:** `electron-updater` s GitHub Releases repozitáře Connect (`latest.yml`), stahování na pozadí,
instalace po kliknutí „Restartovat a aktualizovat“ (nebo při ukončení). Kanál Beta = i předběžná vydání (tag
`vX.Y.Z-beta.N`). Kontrola při startu a každých 6 h; ve vývojové verzi vypnuto. **Vydání:** workflow `release.yml`
na tag `v*` (lint, typecheck, testy, NSIS instalátor, publikace). Podpis kódu je TODO (certifikát vlastníka).
Všechny závislosti jsou sbalené (Vite + esbuild), v instalátoru nejsou `node_modules` (app.asar ~6 MB).
**Převzetí:** Connect při startu najde hry starého launcheru Ashes of Eryon – kořen z registru
`StudioVoxario.AshesOfEryon` → `Game` / `Game-fantasy`, výchozí `%LOCALAPPDATA%\StudioVoxario\Ashes of Eryon\Game`
a záložní `%LOCALAPPDATA%\StudioVoxario\AshesOfEryon{-fantasy}` – a převezme je bez stahování (formát
`install.json` je stejný). Ruční převzetí: Nastavení → Diagnostika. Ověřeno E2E (`e2e-migrate.mjs`): převzatá hra se
spustí a ověření souborů nic nestáhne. Beta kanál starého launcheru (`-beta`) se nepřebírá (Connect má kanál jinak).

## D18 – Fáze 8 jen jako návrh (web se nemění bez schválení)
Úpravy webu jsou připravené jako `git am` patche v `docs/web-patches/` (vyrobené z exportu webu v dočasné složce,
pracovní kopie webu zůstala netknutá): 0001 Ke stažení jen Connect + `app=connect`, 0002 návrat z platby deep
linkem, 0003 oprava RLS úložiště pro držitele licence, 0004 `/connect/catalog.json`, 0005 zrušení rozcestníku.
Inventář a co musí zůstat: `WEB_CLEANUP.md`; pořadí a rizika: `WEB_PROPOSAL.md`. Workflow vydání nahrává i
`StudioVoxarioConnectSetup.exe` bez čísla verze – stabilní odkaz pro stránku Ke stažení.

## D19 – Bezpečnostní aktualizace závislostí (0.1.1)
Electron 33 (bez podpory, známé zranitelnosti) → **45.3.4**, electron-builder 26.18, electron-updater 6.8,
react-router-dom 7.18 (open redirect), zod 4.6 (vyčerpání paměti), vitest 4.1, esbuild 0.28; `pnpm.overrides` pro
`tar` a staré `app-builder-lib` ze `electron-builder-squirrel-windows` (nepoužívá se). `pnpm audit --prod`: bez nálezů;
zbývají jen nástroje pro sestavení/lint. Po aktualizaci znovu prošly E2E testy (instalace, přesun, limit, plánovač,
aplikace, převzetí) proti produkčním datům webu.

## D20 – Vlastní vizuální identita (0.2.0): HUD StudioVoxario místo „launcheru jako ostatní“
Na přání vlastníka se Connect nemá podobat Epic Games Store. Změna rozložení i jazyka podle HUD stylu webu
(holo-pod): **horní velitelská lišta** se záložkami 01–04 místo bočního panelu, **stavová lišta** dole (spojení,
stahování, rychlost, volné místo, verze), **Domů = „deck“** (velký holo panel + výběr produktů 01–05 jako menu ve hře,
bez automatického kolotoče; pod ním panely Pokračovat / Stahování a časová osa novinek), **karty naležato** se
zkosenými rohy, vlasovým neonovým rámem a rohovými závorkami (místo portrétních obálek), zkosená tlačítka a štítky,
nadpisy verzálkami (Oxanium) se štítkem `// sekce`, ostré rohy (`--radius` 3 px), pozadí s mřížkou a září.
Utility `.hud`, `.hud-tile`, `.hud-btn`, `.hud-brackets`, `.hud-label`, `.hud-scan` v `packages/ui/src/tokens.css`.
**Vydávání:** electron-builder 26 zakládal vydání bez platného tagu (422) – vydání teď zakládá workflow jako
koncept s tagem (`gh release create --draft --target`), electron-builder do něj nahraje soubory, nakonec se zveřejní.

## D21 – Skutečné poznámky ke každé verzi (0.2.1)
Jediný zdroj: `apps/desktop/src/changelog.json` (verze, datum, nadpis cs/en, změny typu feature/improvement/fix/security
– stejný formát jako `src/data/changelog.ts` webu). Workflow Release bez záznamu pro vydávanou verzi **skončí chybou**;
poznámky jdou do GitHub Release (Markdown + strukturovaná data v komentáři `<!-- connect-changelog {...} -->`).
Workflow Release notes je doplní zpětně po každé změně changelogu. Web (Novinky, Historie verzí) je čte živě z GitHub
Releases API – nová verze se na webu objeví hned po vydání, bez nasazení webu. Connect po aktualizaci ukáže
okno „Co je nového“ (Nastavení → Obecné ho otevře znovu).

## D22 – Vlastní instalátor (0.3.0)
Na přání vlastníka celoobrazovkový instalátor místo průvodce NSIS a jinak než u Voxar.app. **Instalátorem je sám
Connect:** `StudioVoxarioConnectSetup.exe` je portable build (rozbalení s brandovaným splashem `build/setup-splash.bmp`),
který v režimu instalace (`PORTABLE_EXECUTABLE_FILE`) otevře `#/setup`: obrázky her přes celé okno, logo, průběh,
volby vlevo dole (umístění, zástupci, start se systémem), tlačítko vpravo dole. Zkopíruje rozbalenou aplikaci
(`process.noAsar`), zapíše `resources/app-update.yml`, `installer.json`, registr (HKCU: Uninstall\StudioVoxarioConnect,
protokol `studiovoxario://`, `Software\{GUID}\InstallLocation`), zástupce (`shell.writeShortcutLink`) a spustí Connect.
Bez práv správce, bez 7z a druhého runtime. **Aktualizace:** dál electron-updater s technickým NSIS balíčkem
`StudioVoxarioConnectUpdate-x.exe` (tichý, uživatel ho nevidí); NSIS si složku přečte z `InstallLocation` (GUID = UUID v5
appId, stejně jako electron-builder) a tichý starý odinstalátor (`--uninstall /S`) jen skončí bez mazání. Connect při
startu drží jediný záznam v Aplikacích Windows (aktualizuje verzi, maže duplicitní záznam NSIS).
**Odinstalace:** `StudioVoxarioConnect.exe --uninstall` – stejná obrazovka, smazání složky po ukončení procesu.
Ověřeno E2E na Linuxu (`scripts/e2e-setup.mjs`); registr, zástupce a splash ověří Windows (ruční test).

## D23 – Automatická aktualizace Connectu bez zásahu uživatele (0.3.2)
Do 0.3.1 se Connect aktualizoval jen po kliknutí na „Restartovat a aktualizovat“ nebo při úplném ukončení – a protože
zavřením okna se schová do lišty, nová verze se často nenainstalovala vůbec; kontrola navíc běžela jen při startu
a jednou za 6 h. Ověřeno, že aktualizátor vydání vidí (0.3.0 → 0.3.1, `StudioVoxarioConnectUpdate-0.3.1.exe`).
Nově: kontrola při startu, každých 15 min a při návratu do okna; po stažení se verze **sama nainstaluje, když je klid**
(nic neběží ani se nestahuje) – v pozadí hned, s otevřeným oknem po 30 s odpočtu s „Později“ (odklad 2 h).
`generateUpdatesFilesForAllChannels` přidává `beta.yml` pro kanál Beta.

## D24 – Fantasy samostatně, přístupy ke hrám a role (0.4.0)
Fantasy byla ve starém launcheru kanálem Ashes of Eryon; v Connectu je samostatná hra (`related: ashes-of-eryon`)
s přístupem `account_permission` jako Ashes. Web: tabulka `game_access(user_id, game)`, `game_can_play(p_game)`
(Ashes dál přes `ashes_access`/`ashes_can_play`), správa `game_admin_access_list/grant/revoke` (Ashes jen správce,
Fantasy i editor) a `my_platform_role()` (správce / editor / hráč + hry, které spravuje). Přístupy jdou udělit na
webu (Administrace → Přístupy ke hrám) i v Connectu (Správa – jen pro oprávněné). Do nasazení migrace Connect
používá `ashes_can_play` a role z `user_roles` (Fantasy pak jen správce a editor). Pozn.: soubory her jsou ve
veřejném úložišti `game-updates` – přístup hlídá Connect (stejně jako u Ashes ve starém launcheru).

## D25 – Soukromé úložiště her (0.5.0)
Buildy her (`game-updates/unity/…`) už nejsou veřejné: migrace webu přepne bucket na soukromý a pravidla RLS pustí
`unity/fantasy/…` jen s `game_can_play('fantasy')` a ostatní `unity/…` jen s `game_can_play('ashes-of-eryon')`;
`launcher/` zůstává čitelné. Connect stahuje přes `/storage/v1/object/authenticated/…` s tokenem uživatele
(`electron/storage.ts`, token se obnovuje za běhu); dokud je bucket veřejný, záložně veřejná adresa. Pořadí nasazení:
nejdřív Connect 0.5.0 (automatická aktualizace do 15 min), potom migrace webu. Starý launcher Ashes hry nestáhne.

## D26 – Stabilní rychlost stahování (0.5.1)
Měření na skutečném buildu Fantasy (379 souborů do 10 MB, 257 MB): původně 150 s, průměr 1,7 MB/s, 94 ze 148 sekund
pod 1 MB/s. Příčina: ~0,5 s odezva serveru na každý soubor a jen 3 souběžné soubory (291 souborů < 1 MB). Nově dvě
skupiny souběžně – velké soubory (≥ 4 MB, od největšího) podle nastavení „Souběžná spojení“, malé až 16 najednou;
části velkých souborů paralelně. Za stejných podmínek (cache serveru) 8,7 s → 4,2 s; celá Fantasy (949 MB) v aplikaci
za 38 s, zobrazená rychlost 20–46 MB/s. Zobrazená rychlost = průměr posledních 5 s.
