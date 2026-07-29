import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

import * as ts from 'typescript';

/**
 * Ratchet for touchables that carry no accessibility role.
 *
 * Why this exists rather than "we fixed the screens": a mutation run reverted EVERY screen edit in
 * an earlier slice and all 1,104 tests stayed green. By this repo's own revert-test rule, an
 * unpinned fix is not a fix — it is a fix waiting to be undone. And in the same slice I shipped two
 * WRONG roles (`button` + `selected` on multi-select chips) precisely because nothing checked.
 *
 * A per-file COUNT ceiling. `no file exceeds its ceiling` stops debt growing; `every ceiling is
 * tight` stops a ceiling sitting above actual and quietly banking headroom. Note what that pair
 * does and does not give you: it is not a mechanism forcing counts DOWN. Raising a ceiling in the
 * same diff that adds an unroled touchable is green. What it guarantees is that the raise must be
 * an explicit, reviewable edit to the number below — the ratchet makes new debt visible, review
 * refuses it.
 *
 * MEASURED WITH THE TYPESCRIPT AST, not a text scan — see `countUnroled`. That is the third
 * measurement this ratchet has had, and the reason it is now parser-based rather than patched again:
 *  1. `<Tag[^>]*>` — the first `>` it found was usually the one inside `onPress={() => …}`, so the
 *     tag appeared to end before its attributes and every roled touchable read as UNROLED.
 *  2. A brace-aware scan fixed that but was still raw text, so it counted JSX written inside
 *     COMMENTS. `components/ListRow.tsx` carried a ceiling of 1 that was satisfied entirely by the
 *     string `<PressableScale><Card style={row}>…` in its doc header — no such touchable exists.
 *     That single phantom made three shipped claims false at once ("48 across 18 files"; the entry's
 *     own "// the no-onPress branch renders a bare body"; and the anti-slack guarantee, since one
 *     genuine unroled touchable could be added under the phantom's allowance). It also meant a
 *     prose-only edit to a doc comment turned this suite RED.
 * Both bugs are the same class — reading JSX as text — so the fix is to stop doing that. Fixture
 * tests below pin the measurement itself, because bug 2 was caught only incidentally, by ceiling
 * numbers moving.
 *
 * DISCLAIMED, so a green board is not read as more than it is:
 *  - A touchable counts as covered if it has an `accessibilityRole` attribute. This cannot judge
 *    whether the role is CORRECT (`button` where `checkbox` belongs), nor whether the accessible
 *    NAME is truthful — "Add Dan" on a chip that only fills a field passed every automated check in
 *    this repo and needed a human-directed critic. Names are pinned per-component in
 *    a11yContract.test.tsx instead.
 *  - Components that supply a role internally (PrimaryButton, ListRow, Segmented, ProgressBar) are
 *    not raw touchables, so a screen built from them reads as clean — correctly. Their own internal
 *    touchable IS counted here, and is roled.
 *  - This counts JSX call sites, not rendered rows. A touchable inside a `.map()` counts once. That
 *    is deliberate: rendered counts are not statically derivable and would swing with runtime data.
 */
const SRC = resolve(__dirname, '..', '..');

/** Raw touchables — the ones that must carry their own role. */
const TOUCHABLES = new Set([
  'PressableScale',
  'Pressable',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
  'TouchableHighlight',
]);

/**
 * Count touchables with no `accessibilityRole`, by parsing.
 *
 * A spread (`{...props}`) could carry a role we cannot see, so it is NOT credited — the conservative
 * direction for a11y, and there are zero such call sites today.
 */
