/**
 * CLASSIFICATION PIN — user-facing copy must not read as real-money gambling.
 *
 * We submit under an INDIVIDUAL Apple Developer account, so nothing on screen may frame T Poker as
 * a gambling product. Apple requires an ORGANIZATION account for gambling / simulated-gambling
 * apps. This test greps the specific USER-FACING source surfaces for casino idiom and fails if it
 * reappears. It is the in-app twin of apps/landing/__tests__/positioning.test.ts.
 *
 * SCOPE: display strings, alt text, dialog copy — the words a player or a reviewer actually reads.
 * It deliberately does NOT police:
 *   - internal identifiers (`totalPotCents`, `totalPot`/`handPot`, the tournament-config
 *     `payouts: number[]`, the `payoutPcts`/`payoutValid` locals in the wizard) — renaming those is
 *     churn with no user-facing effect, and a file-wide `/payout/i` would trip them;
 *   - the per-hand pot in SessionScreen's hand recorder ("Pot Amount", "{amount} pot") — a poker
 *     hand's pot IS a pot; that authed, optional feature is out of scope. Only the SESSION-wide
 *     total (sum of buy-ins) must not be called a "pot", which is what the SessionScreen bans below
 *     target (`/Pot:\s/` = the header chip, `/>Pot</` = the summary stat label);
 *   - source comments and test fixtures.
 * Because of the per-hand carve-out, the bans are per-file and phrase-specific, not a repo-wide grep.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// __dirname = .../src/features/premium/__tests__ → three levels up is src/.
const read = (rel: string) => readFileSync(resolve(__dirname, '../../..', rel), 'utf8');

/** file (relative to src/) → banned display patterns (case-insensitive). Each must be absent. */
const BANNED: Record<string, RegExp[]> = {
  // "Money on the table" / "the pot" are the classic table-stakes idioms.
  'screens/GuestStatsScreen.tsx': [/money on the table/i, /\bpot\b/i],
  // "the Club" reads as a gambling venue; the tournament card must not sell a "prize pool".
  'screens/HomeScreen.tsx': [/at the club/i, /prize pool/i],
  // Guest home + the sessions list both show a session's total; it was mislabeled "$X pot".
  'screens/GuestHomeScreen.tsx': [/prize pool/i, /\bpot\b/i],
  'screens/LocalSessionsScreen.tsx': [/\bpot\b/i],
  // The live/summary money captions and the end-game confirm dialog.
  'screens/LocalSessionScreen.tsx': [/prize pool/i, /total pot/i],
  'screens/LocalSessionSummaryScreen.tsx': [/prize pool/i, /total pot/i],
  // Session-total captions only (the per-hand pot is intentionally kept — see the header note).
  // `\bPot:` matches the display label "Pot: ₪X" (word boundary before Pot) but NOT the internal
  // `handPot:` style key ('d' before Pot = no boundary); `>Pot<` matches the bare summary label.
  'screens/SessionScreen.tsx': [/total pot/i, /\bPot:/, />Pot</],
  // The tournament wizard's promo copy must not sell "payouts"; the % editor is "prize splits".
  // These three phrases are display-only — they never occur in the kept `payout*` identifiers.
  'screens/LocalNewGameScreen.tsx': [/podium payouts/i, /-place payout/i, /payouts total/i],
  // "Play responsibly" is an operator's phrase — it implies we run something to play for money.
  'screens/LoginScreen.tsx': [/play responsibly/i],
  'screens/WelcomeScreen.tsx': [/play responsibly/i],
  'screens/ProfileScreen.tsx': [/play responsibly/i],
  // The shareable result card leaves the app — it must not broadcast a "pot".
  'components/ShareCard.tsx': [/total pot/i, /prize pool/i],
  'components/RecapCard.tsx': [/total pot/i],
  // The in-app marketing carousel. NOTE: LandingScreen is `paywall`-gated and paywall is pinned
  // OFF in prod, so this is not user-reachable today — cleaned anyway so it can't ship idiom if the
  // paywall landing is ever revived. (`\bpot\b` is safe here: "Spot"/"spotTrainer" have no word
  // boundary before "pot".)
  'features/landing/landingContent.ts': [/money on the table/i, /prize pool/i, /\bpot\b/i],
};

describe('classification — no gambling idiom in user-facing copy', () => {
  for (const [file, patterns] of Object.entries(BANNED)) {
    it(`${file} carries no casino idiom`, () => {
      const src = read(file);
      for (const pattern of patterns) {
        expect(src).not.toMatch(pattern);
      }
    });
  }
});
