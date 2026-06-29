# Funnel Finish (Phase 1, Subsystem 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and QA the free home-game funnel to store-submittable quality — flip the `nav5` + `onboardingV2` flags ON in production, web-verify the full guest → cash → tournament → invite → recap/podium flow, close the still-open funnel a11y/polish gaps, and document (not run) the EAS native build path.

**Architecture:** This subsystem touches **no backend and no money math** (the settlement engine + `local/settlements.ts` + `local/tournament.ts` are pinned by shared C#↔TS fixtures and are out of bounds). It is three kinds of change: (1) two one-line edits to `src/config/features.ts` `PROD_FLAGS`, guarded by a new jest resolution test; (2) additive, token-only / accessibility-only edits to five funnel screens (no behavior change), each its own task with its own verification; (3) two docs (an EAS build guide + a ledger row). Every prod-visible visual change is recorded in `docs/release/prod-visible-changes.md` so the eventual merge is a deliberate release.

**Tech Stack:** Expo SDK 54 (React Native 0.81 / react-native-web 0.21), TypeScript 5.9, React Navigation 7, `jest` (~29.7) via `jest-expo` preset, Ionicons (`@expo/vector-icons`), Playwright 1.60 (web E2E harness already installed under `%LOCALAPPDATA%\ms-playwright`), `expo export -p web` for the deterministic web bundle, EAS CLI (build config in `apps/poker-mobile/eas.json`).

---

## File Structure

```
apps/poker-mobile/
├── jest.config.js                              # MODIFY — add src/config/__tests__ glob to testMatch
├── src/
│   ├── config/
│   │   ├── features.ts                          # MODIFY — flip nav5 + onboardingV2 ON in PROD_FLAGS
│   │   └── __tests__/
│   │       └── features.test.ts                 # CREATE — assert prod resolution of every flag
│   └── screens/
│       ├── GuestHomeScreen.tsx                  # MODIFY — SR labels on Sign In / hero cards / upsell
│       ├── LocalNewGameScreen.tsx              # MODIFY — token swaps + payout-rank labels + button copy
│       ├── LocalSessionScreen.tsx             # MODIFY — Ionicon ranks, SR labels, token swap, 44px targets
│       └── LocalSessionSummaryScreen.tsx      # MODIFY — Ionicon medals, header SR labels, guest sign-up card (G2)
docs/
├── release/
│   ├── eas-build.md                            # CREATE — EAS native build path (documented, not submitted)
│   └── prod-visible-changes.md                 # MODIFY — ledger rows for the flag flip + screen polish
└── superpowers/plans/
    └── 2026-06-25-funnel-finish.md            # this plan
```

**Web E2E harness (not committed — lives in the OS temp dir per the project memory `web-verification-harness`):**

```
%TEMP%\tpoker-verify\
├── serve.js                                    # CREATE — static file server over dist/ with index.html fallback
├── funnel.spec.js                              # CREATE — Playwright script: guest → cash → tournament → invite → recap
└── shots/                                       # screenshots emitted by the run
```

---

## Task 1: Flip `nav5` + `onboardingV2` ON in production (test-first)

**Files:**
- Modify: `apps/poker-mobile/jest.config.js`
- Create: `apps/poker-mobile/src/config/__tests__/features.test.ts`
- Modify: `apps/poker-mobile/src/config/features.ts:31-49` (the `PROD_FLAGS` object)

- [ ] **Step 1: Add the `src/config/__tests__` glob to jest's testMatch**

`jest.config.js` currently does not match `src/config/__tests__`, so a test placed there would silently not run. Add the glob (additive — does not change which existing tests match):

```js
/** Pure-logic tests only for now (settlement engine, local store). */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '**/src/local/__tests__/**/*.test.ts',
    '**/src/utils/__tests__/**/*.test.ts',
    '**/src/features/**/__tests__/**/*.test.ts',
    '**/src/api/__tests__/**/*.test.ts',
    '**/src/content/__tests__/**/*.test.ts',
    '**/src/analytics/__tests__/**/*.test.ts',
    '**/src/components/__tests__/**/*.test.ts',
    '**/src/hooks/__tests__/**/*.test.ts',
    '**/src/config/__tests__/**/*.test.ts',
  ],
};
```

- [ ] **Step 2: Write the failing test**

Create `apps/poker-mobile/src/config/__tests__/features.test.ts`. The module reads `__DEV__` and `process.env.EXPO_PUBLIC_APP_VARIANT` **at import time** to build `resolved`, so the test must pin the production environment (`__DEV__ = false`, no beta variant) and `jest.isolateModules` to force a fresh evaluation. This asserts the two target flags are ON **and** that no other flag silently flipped:

```ts
/**
 * Production feature-flag resolution guard. In a real production build __DEV__ is false and
 * EXPO_PUBLIC_APP_VARIANT is unset, so resolved === PROD_FLAGS. nav5 + onboardingV2 must be ON
 * (Subsystem 1 launch); every other flag must stay OFF so prod stays byte-identical otherwise.
 */
describe('feature flags — production resolution', () => {
  const ORIGINAL_DEV = (global as any).__DEV__;
  const ORIGINAL_VARIANT = process.env.EXPO_PUBLIC_APP_VARIANT;

  beforeEach(() => {
    (global as any).__DEV__ = false;
    delete process.env.EXPO_PUBLIC_APP_VARIANT;
  });

  afterEach(() => {
    (global as any).__DEV__ = ORIGINAL_DEV;
    if (ORIGINAL_VARIANT === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
    else process.env.EXPO_PUBLIC_APP_VARIANT = ORIGINAL_VARIANT;
    jest.resetModules();
  });

  function loadFlags() {
    let mod: typeof import('../features');
    jest.isolateModules(() => {
      mod = require('../features');
    });
    return mod!;
  }

  it('nav5 is ON in production', () => {
    const { isFeatureEnabled } = loadFlags();
    expect(isFeatureEnabled('nav5')).toBe(true);
  });

  it('onboardingV2 is ON in production', () => {
    const { isFeatureEnabled } = loadFlags();
    expect(isFeatureEnabled('onboardingV2')).toBe(true);
  });

  it('every other flag stays OFF in production (prod stays byte-identical)', () => {
    const { featureFlags } = loadFlags();
    const expectedOn = new Set(['nav5', 'onboardingV2']);
    for (const [flag, value] of Object.entries(featureFlags)) {
      expect(value).toBe(expectedOn.has(flag));
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/poker-mobile && npx jest src/config/__tests__/features.test.ts`
Expected: FAIL — `nav5 is ON in production` and `onboardingV2 is ON in production` fail with `expect(received).toBe(expected) // Expected: true, Received: false` (PROD_FLAGS still has both `false`). The "every other flag" test passes.

- [ ] **Step 4: Flip the two flags in `PROD_FLAGS`**

In `apps/poker-mobile/src/config/features.ts`, change the two lines inside the `PROD_FLAGS` object (lines 35 and 36) from `false` to `true`:

```ts
/** Production defaults — every new surface OFF so prod behaves exactly as today. */
const PROD_FLAGS: Record<FeatureFlag, boolean> = {
  bankroll: false,
  study: false,
  coach: false,
  paywall: false,
  nav5: true,
  onboardingV2: true,
  retention: false,
  reminders: false,
  currencyPrefs: false,
  polish: false,
  coachScreenshot: false,
  immersive: false,
  content: false,
  mastery: false,
  solver: false,
  publicSpots: false,
  v2Splash: false,
};
```

Also update the doc comment one line above so it stays honest:

```ts
/** Production defaults — nav5 + onboardingV2 ON (Subsystem 1 launch); every other surface OFF. */
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/poker-mobile && npx jest src/config/__tests__/features.test.ts`
Expected: PASS — `Tests: 3 passed, 3 total`.

- [ ] **Step 6: Run the full gates**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no output, exit code 0.

Run: `cd apps/poker-mobile && npx jest`
Expected: all suites pass (the existing suite count plus the 3 new tests; e.g. `Tests: ...passed`, `Test Suites: ...passed`).

- [ ] **Step 7: Commit**

```powershell
git add apps/poker-mobile/jest.config.js apps/poker-mobile/src/config/features.ts apps/poker-mobile/src/config/__tests__/features.test.ts
git commit -m @'
feat(funnel): flip nav5 + onboardingV2 ON in PROD_FLAGS

Subsystem 1 launch. Adds a jest resolution test asserting both flags are
ON and every other flag stays OFF in production (prod byte-identical
otherwise). Adds src/config/__tests__ to jest testMatch.
'@
```

---

## Task 2: Ledger the production-visible flag flip

**Files:**
- Modify: `docs/release/prod-visible-changes.md` (append a row to the table)

- [ ] **Step 1: Append a ledger row**

The ledger is a markdown table; the last row is the StatWidget/LiveGameBar audit row. Add one new row immediately after it (keep the same column order: Date | Component / screen | Change | Before → After | Commit | Reviewed):

```markdown
| 2026-06-25 | `config/features.ts` `PROD_FLAGS` | `nav5` + `onboardingV2` flipped ON (Subsystem 1 launch) | Prod tab bar: 4-tab (Home/Sessions/Groups/Stats) → **5-tab IA** (Home/Track/Study?/Coach?/Groups — Track replaces Sessions+Stats; Study/Coach remain hidden, their flags still OFF). First-run onboarding: legacy 3-slide `OnboardingScreen` → **pillar-led `OnboardingV2Screen`** with a starting-point router. Reversible by reverting the two flags. | (subsystem 1) | self + plan review |
```

- [ ] **Step 2: Verify the file still renders as a table (no broken pipes)**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no output, exit 0 (docs-only change cannot affect tsc; this is a cheap sanity gate that nothing else was touched).

- [ ] **Step 3: Commit**

```powershell
git add docs/release/prod-visible-changes.md
git commit -m @'
docs(release): ledger nav5 + onboardingV2 prod flag flip
'@
```

---

## Task 3: A11y polish — GuestHomeScreen screen-reader labels

**Context:** `GuestHomeScreen.tsx` has three icon/text touchables with **no** `accessibilityRole`/`accessibilityLabel`: the "Sign In" button (line 53), the two hero cards "Cash Game" / "Tournament" (lines 85 and 96), the active-game card (line 60), and the bottom upsell card (line 133). Screen readers announce these as unlabeled or read raw child text without a role. This task adds labels only — no visual or behavioral change.

**Files:**
- Modify: `apps/poker-mobile/src/screens/GuestHomeScreen.tsx`

- [ ] **Step 1: Label the Sign In button**

Find (line 53):

```tsx
        <TouchableOpacity style={styles.signInBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.8}>
```

Replace with:

```tsx
        <TouchableOpacity style={styles.signInBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Sign in">
```

- [ ] **Step 2: Label the active-game card**

Find (line 60):

```tsx
        <TouchableOpacity
          style={styles.activeCard}
          onPress={() => navigation.navigate('LocalSession', { gameId: activeGame.id })}
          activeOpacity={0.85}
        >
```

Replace with:

```tsx
        <TouchableOpacity
          style={styles.activeCard}
          onPress={() => navigation.navigate('LocalSession', { gameId: activeGame.id })}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Resume live game ${activeGame.name}`}
        >
