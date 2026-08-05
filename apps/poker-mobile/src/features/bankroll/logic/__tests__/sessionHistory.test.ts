import { SESSION_PAGE_SIZE, historyPage } from '../sessionHistory';

const items = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

describe('SESSION_PAGE_SIZE', () => {
  it('is pinned to a literal, not derived', () => {
    expect(SESSION_PAGE_SIZE).toBe(20);
  });
});

describe('historyPage', () => {
  it('shows everything and offers no more when the list is short', () => {
    expect(historyPage(items(5), SESSION_PAGE_SIZE)).toEqual({
      visible: items(5), remaining: 0, hasMore: false,
    });
  });

  it('offers no more when the list ends exactly on the page boundary', () => {
    const page = historyPage(items(20), 20);
    expect(page.visible).toHaveLength(20);
    expect(page.hasMore).toBe(false);
    expect(page.remaining).toBe(0);
  });

  it('truncates and reports what is left', () => {
    const page = historyPage(items(53), 20);
    expect(page.visible).toHaveLength(20);
    expect(page.visible[0]).toBe('s0');
    expect(page.visible[19]).toBe('s19');
    expect(page.remaining).toBe(33);
    expect(page.hasMore).toBe(true);
  });

  it('clamps a visibleCount past the end instead of reporting a negative remainder', () => {
    // `remaining` is the assertion that gives this test teeth. Array.slice already refuses to
    // pad past the end, so length/hasMore hold with or without the clamp — only `remaining`
    // distinguishes them, and an unclamped count yields -996 here, which would render as
    // "Show -996 more" the moment any caller trusted it.
    const page = historyPage(items(3), 999);
    expect(page.visible).toHaveLength(3);
    expect(page.visible).not.toContain(undefined);
    expect(page.remaining).toBe(0);
    expect(page.hasMore).toBe(false);
  });

  it('treats a negative or non-finite count as zero visible', () => {
    expect(historyPage(items(5), -10).visible).toEqual([]);
    expect(historyPage(items(5), NaN).visible).toEqual([]);
    expect(historyPage(items(5), -10).remaining).toBe(5);
  });

  it('handles an empty list without claiming there is more', () => {
    expect(historyPage([], 20)).toEqual({ visible: [], remaining: 0, hasMore: false });
  });
});
