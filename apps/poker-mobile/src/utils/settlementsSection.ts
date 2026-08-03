// Pure decisions for SessionScreen's settlements section, extracted so the
// deletion-guard client behavior is testable without mounting the 3k-line screen.
// Literal pins live in __tests__/settlementsSection.test.ts; the screen's
// consumption of these helpers is pinned by
// screens/__tests__/sessionScreenSettlementsWiring.test.ts.

export const CALC_BLOCKED_FALLBACK = 'Settlements can’t be calculated for this game.';

/**
 * Classify a calculateSettlements failure. HTTP 400 means the server REFUSED
 * (deleted player / orphaned money at this table) — retrying cannot succeed, so the
 * caller should record the reason and stop promising retries. Anything else is
 * transient and must NOT set the blocked state.
 */
export function refusalMessage(
  status: number | undefined,
  serverMessage: string | null | undefined,
): string | null {
  if (status !== 400) return null;
  return serverMessage ?? CALC_BLOCKED_FALLBACK;
}

/**
 * Which seats settle in cash: walk-in guests without a linked account, and the
 * DEPARTED shape — a registered-style seat whose account was deleted (userId
 * anonymised). Excluding the departed shape made the cash line vanish on reload
 * while money was still owed (fleet-demonstrated false all-clear, 2026-08-04).
 */
export function isCashSeat(p: { isGuest: boolean; linkedUserId?: string; userId?: string }): boolean {
  return (p.isGuest && !p.linkedUserId) || (!p.isGuest && !p.userId);
}

/**
 * MUST stay equal to the server's GuestBalanceDto placeholder in
 * CalculateSettlementsCommandHandler ("Departed player") so the same seat
 * carries one label whether the list came from a calculation result or a
 * client-side reload derivation.
 */
export const DEPARTED_PLAYER_LABEL = 'Departed player';

/** Label for a cash seat: the recorded guest name, or the departed placeholder. */
export function cashSeatName(p: { isGuest: boolean; username: string }): string {
  return p.isGuest ? p.username : DEPARTED_PLAYER_LABEL;
}

/**
 * Subtitle for the Cash Settlements section. The guest-specific rationale is a
 * false claim when a cash line belongs to a DEPARTED registered player (deleted
 * account) — copy-honesty rule 1: a claim must be true for who actually sees it.
 */
export function cashSectionSubtitle(hasDepartedSeat: boolean): string {
  return hasDepartedSeat
    ? "These players can't receive digital transfers — settle directly in cash."
    : "Guests can't receive digital transfers — settle these directly in cash.";
}

/**
 * The all-Confirmed celebration may only claim "everyone's even" when no cash
 * balances remain — with a departed player or guests still owed/owing cash, the
 * digital rows being settled is not the table being settled.
 */
export function allSettledCopy(cashOutstanding: boolean): { title: string; sub: string } {
  return cashOutstanding
    ? { title: 'Digital transfers settled', sub: 'Registered players are square — cash balances below.' }
    : { title: 'All settled up!', sub: "Everyone's even. See you next game." };
}
