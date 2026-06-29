/**
 * Global currency readiness (V2.1 STEP 3.5) — DISPLAY ONLY. No FX, no rates, no conversion: amounts
 * stay integer cents; only the symbol/format changes. A module-level "active currency" (default ILS)
 * is read by the formatters when no explicit code is passed, so ~all call sites are currency-aware with
 * no churn — and an explicit `code` arg keeps per-session / multi-currency future-proof.
 *
 * ILS keeps its bespoke format (handled in utils/money.ts) so prod (flag off) is byte-identical; the
 * other 5 currencies use Intl.NumberFormat. English-only app ⇒ fixed 'en-US' locale for consistent
 * symbol placement.
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'ILS' | 'CAD' | 'AUD';

export interface CurrencyDef { code: CurrencyCode; symbol: string; label: string }

export const SUPPORTED_CURRENCIES: CurrencyDef[] = [
  { code: 'USD', symbol: '$',   label: 'US Dollar' },
  { code: 'EUR', symbol: '€',   label: 'Euro' },
  { code: 'GBP', symbol: '£',   label: 'British Pound' },
  { code: 'ILS', symbol: '₪',   label: 'Israeli Shekel' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',  label: 'Australian Dollar' },
];

const BY_CODE = Object.fromEntries(SUPPORTED_CURRENCIES.map(c => [c.code, c])) as Record<CurrencyCode, CurrencyDef>;

export function isSupported(code: string | null | undefined): code is CurrencyCode {
  return !!code && Object.prototype.hasOwnProperty.call(BY_CODE, code);
}

// Module-level active currency (default ILS). Set by CurrencyContext; read as the formatter default.
let active: CurrencyCode = 'ILS';
export function getActiveCurrency(): CurrencyCode { return active; }
export function setActiveCurrency(code: CurrencyCode): void { if (isSupported(code)) active = code; }

export function currencySymbol(code: CurrencyCode = active): string {
  return BY_CODE[code]?.symbol ?? '₪';
}

const FORMAT_LOCALE = 'en-US';
const trimZeros = (s: string): string => s.replace(/\.00$/, '');

/** Format integer cents in a NON-ILS currency via Intl (grouping + 2dp, trailing .00 trimmed). */
export function formatIntlCents(cents: number, code: CurrencyCode): string {
  const neg = cents < 0;
  const major = Math.abs(cents) / 100;
  const s = new Intl.NumberFormat(FORMAT_LOCALE, { style: 'currency', currency: code }).format(major);
  return (neg ? '-' : '') + trimZeros(s);
}

/** Format a major-unit amount in a NON-ILS currency via Intl. */
export function formatIntlMajor(value: number, code: CurrencyCode, maxFractionDigits = 2): string {
  const neg = value < 0;
  const s = new Intl.NumberFormat(FORMAT_LOCALE, {
    style: 'currency', currency: code, minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits,
  }).format(Math.abs(value));
  return (neg ? '-' : '') + s;
}

/** First-launch default: the device locale's currency if supported, else USD. Lazy-loads expo-localization. */
export function detectDefaultCurrency(): CurrencyCode {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Localization = require('expo-localization');
    const locales = Localization.getLocales?.() ?? [];
    const cc = locales[0]?.currencyCode;
    if (isSupported(cc)) return cc;
  } catch { /* fall through */ }
  return 'USD';
}
