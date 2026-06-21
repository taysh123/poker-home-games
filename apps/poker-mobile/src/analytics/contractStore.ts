/**
 * Analytics contract store (PR #8) — flag-gated, lazy loader for the bundled analytics contract artifact.
 *
 * Inert when the `content` flag is OFF (production): returns null WITHOUT requiring the JSON, so production
 * is byte-identical. The contract itself (contract.ts) and adapter (adapter.ts) are pure and can be used in
 * tests without the loader. Bundled (not network) → web + native, no I/O.
 */
import { isFeatureEnabled } from '../config/features';
import { buildAnalyticsContract, type AnalyticsContract, type AnalyticsContractData } from './contract';

let cached: AnalyticsContract | null = null;
let attempted = false;

export function loadAnalyticsContract(): AnalyticsContract | null {
  if (!isFeatureEnabled('content')) return null;
  if (attempted) return cached;
  attempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('../../assets/content/0.8.0/analytics_contract.json') as AnalyticsContractData;
    cached = buildAnalyticsContract(data);
  } catch {
    cached = null;
  }
  return cached;
}

/** Test-only: clear the memoized contract so a test can re-run the loader. */
export function __resetAnalyticsContractForTests(): void {
  cached = null;
  attempted = false;
}
