import { resolveWebLanding, isDeepLinkPath } from '../landingRouting';

describe('isDeepLinkPath', () => {
  it('flags join deep links', () => {
    expect(isDeepLinkPath('/join/group/abc123')).toBe(true);
    expect(isDeepLinkPath('/join/session/xyz')).toBe(true);
  });
  it('does not flag the root or landing', () => {
    expect(isDeepLinkPath('/')).toBe(false);
    expect(isDeepLinkPath('/landing')).toBe(false);
  });
});

describe('resolveWebLanding', () => {
  it('shows Landing for a logged-out web visitor at root', () => {
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '/' })).toBe(true);
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '' })).toBe(true);
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '/landing' })).toBe(true);
  });

  it('sends a logged-in web user to the app, not Landing', () => {
    expect(resolveWebLanding({ platform: 'web', isAuthed: true, path: '/' })).toBe(false);
  });

  it('bypasses Landing for deep links even when logged out', () => {
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '/join/group/abc' })).toBe(false);
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '/join/session/abc' })).toBe(false);
  });

  it('never shows Landing on native', () => {
    expect(resolveWebLanding({ platform: 'ios', isAuthed: false, path: '/' })).toBe(false);
    expect(resolveWebLanding({ platform: 'android', isAuthed: false, path: '/' })).toBe(false);
  });
});