```

- [ ] **Step 3: Label the two hero start-a-game cards**

Find the Cash Game card (line 85):

```tsx
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => navigation.navigate('LocalNewGame', { mode: 'cash' })}
              activeOpacity={0.85}
            >
```

Replace with:

```tsx
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => navigation.navigate('LocalNewGame', { mode: 'cash' })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Start a cash game. Buy-ins, cash-outs, settle up."
            >
```

Find the Tournament card (line 96):

```tsx
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => navigation.navigate('LocalNewGame', { mode: 'tournament' })}
              activeOpacity={0.85}
            >
```

Replace with:

```tsx
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => navigation.navigate('LocalNewGame', { mode: 'tournament' })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Start a tournament. Blind clock, prize pool, podium."
            >
```

- [ ] **Step 4: Label the bottom sign-up upsell card**

Find (line 133):

```tsx
      <TouchableOpacity style={styles.upsellCard} onPress={() => { markSignupIntent(); navigation.navigate('Login'); }} activeOpacity={0.85}>
```

Replace with:

```tsx
      <TouchableOpacity style={styles.upsellCard} onPress={() => { markSignupIntent(); navigation.navigate('Login'); }} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Make it official. Create a free account for groups, lifetime stats, leaderboards, and game history across devices.">
```

- [ ] **Step 5: Run the gates**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no output, exit 0.

Run: `cd apps/poker-mobile && npx jest`
Expected: all suites pass (no test logic changed; this is a regression gate).

- [ ] **Step 6: Manual reduced-motion + SR check**

Manual: open the web build (`npx expo export -p web` then serve `dist/`, or `npm run web`) with the OS "Reduce Motion" setting ON; confirm GuestHome renders steady (no animation regressions) and that tabbing through the header/hero/upsell with a screen reader (VoiceOver on macOS Safari, or Chrome's ChromeVox) announces each control with a role of "button" and the labels above.

- [ ] **Step 7: Commit**

```powershell
git add apps/poker-mobile/src/screens/GuestHomeScreen.tsx
git commit -m @'
a11y(funnel): label GuestHome touchables for screen readers

