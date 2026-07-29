// ESLint flat config — https://docs.expo.dev/guides/using-eslint/
//
// WHY THIS EXISTS (2026-07-29): `apps/poker-mobile` had NO linter (`apps/landing` did, and is
// clean, via next/core-web-vitals). A genuine `react-hooks/rules-of-hooks`
// violation — hooks appended below a conditional return, which crashes at runtime with "Rendered
// fewer hooks than expected" — passed `tsc --noEmit`, 1,051 jest tests AND a full web export in a
// single session. That is a bug class the toolchain literally could not see. This config's first
// job is to see it.
//
// The rules we depend on are re-declared EXPLICITLY below rather than inherited silently, and
// pinned by `src/config/__tests__/eslintRules.test.ts`. Inheriting a guarantee is how you end up
// claiming protection you don't actually have.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      // Playwright screenshot harness — run ad-hoc, not part of the app bundle, and it imports
      // `playwright`, which is deliberately not a dependency of the app.
      'store-assets/*',
    ],
  },
  {
    rules: {
      // ── The reason this config exists. Explicit, never inherited. ──
      'react-hooks/rules-of-hooks': 'error',

      // Stale closures are a bug class this repo HAS shipped, so this is a real ratchet target —
      // but there are existing violations and each needs individual judgement (a careless
      // dependency addition introduces bugs rather than fixing them). Warn now; escalate to error
      // in its own slice.
      'react-hooks/exhaustive-deps': 'warn',

      // OFF, deliberately. This rule wants `don&apos;t` instead of `don't` in JSX text. The
      // rendered output is identical, and this codebase is held to strict copy-honesty review —
      // entity-escaping every apostrophe in user-facing strings makes that copy materially harder
      // to read in a diff. Legibility of shipped copy beats a legacy ambiguity rule.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
