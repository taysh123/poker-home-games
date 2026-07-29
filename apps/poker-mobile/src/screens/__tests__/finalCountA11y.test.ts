import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import * as ts from 'typescript';

/**
 * The Final Count exists TWICE — `LocalSessionScreen` (guest games) and `SessionScreen` (server
 * sessions) — and CLAUDE.md requires the two to stay in sync until the extraction slice merges
 * them. `SessionScreen` carries a comment saying exactly that.
 *
 * That comment was documentation, not a mechanism. `LocalSessionScreen`'s per-player label is
 * revert-tested by LocalSessionScreen.finalcount.test.tsx, but `SessionScreen`'s identical label
 * could be deleted with the entire suite green — so the money screen used by every signed-in user
 * had none of the protection the local flow had. A stated invariant with no test is how the last
 * six false claims shipped.
 *
 * PARSED, NOT GREPPED. The first version of this file used `toContain` over the raw source, which
 * passes just as happily when the attribute is COMMENTED OUT — the identical defect this slice had
 * just finished removing from the role ratchet, reintroduced one file over. It now reads real
 * `accessibilityLabel` JSX attributes off the TypeScript AST, so prose cannot satisfy it.
 *
 * SCOPE, stated so a green run is not over-read: this is still a SOURCE-LEVEL pin. It proves each
 * screen *declares* a per-player accessible name on a Final Count amount field; it does not render
 * either screen, so it cannot prove the label reaches the tree, that the field is the one the user
 * types into, or that it reads correctly. `SessionScreen` is ~3.1k lines and mounting it belongs to
 * the extraction slice. This is the cheap half that makes deletion loud.
 *
 * The two wordings are deliberately NOT identical: local games are cash-only here, while
 * `SessionScreen` derives the unit because `useChips` is a real toggle.
 */
const SCREENS = resolve(__dirname, '..');

/** The source text of every `accessibilityLabel={...}` attribute actually present in the JSX. */
function accessibilityLabels(file: string): string[] {
  const path = join(SCREENS, file);
  const src = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (errors.length) throw new Error(`${file}: ${errors.length} parse error(s)`);

  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'accessibilityLabel' && node.initializer) {
      out.push(node.initializer.getText(sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe('The Final Count — the per-player accessible name, pinned on BOTH flows', () => {
  it('LocalSessionScreen names each amount field after its player', () => {
    expect(accessibilityLabels('LocalSessionScreen.tsx').some(t => t.includes('${p.name} final cash amount')))
      .toBe(true);
  });

  it('SessionScreen names each amount field after its player, with the unit derived', () => {
    expect(accessibilityLabels('SessionScreen.tsx').some(
      t => t.includes('${p.username} final ') && t.includes('chip count') && t.includes('cash amount'),
    )).toBe(true);
  });

  it('a commented-out label does not satisfy either pin', () => {
    // The regression guard for this file's own first version. Kept as a fixture rather than a
    // promise, because "we parse now" is exactly the kind of claim that needs a test.
    const commented = ts.createSourceFile(
      'f.tsx',
      'const A = () => (\n  // accessibilityLabel={`${p.name} final cash amount`}\n  <View />\n);',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const found: string[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isJsxAttribute(n) && n.name.getText(commented) === 'accessibilityLabel') found.push('x');
      ts.forEachChild(n, visit);
    };
    visit(commented);
    expect(found).toEqual([]);
  });

  it('keys that name off player IDENTITY, not row position', () => {
    // Asserted as the positive property. The first version blacklisted the literal shape
    // `Player ${i}`, which its own test name outran: `Seat ${rowIndex + 1}` is just as mis-keyed
    // and sailed through. Requiring the identity expression catches every positional spelling
    // instead of the three that were thought of. On a screen where a mis-keyed row costs real
    // money, a name that follows row ORDER is worse than no name at all.
    for (const [file, identity] of [
      ['LocalSessionScreen.tsx', '${p.name}'],
      ['SessionScreen.tsx', '${p.username}'],
    ] as const) {
      const finalCount = accessibilityLabels(file).filter(t => t.includes(' final '));
      expect(finalCount.length).toBeGreaterThan(0);
      for (const label of finalCount) expect(label).toContain(identity);
    }
  });
});
