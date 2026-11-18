# WEB_PROPOSAL – úpravy webu pro StudioVoxario Connect (ke schválení)

Web (`StudioVoxarioAI/Voxar.app`) jsem **neměnil**. Všechny změny jsou připravené jako patche v `docs/web-patches/`
(vyrobené z kopie webu, ne z pracovní kopie repozitáře) a použijí se až po schválení:

```bash
cd Voxar.app            # repozitář webu, nová větev
git checkout -b connect-web
git am ../StudioVoxario-Connect/docs/web-patches/0001-*.patch   # a další podle výběru
```

| Patch | Co dělá | Riziko | Nutné pro Connect? |
| --- | --- | --- | --- |
| 0001 | **Ke stažení = jen Connect.** `/desktop` nabízí jediné tlačítko „Stáhnout StudioVoxario Connect“. Odstraní z ní tlačítka Voxar.app, VoxarioBrowser a GameSetup Ashes; komponenta `AshesDownloadCard` zůstává v kódu. Doplní `app=connect` do přihlašovací stránky (`/game/auth/launcher`), takže uživatel uvidí „Přihlásit StudioVoxario Connect?“ místo textu launcheru Ashes. | nízké – jedna stránka, odkazy `/desktop`, `/download`, `/stazeni`, `/hra` fungují dál | text přihlášení ano, stránka = poslední fáze, kterou jsi chtěl |
| 0002 | Po platbě (Stripe `?platba=ok`) zahájené z Connectu (`?licence=` / `?pass=`) ukáže toast s tlačítkem **Otevřít v Connectu** (`studiovoxario://purchase-complete?product=<key>`). | nízké | ne (Connect se obnoví i sám po návratu do okna) |
| 0003 | **Oprava chyby obchodu:** politika úložiště `shop_files_buyer_read` pouštěla ke stažení jen předplatitele (`shop_entitlements`), ne držitele trvalé licence (`shop_licenses`). Nově platí stejné pravidlo jako `shop_can_download()`. Týká se i stahování enginu z webu. | nízké, jen čtení souborů | **ano** pro instalaci enginu v Connectu |
| 0004 | `public/connect/catalog.json` + média (3,6 MB) – katalog, který Connect čte jako první (`https://studiovoxario.com/connect/catalog.json`). Úpravou JSONu na webu se mění texty, obrázky, pořadí i nové produkty bez vydání Connectu. | žádné (nové soubory) | doporučeno |
| 0005 | **Zrušení rozcestníku (SPEC 11b):** navigace „Platforma“, patička a úvodní stránka vedou na Connect; VoxarioBrowser a VoxarioProtect jako „instalace přes Connect“. Stránky `/app`, `/browser`, `/launcher`, `/ashes` a jejich kód zůstávají (používá je i desktop Voxar.app). | střední – mění obsah úvodní stránky | podle tvého rozhodnutí |

## Pořadí a zachování přístupů
1. Nejdřív vydat Connect (tag `v0.1.0` → workflow Release, stabilní odkaz
   `…/StudioVoxario-Connect/releases/latest/download/StudioVoxarioConnectSetup.exe`). Repozitář s vydáními musí být
   **veřejný** (stahování z webu i automatické aktualizace jsou anonymní), jinak vydání zrcadlit na web/úložiště.
2. Potom 0003 (migrace přes Supabase) a 0004, nakonec 0001, 0002 a případně 0005.
3. **Voxar.app s klíčem a Ashes s přístupem zůstávají:** Connect instalátor Voxar.app vůbec nestáhne bez odemčení klíčem
   (`app-access` redeem) a Ashes bez `ashes_can_play()`. Staré přímé odkazy na `StudioVoxarioSetup.exe` /
   `VoxarioBrowserSetup.exe` v GitHub Releases dál fungují (aplikace se jimi aktualizují) – jen je web nenabízí.

## Další návrhy (bez patche, až budou potřeba)
- **Klíč k účtu:** `app-access` váže odemčení na IP (`app_access_ips`) a jen uloží `user_id`, když přijde token.
  Pro Connect by bylo spolehlivější `check` podle `user_id` (jiná síť / VPN = znovu klíč). Connect si odemčení
  pamatuje lokálně, takže to dnes nevadí.
- **API katalogu a buildů** (`GET /api/catalog`, `/api/products/:id/builds`) – zatím nahrazeno statickým
  `catalog.json` + manifesty v `game-updates` + `shop_items`. Stačí to; API jen kdyby katalog spravovala administrace.
- **`/me/library`:** dnes ji Connect skládá z `ashes_can_play`, `shop_license_status`, `shop_my_licenses`,
  `app-access`. Jedna RPC `connect_library()` by ušetřila 4 dotazy.
- **Starý launcher Ashes:** do jeho příští verze hlášku „Launcher končí – hry převezme StudioVoxario Connect“ s
  odkazem na `/desktop` (SPEC 11.4). Connect převezme jeho instalace sám.
