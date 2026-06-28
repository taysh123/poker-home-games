/**
 * Named z-index scale — use these instead of hardcoded `zIndex` values so the
 * stacking order stays predictable across overlays, sheets, modals, and toasts.
 *
 * base    — in-flow content (default)
 * raised  — pressed/elevated cards, floating action chrome
 * sticky  — sticky headers / bottom bars that pin above scrolling content
 * overlay — scrims & backdrops behind a sheet/menu
 * modal   — modal + bottom-sheet surfaces (above their own backdrop)
 * toast   — transient feedback, always on top
 */
export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 20,
  overlay: 40,
  modal: 100,
  toast: 1000,
} as const;

export type ZIndexToken = keyof typeof zIndex;
