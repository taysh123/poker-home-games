import { readFileSync } from 'fs';
import { resolve } from 'path';

import { alertLabel, invitationsAlertCopy, settlementsAlertCopy, topGroupCopy, topGroupText, heroSessionsBadgeText, heroStatsErrorCopy } from '../homeAlerts';

/**
 * Literals, not values rebuilt from formatMoney — a test that calls the code it guards moves with
 * it. Currency is the module default (ILS).
 */
const owesMe = { payerUserId: 'other', receiverUserId: 'me', amount: 120 };
const iOwe = { payerUserId: 'me', receiverUserId: 'other', amount: 45 };

describe('settlementsAlertCopy — the money phrasing is the announcement', () => {
  it('pluralises the count', () => {
    expect(settlementsAlertCopy([iOwe], 'me').title).toBe('1 pending settlement');
    expect(settlementsAlertCopy([iOwe, owesMe], 'me').title).toBe('2 pending settlements');
  });

  it('states what the caller owes', () => {
    expect(settlementsAlertCopy([iOwe], 'me').sub).toBe('You owe ₪45');
  });

  it('states what the caller is owed', () => {
    expect(settlementsAlertCopy([owesMe], 'me').sub).toBe("You're owed ₪120");
  });

  it('states both directions when both apply', () => {
    expect(settlementsAlertCopy([iOwe, owesMe], 'me').sub).toBe('You owe ₪45 · Owed ₪120');
  });

  it('falls back to an instruction when the caller is in neither side', () => {
    // A settlement between two OTHER people: announcing "You owe ₪0" would be a lie.
    expect(settlementsAlertCopy([{ payerUserId: 'a', receiverUserId: 'b', amount: 90 }], 'me').sub)
      .toBe('Tap to view and settle up');
  });

  it('does not attribute anything to an unknown caller', () => {
    expect(settlementsAlertCopy([iOwe, owesMe], undefined).sub).toBe('Tap to view and settle up');
  });
});

describe('invitationsAlertCopy', () => {
  it('pluralises the count', () => {
    expect(invitationsAlertCopy(1).title).toBe('1 group invitation');
    expect(invitationsAlertCopy(3).title).toBe('3 group invitations');
  });
});

describe('topGroupCopy — a losing top group must show and say a MINUS', () => {
  it('keeps the sign on a loss', () => {
    // The bug: `{pl > 0 ? '+' : ''}{formatMoney(pl)}` with formatMoney applying Math.abs rendered
    // this as "₪450" — a loss displayed as a gain. Literal expectations, so the test cannot follow
    // formatPL if formatPL changes.
    expect(topGroupText('Poker Crew', -450)).toBe('Top group: Poker Crew -₪450');
    expect(topGroupCopy('Poker Crew', -450).sub).toBe('-₪450');
  });

  it('keeps the plus on a win', () => {
    expect(topGroupText('Poker Crew', 1200)).toBe('Top group: Poker Crew +₪1,200');
  });

  it('is announced with the same numbers it displays', () => {
    // The standing rule in one assertion: the spoken name and the visible line are the same words,
    // so a change to one that is not made to the other fails here.
    const copy = topGroupCopy('Poker Crew', -450);
    expect(`${copy.title}, ${copy.sub}`).toBe('Top group: Poker Crew, -₪450');
    expect(topGroupText('Poker Crew', -450)).toBe('Top group: Poker Crew -₪450');
  });
});

describe('alertLabel — the banner is one element, so the name carries both lines', () => {
  it('reads the title then the subtitle', () => {
    expect(alertLabel(settlementsAlertCopy([iOwe], 'me'))).toBe('1 pending settlement. You owe ₪45');
    expect(alertLabel(invitationsAlertCopy(2))).toBe('2 group invitations. Tap to view and respond');
  });
});

