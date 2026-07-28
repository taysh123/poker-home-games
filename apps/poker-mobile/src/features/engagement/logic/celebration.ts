/**
 * Celebration-visibility derivation — PURE, so every term can be pinned.
 *
 * This lived as an inline expression in EngagementContext's `value`. A mutation run proved that
 * form untestable: dropping `enabled` and dropping `celebrate` BOTH survived the provider-level
 * suite. The `enabled` term in particular is unreachable through the provider (with retention off
 * the evaluate effect early-returns, so the queue never populates), which means it can never be
 * exercised from the outside no matter how the test is written.
 *
 * Extracting it turns three unpinnable terms into a three-input truth table.
 */
export interface CelebrationState {
  /** The `retention` flag. Both celebration renders are gated on it. */
  enabled: boolean;
  /** Length of the pending achievement-unlock queue. */
  unlockQueueLength: number;
  /** The rank-up burst. */
  celebrate: boolean;
}

/**
 * True while ANY celebration EngagementContext owns is on screen.
 *
 * `enabled` is load-bearing even though it is currently unreachable: with `retention` OFF nothing
 * can render, and a consumer told "celebrating" would wait forever. It is defence against a future
 * change to the evaluate effect, not dead weight — and it is pinned here rather than claimed.
 */
export function deriveIsCelebrating({ enabled, unlockQueueLength, celebrate }: CelebrationState): boolean {
  return enabled && (unlockQueueLength > 0 || celebrate);
}
