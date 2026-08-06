/**
 * Month-calendar layout (B5) — pure. Grid geometry and month navigation, kept out of the
 * component so the tricky parts (leap years, week padding, year rollover) are unit-tested;
 * screens are not unit-tested in this repo, so anything worth pinning has to live here.
 *
 * Keys are built from LOCAL date components via localDayKey/localMonthKey — the UTC-ISO
 * shortcut is banned repo-wide by utils/__tests__/dayKeyBan.test.ts.
 */
import { localDayKey, localMonthKey } from '../../study/logic/localDay';

/** Column headers, Sunday-first. English only — i18n is explicitly out of scope for this app. */
export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Shift a 'YYYY-MM' key by whole months. `new Date(y, monthIndex, 1)` normalises an
 * out-of-range month index into the neighbouring year, so rollover needs no special case.
 */
export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  return localMonthKey(new Date(y, m - 1 + delta, 1));
}

/** 'June 2026'. A literal table, not toLocaleString — host ICU data varies across platforms. */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Which month the calendar should open on, in order of preference: the current month when it
 * has sessions; else the most recent PAST month that does; else the earliest FUTURE month that
 * does; else the current month.
 *
 * (The past-before-future ordering is the whole point of the fallback and was previously
 * omitted from this summary line, which read as if only past months were considered.)
 *
 * Opening unconditionally on "now" meant a player whose last game was last month landed on a
 * blank grid with nothing indicating their history was one tap back — a weak first impression
 * on a free headline pillar. Preferring the current month WHEN POPULATED matters too: jumping
 * straight to "most recent with data" would yank an active player backwards on the 1st of a new
 * month, before they had logged anything.
 *
 * `monthKeys` are the LOCAL month keys of the player's sessions, in any order.
 */
export function initialMonthKey(monthKeys: string[], today: Date = new Date()): string {
  const current = localMonthKey(today);
  if (monthKeys.includes(current)) return current;
  const sorted = [...monthKeys].sort();
  // Most recent past month, else the earliest future one — a session can be back-dated OR
  // forward-dated (the log form accepts any date), and landing on a blank grid while data
  // exists is the whole defect being fixed, whichever side of today that data sits on.
  const past = sorted.filter(k => k < current);
  if (past.length > 0) return past[past.length - 1];
  const future = sorted.filter(k => k > current);
  return future.length > 0 ? future[0] : current;
}

/**
 * Day keys for one month laid out in 7-column weeks, Sunday-first. `null` is a padding cell
 * (before the 1st / after the last) so the grid always renders whole rows. A month that both
 * starts on Sunday and divides evenly gets no padding at all (February 2026), and one that
 * starts late in the week needs six rows (August 2026).
 */
export function monthGridCells(monthKey: string): (string | null)[] {
  const [y, m] = monthKey.split('-').map(Number);
  const leadingBlanks = new Date(y, m - 1, 1).getDay();     // 0 = Sunday
  const daysInMonth = new Date(y, m, 0).getDate();          // day 0 of next month = last of this
  const cells: (string | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(localDayKey(new Date(y, m - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
