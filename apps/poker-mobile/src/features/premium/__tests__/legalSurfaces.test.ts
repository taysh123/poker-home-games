/**
 * Legal surface guards — keep the commercial/legal surfaces honest and present:
 *  - terms.html exists and is clearly marked a counsel-owned DRAFT (never presented as final/binding);
 *  - it carries the platform-required subscription disclosures (auto-renew, cancel, eligibility, contact);
 *  - the Terms link is wired from both the Paywall and the Profile screen.
 * Reads files directly (no React render) so it is fast and deterministic.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');

describe('terms.html — counsel-owned draft, honest disclosures', () => {
  const terms = read('../../../../public/terms.html');

  it('is explicitly a non-binding draft pending legal review', () => {
    expect(terms).toMatch(/DRAFT/);
    expect(terms).toMatch(/PENDING LEGAL REVIEW/i);
    expect(terms).toMatch(/not.*legal advice/i);
    expect(terms).toMatch(/not yet (in effect|binding)/i);
    expect(terms).toMatch(/\[counsel-owned\]/i);
  });

  it('carries the subscription / auto-renew / eligibility / contact disclosures', () => {
    expect(terms).toMatch(/auto-renew/i);
    expect(terms).toMatch(/cancel/i);
    expect(terms).toMatch(/18 and older/i);
    expect(terms).toMatch(/truestorylabs@gmail\.com/);
  });

  it('does not falsely claim real-money gambling', () => {
    expect(terms).toMatch(/not.*real-money gambling/i);
  });
});

describe('Terms link presence', () => {
  it('is linked from the Paywall screen', () => {
    expect(read('../ui/PaywallScreen.tsx')).toMatch(/terms\.html/);
  });

  it('is linked from the Profile screen', () => {
    expect(read('../../../screens/ProfileScreen.tsx')).toMatch(/terms\.html/);
  });
});
