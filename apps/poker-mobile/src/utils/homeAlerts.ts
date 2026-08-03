import { formatMoney, formatPL } from './formatters';

/**
 * The two Home alert banners' copy, rendered AND announced from one place.
 *
 * Both banners are a title + subtitle inside a single touchable, so a screen reader reaches them as
 * ONE element and needs a composed name. Writing that name beside the JSX would mean stating the
 * plural rule and the owe/owed arithmetic twice — the exact drift that shipped on the group rows,
 * where the label said "1 session" while the row rendered "1 sessions". Pure and tested so the
 * money phrasing on the settlements banner is pinned rather than eyeballed.
 */
export type PendingSettlement = {
  payerUserId: string;
  receiverUserId: string;
  amount: number;
};

export type AlertCopy = { title: string; sub: string };

/** The pending-settlements banner. `sub` states the caller's own exposure, not the group's. */
export function settlementsAlertCopy(settlements: PendingSettlement[], userId?: string): AlertCopy {
  const owes = settlements
    .filter(s => s.payerUserId === userId)
    .reduce((sum, s) => sum + s.amount, 0);
  const owed = settlements
    .filter(s => s.receiverUserId === userId)
    .reduce((sum, s) => sum + s.amount, 0);

  const title = `${settlements.length} pending settlement${settlements.length !== 1 ? 's' : ''}`;
  if (owes > 0 && owed > 0) return { title, sub: `You owe ${formatMoney(owes)} · Owed ${formatMoney(owed)}` };
  if (owes > 0) return { title, sub: `You owe ${formatMoney(owes)}` };
  if (owed > 0) return { title, sub: `You're owed ${formatMoney(owed)}` };
  return { title, sub: 'Tap to view and settle up' };
}

/** The pending-invitations banner. */
export function invitationsAlertCopy(count: number): AlertCopy {
  return {
    title: `${count} group invitation${count !== 1 ? 's' : ''}`,
    sub: 'Tap to view and respond',
  };
}

/** The accessible name for a title+subtitle banner: what a sighted user reads, in reading order. */
export function alertLabel(copy: AlertCopy): string {
  return `${copy.title}. ${copy.sub}`;
}

/**
 * The top-group chip's text, shown and spoken.
 *
 * `formatPL`, never a hand-rolled sign plus `formatMoney`: formatMoney applies `Math.abs`, so the
 * chip rendered a LOSING top group as "₪450" with no minus at all. `topGroup` is chosen by
 * most-profitable (a reduce over myGroupPL), and `showTopGroup` only excludes null/zero — so a user
 * whose best group is still down reaches this branch and was told they were up.
 *
 * Extracted so that fix is PINNED. HomeScreen has no render harness, which is exactly how the bug
 * survived: adding an accessible name is what exposed it, and a name asserted against a literal
 * would never have noticed the visible half disagreeing.
 */
export function topGroupCopy(name: string, myGroupPL: number): AlertCopy {
  return { title: `Top group: ${name}`, sub: formatPL(myGroupPL) };
}

/** The chip's single visible line: "Top group: Poker Crew -₪450". */
export function topGroupText(name: string, myGroupPL: number): string {
  const copy = topGroupCopy(name, myGroupPL);
  return `${copy.title} ${copy.sub}`;
}

/** The chip's accessible name — the same words, comma-separated so the amount reads as its own clause. */
export function topGroupLabel(name: string, myGroupPL: number): string {
  const copy = topGroupCopy(name, myGroupPL);
  return `${copy.title}, ${copy.sub}`;
}
