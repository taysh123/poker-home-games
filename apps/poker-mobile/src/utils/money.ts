/** Helpers for integer-cent amounts. Currency-aware (V2.1 STEP 3.5): ILS keeps its bespoke format
 *  (unchanged); other currencies use Intl. `code` defaults to the active currency (ILS until set). */
import { getActiveCurrency, formatIntlCents, type CurrencyCode } from './currency';

/** ILS bespoke format (legacy, unchanged): 5050 → "₪50.50", 5000 → "₪50", -4000 → "-₪40". */
function formatIls(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return frac === 0
    ? `${sign}₪${whole}`
    : `${sign}₪${whole}.${String(frac).padStart(2, '0')}`;
}

export function formatCents(cents: number, code: CurrencyCode = getActiveCurrency()): string {
  return code === 'ILS' ? formatIls(cents) : formatIntlCents(cents, code);
}

/** Signed variant for P&L display: 4000 → "+₪40" / "+$40". */
export function formatCentsSigned(cents: number, code: CurrencyCode = getActiveCurrency()): string {
  return cents > 0 ? `+${formatCents(cents, code)}` : formatCents(cents, code);
}

/** "50" → 5000, "50.5" → 5050, "" / "abc" / negative → null. */
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  const cents = parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0') || '0', 10);
  return cents > 0 ? cents : null;
}
