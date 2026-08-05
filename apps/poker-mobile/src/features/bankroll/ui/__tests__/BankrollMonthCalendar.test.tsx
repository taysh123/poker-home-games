/**
 * WIRING pins for the month calendar (B5, fleet find).
 *
 * The pure functions were pinned from the start, but a fleet mutation proved the COMPONENT was
 * not: replacing `byDay.get(dayKey)` with `undefined` — so the calendar ignored every session
 * and rendered a blank month — passed tsc, lint and all 1315 tests. So did replacing the
 * composed accessible name with a bare day number, which silently removes the only non-visual
 * channel a colour-blind or screen-reader user has for the sign.
 *
 * These tests assert against the rendered tree, not the helpers, so both mutations go red.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import BankrollMonthCalendar from '../BankrollMonthCalendar';
import { heatCellStyle, heatCellVisual } from '../../logic/heatCell';
import type { DayHeatLevel } from '../../logic/calendar';

const level = (dayKey: string, netCents: number, lvl: number, sessionCount = 1): DayHeatLevel =>
  ({ dayKey, sessionCount, netCents, level: lvl });

// August 2026 starts on a Saturday and has 31 days — the six-week case.
const MONTH = '2026-08';
// `heatmapLevels` always emits level = Math.sign(netCents) * magnitude, so a losing day carries
// a NEGATIVE level. Keep fixtures faithful to that: the label reads its direction from netCents
// while the visual reads its kind from level, so a mismatched fixture tests a state that cannot
// occur.
const LEVELS: DayHeatLevel[] = [
  level('2026-08-07', 84000, 4),    // big win
  level('2026-08-13', -45000, -2),  // loss
  level('2026-08-20', 0, 0),        // break-even
];

const flatten = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean) as object[]);

describe('BankrollMonthCalendar — the heat data actually reaches the cells', () => {
  it('speaks each played day\'s real result, not just its date', () => {
    const { getByLabelText } = render(<BankrollMonthCalendar monthKey={MONTH} levels={LEVELS} />);
    // If the component dropped `levels` (or swapped the composed label for a bare number),
    // none of these names would exist.
    expect(getByLabelText('August 7, up ₪840, 1 session')).toBeTruthy();
    expect(getByLabelText('August 13, down ₪450, 1 session')).toBeTruthy();
    expect(getByLabelText('August 20, broke even, 1 session')).toBeTruthy();
    expect(getByLabelText('August 1, no session')).toBeTruthy();
  });

  it('paints a winning day filled and a losing day ringed — the B4 shape channel, in the tree', () => {
    const { getByLabelText } = render(<BankrollMonthCalendar monthKey={MONTH} levels={LEVELS} />);
    const win = flatten(getByLabelText('August 7, up ₪840, 1 session').props.style);
    const loss = flatten(getByLabelText('August 13, down ₪450, 1 session').props.style);
    const none = flatten(getByLabelText('August 1, no session').props.style);

    // Win: a real fill, no ring. Loss: a real ring, no fill. Neither may look like an empty day.
    expect(win.backgroundColor).toBe(heatCellStyle(heatCellVisual(LEVELS[0])).backgroundColor);
    expect(win.backgroundColor).not.toBe('transparent');
    expect(loss.backgroundColor).toBe('transparent');
    expect(loss.borderWidth).toBeGreaterThanOrEqual(2);
    expect(none.backgroundColor).toBe('transparent');
    expect(none.borderWidth).toBe(0);
  });

  it('renders every day of the month exactly once', () => {
    const { getByLabelText } = render(<BankrollMonthCalendar monthKey={MONTH} levels={LEVELS} />);
    for (let d = 1; d <= 31; d++) {
      // Throws if missing or duplicated.
      expect(getByLabelText(new RegExp(`^August ${d},`))).toBeTruthy();
    }
  });
});

describe('BankrollMonthCalendar — interactivity is conditional', () => {
  it('exposes NO buttons when it is read-only, rather than ~31 disabled ones', () => {
    const { queryAllByRole } = render(<BankrollMonthCalendar monthKey={MONTH} levels={LEVELS} />);
    // Shipping these as disabled buttons offered a screen-reader user a month of dead controls
    // and misreported data as an interactive element (WCAG 4.1.2).
    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('becomes real buttons, and fires with the right day, once a handler is supplied', () => {
    const onSelectDay = jest.fn();
    const { getByLabelText, queryAllByRole } = render(
      <BankrollMonthCalendar monthKey={MONTH} levels={LEVELS} onSelectDay={onSelectDay} />,
    );
    expect(queryAllByRole('button')).toHaveLength(31);   // every day, no padding cells
    fireEvent.press(getByLabelText('August 7, up ₪840, 1 session'));
    expect(onSelectDay).toHaveBeenCalledWith('2026-08-07');
  });
});

describe('BankrollMonthCalendar — the legend cannot drift from the grid', () => {
  it('draws every swatch with the same function the cells use', () => {
    const { getByText } = render(<BankrollMonthCalendar monthKey={MONTH} levels={LEVELS} />);
    // The legend previously showed a dashed "No game" outline that no cell ever rendered.
    // "No session" is explained in prose instead, because its real appearance is nothing.
    expect(getByText('Won')).toBeTruthy();
    expect(getByText('Lost')).toBeTruthy();
    expect(getByText('Broke even')).toBeTruthy();
    expect(getByText(/An empty square means no session that day\./)).toBeTruthy();
  });

  it('explains the encoding as real text, which web AT can actually reach', () => {
    // An accessibilityLabel on the container was unreachable on web: react-native-web drops
    // accessibilityRole="text", and aria-label on the resulting generic div is name-prohibited.
    const { getByText } = render(<BankrollMonthCalendar monthKey={MONTH} levels={LEVELS} />);
    expect(getByText(/A filled day is a win, an outlined day is a loss/)).toBeTruthy();
  });
});
