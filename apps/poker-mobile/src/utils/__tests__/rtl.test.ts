import { isRtlText, nameWritingDirection } from '../rtl';

describe('isRtlText', () => {
  it('is true for a Hebrew name', () => {
    expect(isRtlText('דני')).toBe(true);
  });

  it('is true for an Arabic name', () => {
    expect(isRtlText('محمد')).toBe(true);
  });

  it('is false for a Latin name', () => {
    expect(isRtlText('Dani')).toBe(false);
  });

  it('is true for a mixed name containing any RTL character', () => {
    expect(isRtlText('Dani דני')).toBe(true);
  });

  it('is false for digits and punctuation only', () => {
    expect(isRtlText('123 - 45')).toBe(false);
  });

  it('is false for empty / null / undefined', () => {
    expect(isRtlText('')).toBe(false);
    expect(isRtlText(null)).toBe(false);
    expect(isRtlText(undefined)).toBe(false);
  });
});

describe('nameWritingDirection', () => {
  it('returns rtl for an RTL name', () => {
    expect(nameWritingDirection('דני')).toBe('rtl');
  });

  it('returns ltr for a Latin name', () => {
    expect(nameWritingDirection('Dani')).toBe('ltr');
  });

  it('returns ltr for empty input', () => {
    expect(nameWritingDirection('')).toBe('ltr');
  });
});
