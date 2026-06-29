/**
 * V2.1 — analytics seam: events buffer, and the onboarding signup-intent marker is single-use
 * (so account_created attributes to the funnel exactly once).
 */
jest.mock('../storage', () => {
  const mem: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (k: string) => (k in mem ? mem[k] : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => { mem[k] = v; }),
    deleteItemAsync: jest.fn(async (k: string) => { delete mem[k]; }),
  };
});

import { track, getBufferedEvents, markSignupIntent, consumeSignupIntent } from '../analytics';

describe('analytics.track', () => {
  it('buffers events with name + props', () => {
    track('onboarding_started');
    track('first_action_completed', { action: 'play' });
    const events = getBufferedEvents();
    const names = events.map(e => e.event);
    expect(names).toContain('onboarding_started');
    const fa = events.find(e => e.event === 'first_action_completed');
    expect(fa?.props).toMatchObject({ action: 'play' });
  });
});

describe('signup intent marker', () => {
  it('is single-use: first consume true, second false', async () => {
    await markSignupIntent();
    expect(await consumeSignupIntent()).toBe(true);
    expect(await consumeSignupIntent()).toBe(false);
  });

  it('returns false when never set', async () => {
    expect(await consumeSignupIntent()).toBe(false);
  });
});
