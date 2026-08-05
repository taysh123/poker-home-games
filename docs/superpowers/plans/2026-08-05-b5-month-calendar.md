# B5 — Bankroll month calendar + monthly P&L strip + history pagination

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the month calendar view, a monthly P&L strip that doubles as the month selector, and paginate the session history — the first slice of Pillar 1 that changes what a user sees.

**Architecture:** All decisions and layout math live in pure, unit-tested functions under `features/bankroll/logic/` (`monthGrid.ts`, `heatCell.ts`, `sessionHistory.ts`), exactly as this repo already does for `bankrollAnalytics`/`calendar`/`logSessionForm` — screens are not unit-tested here, so anything worth pinning must be pure. Two new presentational components (`BankrollMonthCalendar`, `BankrollMonthStrip`) consume that logic and are wired into `BankrollScreen`. The month grid renders as plain RN `Pressable` cells (44×44, roled) rather than SVG, because month cells must be tappable; the SVG house pattern is reserved for B6's non-tappable year grid.

**Tech Stack:** Expo SDK 54 / React Native 0.81.5, TypeScript strict, Jest + @testing-library/react-native, `react-native-svg` (B6 only), theme tokens only.

## Global Constraints

- **Design decision of record:** `docs/superpowers/specs/2026-08-05-b4-calendar-heatmap-taste-direction.md`. Read it first.
- **Sign encoding is shape + hue in the month view** — winners solid on a gold ramp, losers **hollow/ringed**, break-even a thin neutral outline, no session bare. Never colour-alone (HIGH-severity rule; a calendar has no positional escape).
- **Three states stay visually distinct:** no session / played-and-flat / played-and-won-or-lost.
- **Month grid goes full-bleed** — cancel the screen's `spacing.xl` (20) horizontal padding for that section. Inside a default `Card` (padding `spacing.lg` = 16) cells land at ~40px on 375pt, under the 44×44 minimum.
- **Day cells are `Pressable` and MUST carry `accessibilityRole`.** New files have `a11yRoleRatchet` ceiling `0` (`CEILING[rel] ?? 0`) — an unroled touchable fails on the first commit. Do not raise a ceiling.
- **A legend is required** — the heatmap's own accessibility mitigation calls for it, and a signed ramp is not self-evident.
- **Tokens only:** `theme/colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`. No raw hex, no hardcoded font sizes.
- **Day/month keys go through `localDayKey`/`localMonthKey`** (`features/study/logic/localDay.ts`). `toISOString().slice(0, 7|10)` is banned repo-wide by `utils/__tests__/dayKeyBan.test.ts`.
- **English only** — i18n is explicitly out of scope, so month names are a literal array, not `toLocaleString` (which varies by host ICU data).
- **Money is integer cents** throughout; format via `utils/money.ts`.
- **`Pressable` over `TouchableOpacity`** for new code; visible press feedback.
- **Gates (run from `apps/poker-mobile`):** `npx tsc --noEmit` (silent), `npm run lint` (exit 0, budget `--max-warnings 200`), `TZ=Asia/Jerusalem npx jest --ci`. The `TZ` is what CI's "Mobile · tsc + jest" job uses and this slice is timezone-sensitive — always set it.
- **Baseline at plan time:** 142 suites / 1279 tests green.

---

### Task 1: Month grid layout logic

**Files:**
- Create: `apps/poker-mobile/src/features/bankroll/logic/monthGrid.ts`
- Test: `apps/poker-mobile/src/features/bankroll/logic/__tests__/monthGrid.test.ts`

**Interfaces:**
- Consumes: `localDayKey`, `localMonthKey` from `features/study/logic/localDay`.
- Produces: `WEEKDAY_INITIALS: readonly string[]`, `shiftMonth(monthKey: string, delta: number): string`, `monthLabel(monthKey: string): string`, `monthGridCells(monthKey: string): (string | null)[]`.

- [ ] **Step 1: Write the failing test**

