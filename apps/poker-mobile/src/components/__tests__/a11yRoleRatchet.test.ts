import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * Ratchet for touchables that carry no accessibility role.
 *
 * Why this exists rather than "we fixed the screens": a mutation run reverted EVERY screen edit in
 * the previous slice and all 1,104 tests stayed green. By this repo's own revert-test rule, an
 * unpinned fix is not a fix — it is a fix waiting to be undone. And in the same slice I shipped two
 * WRONG roles (`button` + `selected` on multi-select chips) precisely because nothing checked.
 *
 * A per-file COUNT ceiling, matching the raw-colour ratchet. Counts may only go DOWN. A second
 * test fails on slack, so a ceiling cannot drift above actual and quietly bank headroom.
 *
 * DISCLAIMED, so a green board is not read as more than it is:
 *  - This counts a touchable as covered if `accessibilityRole` appears within its opening tag. It
 *    cannot judge whether the role is CORRECT (`button` where `checkbox` belongs), nor whether the
 *    accessible NAME is truthful — "Add Dan" for a chip that only fills a field passed every
 *    automated check in this repo and was caught by a human-directed critic.
 *  - Components that supply a role internally (PrimaryButton, ListRow, Segmented, ProgressBar) are
 *    not counted as touchables here, so a screen using only those reads as clean — correctly.
 */
const SRC = resolve(__dirname, '..', '..');

/**
 * Raw touchables — the ones that must carry their own role.
 *
 * Scanned with a brace-aware walk rather than a regex. `<Tag[^>]*>` is wrong for JSX: the first
 * `>` it finds is usually the one inside `onPress={() => …}`, so the tag appears to end before its
 * attributes and every roled touchable reads as unroled. That produced wildly inflated counts on
 * the first run — a reminder that a ratchet's measurement is as load-bearing as its threshold.
 */
const TOUCHABLE_OPEN = /<(PressableScale|Pressable|TouchableOpacity|TouchableWithoutFeedback|TouchableHighlight)\b/g;

/** Text of one JSX opening tag, from `<Tag` to the `>` that closes it at brace depth 0. */
function openingTag(src: string, start: number): string {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

/** Files permitted to still contain unroled touchables, and how many. Only ever lower these. */
const CEILING: Record<string, number> = {
  'screens/HomeScreen.tsx': 14,                    // worst in the app — next up in the sweep
  'screens/GroupDetailScreen.tsx': 5,
  'screens/SessionsListScreen.tsx': 4,
  'features/solver/ui/SolverWorkspaceScreen.tsx': 4,
  'screens/InvitationsScreen.tsx': 3,
  'features/bankroll/ui/BankrollScreen.tsx': 2,
  'features/bankroll/ui/LogSessionScreen.tsx': 2,
  'screens/NotificationsScreen.tsx': 2,
  'components/DetailSheet.tsx': 2,
  'components/RecapCard.tsx': 2,
  'screens/LoginScreen.tsx': 1,                    // the "Stay signed in" checkbox — needs a ROLE, not a button
  'screens/StatsScreen.tsx': 1,                    // period tabs — adopt the existing Segmented
  'screens/JoinGroupScreen.tsx': 1,
  'screens/JoinSessionScreen.tsx': 1,
  'screens/TrackScreen.tsx': 1,
  'components/AchievementUnlock.tsx': 1,
  'components/DealInOverlay.tsx': 1,
  'components/ListRow.tsx': 1,               // the no-onPress branch renders a bare body
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

/** Count of raw touchables whose opening tag carries no accessibilityRole, per file. */
function unroled(): Map<string, number> {
  const found = new Map<string, number>();
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, '/');
    const src = readFileSync(file, 'utf8');
    let n = 0;
    TOUCHABLE_OPEN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOUCHABLE_OPEN.exec(src)) !== null) {
      if (!/accessibilityRole/.test(openingTag(src, m.index))) n++;
    }
    if (n > 0) found.set(rel, n);
  }
  return found;
}

describe('accessibility role ratchet', () => {
  it('no file exceeds its ceiling, and no new file ships unroled touchables', () => {
    const over: string[] = [];
    for (const [rel, n] of unroled()) {
      const max = CEILING[rel] ?? 0;
      if (n > max) over.push(`${rel}: ${n} > ${max}`);
    }
    expect(over).toEqual([]);
  });

  it('every ceiling is tight — no banked headroom', () => {
    const slack: string[] = [];
    const found = unroled();
    for (const [rel, max] of Object.entries(CEILING)) {
      const n = found.get(rel) ?? 0;
      if (n < max) slack.push(`${rel}: ceiling ${max}, actual ${n} — lower it`);
    }
    expect(slack).toEqual([]);
  });
});
