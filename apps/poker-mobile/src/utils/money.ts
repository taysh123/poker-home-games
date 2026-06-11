/** Helpers for integer-cent amounts used by local (guest-mode) games. */

/** 5050 → "₪50.50", 5000 → "₪50", -4000 → "-₪40" */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return frac === 0
    ? `${sign}₪${whole}`
    : `${sign}₪${whole}.${String(frac).padStart(2, '0')}`;
}

/** Signed variant for P&L display: 4000 → "+₪40". */
export function formatCentsSigned(cents: number): string {
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

/** "50" → 5000, "50.5" → 5050, "" / "abc" / negative → null. */
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  const cents = parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0') || '0', 10);
  return cents > 0 ? cents : null;
}
