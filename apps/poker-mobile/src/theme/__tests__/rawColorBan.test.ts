import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * Raw-colour ratchet for UI code.
 *
 * CLAUDE.md's rule is "All colors in theme/colors.ts. Never hardcode hex values" — and until now
 * nothing enforced it, so rarity accents drifted into THREE divergent copies and podium colours
 * into two, each inlining literals that already existed as tokens.
 *
 * This is a per-file COUNT CEILING, not a boolean allowlist. That distinction was earned: a
 * boolean allowlist entry for `SessionScreen.tsx` — added for its single `#000` shadow — would
 * have licensed unlimited new colour anywhere in a 3.1k-line money-critical file, which is the one
 * most likely to receive new UI code. Counts can only be LOWERED.
 *
 * Covers BOTH `#hex` and `rgb()/rgba()`. An earlier draft matched only `#hex` while its header
 * claimed to be a "raw-colour ratchet", silently ignoring 65 rgba literals — the exact failure its
 * own doc block warned against ("a ban that silently misses a whole shape is worse than no ban").
 *
 * Known and DISCLAIMED gaps, so a green board is not read as more than it is:
 *  - Alpha-suffix concatenation (`colors.gold + '14'`, ~31 sites) builds a colour this cannot see.
 *  - 4-digit CSS shorthand (`#fff8`) is not matched.
 *  - The walk is rooted at `src/`, so `App.tsx` and `scripts/` are out of scope.
 *
 * Entries are legitimate untokenised colour: the poker-table position palette, the avatar palette,
 * playing-card faces, `#000` shadows, glass/sheen overlays, and the HTML export stylesheet.
 */
const SRC = resolve(__dirname, '..', '..');

/** >=3 hex digits so `#1`/`#2` rank labels never match, plus rgb()/rgba(). */
const RAW_COLOR = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b|rgba?\(/g;

/**
 * Max raw-colour literals permitted per file. LOWER these as files are tokenised; never raise one
 * without saying why in review. A file absent from this map may contain none.
 */
const CEILING: Record<string, number> = {
  'screens/SessionScreen.tsx': 34,          // #000 shadow + rgba overlays (3.1k monolith — Q3.6)
  'utils/exportUtils.ts': 20,               // HTML/email export stylesheet (9 are token byte-copies — see below)
  'utils/pokerTable.ts': 20,                // position palette + casino chip tiers (domain colours)
  'screens/HomeScreen.tsx': 10,             // activity-icon tints + glass overlays
  'utils/avatarColor.ts': 10,               // avatar palette — deliberately its own hash-indexed set
  'components/table/PlayingCard.tsx': 6,    // card face/pip/suit — physical-object colours
  'screens/NewGameScreen.tsx': 6,           // gold chip fills
  'components/InviteSheet.tsx': 4,          // QR needs literal fg/bg + white card
  'components/motion/Shimmer.tsx': 4,       // white sheen gradient stops
  'components/Toast.tsx': 3,                // #000 shadow + on-colour white
  'components/table/PokerTable.tsx': 2,
  'components/table/TableBackdrop.tsx': 2,  // felt glow gradient
  'features/study/ui/SpotTrainerScreen.tsx': 2,
  'components/ActionSheet.tsx': 1,
  'components/motion/GlassView.tsx': 1,
  'components/StepIndicator.tsx': 1,
  'components/table/ChipStack.tsx': 1,
  'components/table/Pot.tsx': 1,
  'features/bankroll/ui/BankrollScreen.tsx': 1,
  'features/study/ui/QuizRunnerScreen.tsx': 1,
  'screens/EditGroupScreen.tsx': 1,
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Raw-colour count per src-relative file, excluding theme/ (the tokens themselves). */
function counts(): Map<string, number> {
  const found = new Map<string, number>();
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, '/');
    if (rel.startsWith('theme/')) continue;
    const matches = readFileSync(file, 'utf8').match(RAW_COLOR);
    if (matches) found.set(rel, matches.length);
  }
  return found;
}

describe('raw colour ratchet', () => {
  it('no file exceeds its ceiling, and no new file introduces raw colour', () => {
    const over: string[] = [];
    for (const [rel, n] of counts()) {
      const max = CEILING[rel] ?? 0;
      if (n > max) over.push(`${rel}: ${n} > ${max}`);
    }
    expect(over).toEqual([]);
  });

  it('every ceiling is tight — none has slack a regression could hide in', () => {
    // Slack is how a ratchet stops ratcheting: a ceiling of 34 on a file down to 20 silently
    // permits 14 new literals. Lowering a ceiling is a one-line edit; leaving slack is not free.
    const slack: string[] = [];
    const found = counts();
    for (const [rel, max] of Object.entries(CEILING)) {
      const n = found.get(rel) ?? 0;
      if (n < max) slack.push(`${rel}: ceiling ${max}, actual ${n} — lower it`);
    }
    expect(slack).toEqual([]);
  });

  it('ignores short "#1"-style rank labels', () => {
    // Without the >=3-digit floor this flags every `#${rank}` label and every "#1" in prose,
    // which makes the ban unusable and gets it deleted rather than obeyed.
    expect('const label = `#${rank}`;'.match(RAW_COLOR)).toBeNull();
    expect('// Top-3 are tinted, e.g. #1 and #2'.match(RAW_COLOR)).toBeNull();
    expect("color: '#C46EE8'".match(RAW_COLOR)).toHaveLength(1);
    expect("color: '#fff'".match(RAW_COLOR)).toHaveLength(1);
  });

  it('catches rgb()/rgba(), not only hex', () => {
    expect("backgroundColor: 'rgba(15,25,35,0.6)'".match(RAW_COLOR)).toHaveLength(1);
    expect("backgroundColor: 'rgb(15,25,35)'".match(RAW_COLOR)).toHaveLength(1);
  });

  it('does NOT claim to catch alpha-suffix concatenation', () => {
    // Disclaimed, not hidden. `colors.gold + '14'` builds a colour the regex cannot see, so a
    // green board here does not mean "no untokenised colour exists".
    expect("backgroundColor: colors.gold + '14'".match(RAW_COLOR)).toBeNull();
  });
});
