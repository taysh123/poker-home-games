import { readFileSync } from 'fs';
import { resolve } from 'path';

import { alertLabel, invitationsAlertCopy, settlementsAlertCopy, topGroupCopy, topGroupText } from '../homeAlerts';

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
 */
describe('HomeScreen is wired to homeAlerts, not re-implementing it inline', () => {
  const read = () => readFileSync(resolve(__dirname, '..', '..', 'screens', 'HomeScreen.tsx'), 'utf8');

  it('the top-group chip calls topGroupLabel/topGroupText, not a hand-rolled formatMoney + sign', () => {
    const src = read();
    expect(src).toMatch(/accessibilityLabel=\{\s*topGroupLabel\(/);
    expect(src).toMatch(/\{\s*topGroupText\(/);
    // The exact shape that shipped the bug: a ternary '+' sign glued to formatMoney's Math.abs
    // output, right where the top-group chip's copy lives.
    expect(src).not.toMatch(/topGroup\.myGroupPL\s*>\s*0\s*\?\s*'\+'/);
  });

  it('"+N more groups" has exactly ONE plural expression, shared by the label and the visible text', () => {
    // Two independent `more group${...}` expressions is the defect itself, whether or not they
    // happen to agree today — the point is that nothing stops them drifting apart.
    const src = read();
    const occurrences = src.match(/more group\$\{/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});
