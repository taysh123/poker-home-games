/**
 * Icon sizing scale — keep Ionicons / SVG glyphs on a fixed rhythm instead of
 * sprinkling arbitrary 18/22/26 values. `md` (24) is the everyday default.
 *
 * xs — inline-with-caption glyphs        sm — list-row / chip icons
 * md — default action & nav icons        lg — feature / header icons
 * xl — hero / empty-state illustrations
 */
export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
} as const;

export type IconSizeToken = keyof typeof iconSize;
