/**
 * RTL-aware helpers for user-entered names. The app UI is English/LTR, but player NAMES are user data
 * and may be right-to-left (Hebrew/Arabic). They must render in their natural direction and ellipsize
 * on the correct side — never reversed or clipped on the wrong end. PURE + testable.
 *
 * Apply `writingDirection: nameWritingDirection(name)` to any Text that renders a player name on a
 * table screen (seats, lists, cards).
 */

// Strong RTL code-point ranges (kept as numeric literals so the source stays pure ASCII / encoding-safe):
//   Hebrew 0590-05FF · Arabic/Syriac/Thaana/NKo/Arabic-Supplement 0600-07FF · Arabic Extended-A 08A0-08FF
//   Hebrew + Arabic presentation forms FB1D-FDFF and FE70-FEFF.
// A single strong-RTL character is enough to treat a name as RTL.
function isRtlCodePoint(c: number): boolean {
  return (
    (c >= 0x0590 && c <= 0x05ff) ||
    (c >= 0x0600 && c <= 0x07ff) ||
    (c >= 0x08a0 && c <= 0x08ff) ||
    (c >= 0xfb1d && c <= 0xfdff) ||
    (c >= 0xfe70 && c <= 0xfeff)
  );
}

/** True if the string contains any strong right-to-left (Hebrew/Arabic/...) character. */
export function isRtlText(s: string | null | undefined): boolean {
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    if (isRtlCodePoint(s.charCodeAt(i))) return true;
  }
  return false;
}

/** `writingDirection` value for a name Text: 'rtl' for RTL names, otherwise 'ltr'. */
export function nameWritingDirection(s: string | null | undefined): 'rtl' | 'ltr' {
  return isRtlText(s) ? 'rtl' : 'ltr';
}