```typescript
import { WEEKDAY_INITIALS, shiftMonth, monthLabel, monthGridCells } from '../monthGrid';

describe('WEEKDAY_INITIALS', () => {
  it('is seven Sunday-first column headers', () => {
    expect(WEEKDAY_INITIALS).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });
});

describe('shiftMonth', () => {
  it('moves forward and backward within a year', () => {
    expect(shiftMonth('2026-06', 1)).toBe('2026-07');
    expect(shiftMonth('2026-06', -1)).toBe('2026-05');
    expect(shiftMonth('2026-06', 0)).toBe('2026-06');
  });

  it('rolls the year over in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('handles multi-month jumps across a year boundary', () => {
    expect(shiftMonth('2026-11', 3)).toBe('2027-02');
    expect(shiftMonth('2026-02', -14)).toBe('2024-12');
  });
});

describe('monthLabel', () => {
  it('renders a full English month name and year', () => {
    expect(monthLabel('2026-06')).toBe('June 2026');
    expect(monthLabel('2026-01')).toBe('January 2026');
    expect(monthLabel('2026-12')).toBe('December 2026');
  });
});

describe('monthGridCells', () => {
  it('pads to whole weeks and puts day 01 at its real weekday column', () => {
    // June 2026 starts on a Monday (column index 1) and has 30 days.
    const cells = monthGridCells('2026-06');
    expect(cells).toHaveLength(35);          // 1 lead + 30 days = 31 -> 5 whole weeks
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe('2026-06-01');
    expect(cells[30]).toBe('2026-06-30');
    expect(cells.slice(31)).toEqual([null, null, null, null]);
  });

  it('needs no padding when a month starts Sunday and fits exactly', () => {
    // February 2026 starts on a Sunday and has 28 days -> exactly 4 weeks, no nulls at all.
    const cells = monthGridCells('2026-02');
    expect(cells).toHaveLength(28);
    expect(cells.filter(c => c === null)).toEqual([]);
    expect(cells[0]).toBe('2026-02-01');
    expect(cells[27]).toBe('2026-02-28');
  });

  it('spills into a sixth week when it has to', () => {
    // August 2026 starts on a Saturday (column 6) and has 31 days -> 37 -> 6 weeks.
    const cells = monthGridCells('2026-08');
    expect(cells).toHaveLength(42);
    expect(cells[6]).toBe('2026-08-01');
    expect(cells[36]).toBe('2026-08-31');
  });

  it('counts leap-year February correctly', () => {
    const cells2028 = monthGridCells('2028-02').filter(Boolean);
    expect(cells2028).toHaveLength(29);
    expect(cells2028[28]).toBe('2028-02-29');
    expect(monthGridCells('2026-02').filter(Boolean)).toHaveLength(28);
  });

  it('emits contiguous, ordered day keys with no gaps', () => {
    const days = monthGridCells('2026-06').filter((c): c is string => c !== null);
    expect(days).toHaveLength(30);
    days.forEach((key, i) => expect(key).toBe(`2026-06-${String(i + 1).padStart(2, '0')}`));
  });

  it('always returns a whole number of 7-column weeks', () => {
    for (const key of ['2026-01', '2026-02', '2026-08', '2028-02', '2027-11']) {
      expect(monthGridCells(key).length % 7).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/features/bankroll/logic/__tests__/monthGrid.test.ts --ci`
Expected: FAIL — `Cannot find module '../monthGrid'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Month-calendar layout (B5) — pure. Grid geometry and month navigation, kept out of the
 * component so the tricky parts (leap years, week padding, year rollover) are unit-tested.
 * Keys are built from LOCAL date components via localDayKey/localMonthKey; the UTC-ISO
 * shortcut is banned repo-wide by dayKeyBan.test.ts.
 */
import { localDayKey, localMonthKey } from '../../study/logic/localDay';

/** Column headers, Sunday-first. English only — i18n is out of scope for this app. */
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

/** 'June 2026'. A literal table, not toLocaleString — host ICU data varies by platform. */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Day keys for one month laid out in 7-column weeks, Sunday-first. `null` is a padding cell
 * (before the 1st / after the last) so the grid always renders whole rows. A month that both
 * starts on Sunday and divides evenly gets no padding at all (February 2026), and one that
 * starts late in the week can need six rows (August 2026).
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/features/bankroll/logic/__tests__/monthGrid.test.ts --ci`
Expected: PASS, 7 tests.

- [ ] **Step 5: Verify the day-key ban still holds**

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/utils/__tests__/dayKeyBan.test.ts --ci`
Expected: PASS — the new file must not introduce a banned UTC slice.

- [ ] **Step 6: Commit**

```bash
git add apps/poker-mobile/src/features/bankroll/logic/monthGrid.ts apps/poker-mobile/src/features/bankroll/logic/__tests__/monthGrid.test.ts
git commit -m "feat(bankroll): month-grid layout logic (B5)"
```

---

### Task 2: Heat-cell visual encoding + the colour-alone pins

**Files:**
- Create: `apps/poker-mobile/src/features/bankroll/logic/heatCell.ts`
- Test: `apps/poker-mobile/src/features/bankroll/logic/__tests__/heatCell.test.ts`

**Interfaces:**
- Consumes: `DayHeatLevel` from `features/bankroll/logic/calendar`; `colors` from `theme/colors`; `formatCentsSigned` from `utils/money`.
- Produces: `HeatCellKind = 'none' | 'even' | 'win' | 'loss'`, `HeatCellVisual { kind, step }`, `heatCellVisual(bucket, levelCount?)`, `heatCellStyle(v)`, `heatCellTextColor(v)`, `dayCellLabel(dayKey, dayNumber, bucket)`.

This task carries the B4 decision's teeth: a test proves losers are never solid-filled and that `kind` alone (no colour) separates every state.

- [ ] **Step 1: Write the failing test**

```typescript
import {
  heatCellVisual, heatCellStyle, heatCellTextColor, dayCellLabel,
} from '../heatCell';
import { colors } from '../../../../theme/colors';
import type { DayHeatLevel } from '../calendar';

const bucket = (level: number, netCents: number, sessionCount = 1): DayHeatLevel =>
  ({ dayKey: '2026-06-03', sessionCount, netCents, level });

