import { formatCents, formatCentsSigned, parseAmountToCents } from '../money';

describe('formatCents', () => {
  it('formats whole amounts without decimals', () => {
    expect(formatCents(5000)).toBe('₪50');
    expect(formatCents(0)).toBe('₪0');
  });
  it('formats fractional amounts with two decimals', () => {
    expect(formatCents(5050)).toBe('₪50.50');
    expect(formatCents(5005)).toBe('₪50.05');
  });
  it('formats negatives with a leading minus', () => {
    expect(formatCents(-4000)).toBe('-₪40');
    expect(formatCents(-4050)).toBe('-₪40.50');
  });
});

describe('formatCentsSigned', () => {
  it('prefixes positives with +', () => {
    expect(formatCentsSigned(4000)).toBe('+₪40');
    expect(formatCentsSigned(-4000)).toBe('-₪40');
    expect(formatCentsSigned(0)).toBe('₪0');
  });
});

describe('parseAmountToCents', () => {
  it('parses whole and fractional inputs', () => {
    expect(parseAmountToCents('50')).toBe(5000);
    expect(parseAmountToCents('50.5')).toBe(5050);
    expect(parseAmountToCents('50.05')).toBe(5005);
    expect(parseAmountToCents('1,000')).toBe(100000);
  });
  it('rejects invalid input', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents('-5')).toBeNull();
    expect(parseAmountToCents('0')).toBeNull();
    expect(parseAmountToCents('5.123')).toBeNull();
  });
});
