import { buildInviteMessage, formatInviteExpiry } from '../invite';

describe('buildInviteMessage — matches the existing share copy', () => {
  it('group invite reads "Join \\"X\\" on T Poker: <url>"', () => {
    expect(buildInviteMessage('group', 'Friday Game', 'https://app.tpoker.app/join/group/abc')).toBe(
      'Join "Friday Game" on T Poker: https://app.tpoker.app/join/group/abc',
    );
  });

  it('session invite reads "Join my poker session \\"X\\"!\\n\\n<url>"', () => {
    expect(buildInviteMessage('session', 'Home Game', 'https://app.tpoker.app/join/session/xyz')).toBe(
      'Join my poker session "Home Game"!\n\nhttps://app.tpoker.app/join/session/xyz',
    );
  });
});

describe('formatInviteExpiry', () => {
  const now = Date.parse('2026-07-24T12:00:00.000Z');
  const iso = (deltaMs: number) => new Date(now + deltaMs).toISOString();
  const HOUR = 60 * 60 * 1000;

  it('returns null when there is no expiry or the value is unparseable', () => {
    expect(formatInviteExpiry(undefined, now)).toBeNull();
    expect(formatInviteExpiry('not-a-date', now)).toBeNull();
  });

  it('reports an expired invite', () => {
    expect(formatInviteExpiry(iso(-1), now)).toBe('This invite has expired');
    expect(formatInviteExpiry(iso(0), now)).toBe('This invite has expired');
  });

  it('reports hours under two days, singular at one hour', () => {
    expect(formatInviteExpiry(iso(24 * HOUR), now)).toBe('Expires in 24 hours');
    expect(formatInviteExpiry(iso(1 * HOUR), now)).toBe('Expires in 1 hour');
    expect(formatInviteExpiry(iso(30 * 60 * 1000), now)).toBe('Expires in 1 hour'); // ceil of 0.5h
  });

  it('reports whole days at 48h and beyond', () => {
    expect(formatInviteExpiry(iso(72 * HOUR), now)).toBe('Expires in 3 days');
    expect(formatInviteExpiry(iso(48 * HOUR), now)).toBe('Expires in 2 days');
  });
});
