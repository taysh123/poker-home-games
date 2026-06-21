/**
 * Design-system primitive logic tests (Phase 1). Follows the repo convention of testing PURE logic (no RN
 * render dependency): the Chip visual resolver and the StateView branch precedence.
 */
import { chipVisual } from '../chipVisual';
import { resolveStateBranch } from '../stateBranch';
import { colors } from '../../theme/colors';

describe('chipVisual — tone + solid + size resolver', () => {
  it('subtle (default) uses the tone faint bg + tone fg', () => {
    const v = chipVisual('gold', false, 'sm');
    expect(v.fg).toBe(colors.gold);
    expect(v.bg).toBe(colors.goldFaint);
    expect(v.border).toBe(colors.goldMuted);
  });

  it('solid flips fg to the on-accent (background) color and fills bg with the accent', () => {
    const v = chipVisual('gold', true, 'sm');
    expect(v.fg).toBe(colors.background); // on-accent — never gold-on-gold
    expect(v.bg).toBe(colors.gold);
    expect(v.border).toBe(colors.gold);
  });

  it('covers every tone with non-empty colors', () => {
    for (const tone of ['neutral', 'gold', 'success', 'error', 'warning', 'info'] as const) {
      const v = chipVisual(tone, false, 'sm');
      expect(v.fg.length).toBeGreaterThan(0);
      expect(v.bg.length).toBeGreaterThan(0);
      expect(v.border.length).toBeGreaterThan(0);
    }
  });

  it('size geometry is pinned (sm smaller than md; sm matches the chips it replaces)', () => {
    const sm = chipVisual('neutral', false, 'sm');
    const md = chipVisual('neutral', false, 'md');
    expect(sm.font).toBe(10);
    expect(md.font).toBe(11);
    expect(md.padH).toBeGreaterThanOrEqual(sm.padH);
  });
});

describe('resolveStateBranch — precedence error → loading → empty → content', () => {
  it('error wins over everything (incl. loading)', () => {
    expect(resolveStateBranch({ loading: true, error: true, isEmpty: true })).toBe('error');
    expect(resolveStateBranch({ loading: false, error: { title: 'x' }, isEmpty: false })).toBe('error');
  });
  it('loading wins over empty when no error', () => {
    expect(resolveStateBranch({ loading: true, error: false, isEmpty: true })).toBe('loading');
  });
  it('empty when not loading/error but empty', () => {
    expect(resolveStateBranch({ loading: false, isEmpty: true })).toBe('empty');
  });
  it('content when data present', () => {
    expect(resolveStateBranch({ loading: false, isEmpty: false })).toBe('content');
  });
});
