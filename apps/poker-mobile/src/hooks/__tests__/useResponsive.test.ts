import { breakpointFor } from '../useResponsive';

describe('useResponsive breakpoints', () => {
  it('maps widths to breakpoints', () => {
    expect(breakpointFor(320)).toBe('mobile');
    expect(breakpointFor(767)).toBe('mobile');
    expect(breakpointFor(768)).toBe('tablet');
    expect(breakpointFor(1023)).toBe('tablet');
    expect(breakpointFor(1024)).toBe('desktop');
    expect(breakpointFor(1920)).toBe('desktop');
  });
});