describe('heatCellVisual — the four states', () => {
  it('no bucket at all is "none"', () => {
    expect(heatCellVisual(undefined)).toEqual({ kind: 'none', step: 0 });
  });

  it('a played but break-even day is "even", NOT "none"', () => {
    // The distinction that matters: "I did not play" vs "I played and finished flat".
    expect(heatCellVisual(bucket(0, 0))).toEqual({ kind: 'even', step: 0 });
  });

  it('positive levels are "win" and negative are "loss", at their magnitude step', () => {
    expect(heatCellVisual(bucket(4, 10000))).toEqual({ kind: 'win', step: 4 });
    expect(heatCellVisual(bucket(1, 100))).toEqual({ kind: 'win', step: 1 });
    expect(heatCellVisual(bucket(-4, -10000))).toEqual({ kind: 'loss', step: 4 });
    expect(heatCellVisual(bucket(-2, -500))).toEqual({ kind: 'loss', step: 2 });
  });

  it('clamps a step above the ramp so a style lookup can never fall off the end', () => {
    expect(heatCellVisual(bucket(9, 99999), 4)).toEqual({ kind: 'win', step: 4 });
    expect(heatCellVisual(bucket(-9, -99999), 4)).toEqual({ kind: 'loss', step: 4 });
  });
});

describe('THE B4 PIN: sign never depends on colour alone', () => {
  it('mirrored magnitudes differ by KIND, not just by hue', () => {
    // Grayscale the app and a +400 day must still be tellable from a -400 day.
    for (const step of [1, 2, 3, 4]) {
      const win = heatCellVisual(bucket(step, 400));
      const loss = heatCellVisual(bucket(-step, -400));
      expect(win.kind).not.toBe(loss.kind);
      expect(win.step).toBe(loss.step);
    }
  });

  it('losing cells are HOLLOW — never a solid fill, at any intensity', () => {
    for (const step of [1, 2, 3, 4]) {
      const style = heatCellStyle(heatCellVisual(bucket(-step, -400)));
      expect(style.backgroundColor).toBe('transparent');
      expect(style.borderWidth).toBeGreaterThanOrEqual(2);
    }
  });

  it('winning cells are FILLED — a real background at every intensity', () => {
    for (const step of [1, 2, 3, 4]) {
      const style = heatCellStyle(heatCellVisual(bucket(step, 400)));
      expect(style.backgroundColor).not.toBe('transparent');
    }
  });

  it('all four kinds are visually distinct from each other', () => {
    const styles = [
      heatCellStyle(heatCellVisual(undefined)),
      heatCellStyle(heatCellVisual(bucket(0, 0))),
      heatCellStyle(heatCellVisual(bucket(2, 400))),
      heatCellStyle(heatCellVisual(bucket(-2, -400))),
    ].map(s => `${s.backgroundColor}|${s.borderColor}|${s.borderWidth}`);
    expect(new Set(styles).size).toBe(4);
  });

  it('the win ramp strengthens monotonically and ends on solid gold', () => {
    const fills = [1, 2, 3, 4].map(s => heatCellStyle(heatCellVisual(bucket(s, 400))).backgroundColor);
    expect(new Set(fills).size).toBe(4);      // four distinguishable steps
    expect(fills[3]).toBe(colors.gold);
  });
});

describe('heatCellTextColor', () => {
  it('flips to the dark background token on the solid-gold top step', () => {
    // White-on-gold fails contrast; the top step is the only opaque fill.
    expect(heatCellTextColor(heatCellVisual(bucket(4, 10000)))).toBe(colors.background);
  });

  it('stays light on every translucent or hollow cell', () => {
    expect(heatCellTextColor(heatCellVisual(bucket(1, 100)))).toBe(colors.textHigh);
    expect(heatCellTextColor(heatCellVisual(bucket(-4, -10000)))).toBe(colors.textHigh);
    expect(heatCellTextColor(heatCellVisual(bucket(0, 0)))).toBe(colors.textMuted);
    expect(heatCellTextColor(heatCellVisual(undefined))).toBe(colors.textDim);
  });
});

