/**
 * Border-radius scale — the app standardizes on these four stops.
 * sm: chips/inputs/small buttons · md: list rows, inner cards ·
 * lg: cards/sheets (the default) · xl: hero cards/modals.
 */
export const radii = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  /** Form controls (inputs, buttons) — 12, sits between sm and md. */
  control: 12,
  pill: 999,
} as const;