describe('heroSessionsBadgeText — a load failure must not look like a genuine zero', () => {
  // The bug (pre-Q2 audit, HomeScreen.tsx:160): `stats?.totalSessionsPlayed ?? 0` renders
  // "0 sessions" identically for a genuine new user AND a failed load — a returning user with
  // real history sees confidently wrong data after a network blip.
  it('shows the real, pluralised count when stats loaded', () => {
    expect(heroSessionsBadgeText(false, 0)).toBe('0 sessions');
    expect(heroSessionsBadgeText(false, 1)).toBe('1 session');
    expect(heroSessionsBadgeText(false, 5)).toBe('5 sessions');
  });

  it('shows an honest placeholder on a load failure, never a number', () => {
    expect(heroSessionsBadgeText(true, 0)).toBe('—');
    // Even if a stale/partial count were somehow available, an error state must not imply data.
    expect(heroSessionsBadgeText(true, 7)).toBe('—');
  });
});

describe('heroStatsErrorCopy — the hero P&L error state, literal-pinned', () => {
  it('never claims a number — it says loading failed', () => {
    expect(heroStatsErrorCopy.title).toBe("Couldn't load your stats");
    expect(heroStatsErrorCopy.sub).toBe('Check your connection and tap to retry.');
  });
});

/**
 * A pinned FUNCTION only removes drift if the SCREEN actually calls it. HomeScreen.tsx has no
 * render harness, so nothing above proves that — mutation-confirmed: reverting the top-group chip
 * to a hand-rolled `formatMoney` + sign (bypassing topGroupLabel/topGroupText entirely, with
 * homeAlerts.ts itself untouched) left the full 1158-test suite green. Same for the "+N more
 * groups" row — reverting its single shared `moreGroupsText` back into two independently
 * hand-rolled plural expressions (the label said "1 session" while the row said "1 sessions" shape
 * this repo keeps re-shipping) also left the suite green.
 *
 * Source checks, the same tradeoff already accepted for GroupsListScreen's wiring pin
 * (utils/__tests__/groupRow.test.ts's "both group rows are wired to the shared helper"). They
 * prove the call sites exist; they cannot prove what HomeScreen renders at runtime.
 *
 * A FIRST VERSION of these two assertions shipped and did not actually close the gap — caught by
 * an adversarial fleet run on the commit that added them. Both defects and their fixes:
 *  - The topGroupText check was unanchored (`toMatch(/\{\s*topGroupText\(/)`), so a plain COMMENT
 *    mentioning "topGroupText(" satisfied it while the real Text body stayed hand-rolled. Fixed by
 *    requiring the call inside the exact JSX span between the Text's `style={styles.topGroupText}`
 *    and its closing tag — a comment elsewhere in the file can't land inside that span.
 *  - The banned-pattern check only named ONE spelling of the old bug (`myGroupPL > 0 ? '+'`); a
 *    trivial rewrite (`>= 0`, string concatenation, a differently-named ternary) reintroduced the
 *    identical wiring bug undetected. Fixed structurally instead of textually: `formatMoney` is not
 *    imported by this file at all, so the bug's one required ingredient is simply unavailable
 *    however it's spelled.
 *  - The "+N more groups" check counted occurrences of the substring `more group${` — but the REAL
 *    historical bug (commit 28ae7fe's parent) had the visible-Text half as a bare string literal
 *    with no `${` interpolation at all, so reverting to that exact shape left the count at "1" and
 *    the test green. Fixed by counting the shared VARIABLE's identifier instead of a text shape:
 *    `moreGroupsText` must appear exactly 3 times (one declaration, two uses) regardless of which
 *    string syntax either use employs.
 */
