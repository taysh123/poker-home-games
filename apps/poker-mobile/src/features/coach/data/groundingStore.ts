/**
 * Coach grounding store — loads the bundled `coach_grounding.json` artifact and indexes it.
 *
 * Flag-gated + lazy: when the `content` flag is OFF (production), `loadGroundingIndex()`
 * returns `null` WITHOUT requiring the JSON, so production behavior is byte-identical (the
 * artifact is never parsed and the coach falls back to its existing, ungrounded path). The
 * artifact is bundled (not network/sqlite) so this works on web and native with no I/O.
 */
import { isFeatureEnabled } from '../../../config/features';
import { coachGroundingArtifact } from '../../../content/bundledArtifacts';
import { buildGroundingIndex, type GroundingDataset, type GroundingIndex } from '../logic/grounding';

let cached: GroundingIndex | null = null;
let attempted = false;

/**
 * Return the indexed coach grounding dataset, or `null` when the content flag is OFF or the
 * artifact is missing/unparseable. Result is memoized after the first successful (or failed)
 * attempt. The `require()` is inside the function so the JSON is only pulled in when the flag
 * is on and the index is first requested.
 */
export function loadGroundingIndex(): GroundingIndex | null {
  if (!isFeatureEnabled('content')) return null;
  if (attempted) return cached;
  attempted = true;
  try {
    const data = coachGroundingArtifact() as GroundingDataset;
    cached = buildGroundingIndex(data);
  } catch {
    cached = null; // missing/corrupt artifact → no grounding (coach keeps its ungrounded path)
  }
  return cached;
}

/** Test-only: clear the memoized index so a test can re-run the loader. */
export function __resetGroundingCacheForTests(): void {
  cached = null;
  attempted = false;
}
