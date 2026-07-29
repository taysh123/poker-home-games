import { formatMoney } from './formatters';

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
