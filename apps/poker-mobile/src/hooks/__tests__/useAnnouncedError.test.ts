import { AccessibilityInfo } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useAnnouncedError } from '../useAnnouncedError';

/**
 * Form errors must be SPOKEN, not merely drawn.
 *
 * `accessibilityLiveRegion` + `accessibilityRole="alert"` cover Android and web, and cover NOTHING
 * on iOS: RN maps the alert role to `UIAccessibilityTraitNone` and ships no iOS implementation of
 * live regions at all (no `liveRegion` anywhere under `React/`). Relying on the props alone left
 * auth failures silent on the platform this app shipped on first — hidden behind a comment
 * claiming they were announced.
 *
 * Extracted so the two hand-rolled forms (CreateGroup/EditGroup) get the same behaviour as
 * AppTextInput instead of a second copy that drifts.
 */
describe('useAnnouncedError', () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it('announces an error when it appears', () => {
    renderHook(({ e }) => useAnnouncedError(e), { initialProps: { e: 'Group name is required' } });
    expect(spy).toHaveBeenCalledWith('Group name is required');
  });

  it('says nothing when there is no error', () => {
    renderHook(({ e }) => useAnnouncedError(e), { initialProps: { e: undefined as string | undefined } });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not repeat an unchanged error on re-render', () => {
    const { rerender } = renderHook(({ e }) => useAnnouncedError(e), { initialProps: { e: 'Nope' } });
    rerender({ e: 'Nope' });
    rerender({ e: 'Nope' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('announces a DIFFERENT error', () => {
    const { rerender } = renderHook(({ e }) => useAnnouncedError(e), { initialProps: { e: 'First' } });
    rerender({ e: 'Second' });
    expect(spy).toHaveBeenNthCalledWith(2, 'Second');
  });

  it('re-announces the same error after it clears and returns', () => {
    // Submitting twice with the same mistake must speak twice — otherwise the second attempt
    // appears to have silently succeeded.
    const { rerender } = renderHook(({ e }) => useAnnouncedError(e), {
      initialProps: { e: 'Nope' as string | undefined },
    });
    rerender({ e: undefined });
    rerender({ e: 'Nope' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
