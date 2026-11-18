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

## Struktura
```
apps/desktop            Electron + React UI
packages/ui             designové tokeny a komponenty
packages/catalog-client datový model, validace, adaptér katalogu webu
packages/installer-core stahování, delta aktualizace, instalace, ověření
docs/                   DISCOVERY, DECISIONS, ARCHITECTURE
```

Plán po fázích: SPEC sekce 10 (F0 kostra → F1 katalog → F2 účet a knihovna → F3 instalace → F4 nastavení →
F5 nákup a licence → F6 aplikace portfolia → F7 vydání → F8 úklid webu).
