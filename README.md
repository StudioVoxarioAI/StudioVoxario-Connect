# StudioVoxario Connect

Desktopová platforma StudioVoxario – **obchod, knihovna, stahování a aktualizace** všech her a softwaru studia
(Ashes of Eryon, Fantasy, Voxario Studio Engine, Voxar.app, VoxarioProtect, VoxarioBrowser). Data (produkty, ceny,
texty, obrázky, verze, účty, licence) jsou na webu StudioVoxario – Connect je klient.

## Vývoj
```bash
pnpm install          # Node 20+, pnpm 10
pnpm dev              # Vite + Electron
pnpm lint && pnpm typecheck && pnpm test
pnpm build            # renderer + hlavní proces
pnpm --filter @connect/desktop pack:win     # instalátor Windows (NSIS)
pnpm preview:shots    # náhledy obrazovek -> apps/desktop/shots/
```

E2E proti skutečnému webu (Linux s `xvfb-run`, `NODE_PATH=$(npm root -g)` pro Playwright), v `apps/desktop`:
`scripts/e2e-install.mjs` (instalace, oprava, odinstalace Ashes), `e2e-resume.mjs` (navázání po restartu),
`e2e-f4.mjs` (knihovny na dvou discích, přesun, limit, plánovač), `e2e-apps.mjs` (aplikace s instalátorem),
`e2e-migrate.mjs` (převzetí instalace starého launcheru).

## Vydání
1. Verze se bere z tagu: vytvořte tag `vX.Y.Z` (beta: `vX.Y.Z-beta.N`) a pushněte ho.
2. Workflow **Release** sestaví instalátor Windows (`StudioVoxarioConnectSetup-X.Y.Z.exe`) a s `latest.yml`
   ho nahraje do GitHub Releases. Nainstalované Connecty si ho stáhnou samy (Nastavení → Obecné; beta jen kanál Beta).
3. **Podpis kódu** zatím chybí (SmartScreen varuje) – doplnit certifikát do secrets `CSC_LINK`, `CSC_KEY_PASSWORD`.
4. Automatické aktualizace čtou vydání veřejně – repozitář s vydáními musí být veřejný (nebo vydání
   zrcadlit na web, viz `docs/WEB_PROPOSAL.md`).

Příručka pro hráče: `docs/USER_GUIDE.md`.

## Struktura
```
apps/desktop            Electron + React UI
packages/ui             designové tokeny a komponenty
packages/catalog-client datový model, validace, adaptér katalogu webu
packages/installer-core stahování, delta aktualizace, instalace, ověření
docs/                   DISCOVERY, DECISIONS, ARCHITECTURE, USER_GUIDE, WEB_PROPOSAL
```

Plán po fázích: SPEC sekce 10 (F0 kostra → F1 katalog → F2 účet a knihovna → F3 instalace → F4 nastavení →
F5 nákup a licence → F6 aplikace portfolia → F7 vydání → F8 úklid webu).