describe('dayCellLabel — spoken name matches what is drawn', () => {
  it('names an unplayed day without implying a result', () => {
    expect(dayCellLabel('2026-06-03', 3, undefined)).toBe('June 3, no session');
  });

  it('says break-even explicitly rather than reading as nothing', () => {
    expect(dayCellLabel('2026-06-03', 3, bucket(0, 0))).toBe('June 3, broke even, 1 session');
  });

  it('states the signed amount and pluralises sessions', () => {
    // formatCents drops a zero fraction for ILS: 84000 -> "₪840", not "₪840.00".
    expect(dayCellLabel('2026-06-03', 3, bucket(3, 84000))).toBe('June 3, up ₪840, 1 session');
    expect(dayCellLabel('2026-06-03', 3, bucket(-2, -45000, 2))).toBe('June 3, down ₪450, 2 sessions');
  });

  it('keeps a fractional amount intact', () => {
    expect(dayCellLabel('2026-06-03', 3, bucket(1, 5050))).toBe('June 3, up ₪50.50, 1 session');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/features/bankroll/logic/__tests__/heatCell.test.ts --ci`
Expected: FAIL — `Cannot find module '../heatCell'`.

- [ ] **Step 3: Write minimal implementation**

Money format was verified while writing this plan: `formatCents` uses a bespoke ILS format that **drops a zero fraction** (`84000 → "₪840"`, `5050 → "₪50.50"`), which is why the label pins above read `₪840` and not `₪840.00`. If a test disagrees, fix the *test* to the real output — never bend the implementation to a guessed string.

```typescript
/**
 * Heat-cell visual encoding (B5) — pure. This is where the B4 taste decision is enforced:
 * in the month view, SIGN is carried by SHAPE (filled vs hollow) and only reinforced by hue,
 * so a losing day stays tellable from a winning one in grayscale and under any colour-vision
 * deficiency. Gold vs red is a weak pair under deuteranopia, and unlike BankrollHistogram a
 * calendar cannot lean on position — the date owns the position.
 *
 * Decision of record: docs/superpowers/specs/2026-08-05-b4-calendar-heatmap-taste-direction.md
 */
import { colors } from '../../../theme/colors';
import { formatCents } from '../../../utils/money';
import { monthLabel } from './monthGrid';
import type { DayHeatLevel } from './calendar';

export type HeatCellKind = 'none' | 'even' | 'win' | 'loss';

export interface HeatCellVisual {
  kind: HeatCellKind;
  /** Ramp position 0..levelCount. 0 for 'none' and 'even'. */
  step: number;
}

export interface HeatCellStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}

/** Gold opacity ramp — these four tokens ARE an alpha ramp: 0.08, 0.15, 0.40, 1.0. */
const WIN_FILL = [colors.goldFaint, colors.goldSubtle, colors.goldMuted, colors.gold];
/** Losers ramp on ring weight + colour, never on fill (see the module header). */
const LOSS_BORDER = [colors.errorMuted, colors.errorMuted, colors.error, colors.error];
const LOSS_WIDTH = [2, 2.5, 3, 3.5];

export function heatCellVisual(bucket: DayHeatLevel | undefined, levelCount = 4): HeatCellVisual {
  if (!bucket) return { kind: 'none', step: 0 };
  if (bucket.level === 0) return { kind: 'even', step: 0 };
  // Clamp: heatmapLevels already bounds this, but a style lookup must never index off the end.
  const step = Math.min(Math.abs(bucket.level), levelCount);
  return { kind: bucket.level > 0 ? 'win' : 'loss', step };
}

export function heatCellStyle(v: HeatCellVisual): HeatCellStyle {
  switch (v.kind) {
    case 'win':
      return { backgroundColor: WIN_FILL[v.step - 1], borderColor: 'transparent', borderWidth: 0 };
    case 'loss':
      return { backgroundColor: 'transparent', borderColor: LOSS_BORDER[v.step - 1], borderWidth: LOSS_WIDTH[v.step - 1] };
    case 'even':
      return { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 };
    default:
      return { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 };
  }
}

export function heatCellTextColor(v: HeatCellVisual): string {
  if (v.kind === 'none') return colors.textDim;
  if (v.kind === 'even') return colors.textMuted;
  // The top win step is the only OPAQUE fill; white on solid gold fails contrast.
  if (v.kind === 'win' && v.step === WIN_FILL.length) return colors.background;
  return colors.textHigh;
}

/** Composed accessible name. Pinned in tests so the spoken name cannot drift from the cell. */
export function dayCellLabel(dayKey: string, dayNumber: number, bucket: DayHeatLevel | undefined): string {
  const [y, m] = dayKey.split('-');
  const day = `${monthLabel(`${y}-${m}`).split(' ')[0]} ${dayNumber}`;
  if (!bucket) return `${day}, no session`;
  const sessions = `${bucket.sessionCount} session${bucket.sessionCount === 1 ? '' : 's'}`;
  if (bucket.netCents === 0) return `${day}, broke even, ${sessions}`;
  const dir = bucket.netCents > 0 ? 'up' : 'down';
  return `${day}, ${dir} ${formatCents(Math.abs(bucket.netCents))}, ${sessions}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/features/bankroll/logic/__tests__/heatCell.test.ts --ci`
Expected: PASS, 13 tests.

- [ ] **Step 5: Revert-test the load-bearing pin**

Temporarily give losing cells a solid fill — change the `'loss'` branch of `heatCellStyle` to
`{ backgroundColor: colors.errorFaint, borderColor: LOSS_BORDER[v.step - 1], borderWidth: LOSS_WIDTH[v.step - 1] }`.

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/features/bankroll/logic/__tests__/heatCell.test.ts --ci`
Expected: FAIL — `losing cells are HOLLOW` goes red and nothing else does. Restore the original branch and confirm `git diff` on the file is clean before continuing.

- [ ] **Step 6: Commit**

```bash
git add apps/poker-mobile/src/features/bankroll/logic/heatCell.ts apps/poker-mobile/src/features/bankroll/logic/__tests__/heatCell.test.ts
git commit -m "feat(bankroll): heat-cell encoding with the colour-alone pins (B5)"
```

---

### Task 3: Session-history pagination logic

**Files:**
- Create: `apps/poker-mobile/src/features/bankroll/logic/sessionHistory.ts`
- Test: `apps/poker-mobile/src/features/bankroll/logic/__tests__/sessionHistory.test.ts`

**Interfaces:**
- Produces: `SESSION_PAGE_SIZE: 20`, `HistoryPage<T> { visible: T[]; remaining: number; hasMore: boolean }`, `historyPage<T>(items: T[], visibleCount: number): HistoryPage<T>`.

Scope note: this is **incremental reveal**, not virtualization. `BankrollScreen` is a single `ScrollView` with several sections, so converting the history to `FlatList` is a larger refactor. Capping the initially-rendered rows is the honest, minimal fix for "a calendar invites year-scale data"; say so in the PR rather than implying the list is virtualized.

- [ ] **Step 1: Write the failing test**

```typescript
import { SESSION_PAGE_SIZE, historyPage } from '../sessionHistory';

const items = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

describe('SESSION_PAGE_SIZE', () => {
  it('is pinned to a literal, not derived', () => {
    expect(SESSION_PAGE_SIZE).toBe(20);
  });
});

describe('historyPage', () => {
  it('shows everything and offers no more when the list is short', () => {
    expect(historyPage(items(5), SESSION_PAGE_SIZE)).toEqual({
      visible: items(5), remaining: 0, hasMore: false,
    });
  });

  it('offers no more when the list ends exactly on the page boundary', () => {
    const page = historyPage(items(20), 20);
    expect(page.visible).toHaveLength(20);
    expect(page.hasMore).toBe(false);
    expect(page.remaining).toBe(0);
  });

  it('truncates and reports what is left', () => {
    const page = historyPage(items(53), 20);
    expect(page.visible).toHaveLength(20);
    expect(page.visible[0]).toBe('s0');
    expect(page.visible[19]).toBe('s19');
    expect(page.remaining).toBe(33);
    expect(page.hasMore).toBe(true);
  });

  it('clamps a visibleCount past the end instead of padding with undefined', () => {
    const page = historyPage(items(3), 999);
    expect(page.visible).toHaveLength(3);
    expect(page.visible).not.toContain(undefined);
    expect(page.hasMore).toBe(false);
  });

  it('treats a negative or non-finite count as zero visible', () => {
    expect(historyPage(items(5), -10).visible).toEqual([]);
    expect(historyPage(items(5), NaN).visible).toEqual([]);
    expect(historyPage(items(5), -10).remaining).toBe(5);
  });

  it('handles an empty list without claiming there is more', () => {
    expect(historyPage([], 20)).toEqual({ visible: [], remaining: 0, hasMore: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/features/bankroll/logic/__tests__/sessionHistory.test.ts --ci`
Expected: FAIL — `Cannot find module '../sessionHistory'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Session-history paging (B5) — pure. INCREMENTAL REVEAL, not virtualization: BankrollScreen is
 * one ScrollView with several sections, so this caps how many rows mount at once rather than
 * recycling them. The calendar is an explicit invitation to year-scale data, so the cap lands
 * here (B5) rather than after the year view invites it (B6).
 */
export const SESSION_PAGE_SIZE = 20;

export interface HistoryPage<T> {
  visible: T[];
  remaining: number;
  hasMore: boolean;
}

export function historyPage<T>(items: T[], visibleCount: number): HistoryPage<T> {
  const count = Number.isFinite(visibleCount) ? Math.max(0, Math.min(visibleCount, items.length)) : 0;
  return {
    visible: items.slice(0, count),
    remaining: items.length - count,
    hasMore: count < items.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/features/bankroll/logic/__tests__/sessionHistory.test.ts --ci`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/features/bankroll/logic/sessionHistory.ts apps/poker-mobile/src/features/bankroll/logic/__tests__/sessionHistory.test.ts
git commit -m "feat(bankroll): session-history paging logic (B5)"
```

---

### Task 4: The month calendar component

**Files:**
- Create: `apps/poker-mobile/src/features/bankroll/ui/BankrollMonthCalendar.tsx`

**Interfaces:**
- Consumes: `monthGridCells`, `WEEKDAY_INITIALS` (Task 1); `heatCellVisual`, `heatCellStyle`, `heatCellTextColor`, `dayCellLabel` (Task 2); `DayHeatLevel` from `features/bankroll/logic/calendar`.
- Produces: default export `BankrollMonthCalendar({ monthKey, levels, onSelectDay }: { monthKey: string; levels: DayHeatLevel[]; onSelectDay?: (dayKey: string) => void })`.

**Every `Pressable` here MUST carry `accessibilityRole`** — this is a new file, so `a11yRoleRatchet`'s ceiling for it is `0`.

- [ ] **Step 1: Write the component**

```tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { monthGridCells, WEEKDAY_INITIALS } from '../logic/monthGrid';
import { heatCellVisual, heatCellStyle, heatCellTextColor, dayCellLabel } from '../logic/heatCell';
import type { DayHeatLevel } from '../logic/calendar';

/**
 * Month calendar (B5). Plain RN cells rather than SVG because month days must be TAPPABLE —
 * the SVG house pattern (BankrollLineChart) is reserved for B6's non-tappable year grid, where
 * ~5px cells make per-day taps indefensible.
 *
 * Sign is carried by SHAPE (filled win vs hollow loss), not hue alone — see logic/heatCell.ts.
 * The parent renders this FULL-BLEED: inside the screen's spacing.xl padding plus a default Card
 * the seven columns land at ~40px, under the 44x44 minimum.
 */
const MIN_TARGET = 44;

export default function BankrollMonthCalendar({
  monthKey,
  levels,
  onSelectDay,
}: {
  monthKey: string;
  levels: DayHeatLevel[];
  onSelectDay?: (dayKey: string) => void;
}) {
  const cells = useMemo(() => monthGridCells(monthKey), [monthKey]);
  const byDay = useMemo(() => new Map(levels.map(l => [l.dayKey, l])), [levels]);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAY_INITIALS.map((w, i) => (
          // Decorative: the day cells carry the full date in their own labels.
          <Text key={i} style={styles.weekday} accessibilityElementsHidden importantForAccessibility="no">
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((dayKey, i) => {
          if (!dayKey) return <View key={`pad-${i}`} style={styles.cell} />;
          const bucket = byDay.get(dayKey);
          const visual = heatCellVisual(bucket);
          const style = heatCellStyle(visual);
          const dayNumber = Number(dayKey.slice(8));
          return (
            <Pressable
              key={dayKey}
              onPress={onSelectDay ? () => onSelectDay(dayKey) : undefined}
              disabled={!onSelectDay}
              accessibilityRole="button"
              accessibilityLabel={dayCellLabel(dayKey, dayNumber, bucket)}
              style={({ pressed }) => [styles.cell, styles.cellInner, style, pressed && styles.pressed]}
            >
              <Text style={[styles.dayNumber, { color: heatCellTextColor(visual) }]}>{dayNumber}</Text>
            </Pressable>
          );
        })}
      </View>

      <Legend />
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend} accessible accessibilityRole="text" accessibilityLabel="Legend: filled is a winning day, outlined in red is a losing day, thin outline is break-even, empty means no session.">
      <LegendSwatch style={{ backgroundColor: colors.goldMuted }} label="Won" />
      <LegendSwatch style={{ borderColor: colors.error, borderWidth: 2 }} label="Lost" />
      <LegendSwatch style={{ borderColor: colors.border, borderWidth: 1 }} label="Even" />
      <LegendSwatch style={{}} label="No game" />
    </View>
  );
}

function LegendSwatch({ style, label }: { style: object; label: string }) {
  return (
    <View style={styles.legendItem} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.swatch, style]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1, textAlign: 'center', ...typography.caps,
    color: colors.textMuted, marginBottom: spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, minHeight: MIN_TARGET, padding: 2 },
  cellInner: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  pressed: { opacity: 0.6 },
  dayNumber: { ...typography.labelSmall },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
    marginTop: spacing.md, justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 3, borderColor: 'transparent' },
  legendText: { ...typography.caption, color: colors.textMuted },
});
```

**Note on the cell box:** `width: '14.2857%'` with `aspectRatio: 1` keeps square cells at any width; `minHeight: MIN_TARGET` guarantees the 44px floor even on a narrow device where the percentage would compute smaller. `borderRadius` sits on `cellInner` so padding cells stay invisible.

- [ ] **Step 2: Type-check**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: silent.

- [ ] **Step 3: Verify the a11y ratchet accepts the new file**

Run: `cd apps/poker-mobile && TZ=Asia/Jerusalem npx jest src/components/__tests__/a11yRoleRatchet.test.ts --ci`
Expected: PASS. If it fails with `BankrollMonthCalendar.tsx: 1 > 0`, a `Pressable` is missing `accessibilityRole` — add the role. **Do not add a CEILING entry.**

- [ ] **Step 4: Commit**

```bash
git add apps/poker-mobile/src/features/bankroll/ui/BankrollMonthCalendar.tsx
git commit -m "feat(bankroll): month calendar component with legend (B5)"
```

---

### Task 5: The monthly P&L strip

**Files:**
- Create: `apps/poker-mobile/src/features/bankroll/ui/BankrollMonthStrip.tsx`

**Interfaces:**
- Consumes: `monthLabel`, `shiftMonth` (Task 1); `MonthBucket` from `features/bankroll/logic/calendar`; `formatCentsSigned` from `utils/money`.
- Produces: default export `BankrollMonthStrip({ monthKey, months, onChangeMonth }: { monthKey: string; months: MonthBucket[]; onChangeMonth: (monthKey: string) => void })`.

Doubles as the month selector: prev/next arrows plus the selected month's net, so the strip both navigates and informs.

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { radii } from '../../../theme/radii';
import { formatCentsSigned } from '../../../utils/money';
import { monthLabel, shiftMonth } from '../logic/monthGrid';
import type { MonthBucket } from '../logic/calendar';

/**
 * Month selector + that month's net (B5). Arrows move one month at a time; the header states
 * the month and its P&L so the calendar below always has a stated total to be read against.
 */
export default function BankrollMonthStrip({
  monthKey,
  months,
  onChangeMonth,
}: {
  monthKey: string;
  months: MonthBucket[];
  onChangeMonth: (monthKey: string) => void;
}) {
  const bucket = months.find(m => m.monthKey === monthKey);
  const net = bucket?.netCents ?? 0;
  const sessions = bucket?.sessionCount ?? 0;
  const netColor = net > 0 ? colors.success : net < 0 ? colors.error : colors.textHigh;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChangeMonth(shiftMonth(monthKey, -1))}
        accessibilityRole="button"
        accessibilityLabel={`Previous month, ${monthLabel(shiftMonth(monthKey, -1))}`}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.month}>{monthLabel(monthKey)}</Text>
        <Text style={[styles.net, { color: netColor }]}>
          {sessions === 0 ? 'No sessions' : `${formatCentsSigned(net)} · ${sessions} session${sessions === 1 ? '' : 's'}`}
        </Text>
      </View>

      <Pressable
        onPress={() => onChangeMonth(shiftMonth(monthKey, 1))}
        accessibilityRole="button"
        accessibilityLabel={`Next month, ${monthLabel(shiftMonth(monthKey, 1))}`}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: 44, height: 44, borderRadius: radii.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh,
  },
  pressed: { opacity: 0.6 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  month: { ...typography.h3, color: colors.text },
  net: { ...typography.bodySmall, marginTop: 2 },
});
```

- [ ] **Step 2: Type-check and ratchet**

Run: `cd apps/poker-mobile && npx tsc --noEmit && TZ=Asia/Jerusalem npx jest src/components/__tests__/a11yRoleRatchet.test.ts --ci`
Expected: tsc silent, ratchet PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/poker-mobile/src/features/bankroll/ui/BankrollMonthStrip.tsx
git commit -m "feat(bankroll): month selector strip with monthly P&L (B5)"
```

---

### Task 6: Wire into BankrollScreen (full-bleed calendar + pagination)

**Files:**
- Modify: `apps/poker-mobile/src/features/bankroll/ui/BankrollScreen.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–5, plus `dayBuckets`, `monthBuckets`, `heatmapLevels` from `features/bankroll/logic/calendar` and `localMonthKey` from `features/study/logic/localDay`.

- [ ] **Step 1: Add imports and state**

Add to the import block:

```tsx
import { localMonthKey } from '../../study/logic/localDay';
import { monthBuckets, heatmapLevels } from '../logic/calendar';
import { SESSION_PAGE_SIZE, historyPage } from '../logic/sessionHistory';
import BankrollMonthCalendar from './BankrollMonthCalendar';
import BankrollMonthStrip from './BankrollMonthStrip';
```

Inside the component, after the existing `const [sourceIdx, setSourceIdx] = useState(0);`:

```tsx
const [monthKey, setMonthKey] = useState(() => localMonthKey());
const [visibleCount, setVisibleCount] = useState(SESSION_PAGE_SIZE);
```

- [ ] **Step 2: Derive the calendar data**

After the existing `const history = useMemo(...)` block:

```tsx
const months = useMemo(() => monthBuckets(filtered), [filtered]);
const monthLevels = useMemo(
  () => heatmapLevels(filtered.filter(s => localMonthKey(new Date(s.startedAt)) === monthKey)),
  [filtered, monthKey],
);
const page = useMemo(() => historyPage(history, visibleCount), [history, visibleCount]);
```

**Why filter to the month before calling `heatmapLevels`:** the ramp is relative to the largest `|netCents|` in the set it is given. Passing the whole dataset would scale every month against the all-time best day, so a normal month would render almost entirely at step 1. Scoping to the visible month makes the ramp mean "within this month" — which is what a month view should say.

- [ ] **Step 3: Reset paging when the filter changes**

Immediately after the two `useMemo`s above:

```tsx
// A filter change rebuilds the list, so a carried-over "show more" count would silently
// reveal a different number of rows than the user last chose.
useEffect(() => { setVisibleCount(SESSION_PAGE_SIZE); }, [typeIdx, sourceIdx]);
```

Add `useEffect` to the existing `react` import.

- [ ] **Step 4: Render the calendar section**

Insert a new section immediately **above** the existing `{/* History */}` block:

```tsx
{/* Month calendar — FULL-BLEED so the 7 columns clear the 44px touch minimum. */}
<View style={styles.section}>
  <SectionTitle>CALENDAR</SectionTitle>
  <View style={styles.bleed}>
    <BankrollMonthStrip monthKey={monthKey} months={months} onChangeMonth={setMonthKey} />
    <View style={{ marginTop: spacing.md }}>
      <BankrollMonthCalendar monthKey={monthKey} levels={monthLevels} />
    </View>
  </View>
</View>
```

Add to `StyleSheet.create`:

```tsx
// Cancels the ScrollView's spacing.xl side padding: inside it, seven columns land at ~40px.
bleed: { marginHorizontal: -spacing.xl, paddingHorizontal: spacing.sm },
```

`onSelectDay` is deliberately omitted for now — day→history filtering is B7's job (the filter UI slice). The cells stay roled and labelled, and render `disabled` until then.

- [ ] **Step 5: Paginate the history list**

Replace the existing history body:

```tsx
{history.map(s => (
  <SessionRow key={s.id} session={s} onPress={() => goLog(s.id)} />
))}
```

with:

```tsx
{page.visible.map(s => (
  <SessionRow key={s.id} session={s} onPress={() => goLog(s.id)} />
))}
{page.hasMore && (
  <PrimaryButton
    label={`Show ${Math.min(page.remaining, SESSION_PAGE_SIZE)} more`}
    variant="outline"
    onPress={() => setVisibleCount(c => c + SESSION_PAGE_SIZE)}
  />
)}
```

`PrimaryButton`'s variants were verified while writing this plan: `gold | gradient | outline`. There is **no** `secondary` — `outline` is the correct low-emphasis choice here, and gold is reserved for primary CTAs.

- [ ] **Step 6: Run the full gate suite**

```bash
cd apps/poker-mobile
npx tsc --noEmit
npm run lint
TZ=Asia/Jerusalem npx jest --ci
```

Expected: tsc silent; lint exit 0; jest 142+ suites green with the ~26 new tests from Tasks 1–3 added. If `a11yRoleRatchet` reports `BankrollScreen.tsx` over its ceiling of 2, the new section added an unroled touchable — role it rather than raising the ceiling.

- [ ] **Step 7: Commit**

```bash
git add apps/poker-mobile/src/features/bankroll/ui/BankrollScreen.tsx
git commit -m "feat(bankroll): wire the month calendar and paginate history (B5)"
```

---

### Task 7: Mutation-test, fleet, PR

- [ ] **Step 1: Mutation-test the new pins**

For each mutation: apply it, run the suite, confirm **exactly** the expected test goes red and nothing else, then restore and verify `git diff` is clean.

| Mutation | Expected red |
|---|---|
| `monthGridCells`: drop the `while (cells.length % 7 !== 0)` padding loop | `pads to whole weeks…`, `spills into a sixth week…`, `always returns a whole number of 7-column weeks` |
| `monthGridCells`: use `getDay()` of the *last* day instead of the first for `leadingBlanks` | `pads to whole weeks…`, `spills into a sixth week…` |
| `shiftMonth`: `m + delta` instead of `m - 1 + delta` | all three `shiftMonth` tests |
| `heatCellVisual`: return `'none'` for a break-even bucket | `a played but break-even day is "even", NOT "none"` |
| `heatCellStyle`: give losses a solid fill | `losing cells are HOLLOW…` (already done in Task 2 Step 6 — redo against the committed state) |
| `heatCellTextColor`: always return `colors.textHigh` | `flips to the dark background token on the solid-gold top step` |
| `historyPage`: drop the `Math.min(visibleCount, items.length)` clamp | `clamps a visibleCount past the end…` |

- [ ] **Step 2: Push, then run the fleet**

```bash
git push -u origin feat/bankroll-month-calendar
```

Fleet at HIGH effort. **Any dimension whose prompt instructs mutation MUST get `isolation: 'worktree'` on its `agent()` call — non-negotiable owner ruling, no exceptions.** Dimensions to cover:

1. **Correctness** — month-grid edge cases beyond the pinned ones (DST months, year boundaries, a month with zero sessions, a month where every day is break-even).
2. **Accessibility** — day-cell roles and labels; verify the ratchet and `a11yContract`; confirm the legend is reachable and that padding cells are not announced; check that the composed label matches what is actually drawn (this repo has been bitten by a label that disagreed with its cell).
3. **Visual/token conformance** — no raw hex, no hardcoded font sizes, gold used sparingly, the full-bleed maths actually clearing 44px at 360dp and 375pt.
4. **Adversarial test quality** (worktree-isolated) — mutation-test beyond the table above.
5. **Plan conformance** — B4 decision honoured: sign never colour-alone; no SVG filter primitives anywhere; pagination present; no day→history wiring (that is B7).

Verify RAW fleet output from the journal, never a summary.

- [ ] **Step 3: Open the PR and stop**

Include: the B4 decision link, the colour-alone pins and how they were revert-tested, the honest scope note that pagination is incremental reveal rather than virtualization, and the verified full-bleed arithmetic. Confirm CI green on the PR itself before reporting ready, then **stop for the owner's merge**.

---

## Out of scope for B5

- **Year heatmap** — B6. It uses the SVG house pattern, is never tappable, and its luminance ramp must use fill lightness/opacity on plain `<Rect>`s, **never SVG filter primitives** (patchy on Android while react-native-web renders them fine). B6's fleet must confirm on a real Android path.
- **Day → history filtering** — B7, alongside the date-range and tags filter UI. `onSelectDay` is already threaded for it.
- **List virtualization** — deliberately deferred; see Task 3's scope note.
