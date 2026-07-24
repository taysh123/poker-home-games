/**
 * Pure invite helpers shared by the group + session invite flows (2.3 QR invites). Kept out of the
 * screens so the share copy and expiry formatting are testable without rendering. The copy mirrors
 * the existing one-tap Share text so the QR sheet's Share button behaves identically.
 */
export type InviteKind = 'group' | 'session';

/** The message used for the native Share sheet — byte-identical to the pre-2.3 inline strings. */
export function buildInviteMessage(kind: InviteKind, title: string, url: string): string {
  return kind === 'group'
    ? `Join "${title}" on T Poker: ${url}`
    : `Join my poker session "${title}"!\n\n${url}`;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Human expiry label for an invite token. `null` when there is no/invalid expiry (caller hides the
 * line). Hours under two days (so a 24h session token reads "24 hours"), whole days at 48h+.
 */
export function formatInviteExpiry(expiresAt: string | undefined, nowMs: number): string | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return null;
  const remaining = end - nowMs;
  if (remaining <= 0) return 'This invite has expired';
  const hours = Math.ceil(remaining / HOUR_MS);
  if (hours >= 48) {
    const days = Math.round(hours / 24);
    return `Expires in ${days} days`;
  }
  return `Expires in ${hours} hour${hours === 1 ? '' : 's'}`;
}
