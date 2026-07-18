/**
 * TDD: pure sourceForVariant mapping.
 * Each variant must return a distinct, defined Lottie source; the default must equal 'celebration'.
 * This is a pure-logic test (no RN rendering) so it runs in the Node/jest-expo environment.
 */
import { sourceForVariant } from '../Celebration';

describe('sourceForVariant — maps CelebrationVariant to Lottie asset', () => {
  it('returns a defined source for "celebration"', () => {
    expect(sourceForVariant('celebration')).toBeDefined();
  });

  it('returns a defined source for "achievement"', () => {
    expect(sourceForVariant('achievement')).toBeDefined();
  });

  it('returns a defined source for "success"', () => {
    expect(sourceForVariant('success')).toBeDefined();
  });

  it('all three variants return distinct sources (different require() targets)', () => {
    const celebration = sourceForVariant('celebration');
    const achievement = sourceForVariant('achievement');
    const success = sourceForVariant('success');
    // Different JSON files → different object references
    expect(achievement).not.toBe(celebration);
    expect(success).not.toBe(celebration);
    expect(success).not.toBe(achievement);
  });

  it('calling with no argument defaults to the "celebration" source', () => {
    // Require is cached by Node, so same file → identical reference
    expect(sourceForVariant()).toBe(sourceForVariant('celebration'));
  });
});
