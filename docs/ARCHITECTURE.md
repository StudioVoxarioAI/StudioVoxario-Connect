# ARCHITECTURE – StudioVoxario Connect

```
┌──────────────────────────── apps/desktop (Electron) ────────────────────────────┐
│ Renderer (React, Vite, Tailwind; sandbox)                                       │
│   Domů │ Obchod │ Knihovna │ Stahování │ Hledání (Ctrl+K) │ Účet │ Nastavení       │
│   TanStack Query (cache katalogu), zustand (předvolby), i18next (cs / en)       │
│        │ window.connect (preload, contextBridge – úzké API)                     │
│ Hlavní proces (electron/main.ts)                                                │
│   okno bez rámu, jedna instance, deep link studiovoxario://                     │
│   [F1] synchronizace katalogu   [F2] přihlášení (PKCE, safeStorage)             │
│   [F3] stahování / instalace / spuštění / ověření (installer-core) + SQLite     │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ HTTPS
        ┌──────────────────────────────┴──────────────────────────────┐
        │ Web StudioVoxario (Supabase) – zdroj pravdy                  │
        │ shop_items · licence · ashes_can_play · app-access ·         │
        │ launcher-auth · Stripe · game-updates (manifesty, buildy)    │
        └──────────────────────────────────────────────────────────────┘
```

| Balíček | Obsah | Stav |
|---|---|---|
| `packages/ui` | designové tokeny (`tokens.css`), Button, Badge, Skeleton, EmptyState, SectionTitle | F0 |
| `packages/catalog-client` | Zod schémata datového modelu (SPEC 5 + `access`), `parseProducts`, ID portfolia; adaptér webu | F0 schémata, F1 adaptér |
| `packages/installer-core` | delta plán (SHA-256), bezpečné cesty, fronta stahování, formátování; později stahování (Range, resume), staging/rollback, ověření | F0 jádro, F3 I/O |
| `apps/desktop` | Electron (main, preload), React UI, i18n, náhledy (`pnpm shots`) | F0 kostra |

Pravidla: žádná business logika v UI; vše z webu se validuje; UI nikdy nečeká na síť (skeletony, cache);
nainstalované hry jdou spustit offline (kromě produktů s online přístupem).
