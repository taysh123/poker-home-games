/**
 * Pure decision for whether a visitor should see the web-only Landing page.
 * Kept side-effect-free so it is unit-testable without React Navigation; the
 * navigator consumes it (see AppNavigator). Deep links (/join/*) bypass Landing.
 */
export type RoutePlatform = 'web' | 'ios' | 'android';
export type RouteInput = { platform: RoutePlatform; isAuthed: boolean; path: string };

export function isDeepLinkPath(path: string): boolean {
  return /^\/?join\/(group|session)\//.test(path);
}

export function resolveWebLanding({ platform, isAuthed, path }: RouteInput): boolean {
  if (platform !== 'web') return false;
  if (isAuthed) return false;
  if (isDeepLinkPath(path)) return false;
  const normalized = path.replace(/^\//, '').replace(/\/$/, '');
  return normalized === '' || normalized === 'landing';
}