Adds accessibilityRole/accessibilityLabel to the Sign In button, active-game
card, both start-a-game hero cards, and the sign-up upsell. No visual change.
'@
```

---

## Task 4: A11y + token polish — LocalNewGameScreen

**Context:** `LocalNewGameScreen.tsx` has three funnel-relevant gaps: (1) emoji medals as icons in the payout editor (line 351 `🥇🥈🥉`) and a card-suit emoji in the primary CTA label (line 625 `Deal 'Em In 🃏`) — both violate the "no emoji as icons / SVG icons" rule; (2) raw rgba literals bypassing the gold tokens in `presetChipSelected` (line 718), `reviewChip` bg/border (lines 863-865), and `playerChip` bg/border (lines 822-823) — `goldFaint`/`goldSubtle`/`goldMuted` already exist; (3) the payout-rank cell needs a numeric label for screen readers once the emoji is gone. The settlement/tournament math is untouched.

**Files:**
- Modify: `apps/poker-mobile/src/screens/LocalNewGameScreen.tsx`

- [ ] **Step 1: Replace the emoji payout ranks with numeric "#N" text**

The payout editor renders one row per place. Replace the emoji-or-`#N` expression with a plain `#N` (the visual order already conveys 1st/2nd/3rd; a numeric rank is screen-reader friendly and on-brand). Find (lines 349-364):

```tsx
                  {payoutPcts.map((pct, i) => (
                    <View key={i} style={styles.payoutRow}>
                      <Text style={styles.payoutRank}>{i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : i + 1 === 3 ? '🥉' : `#${i + 1}`}</Text>
                      <View style={styles.payoutInputWrap}>
                        <TextInput
                          style={styles.payoutInput}
                          value={pct}
                          onChangeText={v => setPayoutPcts(prev => prev.map((x, j) => (j === i ? v.replace(/[^0-9]/g, '') : x)))}
                          placeholder="0"
                          placeholderTextColor={colors.textDim}
                          keyboardType="number-pad"
                        />
                      </View>
                      <Text style={styles.payoutPct}>%</Text>
                    </View>
                  ))}
```

Replace with:

```tsx
                  {payoutPcts.map((pct, i) => (
                    <View key={i} style={styles.payoutRow}>
                      <Text style={styles.payoutRank}>{`#${i + 1}`}</Text>
                      <View style={styles.payoutInputWrap}>
                        <TextInput
                          style={styles.payoutInput}
                          value={pct}
                          onChangeText={v => setPayoutPcts(prev => prev.map((x, j) => (j === i ? v.replace(/[^0-9]/g, '') : x)))}
                          placeholder="0"
                          placeholderTextColor={colors.textDim}
                          keyboardType="number-pad"
                          accessibilityLabel={`Payout percentage for place ${i + 1}`}
                        />
                      </View>
                      <Text style={styles.payoutPct}>%</Text>
                    </View>
                  ))}
```

- [ ] **Step 2: Remove the emoji from the primary CTA label**

Find (line 625):

```tsx
                label="Deal 'Em In 🃏"
```

Replace with:

```tsx
                label="Deal 'Em In"
```

- [ ] **Step 3: Swap the raw rgba literals for semantic tokens**

In the `StyleSheet.create` block, replace the three hardcoded gold rgba values with the existing tokens.

Find (line 718):

```tsx
  presetChipSelected: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
```

Replace with:

```tsx
  presetChipSelected: { borderColor: colors.gold, backgroundColor: colors.goldSubtle },
```

Find (lines 815-825, the `playerChip` style):

```tsx
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    backgroundColor: 'rgba(201,168,76,0.10)',
  },
```

Replace with:

```tsx
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldSubtle,
  },
```

Find (lines 856-866, the `reviewChip` style):

```tsx
  reviewChip: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },
```

Replace with:

```tsx
  reviewChip: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.goldSubtle,
    borderWidth: 1,
    borderColor: colors.goldMuted,
  },
```

- [ ] **Step 4: Run the gates**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no output, exit 0.

Run: `cd apps/poker-mobile && npx jest`
Expected: all suites pass.

- [ ] **Step 5: Verify no raw gold rgba remains in this file**

Run: `cd apps/poker-mobile && npx jest --listTests > $null; Select-String -Path src/screens/LocalNewGameScreen.tsx -Pattern '201,168,76'`
Expected: no matches printed (every gold rgba replaced by a token). If any line prints, replace it with the matching token (`rgba(201,168,76,0.08)`→`goldFaint`, `0.15`→`goldSubtle`, `0.40`→`goldMuted`).

- [ ] **Step 6: Commit**

```powershell
git add apps/poker-mobile/src/screens/LocalNewGameScreen.tsx
git commit -m @'
a11y(funnel): de-emoji LocalNewGame + use gold tokens