/** Matches theme/__tests__/rawColorBan.test.ts's own stripComments — the same reason applies here:
 * a source check must measure what SHIPS, not prose about it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('HomeScreen is wired to homeAlerts, not re-implementing it inline', () => {
  const read = () => readFileSync(resolve(__dirname, '..', '..', 'screens', 'HomeScreen.tsx'), 'utf8');

  it('the top-group chip calls topGroupLabel/topGroupText, not a hand-rolled formatMoney + sign', () => {
    // Comments are stripped BEFORE the span is extracted. A first version of this test anchored
    // the match to the JSX span but read it verbatim, so a comment placed INSIDE that span
    // (e.g. `{/* mirrors topGroupText( from homeAlerts.ts */}`) satisfied the check on its own
    // text, with the real render body left hand-rolled underneath it — caught by revert-testing
    // this exact shape, not merely reasoned about.
    const src = stripComments(read());

    const labelBlock = src.match(/style=\{styles\.topGroupChip\}[\s\S]*?accessibilityLabel=\{[^}]*\}/);
    expect(labelBlock?.[0] ?? '').toMatch(/topGroupLabel\(/);

    const textBlock = src.match(/style=\{styles\.topGroupText\}[\s\S]*?<\/Text>/);
    expect(textBlock?.[0] ?? '').toMatch(/topGroupText\(/);

    // Structural, not textual: formatMoney applies Math.abs and is the one ingredient the old bug
    // needed. However the ternary was spelled, it cannot exist here if formatMoney isn't imported.
    expect(src).not.toMatch(/\bformatMoney\b/);
  });

  it('"+N more groups" uses ONE shared variable, referenced by both the label and the visible text', () => {
    // Counts the identifier itself rather than a text shape (template literal vs. string literal),
    // so it cannot be fooled by which syntax either call site happens to use. Comments stripped for
    // the same reason as the test above — an occurrence inside a comment isn't a real use.
    const src = stripComments(read());
    expect(src.match(/\bconst moreGroupsText\s*=/g) ?? []).toHaveLength(1);
    expect(src.match(/\bmoreGroupsText\b/g) ?? []).toHaveLength(3); // declaration + label + visible text
  });

  it('three of the seven Promise.all loads have their own .catch — one failing call must not blank the batch', () => {
    // Pre-Q2 audit finding: getMyGroups/getMyStats/getMyInvitations had no independent .catch,
    // so any ONE of their failures rejected the whole Promise.all into the outer silent catch{},
    // even though the other four calls already degrade independently.
    const src = stripComments(read());
    // Non-greedy up to `]);` specifically — several calls inside cast `as XDto[]`, which itself
    // contains `])`, so a naive `\]\)` stop would truncate the match after the first such cast.
    const block = src.match(/Promise\.all\(\[[\s\S]*?\]\);/)?.[0] ?? '';
    expect(block).toMatch(/getMyGroups\(token\)\.catch\(/);
    expect(block).toMatch(/getMyStats\(token\)\.catch\(/);
    expect(block).toMatch(/getMyInvitations\(token\)\.catch\(/);
  });

  it('the hero session badge is wired to heroSessionsBadgeText, not a hand-rolled ?? 0', () => {
    const src = stripComments(read());
    expect(src).toMatch(/heroSessionsBadgeText\(/);
    // The exact bug shape this replaces — must not survive alongside the fix.
    expect(src).not.toMatch(/stats\?\.totalSessionsPlayed\s*\?\?\s*0/);
  });

  it('the hero P&L renders heroStatsErrorCopy instead of a false ₪0 "Break even" on a load failure', () => {
    const src = stripComments(read());
    // The derived signal: stats failed to load if loading finished and stats is still null.
    expect(src).toMatch(/statsError\s*=\s*!statsLoading\s*&&\s*stats\s*===\s*null/);
    // The value/sub block must branch on it BEFORE reaching the real AnimatedNumber render —
    // anchored to the hero card's own JSX span so a comment elsewhere can't satisfy this.
    const heroBlock = src.match(/heroCardInner[\s\S]*?AnimatedNumber/)?.[0] ?? '';
    expect(heroBlock).toMatch(/statsError/);
    expect(src).toMatch(/heroStatsErrorCopy\.title/);
    expect(src).toMatch(/heroStatsErrorCopy\.sub/);
  });
});
