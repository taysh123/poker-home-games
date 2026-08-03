import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Segmented has NO render test anywhere in the repo (confirmed by mutation run: deleting or
 * freezing `aria-selected` survived a full `npx jest` untouched, and grepping every __tests__
 * directory for both "aria-selected" and "<Segmented" returns nothing). `controls.test.ts` only
 * imports Segmented's pure helpers (`clampIndex`, `segmentThumbOffset`), never the component.
 *
 * A render test would not close the gap even if one existed: jest-expo runs real react-native, not
 * react-native-web, and RN's own View.js merges the flat `aria-*` prop into `accessibilityState`
 * before any test can read it — so a rendered assertion cannot distinguish "twin present" from
 * "twin absent" in this environment (confirmed on the identical LoginScreen case,
 * `screens/__tests__/LoginScreen.test.tsx`). The one place the twin matters — react-native-web,
 * which drops accessibilityState and reads only the flat prop — is never exercised here.
 *
 * So this is a SOURCE check, the same tradeoff already accepted for GroupsListScreen's wiring pin
 * (`utils/__tests__/groupRow.test.ts`). It proves the twin exists in source; it cannot prove it
 * reaches the DOM correctly on web.
 */
describe('Segmented — the aria-selected web twin exists in source', () => {
  it('every segment carries the flat aria-selected twin, tracking isSelected', () => {
    const src = readFileSync(join(__dirname, '..', 'Segmented.tsx'), 'utf8');
    expect(src).toMatch(/aria-selected=\{\s*isSelected\s*\}/);
  });
});
