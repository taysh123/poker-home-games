import {
  CALC_BLOCKED_FALLBACK,
  refusalMessage,
  isCashSeat,
  cashSeatName,
  allSettledCopy,
} from '../settlementsSection';

// Pins for the deletion-guard client behavior on the money-critical SessionScreen.
// Literals are pinned as LITERALS (repo standing rule) — the sibling wiring test
// (screens/__tests__/sessionScreenSettlementsWiring.test.ts) pins that SessionScreen
// actually consumes these helpers, so reverting the screen half goes red there.

describe('refusalMessage — 400 means the server REFUSED; anything else is transient', () => {
  it('surfaces the server message on a 400', () => {
    expect(refusalMessage(400, 'This session includes a player whose account was deleted…')).toBe(
      'This session includes a player whose account was deleted…',
    );
  });

  it('falls back to the pinned literal when a 400 carries no message', () => {
    expect(refusalMessage(400, undefined)).toBe(CALC_BLOCKED_FALLBACK);
    expect(refusalMessage(400, null)).toBe(CALC_BLOCKED_FALLBACK);
    expect(CALC_BLOCKED_FALLBACK).toBe('Settlements can’t be calculated for this game.');
  });

  it('returns null for non-400 failures — those are retryable and must not set the blocked state', () => {
    expect(refusalMessage(500, 'boom')).toBeNull();
    expect(refusalMessage(undefined, 'network down')).toBeNull();
    expect(refusalMessage(403, 'nope')).toBeNull();
  });
});

describe('isCashSeat — which seats settle in cash', () => {
  it('includes a plain walk-in guest', () => {
    expect(isCashSeat({ isGuest: true })).toBe(true);
  });

  it('excludes a guest linked to a live account (they settle digitally)', () => {
    expect(isCashSeat({ isGuest: true, linkedUserId: 'u1' })).toBe(false);
  });

  it('excludes an ordinary registered player', () => {
    expect(isCashSeat({ isGuest: false, userId: 'u1' })).toBe(false);
  });

  it('includes the DEPARTED shape: a registered-style seat whose account was deleted', () => {
    // Without this, a reload dropped the departed cash line and the screen rendered
    // "All settled up! Everyone's even." while a survivor was still owed cash —
    // fleet-demonstrated (2026-08-04), the false-all-clear class this repo pins.
    expect(isCashSeat({ isGuest: false })).toBe(true);
    expect(isCashSeat({ isGuest: false, userId: undefined })).toBe(true);
  });
});

describe('cashSeatName — honest labels on cash lines', () => {
  it('keeps the guest name the host recorded', () => {
    expect(cashSeatName({ isGuest: true, username: 'Dan (guest)' })).toBe('Dan (guest)');
  });

  it('labels the departed seat with the same literal the server uses', () => {
    // Must stay equal to the GuestBalanceDto placeholder in
    // CalculateSettlementsCommandHandler — one seat, one label on both surfaces.
    expect(cashSeatName({ isGuest: false, username: 'Unknown' })).toBe('Departed player');
  });
});

describe('allSettledCopy — the all-clear may only be claimed when it is true', () => {
  it('celebrates only when no cash is outstanding', () => {
    expect(allSettledCopy(false)).toEqual({
      title: 'All settled up!',
      sub: "Everyone's even. See you next game.",
    });
  });

  it('says digital-only when cash balances remain', () => {
    expect(allSettledCopy(true)).toEqual({
      title: 'Digital transfers settled',
      sub: 'Registered players are square — cash balances below.',
    });
  });
});
