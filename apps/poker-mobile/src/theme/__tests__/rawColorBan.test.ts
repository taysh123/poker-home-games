import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * Raw-colour ratchet for UI code.
 *
 * CLAUDE.md's rule is "All colors in theme/colors.ts. Never hardcode hex values" — and until now
 * nothing enforced it, so rarity accents drifted into THREE divergent copies and podium colours
 * into two, each inlining literals that already existed as tokens.
 *
 * This is an ALLOWLIST ratchet, not a blanket ban. Plenty of raw colour in this app is legitimate
 * and deliberately not tokenised: the poker-table position palette, the avatar palette, playing-
 * card faces, `#000` shadows, and the HTML/email export stylesheet. Those are listed below and can
 * only be REMOVED. What the ratchet stops is a NEW file quietly starting to hardcode colour.
 *
 * Three traps this had to handle, found by reading the code before writing the rule:
 *  1. Rank labels like `"#1"` / `"#2"` appear in comments and copy — requiring >=3 hex digits
 *     avoids matching them.
 *  2. ~31 sites do `colors.success + '44'` — an alpha suffix, which is a HALF hex and invisible to
 *     a `#` regex. This test does not claim to catch those; saying so here is the point, because a
 *     ban that silently misses a whole shape is worse than no ban.
 *  3. This file names hex literals in its own allowlist, so it must exclude itself.
 */
const SRC = resolve(__dirname, '..', '..');

/** >=3 hex digits, so `#1`/`#2` rank labels never match. */
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/;

/**
 * Files permitted to contain raw colour, each with the reason. This list may SHRINK; adding to it
 * should be a deliberate, reviewed act — that is the entire mechanism.
 */
const ALLOWED = new Set<string>([
  'utils/exportUtils.ts',            // HTML/email export stylesheet — leaves the RN theme entirely
  'utils/pokerTable.ts',             // position palette + casino chip tiers (domain colours)
  'utils/avatarColor.ts',            // avatar palette — deliberately its own hash-indexed set
  'components/table/PlayingCard.tsx',// card face/pip/suit colours — physical-object colours
  'components/table/PokerTable.tsx', // #000 shadow
  'components/Toast.tsx',            // #000 shadow + on-colour white
  'components/InviteSheet.tsx',      // QR code needs literal fg/bg, not theme-resolved
  'screens/SessionScreen.tsx',       // #000 shadow (the 3.1k monolith — see Q3.6 for its cleanup)
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('raw colour ratchet', () => {
  it('no file outside theme/ or the allowlist hardcodes a hex colour', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      if (rel.startsWith('theme/')) continue; // the tokens themselves
      if (ALLOWED.has(rel)) continue;
      if (HEX.test(readFileSync(file, 'utf8'))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('the allowlist contains no stale entries', () => {
    // An allowlist entry for a file that no longer has raw colour is a licence nobody revoked.
    // Forcing it to shrink is what makes this a ratchet rather than a snapshot.
    const stale = [...ALLOWED].filter(rel => {
      try {
        return !HEX.test(readFileSync(join(SRC, rel), 'utf8'));
      } catch {
        return true; // file deleted — entry is stale
      }
    });
    expect(stale).toEqual([]);
  });

  it('the rule ignores short "#1"-style rank labels', () => {
    // Guards trap 1: a regex without the >=3-digit floor flags every `#${rank}` label and every
    // "#1" in prose, which would make the ban unusable and get it deleted.
    expect(HEX.test('const label = `#${rank}`;')).toBe(false);
    expect(HEX.test('// Top-3 are tinted, e.g. #1 and #2')).toBe(false);
    expect(HEX.test("color: '#C46EE8'")).toBe(true);
    expect(HEX.test("color: '#fff'")).toBe(true);
  });

  it('does NOT claim to catch alpha-suffix concatenation', () => {
    // Trap 2, stated rather than hidden. `colors.gold + '14'` builds a colour the regex cannot
    // see. Documented so nobody reads a green board as "no untokenised colour exists".
    expect(HEX.test("backgroundColor: colors.gold + '14'")).toBe(false);
  });
});
