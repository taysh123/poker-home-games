import * as fs from 'fs';
import * as path from 'path';

// WIRING pins for the deletion-guard client fixes on SessionScreen (fleet finding
// 2026-08-04: "reverting the SessionScreen diff keeps all 1167 tests green"). The pure
// decisions live in utils/settlementsSection and are literal-pinned there; these
// anchors pin that the 3k-line screen actually CONSUMES them, so reverting the screen
// half of the fix goes red here. Comments are stripped before matching — a comment
// injected inside an anchored span defeated the a11y wiring pins once already (#72).

const source = fs.readFileSync(path.join(__dirname, '..', 'SessionScreen.tsx'), 'utf8');

// Strip /* … */ blocks and whole-line // comments. Trailing // comments are left alone
// (URLs like https:// would false-positive); anchors below never span a trailing comment.
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter(line => !/^\s*\/\//.test(line))
  .join('\n');

function count(needle: string): number {
  return code.split(needle).length - 1;
}

describe('SessionScreen wiring — deletion-guard client behavior', () => {
  it('imports the settlements-section helpers', () => {
    expect(code).toMatch(/import\s*\{[^}]*refusalMessage[^}]*\}\s*from\s*'\.\.\/utils\/settlementsSection'/);
  });

  it('classifies every calculateSettlements failure through refusalMessage (all three call sites)', () => {
    // auto-call in load(), end-session batch, manual Recalculate handler
    expect(count('refusalMessage(')).toBeGreaterThanOrEqual(3);
  });

  it('renders the blocked state INSTEAD of the "Everyone is even" all-clear', () => {
    const blockedBranch = code.indexOf('settlements.length === 0 && settlementsBlocked');
    const evenCard = code.indexOf("'Everyone is even'");
    expect(blockedBranch).toBeGreaterThan(-1);
    expect(evenCard).toBeGreaterThan(-1);
    expect(blockedBranch).toBeLessThan(evenCard);
    expect(code).toContain('Settlements unavailable');
  });

  it('derives cash seats through isCashSeat/cashSeatName so the departed player survives a reload', () => {
    expect(code).toContain('.filter(isCashSeat)');
    expect(count('cashSeatName(')).toBeGreaterThanOrEqual(1);
  });

  it('gates the all-settled celebration on no cash being outstanding', () => {
    expect(count('allSettledCopy(')).toBeGreaterThanOrEqual(1);
  });

  it('derives the cash-section subtitle from the parties instead of always claiming guests', () => {
    expect(count('cashSectionSubtitle(')).toBeGreaterThanOrEqual(1);
    expect(code).not.toContain("Guests can't receive digital transfers");
  });

  it('hides the header Recalculate control while the section says recalculation is impossible', () => {
    expect(code).toContain('!(settlementsBlocked && settlements.length === 0) &&');
  });
});
