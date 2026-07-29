import { readFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * The Final Count exists TWICE — `LocalSessionScreen` (guest games) and `SessionScreen` (server
 * sessions) — and CLAUDE.md requires the two to stay in sync until the extraction slice merges
 * them. `SessionScreen` carries a comment saying exactly that.
 *
 * That comment was documentation, not a mechanism. `LocalSessionScreen`'s per-player label is
 * revert-tested by LocalSessionScreen.finalcount.test.tsx, but `SessionScreen`'s identical label
 * could be deleted with the entire suite green — so the money screen used by every signed-in user
 * had none of the protection the local flow had. A stated invariant with no test is how the last
 * five false claims shipped.
 *
 * SCOPE, stated so a green run is not over-read: this is a SOURCE-LEVEL pin. It proves each screen
 * emits a per-player accessible name on its Final Count amount field; it does not render either
 * screen, so it cannot prove the label reaches the tree or reads correctly. `SessionScreen` is ~3.1k
 * lines and mounting it is the extraction slice's job. This is the cheap half that makes deletion
 * loud, not a substitute for the render test.
 *
 * The two wordings are deliberately NOT identical: local games are cash-only here, while
 * `SessionScreen` derives the unit because `useChips` is a real toggle. Both are pinned to the
 * literal shape rather than to each other.
 */
const SCREENS = resolve(__dirname, '..');

function source(file: string): string {
  return readFileSync(join(SCREENS, file), 'utf8');
}

describe('The Final Count — the per-player accessible name, pinned on BOTH flows', () => {
  it('LocalSessionScreen names each amount field after its player', () => {
    expect(source('LocalSessionScreen.tsx')).toContain('accessibilityLabel={`${p.name} final cash amount`}');
  });

  it('SessionScreen names each amount field after its player, with the unit derived', () => {
    expect(source('SessionScreen.tsx')).toContain(
      "accessibilityLabel={`${p.username} final ${session.chipRatio && useChips ? 'chip count' : 'cash amount'}`}",
    );
  });

  it('neither flow hard-codes a row index or position into that name', () => {
    // Guards the defect the local render test removed: a name that follows row ORDER rather than
    // the player is worse than no name at all on a screen where a mis-keyed row costs real money.
    for (const file of ['LocalSessionScreen.tsx', 'SessionScreen.tsx']) {
      expect(source(file)).not.toMatch(/accessibilityLabel=\{`(Player|Row) \$\{(i|index|idx)\b/);
    }
  });
});
