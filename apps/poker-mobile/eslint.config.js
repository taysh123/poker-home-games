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
      // Deliberately-invalid fixture that `src/config/__tests__/eslintRules.test.ts` lints with
      // --no-ignore to prove the linter REPORTS a rules-of-hooks violation. Excluded here so it
      // does not fail the very gate it verifies.
      'src/config/__fixtures__/*',
    ],
  },
  {
    rules: {
      // ── The reason this config exists. ──
      // Honest note: eslint-config-expo ALREADY sets this to error, so this line is a no-op
      // today — it is documentation plus insurance against a preset change, not the thing
      // providing the guarantee. What actually holds the guarantee is
      // src/config/__tests__/eslintRules.test.ts, which lints a real violating fixture.
      'react-hooks/rules-of-hooks': 'error',

      // Stale closures are a bug class this repo HAS shipped, so this is a real ratchet target —
      // but each violation needs individual judgement: both bugs fixed in fix/stale-closure-deps
      // resisted the textbook repair, because adding the missing dependency changed a callback's
      // identity and re-fired the useFocusEffect that calls it. Warn now; escalate in its own
      // slice.
      //
      // ⚠️ THAT SLICE MUST ENUMERATE SUPPRESSIONS, NOT JUST WARNINGS. `--max-warnings` counts the
      // ~16 reported sites; there are also ~13 pre-existing
      // `// eslint-disable-next-line react-hooks/exhaustive-deps` comments that ESLint never
      // reports and the ceiling never counts (`grep -rn "eslint-disable.*exhaustive-deps" src/`).
      // They are author suppressions with rationale, not lint-gaming — but escalating to error
      // would show a green board with those sites never individually judged.
      //
      // What actually distinguishes dangerous from benign: a missing dep in a SYNCHRONOUS effect
      // body can never read stale (React invokes the latest closure). Stale reads come only from
      // a useCallback/useMemo handed to a consumer, or a callback created inside an effect that
      // outlives it (interval / subscription / timeout). Triage those first.
      'react-hooks/exhaustive-deps': 'warn',

      // OFF, deliberately. This rule wants `don&apos;t` instead of `don't` in JSX text. The
      // rendered output is identical, and this codebase is held to strict copy-honesty review —
      // entity-escaping every apostrophe in user-facing strings makes that copy materially harder
      // to read in a diff. Legibility of shipped copy beats a legacy ambiguity rule.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
