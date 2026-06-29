# `src/features/` — V2 feature modules

Each V2 pillar lives in its own self-contained module so UI, data, storage, analytics,
and AI logic stay cleanly separated and independently testable. This keeps the
gradual Four-Pillars migration (Play → Track → Study → Improve) additive — existing
production screens are untouched.

## Convention (per feature)

```
features/<name>/
├── data/        # versioned on-device store (AsyncStorage) — mirror src/local/localGamesStore.ts:
│                #   STORAGE_KEY + quarantine + schemaVersion/migrateToCurrent + pure file→file mutations
├── logic/       # pure calculations (integer cents, ISO timestamps) — TDD; tests in logic/__tests__
├── ui/          # screens + components (compose the Velvet Table design system)
├── types.ts     # domain models (UUID ids, ISO timestamps — sync-ready)
└── index.ts     # public surface of the module
```

## Cross-cutting

- Visibility is gated by `src/config/features.ts` (`isFeatureEnabled('bankroll' | 'study' | 'coach')`).
- Premium surfaces wrap in `<PremiumGate>` / read `useEntitlements()` (`src/context/EntitlementsContext.tsx`).
- State is exposed via a context provider per feature (mirror `src/context/LocalGamesContext.tsx`),
  registered in `App.tsx`.
- Money = integer cents (`src/utils/money.ts`); ids = `expo-crypto` `randomUUID()`; timestamps = ISO 8601.

## Modules

- `bankroll/` — Track pillar: bankroll / cash / tournament session tracker (Phase 1).
- `study/` — Study pillar: preflop GTO study (Phase 2).
- `coach/` — Improve pillar: AI hand-analysis coach (Phase 3, scaffolding first).