export function countUnroled(src: string, fileName = 'file.tsx'): number {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let n = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (TOUCHABLES.has(node.tagName.getText(sf))) {
        const roled = node.attributes.properties.some(
          p => ts.isJsxAttribute(p) && p.name.getText(sf) === 'accessibilityRole',
        );
        if (!roled) n++;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return n;
}

/** Every JSX tag in a file whose name looks like a touchable primitive. */
function touchableNamedTags(src: string, fileName = 'file.tsx'): string[] {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (/^(Pressable|Touchable)/.test(tag)) found.push(tag);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/**
 * Files permitted to still contain unroled touchables, and how many. Only ever lower these.
 * 47 across 17 files at the time of writing.
 */
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

function sources(): { rel: string; src: string }[] {
  return walk(SRC).map(file => ({
    rel: relative(SRC, file).replace(/\\/g, '/'),
    src: readFileSync(file, 'utf8'),
  }));
}

/** Count of unroled raw touchables, per file. */
function unroled(): Map<string, number> {
  const found = new Map<string, number>();
  for (const { rel, src } of sources()) {
    const n = countUnroled(src, rel);
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

  it('every ceiling is tight — no banked headroom, no stale entry', () => {
    const slack: string[] = [];
    const found = unroled();
    for (const [rel, max] of Object.entries(CEILING)) {
      const n = found.get(rel) ?? 0;
      if (n < max) slack.push(`${rel}: ceiling ${max}, actual ${n} — lower it`);
    }
    expect(slack).toEqual([]);
  });

  it('knows about every touchable primitive the app actually uses', () => {
    // Without this, adding `TouchableNativeFeedback` (or any new primitive) to a screen would be
    // invisible to the ratchet: unmeasured, uncapped, and reported as clean.
    const unknown = new Set<string>();
    for (const { rel, src } of sources()) {
      for (const tag of touchableNamedTags(src, rel)) if (!TOUCHABLES.has(tag)) unknown.add(tag);
    }
    expect([...unknown]).toEqual([]);
  });
});

/**
 * The measurement, pinned independently of the ceiling numbers. Without these, a broken measurement
 * shows up only as ceilings mysteriously moving — which is how the comment bug reached `main`.
 *
 * Measured, not assumed: replaying these fixtures against the previous brace-aware text scan turns
 * exactly ONE of them red — the comment case, which is the bug that was live. The other eight are
 * regression documentation: the old scan happened to get them right too, so they discriminate
 * against a future naive rewrite, not against the version this replaced. Stated plainly because the
 * useful claim is "the shipped bug is pinned", not "nine tests now guard the parser".
 */
describe('countUnroled — the measurement itself', () => {
  it('does not count JSX written inside comments', () => {
    expect(countUnroled(`
      /** Replaces per-screen \`<PressableScale><Card style={row}>…\` blocks with one layout. */
      // <TouchableOpacity onPress={x}>legacy</TouchableOpacity>
      const A = () => <View />;
    `)).toBe(0);
  });

  it('sees a role that sits after a multi-line arrow prop', () => {
    // The original regex stopped at the `>` inside `() =>`, so this read as unroled.
    expect(countUnroled(`
      const A = () => (
        <PressableScale
          onPress={() => { doThing(); }}
          accessibilityRole="button"
        ><Text>x</Text></PressableScale>
      );
    `)).toBe(0);
  });

  it('counts a bare touchable', () => {
    expect(countUnroled('const A = () => <TouchableOpacity onPress={f}><Text>x</Text></TouchableOpacity>;')).toBe(1);
  });

  it('is not fooled by a `>` inside a string prop', () => {
    expect(countUnroled('const A = () => <Pressable accessibilityLabel="a > b" onPress={f}><Text>x</Text></Pressable>;')).toBe(1);
  });

  it('does not credit a touchable with a role that belongs to its CHILD', () => {
    expect(countUnroled(`
      const A = () => (
        <Pressable onPress={f}>
          <View accessibilityRole="button"><Text>x</Text></View>
        </Pressable>
      );
    `)).toBe(1);
  });

  it('counts a nested touchable passed inside a JSX-valued prop', () => {
    // The outer tag's attributes contain a whole element; a text scan swallowed the inner one.
    expect(countUnroled(`
      const A = () => (
        <PressableScale accessibilityRole="button" right={<TouchableOpacity onPress={f}><Text>x</Text></TouchableOpacity>}>
          <Text>y</Text>
        </PressableScale>
      );
    `)).toBe(1);
  });

  it('handles self-closing tags in both directions', () => {
    expect(countUnroled('const A = () => <Pressable onPress={f} />;')).toBe(1);
    expect(countUnroled('const A = () => <Pressable onPress={f} accessibilityRole="button" />;')).toBe(0);
  });

  it('does not credit a spread that might or might not carry a role', () => {
    expect(countUnroled('const A = () => <Pressable {...rest} onPress={f} />;')).toBe(1);
  });
});
