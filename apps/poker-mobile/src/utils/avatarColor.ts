/**
 * Single source of truth for avatar identity colors. Previously three screens
 * defined their own palettes + two different hash functions — never duplicate
 * this again; import from here.
 */

export const AVATAR_COLORS = [
  '#C9A84C', // gold
  '#5DA9E9', // sky
  '#E96D5D', // coral
  '#7BC47F', // green
  '#B97BD9', // violet
  '#E9A95D', // amber
  '#5DD9C1', // teal
  '#D95D8F', // rose
  '#8FA9C9', // steel
  '#C9C95D', // olive
] as const;

/** Deterministic color for a display name (polynomial hash, stable across screens). */
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
