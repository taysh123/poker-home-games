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