Payout ranks now numeric (#1..#N) with SR labels; CTA drops the card-suit
emoji; presetChip/playerChip/reviewChip use goldSubtle/goldMuted instead of
raw rgba. No layout change.
'@
```

---

## Task 5: A11y + token polish — LocalSessionScreen

**Context:** `LocalSessionScreen.tsx` (the live game) has these funnel gaps: (1) the leader uses a `👑` emoji appended to the name (lines 452-455); (2) the finish-early ranking modal uses emoji medals `🥇🥈🥉` (line 544); (3) the player rows (line 444), the dashboard `±level` controls (lines 374/386) and the section "+ Add Player / + Late Reg" action (line 421) have no `accessibilityRole`/`accessibilityLabel`; (4) the `countCardOk` style uses raw success rgba (line 984) instead of the `successFaint` token. The clock control buttons already meet 44px (`dashCtrlBtn` height 44 / minWidth 44). No game logic changes.

**Files:**
- Modify: `apps/poker-mobile/src/screens/LocalSessionScreen.tsx`

- [ ] **Step 1: Replace the leader crown emoji with an Ionicon**

Find (lines 451-456):

```tsx
                      <Text style={styles.playerName} numberOfLines={1}>
                        {player.name}
                        {isLeader ? '  👑' : ''}
                      </Text>
```

Replace with (render the name and, when leader, a trailing gold trophy Ionicon in a row):

```tsx
                      <View style={styles.playerNameRow}>
                        <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                        {isLeader && (
                          <Ionicons name="trophy" size={13} color={colors.goldLight} style={styles.leaderCrown} accessibilityLabel="Chip leader" />
                        )}
                      </View>
```

Then add the two new styles to the `StyleSheet.create` block, immediately after the `playerName` style (line 913):

```tsx
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leaderCrown: { marginTop: 1 },
```

- [ ] **Step 2: Replace the finish-early emoji medals with numeric ranks**

In the finish-early ranking modal, the medal expression mixes emoji and `#N`. Replace it with a plain `#N` (consistent with the payout editor and screen-reader friendly). Find (lines 542-548):

```tsx
              {(rankOrder ?? []).map((pid, i) => {
                const p = game.players.find(pl => pl.id === pid);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                return (
                  <View key={pid} style={styles.rankRow}>
                    <Text style={styles.rankMedal}>{medal}</Text>
```

Replace with:

```tsx
              {(rankOrder ?? []).map((pid, i) => {
                const p = game.players.find(pl => pl.id === pid);
                return (
                  <View key={pid} style={styles.rankRow}>
                    <Text style={styles.rankMedal}>{`#${i + 1}`}</Text>
```

- [ ] **Step 3: Label the section add-player / late-reg action**

Find (lines 420-424):

```tsx
          {(!isTournament || isLateRegOpen(game)) && (
            <TouchableOpacity onPress={() => openAmountModal({ kind: 'addPlayer' })} hitSlop={8}>
              <Text style={styles.sectionAction}>+ {isTournament ? 'Late Reg' : 'Add Player'}</Text>
            </TouchableOpacity>
          )}
```

Replace with:

```tsx
          {(!isTournament || isLateRegOpen(game)) && (
            <TouchableOpacity
              onPress={() => openAmountModal({ kind: 'addPlayer' })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isTournament ? 'Register a late entry' : 'Add a player'}
            >
              <Text style={styles.sectionAction}>+ {isTournament ? 'Late Reg' : 'Add Player'}</Text>
            </TouchableOpacity>
          )}
```

- [ ] **Step 4: Label the player row touchable**

Find (lines 444-449):

```tsx
                  <TouchableOpacity
                    key={player.id}
                    style={[styles.playerRow, isLeader && styles.playerRowLeader]}
                    onPress={() => setSheetPlayer(player)}
                    activeOpacity={0.75}
                  >
```

Replace with:

```tsx
                  <TouchableOpacity
                    key={player.id}
                    style={[styles.playerRow, isLeader && styles.playerRowLeader]}
                    onPress={() => setSheetPlayer(player)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${player.name}. Tap for actions.`}
                  >
```

- [ ] **Step 5: Label the dashboard previous-level / next-level controls**

Find the previous-level button (lines 374-381):

```tsx
                <TouchableOpacity
                  style={styles.dashCtrlBtn}
                  onPress={() => { lightTap(); gotoLevel(game.id, -1); }}
                  disabled={view.levelNumber <= 1}
                  hitSlop={8}
                >
                  <Ionicons name="play-skip-back" size={16} color={view.levelNumber <= 1 ? colors.textDim : colors.text} />
                </TouchableOpacity>
```

Replace with:

```tsx
                <TouchableOpacity
                  style={styles.dashCtrlBtn}
                  onPress={() => { lightTap(); gotoLevel(game.id, -1); }}
                  disabled={view.levelNumber <= 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Previous blind level"
                  accessibilityState={{ disabled: view.levelNumber <= 1 }}
                >
                  <Ionicons name="play-skip-back" size={16} color={view.levelNumber <= 1 ? colors.textDim : colors.text} />
                </TouchableOpacity>
```

Find the next-level button (lines 386-393):

```tsx
                <TouchableOpacity
                  style={styles.dashCtrlBtn}
                  onPress={() => { lightTap(); gotoLevel(game.id, 1); }}
                  disabled={atLastLevel}
                  hitSlop={8}
                >
                  <Ionicons name="play-skip-forward" size={16} color={atLastLevel ? colors.textDim : colors.text} />
                </TouchableOpacity>
```

Replace with:

```tsx
                <TouchableOpacity
                  style={styles.dashCtrlBtn}
                  onPress={() => { lightTap(); gotoLevel(game.id, 1); }}
                  disabled={atLastLevel}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Next blind level"
                  accessibilityState={{ disabled: atLastLevel }}
                >
                  <Ionicons name="play-skip-forward" size={16} color={atLastLevel ? colors.textDim : colors.text} />
                </TouchableOpacity>
```

Also label the pause/resume control. Find (line 382):

```tsx
                <TouchableOpacity style={[styles.dashCtrlBtn, styles.dashCtrlPrimary]} onPress={toggleClockPause} hitSlop={8}>
```

Replace with:

```tsx
                <TouchableOpacity style={[styles.dashCtrlBtn, styles.dashCtrlPrimary]} onPress={toggleClockPause} hitSlop={8} accessibilityRole="button" accessibilityLabel={view.paused ? 'Resume the clock' : 'Pause the clock'}>
```

- [ ] **Step 6: Swap the raw success rgba in `countCardOk` for the token**

Find (line 984):

```tsx
  countCardOk: { backgroundColor: 'rgba(39,174,96,0.08)', borderColor: 'rgba(39,174,96,0.35)' },
```

Replace with (use the existing `successFaint` token for the fill; keep a slightly stronger border via the same token — the visual delta is negligible and both are token-driven):

```tsx
  countCardOk: { backgroundColor: colors.successFaint, borderColor: colors.success },
```

- [ ] **Step 7: Run the gates**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no output, exit 0.

Run: `cd apps/poker-mobile && npx jest`
Expected: all suites pass.

- [ ] **Step 8: Verify no emoji icon / raw rgba remains in the touched regions**

Run: `Select-String -Path apps/poker-mobile/src/screens/LocalSessionScreen.tsx -Pattern '👑|🥇|🥈|🥉|39,174,96'`
Expected: no matches printed.

- [ ] **Step 9: Commit**

```powershell
git add apps/poker-mobile/src/screens/LocalSessionScreen.tsx
git commit -m @'
a11y(funnel): de-emoji + label LocalSession live screen

Leader crown emoji -> trophy Ionicon; finish-early medals -> #N; SR labels on
player rows, section add action, and the dashboard level/pause controls;
countCardOk uses the successFaint token. No game-logic change.
'@
```

---

## Task 6: A11y + token polish — LocalSessionSummaryScreen (medals + header labels)

**Context:** `LocalSessionSummaryScreen.tsx` (recap / podium) uses emoji medals/trophy throughout the on-screen UI: the champion row `🏆` (line 222), the podium ranks `🥇🥈🥉` (line 234), and the cash-winner rank `🏆` (line 271). It also has three icon-only header buttons (close line 167, share line 173, trash line 177) with **no** SR labels. **Important scope note:** the `ShareCard`/`shareData` payload (lines 122-140) renders into an off-screen image for sharing, NOT the live DOM — leave its emoji medals (`🥇🥈🥉` at line 133) as-is; they are intentional flourish in the exported PNG and out of the "no emoji as icons" UI rule. This task changes on-screen UI only.

**Files:**
- Modify: `apps/poker-mobile/src/screens/LocalSessionSummaryScreen.tsx`

- [ ] **Step 1: Label the three header buttons**

Find the close button (line 167):

```tsx
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.popToTop()} hitSlop={12} activeOpacity={0.75}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
```

Replace with:

```tsx
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.popToTop()} hitSlop={12} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Close summary">
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
```

Find the share button (line 173):

```tsx
            <TouchableOpacity style={styles.backBtn} onPress={handleShareImage} hitSlop={12} activeOpacity={0.75}>
              <Ionicons name="share-outline" size={18} color={colors.gold} />
            </TouchableOpacity>
```

Replace with:

```tsx
            <TouchableOpacity style={styles.backBtn} onPress={handleShareImage} hitSlop={12} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Share result card">
              <Ionicons name="share-outline" size={18} color={colors.gold} />
            </TouchableOpacity>
```

Find the trash button (line 177):

```tsx
          <TouchableOpacity style={styles.backBtn} onPress={handleDelete} hitSlop={12} activeOpacity={0.75}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
```

Replace with:

```tsx
          <TouchableOpacity style={styles.backBtn} onPress={handleDelete} hitSlop={12} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Delete this game">
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
```

- [ ] **Step 2: Replace the champion-row trophy emoji with an Ionicon**

Find (lines 220-226):

```tsx
          {championName && (
            <View style={styles.championRow}>
              <Text style={styles.championTrophy}>🏆</Text>
              <Text style={styles.championName} numberOfLines={1}>{championName}</Text>
              {championSub && <Text style={styles.championSub}>{championSub}</Text>}
            </View>
          )}
```

Replace with:

```tsx
          {championName && (
            <View style={styles.championRow}>
              <Ionicons name="trophy" size={16} color={colors.goldLight} accessibilityLabel="Champion" />
              <Text style={styles.championName} numberOfLines={1}>{championName}</Text>
              {championSub && <Text style={styles.championSub}>{championSub}</Text>}
            </View>
          )}
```

Then delete the now-unused `championTrophy` style (line 382):

```tsx
  championTrophy: { fontSize: 16 },
```

(Remove that whole line.)

- [ ] **Step 3: Replace the podium rank medals with numeric ranks**

The podium maps each standing to a medal-or-`#N`. Replace with a plain `#N`. Find (lines 233-240):

```tsx
            {podium.map(({ player, position, payoutCents, netCents }) => {
              const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null;
              const isChampion = position === 1;
              return (
                <View key={player.id} style={[styles.resultRow, isChampion && styles.resultRowWinner]}>
                  <Text style={[styles.resultRank, isChampion && styles.resultRankWinner]}>
                    {medal ?? `#${position}`}
                  </Text>
```

Replace with:

```tsx
            {podium.map(({ player, position, payoutCents, netCents }) => {
              const isChampion = position === 1;
              return (
                <View key={player.id} style={[styles.resultRow, isChampion && styles.resultRowWinner]}>
                  <Text style={[styles.resultRank, isChampion && styles.resultRankWinner]}>
                    {`#${position}`}
                  </Text>
```

- [ ] **Step 4: Replace the cash-winner rank trophy with a numeric rank**

Find (lines 266-272):

```tsx
        {results.map(({ player, netCents }, index) => {
          const isWinner = index === 0 && netCents > 0;
          return (
            <View key={player.id} style={[styles.resultRow, isWinner && styles.resultRowWinner]}>
              <Text style={[styles.resultRank, isWinner && styles.resultRankWinner]}>
                {isWinner ? '🏆' : `#${index + 1}`}
              </Text>
```

Replace with:

```tsx
        {results.map(({ player, netCents }, index) => {
          const isWinner = index === 0 && netCents > 0;
          return (
            <View key={player.id} style={[styles.resultRow, isWinner && styles.resultRowWinner]}>
              <Text style={[styles.resultRank, isWinner && styles.resultRankWinner]}>
                {`#${index + 1}`}
              </Text>
```

- [ ] **Step 5: Run the gates**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no output, exit 0 (also catches the removed `championTrophy` style if it were still referenced).

Run: `cd apps/poker-mobile && npx jest`
Expected: all suites pass.

- [ ] **Step 6: Verify only the intended (off-screen ShareCard) emoji remains**

Run: `Select-String -Path apps/poker-mobile/src/screens/LocalSessionSummaryScreen.tsx -Pattern '🏆|🥇|🥈|🥉'`
Expected: exactly the three medal references inside the `shareData.rows` block (line ~133) print; no other matches. If any on-screen reference remains, replace it per Steps 2-4.

- [ ] **Step 7: Commit**

```powershell
git add apps/poker-mobile/src/screens/LocalSessionSummaryScreen.tsx
git commit -m @'
a11y(funnel): de-emoji recap UI + label header buttons

Champion trophy -> Ionicon; podium/cash ranks -> #N on screen; SR labels on
close/share/delete header buttons. ShareCard PNG medals left intentionally.
'@
```

---

## Task 7: Activation handoff (G2) — guest sign-up card on the summary

**Context:** Growth item G2 from the audit: the highest-intent moment in the funnel is right after a guest finishes their first local game (value delivered, confetti firing) on `LocalSessionSummaryScreen`, and it is currently an **unused** handoff. Add an honest "save across devices" sign-up card — but only for guests (no logged-in user) — between the cash-settlements section and the cross-pillar CTAs. It reuses the existing `markSignupIntent()` analytics seam (already imported in GuestHome) and navigates to `Login`. This is additive UI; no money math.

**Files:**
- Modify: `apps/poker-mobile/src/screens/LocalSessionSummaryScreen.tsx`

- [ ] **Step 1: Import the auth state and the signup-intent marker**

At the top of the file, add two imports after the existing `confirmDialog` import (line 32):

```tsx
import { useAuth } from '../context/AuthContext';
import { markSignupIntent } from '../utils/analytics';
```

- [ ] **Step 2: Read the user inside the component**

Find the start of the component body (line 43-45):

```tsx
  const { gameId } = route.params;
  const insets = useSafeAreaInsets();
  const { games, deleteGame } = useLocalGames();
```

Replace with:

```tsx
  const { gameId } = route.params;
  const insets = useSafeAreaInsets();
  const { games, deleteGame } = useLocalGames();
  const { user } = useAuth();
```

- [ ] **Step 3: Render the guest-only sign-up card before the cross-pillar CTAs**

Find the spacer + cross-pillar block (lines 304-305):

```tsx
        <View style={{ height: 32 }} />
        {isFeatureEnabled('retention') && (isFeatureEnabled('bankroll') || isFeatureEnabled('coach')) && (
```

Insert the card between the spacer and the cross-pillar block:

```tsx
        <View style={{ height: 32 }} />
        {user === null && (
          <TouchableOpacity
            style={styles.saveCard}
            onPress={() => { markSignupIntent(); navigation.navigate('Login'); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save this game to a free account to keep your history across devices"
          >
            <View style={styles.saveIconWrap}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.gold} />
            </View>
            <View style={styles.saveText}>
              <Text style={styles.saveTitle}>Save this game</Text>
              <Text style={styles.saveSub}>Create a free account to keep your stats, groups, and history across devices.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {isFeatureEnabled('retention') && (isFeatureEnabled('bankroll') || isFeatureEnabled('coach')) && (
```

- [ ] **Step 4: Add the card styles**

In the `StyleSheet.create` block, add these styles after the `transferAmount` style (the last entry, line 450):

```tsx
  saveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: 12,
    marginBottom: 16,
  },
  saveIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { flex: 1, gap: 3 },
  saveTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  saveSub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
```

- [ ] **Step 5: Run the gates**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no output, exit 0.

Run: `cd apps/poker-mobile && npx jest`
Expected: all suites pass.

- [ ] **Step 6: Ledger this prod-visible addition**

Append one row to the table in `docs/release/prod-visible-changes.md` (after the row added in Task 2):

```markdown
| 2026-06-25 | `LocalSessionSummaryScreen` (guest recap) | Added a guest-only "Save this game" sign-up card (G2 activation handoff) | Guests finishing a local game now see an honest account-creation card above the Done button; logged-in users see no change (`user === null` gate). Taps mark signup intent + open Login | (subsystem 1) | self + plan review |
```

- [ ] **Step 7: Manual web check**

Manual: `cd apps/poker-mobile && npx expo export -p web`, serve `dist/`, run a guest cash game to completion; confirm the "Save this game" card appears on the summary for a logged-out guest and that tapping it opens the Login modal. (Covered automatically by Task 8's E2E script, but eyeball it here.)

- [ ] **Step 8: Commit**

```powershell
git add apps/poker-mobile/src/screens/LocalSessionSummaryScreen.tsx docs/release/prod-visible-changes.md
git commit -m @'
feat(funnel): guest sign-up card on the game summary (G2)

Adds an honest "save across devices" account card at the highest-intent moment
(first finished local game), guest-only via the user===null gate. Ledgered.
'@
```

---

## Task 8: Web E2E verification — guest → cash → tournament → invite → recap (verification-only)

**Context:** This is a **verification-only** task — it produces a Playwright script + commands + expected output, not app code. It follows the project memory `web-verification-harness`: `npx expo export -p web` produces a deterministic static bundle in `dist/`; a tiny node http server serves it with an `index.html` fallback (SPA deep links); Playwright drives the guest funnel and screenshots each beat. The harness scripts live in `%TEMP%\tpoker-verify\` (NOT committed). RN-web selector pitfalls from the memory are baked in: `getByText`/`getByPlaceholder` are substring + case-insensitive (pass `{ exact: true }`); bottom-tab buttons need `getByRole('tab', { name })`; hidden mounted screens require `.filter({ visible: true })`; `Alert.alert` is a no-op on web (the app uses `utils/confirm.ts` → `window.confirm`, so Playwright must auto-accept dialogs).

**Files:**
- Create: `%TEMP%\tpoker-verify\serve.js`
- Create: `%TEMP%\tpoker-verify\funnel.spec.js`

- [ ] **Step 1: Export the web bundle**

Run: `cd apps/poker-mobile && npx expo export -p web`
Expected: completes with `Exported: dist` (a `dist/` directory containing `index.html` + hashed JS/asset bundles). This is the same bundle Vercel serves.

- [ ] **Step 2: Create the static file server**

Create `%TEMP%\tpoker-verify\serve.js` (resolve `%TEMP%` first: `echo $env:TEMP`). It serves `apps/poker-mobile/dist` with a SPA fallback to `index.html` so client-routed deep links resolve:

```js
// Minimal static server for the exported Expo web bundle, with SPA index.html fallback.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node serve.js <dist-dir> [port]'); process.exit(1); }
const PORT = Number(process.argv[3] || 4173);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.map': 'application/json',
};

function send(res, file) {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, urlPath);
  if (urlPath === '/' || !path.extname(file)) {
    // route or directory request -> SPA shell
    file = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(ROOT, 'index.html');
  }
  fs.access(file, fs.constants.R_OK, (err) => {
    if (err) { send(res, path.join(ROOT, 'index.html')); return; }
    send(res, file);
  });
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
```

- [ ] **Step 3: Create the Playwright funnel script**

Create `%TEMP%\tpoker-verify\funnel.spec.js`. It is a standalone node script (not a `@playwright/test` runner file) that launches chromium, drives the funnel, screenshots each beat to `shots/`, and exits non-zero on any failed assertion:

```js
// Guest funnel E2E for the exported web bundle. Run AFTER `node serve.js <dist> 4173`.
// Drives: onboarding(V2) -> cash game (2 players, buy-ins, end & settle) -> recap/sign-up card
//         -> tournament (entry fee, 2 players, bust to crown) -> podium -> invite-deeplink resolves.
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:4173';
const SHOTS = path.join(__dirname, 'shots');
let failures = 0;
function check(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg); } else { console.log('ok:', msg); } }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
  // utils/confirm.ts uses window.confirm on web — auto-accept so destructive/confirm flows proceed.
  page.on('dialog', d => d.accept());

  // 1) First run -> OnboardingV2 (pillar-led). Skip into the guest app.
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(SHOTS, '01-onboarding.png') });
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.count()) await skip.first().click();
  // land on guest Home
  await page.getByText('Start a game', { exact: false }).first().waitFor({ timeout: 15000 });
  check(await page.getByText('T POKER', { exact: true }).count() > 0, 'guest Home shows brand');
  await page.screenshot({ path: path.join(SHOTS, '02-guest-home.png') });

  // 2) CASH GAME — hero card -> wizard
  await page.getByRole('button', { name: /Start a cash game/i }).first().click();
  await page.getByText('Set the Table', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText('Next', { exact: true }).first().click();           // step 1 -> 2
  // add two players via the GuestNameInput
  const nameInput = page.getByPlaceholder('Player name...', { exact: true });
  await nameInput.fill('Alice'); await page.getByText('Add', { exact: true }).first().click();
  await nameInput.fill('Bob');   await page.getByText('Add', { exact: true }).first().click();
  await page.getByText('Review', { exact: true }).first().click();         // step 2 -> 3
  await page.getByText("Deal 'Em In", { exact: true }).first().click();    // start (de-emoji'd label)
  // live screen
  await page.getByText('TOTAL POT', { exact: true }).waitFor({ timeout: 15000 });
  check(await page.getByText('AT THE TABLE', { exact: true }).count() > 0, 'cash live screen shows table');
  await page.screenshot({ path: path.join(SHOTS, '03-cash-live.png') });

  // buy-ins: tap Alice -> Buy In... -> amount -> Confirm
  await page.getByText('Alice', { exact: true }).first().click();
  await page.getByText('Buy In…', { exact: true }).first().click();
  await page.getByPlaceholder('0', { exact: true }).fill('100');
  await page.getByText('Confirm', { exact: true }).first().click();
  await page.getByText('Bob', { exact: true }).first().click();
  await page.getByText('Buy In…', { exact: true }).first().click();
  await page.getByPlaceholder('0', { exact: true }).fill('100');
  await page.getByText('Confirm', { exact: true }).first().click();

  // end & settle: End Game -> The Final Count -> count Alice 200, Bob 0 -> End Game & Settle
  await page.getByText('End Game', { exact: true }).first().click();
  await page.getByText('The Final Count', { exact: true }).waitFor({ timeout: 10000 });
  const stackInputs = page.getByPlaceholder('0', { exact: true });
  await stackInputs.nth(0).fill('200');   // Alice took both stacks
  await stackInputs.nth(1).fill('0');     // Bob busted
  await page.getByText('End Game & Settle', { exact: true }).first().click();

  // recap/summary
  await page.getByText('GAME OVER', { exact: true }).waitFor({ timeout: 15000 });
  check(await page.getByText('RESULTS', { exact: true }).count() > 0, 'recap shows results');
  check(await page.getByText('CASH SETTLEMENTS', { exact: true }).count() > 0, 'recap shows settlements');
  check(await page.getByRole('button', { name: /Save this game/i }).count() > 0, 'guest sign-up card (G2) present');
  await page.screenshot({ path: path.join(SHOTS, '04-cash-recap.png') });
  await page.getByText('Done', { exact: true }).first().click();

  // 3) TOURNAMENT — hero card -> wizard (entry fee), bust to crown
  await page.getByRole('button', { name: /Start a tournament/i }).first().click();
  await page.getByText('Set the Table', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByPlaceholder('50', { exact: true }).first().fill('50');   // entry fee
  await page.getByText('Next', { exact: true }).first().click();
  await nameInput.fill('Cara'); await page.getByText('Add', { exact: true }).first().click();
  await nameInput.fill('Dan');  await page.getByText('Add', { exact: true }).first().click();
  await page.getByText('Review', { exact: true }).first().click();
  await page.getByText("Deal 'Em In", { exact: true }).first().click();
  await page.getByText('PRIZE POOL', { exact: true }).waitFor({ timeout: 15000 });
  check(await page.getByText('LEVEL 1', { exact: false }).count() > 0, 'tournament dashboard shows clock');
  await page.screenshot({ path: path.join(SHOTS, '05-tournament-live.png') });

  // bust Dan -> crowns Cara (final bust triggers a confirm -> auto-accepted)
  await page.getByText('Dan', { exact: true }).first().click();
  await page.getByText('Bust Out', { exact: true }).first().click();
  await page.getByText('TOURNAMENT COMPLETE', { exact: true }).waitFor({ timeout: 15000 });
  check(await page.getByText('FINAL STANDINGS', { exact: true }).count() > 0, 'podium shows standings');
  await page.screenshot({ path: path.join(SHOTS, '06-podium.png') });
  await page.getByText('Done', { exact: true }).first().click();

  // 4) INVITE DEEP LINK — the SPA fallback must resolve /join/group/<token> to the app, not 404.
  const resp = await page.goto(`${BASE}/join/group/TEST-TOKEN-123`, { waitUntil: 'networkidle' });
  check(resp && resp.status() === 200, 'invite deep link returns 200 (SPA fallback)');
  // guest sees the "sign in to join" handoff rather than a blank/404
  check(await page.locator('body').innerText().then(t => t.length > 0), 'invite route renders the app shell');
  await page.screenshot({ path: path.join(SHOTS, '07-invite-deeplink.png') });

  await browser.close();
  console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} E2E CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
```

- [ ] **Step 4: Ensure the `playwright` package resolves from the temp dir**

The script does `require('playwright')`, so the npm package must be resolvable from `%TEMP%\tpoker-verify\`. The chromium browser binary is already cached under `%LOCALAPPDATA%\ms-playwright` (per project memory `web-verification-harness`), but install the package in the temp dir if it is missing:

```powershell
$verify = Join-Path $env:TEMP 'tpoker-verify'
if (-not (Test-Path (Join-Path $verify 'node_modules\playwright'))) {
  Push-Location $verify
  npm init -y | Out-Null
  npm install playwright@1.60.0
  Pop-Location
}
```

Expected: `playwright@1.60.0` present under `%TEMP%\tpoker-verify\node_modules` (skipped silently if already installed). No browser download needed — the cached chromium is reused.

- [ ] **Step 5: Serve the bundle (background) and run the script**

Run (PowerShell, from `apps/poker-mobile`): start the server in the background, then drive it. Resolve the temp dir first.

```powershell
$verify = Join-Path $env:TEMP 'tpoker-verify'
$dist = (Resolve-Path 'dist').Path
$server = Start-Process node -ArgumentList "$verify\serve.js","$dist","4173" -PassThru -WindowStyle Hidden
try {
  node "$verify\funnel.spec.js"
} finally {
  Stop-Process -Id $server.Id -Force
}
```

Expected terminal output: a sequence of `ok: ...` lines for each `check(...)` and a final `ALL E2E CHECKS PASSED`; the process exits 0. Screenshots `01-onboarding.png` … `07-invite-deeplink.png` are written to `%TEMP%\tpoker-verify\shots\`. If any `FAIL:` line appears, the run exits non-zero — open the corresponding screenshot, fix the funnel screen (or the selector if it is a known RN-web substring pitfall), re-export, and re-run.

- [ ] **Step 6: Record the verification result in the QA status doc**

Append a dated bullet to `docs/release/v2-qa-status.md` (it already tracks QA passes) noting the funnel E2E result:

```markdown
- 2026-06-25 — **Funnel E2E (web)**: `expo export -p web` + Playwright (`%TEMP%\tpoker-verify\funnel.spec.js`) green — guest onboarding(V2) → cash game (buy-ins → Final Count → settle) → recap + G2 sign-up card → tournament (entry fee → bust → podium) → invite deep-link SPA fallback (200). Screenshots in `%TEMP%\tpoker-verify\shots\`.
```

- [ ] **Step 7: Commit (docs only — the harness scripts are not committed)**

```powershell
git add docs/release/v2-qa-status.md
git commit -m @'
docs(qa): record funnel web E2E pass (guest -> cash -> tournament -> invite -> recap)
'@
```

---

## Task 9: Document the EAS native build path (documented, NOT submitted)

**Context:** The spec (§5, §12) requires the EAS native build path to be **documented**, not run/submitted. `apps/poker-mobile/eas.json` already defines `development` / `preview` / `beta` / `production` build profiles and a `submit.production` config (iOS `ascAppId` 6781109023 / `appleTeamId` J2MGQU5C7U; Android internal track via `play-service-account.json`). The doc must fit the existing `docs/release/*` conventions and enumerate the required env per profile: `EXPO_PUBLIC_API_URL`, the Google client IDs, and `EXPO_PUBLIC_APP_VARIANT` (which the beta profile sets to `beta` to activate `BETA_FLAGS`).

**Files:**
- Create: `docs/release/eas-build.md`

- [ ] **Step 1: Write the EAS build guide**

Create `docs/release/eas-build.md` with this content (exact — values pulled from the current `eas.json` and `features.ts`):

```markdown
# EAS native build path (documented — not yet submitted)

> Status: **reference only.** This documents how to produce iOS/Android builds with EAS for the
> Subsystem 1 launch. No store build is submitted as part of this work (Phase 1 ships web-verified;
> native store submission is a separate, human-gated step — see `docs/release/v2-merge-readiness.md`).
> Optional store accounts (Apple Developer $99/yr, Google Play $25 one-time) are only needed if/when
> store builds are actually pursued.

## Prerequisites

- EAS CLI `>= 16.0.0` (`eas.json` pins `cli.version`). Install: `npm i -g eas-cli`. Authenticate: `eas login`.
- Run all `eas build` commands from `apps/poker-mobile/` (the Expo project root).
- `appVersionSource` is `remote` — EAS owns the build number; `autoIncrement` is on for `beta` and
  `production`, so each build bumps automatically.

## Build profiles (from `eas.json`)

| Profile | Distribution | Channel | Variant / flags | Use |
|---------|--------------|---------|-----------------|-----|
| `development` | internal (dev client) | — | dev (`__DEV__` overrides) | Local debugging on a device with the dev client. |
| `preview` | internal | — | production flags (no `EXPO_PUBLIC_APP_VARIANT`) | Internal sanity build that behaves like prod. |
| `beta` | internal (extends `preview`) | `beta` | `EXPO_PUBLIC_APP_VARIANT=beta` ⇒ `BETA_FLAGS` (full V2 preview, paywall OFF) | Hand to testers to exercise the whole V2 surface in a real build. |
| `production` | store | (default) | production flags only | The store build. nav5 + onboardingV2 ON; all other flags OFF. |

## Required environment per profile

EAS reads `build.<profile>.env` from `eas.json` at build time. The values currently committed:

| Var | preview / beta / production | Notes |
|-----|------------------------------|-------|
| `EXPO_PUBLIC_API_URL` | `https://poker-home-games-production.up.railway.app` | Backend (Railway). |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6.apps.googleusercontent.com` | Google OAuth (web client id; the app falls back to public client IDs for native OAuth on SDK 54). |
| `EXPO_PUBLIC_APP_VARIANT` | `beta` (beta profile only) | Activates `BETA_FLAGS` in `src/config/features.ts`. Unset on `preview`/`production` ⇒ `PROD_FLAGS`. |

> Optional native-OAuth overrides (only if you stop using the public fallback client IDs):
> `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`. Not required for the
> current build profiles.

## Build commands

```powershell
# from apps/poker-mobile
eas build --profile production --platform ios
eas build --profile production --platform android
# tester build that previews the full V2 surface (paywall OFF):
eas build --profile beta --platform android
```

## Submission (NOT performed here)

`submit.production` in `eas.json` is pre-wired:
- iOS: `appleTeamId = J2MGQU5C7U`, `ascAppId = 6781109023`.
- Android: `serviceAccountKeyPath = ./play-service-account.json` (gitignored — must be present locally), `track = internal`.

When store submission is approved, run (documented for completeness — do not run as part of Subsystem 1):

```powershell
eas submit --profile production --platform ios --latest
eas submit --profile production --platform android --latest
```

## Pre-submission gates

Before any store build, all repo gates must be green (see `docs/release/v2-merge-readiness.md`):
`npx tsc --noEmit` · `npx jest` · `npx expo export -p web` (this subsystem has no backend changes,
so `dotnet build` / `dotnet test` are unaffected). Confirm `PROD_FLAGS` still has only `nav5` +
`onboardingV2` ON (guarded by `src/config/__tests__/features.test.ts`).
```

- [ ] **Step 2: Sanity-check the doc cross-references resolve**

Run: `Test-Path docs/release/v2-merge-readiness.md`
Expected: `True` (the doc this guide cross-references exists — it was in the `docs/release/*` glob).

- [ ] **Step 3: Commit**

```powershell
git add docs/release/eas-build.md
git commit -m @'
docs(release): document the EAS native build path (not submitted)

Profiles, required env (EXPO_PUBLIC_API_URL, Google client IDs,
EXPO_PUBLIC_APP_VARIANT), build/submit commands, and pre-submission gates.
'@
```

---

## Final gate (run after all tasks)

- [ ] **Run the full repo gates for this subsystem**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no output, exit 0.

Run: `cd apps/poker-mobile && npx jest`
Expected: all suites pass (existing suites + the 3 new `features.test.ts` tests).

Run: `cd apps/poker-mobile && npx expo export -p web`
Expected: `Exported: dist`, exit 0.

(No backend changed in this subsystem, so `dotnet build` / `dotnet test` are not required here — they remain green from the unchanged backend.)

- [ ] **Confirm the funnel E2E (Task 8) is green** against the latest `dist/` from the export above (re-run `funnel.spec.js` if any screen task landed after the last E2E run).
