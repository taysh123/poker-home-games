/**
 * The one support address. Previously duplicated across ProfileScreen, PaywallScreen and the
 * shipped policy HTML; the TypeScript call sites now share this constant.
 *
 * NOTE: `public/*.html` deliberately keeps its literal — those are shipped assets pinned by
 * features/premium/__tests__/legalSurfaces.test.ts, and templatising them would break that pin
 * for no benefit.
 */
export const SUPPORT_EMAIL = 'truestorylabs@gmail.com';

export function supportMailto(subject: string, body?: string): string {
  const parts = [`subject=${encodeURIComponent(subject)}`];
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${SUPPORT_EMAIL}?${parts.join('&')}`;
}
