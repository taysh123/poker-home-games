/**
 * Bankroll calendar/heatmap logic (B3) — pure functions, LOCAL calendar days/months via
 * localDayKey/localMonthKey (features/study/logic/localDay.ts). The UTC-ISO shortcut
 * (toISOString().slice(0, 7|10)) is banned repo-wide by dayKeyBan.test.ts — every bucket key
 * here goes through those two helpers, never a raw ISO slice.
 */
import { localDayKey, localMonthKey } from '../../study/logic/localDay';
import { sessionNetCents } from './bankrollAnalytics';
import type { BankrollSession } from '../types';

export interface DayBucket {
  /** LOCAL calendar day, 'YYYY-MM-DD'. */
  dayKey: string;
  sessionCount: number;
  netCents: number;
}

/** Group sessions by LOCAL calendar day. Sparse — only days with >=1 session are returned. */
export function dayBuckets(sessions: BankrollSession[]): DayBucket[] {
  const byDay = new Map<string, DayBucket>();
  for (const s of sessions) {
    const dayKey = localDayKey(new Date(s.startedAt));
    const net = sessionNetCents(s);
    const existing = byDay.get(dayKey);
    if (existing) {
      existing.sessionCount += 1;
      existing.netCents += net;
    } else {
      byDay.set(dayKey, { dayKey, sessionCount: 1, netCents: net });
    }
  }
  return [...byDay.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export interface MonthBucket {
  /** LOCAL calendar month, 'YYYY-MM'. */
  monthKey: string;
  sessionCount: number;
  netCents: number;
}

/** Group sessions by LOCAL calendar month. Sparse — only months with >=1 session are returned. */
export function monthBuckets(sessions: BankrollSession[]): MonthBucket[] {
  const byMonth = new Map<string, MonthBucket>();
  for (const s of sessions) {
    const monthKey = localMonthKey(new Date(s.startedAt));
    const net = sessionNetCents(s);
    const existing = byMonth.get(monthKey);
    if (existing) {
      existing.sessionCount += 1;
      existing.netCents += net;
    } else {
      byMonth.set(monthKey, { monthKey, sessionCount: 1, netCents: net });
    }
  }
  return [...byMonth.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/**
 * Net cents for ONE local month key ('YYYY-MM'), 0 if no sessions that month. The single shared
 * implementation of "this month's bankroll net" — EngagementContext's bankrollPositiveMonth
 * derives from this instead of re-filtering sessions itself (B3; was duplicated inline at
 * EngagementContext.tsx:92-100).
 */
export function netCentsForMonth(sessions: BankrollSession[], monthKey: string): number {
  return monthBuckets(sessions).find(b => b.monthKey === monthKey)?.netCents ?? 0;
}

export interface DayHeatLevel extends DayBucket {
  /**
   * Discrete shading level for calendar-heatmap rendering. Signed: positive = winning day,
   * negative = losing day, 0 = no session OR an exact break-even day (both render as neutral;
   * `sessionCount` distinguishes them if a caller needs to). Magnitude is 1..4, banded against
   * `heatReferenceCents` — a property of the PLAYER, not of whatever set is on screen.
   */
  level: number;
}

/**
 * Band edges as multiples of the heat reference. Deliberately placed OFF 1.0: on a tournament
 * bust `|net|` equals that day's cost exactly, so a ratio of 1.0 is the MODAL value for a
 * tournament player — 34 of 40 days in a simulated year. An edge sitting there made the modal
 * day flip step on a ₪1 difference. Every edge below is a ratio real results do not cluster on.
 *
 * `HEAT_BANDS.length + 1` is the number of steps, and must stay equal to RAMP_STEPS in
 * logic/heatCell.ts — pinned in both test files, because nothing in the types couples them.
 */
export const HEAT_BANDS = [0.6, 1.4, 2.5] as const;

/**
 * The reference a day's net is measured against: the LOWER MEDIAN of `|dayNet|` across every
 * day in the player's history that had a non-zero result. Returns 0 when there is nothing to
 * measure (no sessions, or every day broke even exactly).
 *
 * A property of the PLAYER, not of whatever set is on screen. The original ramp scaled against
 * `max(|net|)` in the set it was handed, which was unstable three ways: a lone $20 night painted
 * the top step; one $5,000 night collapsed 20 normal nights to step 1; and the SAME day rendered
 * differently in the month view than the year view. That last one is why this had to be settled
 * before the year heatmap could inherit the ramp.
 *
 * WHY THE OUTCOME SCALE AND NOT COST. An earlier version of this anchored on median daily COST
 * (buy-ins + fees). That measured EXPOSURE while the calendar displays OUTCOME, and the two
 * scale asymmetrically: a loss is bounded by exposure, a win is not. Measured consequences —
 *   - The worst possible cash loss (losing the whole buy-in) is exactly 1.0x cost, so the loss
 *     side could never reach the top step at all. A quarter of the ramp was unreachable.
 *   - A tournament bust has `|net|` exactly equal to cost, putting the modal day precisely on a
 *     band edge.
 * Anchoring on `|dayNet|` puts the reference on the same scale as the thing being measured, so
 * both directions use the full ramp.
 *
 * WHY THE LOWER MEDIAN, not a plain one. A plain median AVERAGES the two middle values on an even
 * count, which lets a single enormous night enter the reference: `[₪100, ₪50,000]` averaged to
 * ₪25,050 — a 250x drag. The lower median is a true order statistic, always an observed value,
 * so an outlier can never contribute its magnitude at ANY n, even or odd. (The earlier pin
 * claimed this property while testing only n=3, which is odd and therefore structurally unable
 * to see the defect.)
 *
 * KNOWN AND ACCEPTED: a lone session makes `|net|` its own reference, landing mid-ramp rather
 * than at either extreme. With one data point that is the honest answer — it is not blazing, and
 * pretending to know whether it was big or small would be worse.
 */
export function heatReferenceCents(sessions: BankrollSession[]): number {
  const nets = dayBuckets(sessions)
    .map(b => Math.abs(b.netCents))
    .filter(n => n > 0)
    .sort((a, b) => a - b);
  if (nets.length === 0) return 0;
  // Lower median: for an even count take the lower of the two middle values rather than their
  // mean, so no outlier's magnitude can ever enter the result.
  return nets[Math.ceil(nets.length / 2) - 1];
}

/**
 * Bucket each active day's net into signed intensity levels, banded against `referenceCents`
 * (from `heatReferenceCents`). The reference is an explicit parameter with no default, so a
 * caller cannot silently fall back to set-relative scaling.
 *
 * FALLBACK, stated rather than implied: when the reference is unusable (0, negative, NaN — i.e.
 * a player with no session carrying a positive cost), every non-zero day renders at step 1. It
 * does not blaze and it does not throw: the day is still marked as played and still carries its
 * sign, and only the magnitude — which genuinely cannot be known without a reference — is
 * withheld. Returning 0 instead would be wrong, because 0 already means "broke even".
 */
export function heatmapLevels(sessions: BankrollSession[], referenceCents: number): DayHeatLevel[] {
  const usable = Number.isFinite(referenceCents) && referenceCents > 0;
  return dayBuckets(sessions).map(b => {
    // A non-finite net would otherwise produce a NaN ratio, a NaN step, and an undefined style
    // lookup downstream — rendering a LOSS identically to a no-session day.
    if (b.netCents === 0 || !Number.isFinite(b.netCents)) return { ...b, level: 0 };
    if (!usable) return { ...b, level: Math.sign(b.netCents) };
    const ratio = Math.abs(b.netCents) / referenceCents;
    const step = ratio < HEAT_BANDS[0] ? 1 : ratio < HEAT_BANDS[1] ? 2 : ratio < HEAT_BANDS[2] ? 3 : 4;
    return { ...b, level: Math.sign(b.netCents) * step };
  });
}

/**
 * Heat levels for the days of ONE local month.
 *
 * TWO SETS, deliberately separate parameters. `allSessions` is the player's ENTIRE history and
 * feeds the reference; `visibleSessions` is whatever the screen's filters have left and supplies
 * the days. Collapsing them into one argument is what went wrong before: the only caller passed
 * its type/source-FILTERED list, so switching the Cash/Tournament tab silently re-derived the
 * reference and re-levelled the very same day — measured at level 1 on the All tab and level 2
 * on the Cash tab. That is the cross-view instability this whole design exists to remove, one
 * layer down, and the single-argument shape made it impossible to express the right thing.
 *
 * A day therefore has ONE intensity, whatever is filtered or which month is open.
 */
export function monthHeatLevels(
  allSessions: BankrollSession[],
  visibleSessions: BankrollSession[],
  monthKey: string,
): DayHeatLevel[] {
  return heatmapLevels(
    visibleSessions.filter(s => localMonthKey(new Date(s.startedAt)) === monthKey),
    heatReferenceCents(allSessions),
  );
}
