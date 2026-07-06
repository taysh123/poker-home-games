/**
 * Entrance recipes — pure config producers. The `play` gate is what keeps the
 * entry-experience choreography from running invisibly under the launch splash
 * (it holds elements at their hidden start state until the splash resolves).
 */
import { slideUpSequence, staggerIn } from '../recipes';

describe('slideUpSequence', () => {
  it('default: fades in and rises with the configured delay/duration', () => {
    const r = slideUpSequence({ delay: 140, duration: 320 });
    expect(r.from).toEqual({ opacity: 0, translateY: 12 });
    expect(r.animate).toEqual({ opacity: 1, translateY: 0 });
    expect(r.transition).toEqual({ type: 'timing', duration: 320, delay: 140 });
  });

  it('play:false holds the element hidden at its start state (no motion, no reveal)', () => {
    const r = slideUpSequence({ delay: 140, duration: 320, play: false });
    expect(r.animate.opacity).toBe(0);
    expect(r.from.opacity).toBe(0);
  });

  it('play flips true → the entrance runs with its original stagger delay', () => {
    const held = slideUpSequence({ delay: 70, play: false });
    const released = slideUpSequence({ delay: 70, play: true });
    expect(held.animate.opacity).toBe(0);
    expect(released.animate.opacity).toBe(1);
    expect(released.transition).toEqual({ type: 'timing', duration: expect.any(Number), delay: 70 });
  });

  it('reduced motion: instant at rest when playing; held stays put without translate', () => {
    const playing = slideUpSequence({ reduced: true, delay: 70 });
    expect(playing.from).toEqual({ opacity: 1, translateY: 0 });
    expect(playing.transition).toEqual({ type: 'timing', duration: 0, delay: 0 });
    const held = slideUpSequence({ reduced: true, delay: 70, play: false });
    expect(held.animate.opacity).toBe(0);
    expect(held.animate.translateY).toBe(0);
  });
});

describe('staggerIn', () => {
  it('spaces items by step from an optional base offset', () => {
    expect(staggerIn(0)).toBe(0);
    expect(staggerIn(2)).toBe(80);
    expect(staggerIn(2, 40, 140)).toBe(220);
    expect(staggerIn(0, 40, 140)).toBe(140);
  });
});
