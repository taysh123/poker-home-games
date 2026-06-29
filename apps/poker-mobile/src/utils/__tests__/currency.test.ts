import {
  formatIntlCents, formatIntlMajor, currencySymbol, isSupported,
  getActiveCurrency, setActiveCurrency, SUPPORTED_CURRENCIES,
} from '../currency';
import { formatCents, formatCentsSigned } from '../money';

afterEach(() => setActiveCurrency('ILS')); // restore default for other suites

describe('SUPPORTED_CURRENCIES', () => {
  it('covers exactly the 6 supported codes', () => {
    expect(SUPPORTED_CURRENCIES.map(c => c.code).sort()).toEqual(['AUD', 'CAD', 'EUR', 'GBP', 'ILS', 'USD']);
  });
  it('isSupported guards unknown codes', () => {
    expect(isSupported('USD')).toBe(true);
    expect(isSupported('JPY')).toBe(false);
    expect(isSupported(null)).toBe(false);
  });
});

describe('formatIntlCents (non-ILS)', () => {
  it('adds grouping + 2dp and trims trailing .00', () => {
    expect(formatIntlCents(123450, 'USD')).toBe('$1,234.50');
    expect(formatIntlCents(5000, 'USD')).toBe('$50');
    expect(formatIntlCents(-4000, 'USD')).toBe('-$40');
  });
  it('uses distinct symbols per currency', () => {
    expect(formatIntlCents(5000, 'EUR')).toBe('€50');
    expect(formatIntlCents(5000, 'GBP')).toBe('£50');
    expect(formatIntlCents(5000, 'CAD')).toBe('CA$50');
    expect(formatIntlCents(5000, 'AUD')).toBe('A$50');
  });
});

describe('formatIntlMajor (non-ILS)', () => {
  it('formats whole + fractional major units', () => {
    expect(formatIntlMajor(1234, 'USD', 0)).toBe('$1,234');
    expect(formatIntlMajor(50.5, 'USD', 2)).toBe('$50.5');
  });
});

describe('currencySymbol', () => {
  it('returns the configured symbol', () => {
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('ILS')).toBe('₪');
  });
});

describe('active currency drives money.ts default', () => {
  it('defaults to ILS legacy format (prod parity)', () => {
    expect(getActiveCurrency()).toBe('ILS');
    expect(formatCents(5050)).toBe('₪50.50');
    expect(formatCents(5000)).toBe('₪50');
    expect(formatCentsSigned(4000)).toBe('+₪40');
  });
  it('switches all formatters when the active currency changes', () => {
    setActiveCurrency('USD');
    expect(formatCents(5050)).toBe('$50.50');
    expect(formatCentsSigned(4000)).toBe('+$40');
  });
  it('an explicit code overrides the active currency (per-session future-proofing)', () => {
    setActiveCurrency('USD');
    expect(formatCents(5050, 'EUR')).toBe('€50.50');
    expect(formatCents(5050, 'ILS')).toBe('₪50.50');
  });
});
