/**
 * Accessibility contracts for the shared form/chrome components.
 *
 * These three components are where the app's a11y leverage lives, because a screen using
 * `AppTextInput` or `PrimaryButton` should inherit a correct accessible name rather than
 * remembering to supply one.
 *
 * Scope, counted rather than estimated: `AppTextInput` is used by 42 inputs across 8 screens, and
 * `BrandHeader` (re-exported as `ScreenHeader`) by 32 call sites. An earlier version of this
 * comment claimed "~45 defects across ~20 screens" and included `FormRow` — which had ZERO
 * production call sites and has since been deleted. Hardening dead code inflates the number and
 * delivers nothing.
 *
 * The defect these pin is invisible to a sighted user and total for a screen-reader user: React
 * Native has no `htmlFor`/`aria-labelledby`, so a visible `<Text>` rendered as a SIBLING of a
 * `TextInput` is NOT its accessible name. Every one of those inputs looked perfectly labelled and
 * announced as "text field, <placeholder>".
 *
 * `PrimaryButton`'s case is the recurring shape this session kept finding: its JSDoc claimed the
 * label "defaults to `label` text when omitted" and the code did not do that. It worked by
 * accident — RN derives a name from the child <Text> — right up until `loading` replaced that
 * child with a bare ActivityIndicator, leaving an unnamed button mid-submit. A doc comment is not
 * a guarantee; this test is.
 */
import React from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { render } from '@testing-library/react-native';

import AppTextInput from '../AppTextInput';
import BrandHeader from '../BrandHeader';
import GroupListItem from '../GroupListItem';
import GuestNameInput from '../GuestNameInput';
import PrimaryButton from '../PrimaryButton';
import SessionListItem from '../SessionListItem';

// BrandHeader pulls in the icon font + navigation + safe-area, none of which resolve in this jest
// context. Presentation only — irrelevant to the a11y contracts under test.
// These sit BELOW the imports on purpose: babel-plugin-jest-hoist lifts `jest.mock` above them at
// transform time regardless, so the mocks still apply, and this keeps `import/first` clean.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

describe('AppTextInput — the visible label must be the accessible name', () => {
  it('exposes its label as the input accessible name', () => {
    const { getByLabelText } = render(<AppTextInput label="Email address" placeholder="you@example.com" />);
    expect(getByLabelText('Email address')).toBeTruthy();
  });

  it('lets an explicit accessibilityLabel win over the visible label', () => {
    const { getByLabelText } = render(
      <AppTextInput label="Amount" accessibilityLabel="Buy-in amount in shekels" />,
    );
    expect(getByLabelText('Buy-in amount in shekels')).toBeTruthy();
  });

  it('marks its inline error as a live alert (Android + web)', () => {
    const { getByText } = render(<AppTextInput label="Password" error="Incorrect password" />);
    const errorNode = getByText('Incorrect password');
    expect(errorNode.props.accessibilityLiveRegion).toBe('polite');
    expect(errorNode.props.accessibilityRole).toBe('alert');
  });

  it('ALSO announces the error explicitly, because iOS implements neither prop', () => {
    // RN maps role "alert" to UIAccessibilityTraitNone on iOS and ships no iOS implementation of
    // accessibilityLiveRegion. Relying on the props alone would leave auth failures silent on
    // iOS — the platform this app shipped on first.
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    render(<AppTextInput label="Password" error="Incorrect password" />);
    expect(spy).toHaveBeenCalledWith('Incorrect password');
    spy.mockRestore();
  });

  it('does not re-announce an unchanged error on re-render', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const { rerender } = render(<AppTextInput label="Password" error="Incorrect password" />);
    rerender(<AppTextInput label="Password" error="Incorrect password" />);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('says nothing when there is no error', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    render(<AppTextInput label="Password" />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not mark the hint as an alert', () => {
    const { getByText } = render(<AppTextInput label="Name" hint="Shown to your group" />);
    expect(getByText('Shown to your group').props.accessibilityRole).toBeUndefined();
  });
});

describe('PrimaryButton — named even while loading', () => {
  it('keeps an accessible name when loading replaces the label with a spinner', () => {
    const { getByLabelText } = render(<PrimaryButton label="Create group" loading onPress={() => {}} />);
    expect(getByLabelText('Create group')).toBeTruthy();
  });

  it('still honours an explicit accessibilityLabel', () => {
    const { getByLabelText } = render(
      <PrimaryButton label="Save" accessibilityLabel="Save profile changes" onPress={() => {}} />,
    );
    expect(getByLabelText('Save profile changes')).toBeTruthy();
  });
});

describe('GuestNameInput — the shared hole in two half-labelled wizards', () => {
  // Q1.5a labelled every AppTextInput, which left NewGameScreen announcing in step 1 and silent
  // in step 2, and LocalNewGameScreen complete except here. A half-announced form is worse than a
  // silent one: the user cannot calibrate what the silence means.
  const props = {
    value: '',
    onChangeText: () => {},
    onAdd: () => {},
    suggestions: [] as string[],
    onPickSuggestion: () => {},
  };

  it('names its text field', () => {
    const { getByLabelText } = render(<GuestNameInput {...props} />);
    expect(getByLabelText('Guest name')).toBeTruthy();
  });

  it('gives the Add button a role and a name', () => {
    const { getByLabelText } = render(<GuestNameInput {...props} value="Dan" />);
    const add = getByLabelText('Add guest');
    expect(add.props.accessibilityRole).toBe('button');
  });

  it('reports the Add button as disabled when there is nothing to add', () => {
    // It is visually dimmed and functionally disabled; without accessibilityState a screen reader
    // announces an ordinary button that silently does nothing.
    const { getByLabelText } = render(<GuestNameInput {...props} value="   " />);
    expect(getByLabelText('Add guest').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('names each suggestion chip with what it ACTUALLY does', () => {
    // Not "Add Dan". The chip only fills the field — the user must still press Add. The earlier
    // label promised an action the tap does not perform, and this test pinned the wrong string.
    const { getByLabelText } = render(<GuestNameInput {...props} suggestions={['Dan', 'Ron']} />);
    expect(getByLabelText('Use Dan').props.accessibilityRole).toBe('button');
    expect(getByLabelText('Use Ron')).toBeTruthy();
  });

  it('takes its field name from the caller vocabulary, not a hardcoded "Guest"', () => {
    const { getByLabelText } = render(
      <GuestNameInput {...props} placeholder="Player name..." />,
    );
    expect(getByLabelText('Player name')).toBeTruthy();
  });
});

/**
 * The two list rows carry a COMPOSED accessible name, and these tests exist because the role
 * ratchet cannot see it: its only predicate is the literal string `accessibilityRole`, so the role
 * half of that commit was revert-tested and the name half was pinned by nothing at all. Deleting
 * either label left all 1,106 tests green — an unpinned fix, by this repo's own rule.
 *
 * Expected strings are written as LITERALS rather than rebuilt from `formatPL`/the component's own
 * array, so a test cannot follow the code it guards. Currency is the module default (ILS).
 *
 * These also pin the thing automation kept missing: that the spoken name matches what is on SCREEN.
 * Every case below was a real defect — an omitted chip, an omitted money value, or a plural rule
 * written twice with two different answers.
 */
describe('SessionListItem — the row announces everything the row shows', () => {
  const base = { name: 'Friday Night', meta: '3 players · 2h', onPress: () => {} };

  it('names a finished row with its result badge, meta and P&L', () => {
    const { getByLabelText } = render(
      <SessionListItem {...base} status="Finished" profitLoss={-4250} showResultBadge />,
    );
    expect(getByLabelText('Friday Night, loss, 3 players · 2h, -₪4,250')).toBeTruthy();
  });

  it('announces a break-even row as EVEN, not as a gain', () => {
    // The visible Chip reads "EVEN" while formatPL(0) reads "+₪0". Announcing only the number told
    // a screen-reader user they had won money on a session where they broke even.
    const { getByLabelText } = render(
      <SessionListItem {...base} status="Finished" profitLoss={0} showResultBadge />,
    );
    expect(getByLabelText('Friday Night, even, 3 players · 2h, +₪0')).toBeTruthy();
  });

  it('says "live" for an active row and omits the result badge', () => {
    const { getByLabelText } = render(
      <SessionListItem {...base} status="Active" profitLoss={1200} showResultBadge />,
    );
    expect(getByLabelText('Friday Night, live, 3 players · 2h, +₪1,200')).toBeTruthy();
  });

  it('omits the badge term wherever the badge is not rendered', () => {
    const { getByLabelText } = render(
      <SessionListItem {...base} status="Finished" profitLoss={-4250} />,
    );
    expect(getByLabelText('Friday Night, 3 players · 2h, -₪4,250')).toBeTruthy();
  });

  it('drops the money term when there is no P&L to show', () => {
    const { getByLabelText } = render(<SessionListItem {...base} status="Draft" />);
    expect(getByLabelText('Friday Night, 3 players · 2h')).toBeTruthy();
  });
});

describe('GroupListItem — the row announces everything the row shows', () => {
  it('includes the P&L chip the row renders', () => {
    // Regression, not merely an omission: with no explicit label RN derived a name from the child
    // <Text> nodes, which INCLUDED this number. Adding a label that omits it made the value
    // unreachable, because accessibilityRole="button" collapses the row to one element.
    const { getByLabelText } = render(
      <GroupListItem name="Poker Crew" memberCount={4} role="Owner" myGroupPL={-450} myGroupSessions={12} onPress={() => {}} />,
    );
    expect(getByLabelText('Poker Crew, Owner, 4 members · 12 sessions, -₪450')).toBeTruthy();
  });

  it('uses ONE meta string for both the visible line and the name', () => {
    // The plural rule was written twice and disagreed: the label said "1 session" while the row
    // rendered "1 sessions". A single source makes drift structurally impossible, which is what the
    // commit claimed and did not do.
    const { getByLabelText, getByText } = render(
      <GroupListItem name="Solo Crew" memberCount={1} myGroupSessions={1} onPress={() => {}} />,
    );
    expect(getByText('1 member · 1 session')).toBeTruthy();
    expect(getByLabelText('Solo Crew, 1 member · 1 session')).toBeTruthy();
  });

  it('omits sessions and P&L when the row shows neither', () => {
    const { getByLabelText } = render(
      <GroupListItem name="New Crew" memberCount={2} myGroupSessions={0} onPress={() => {}} />,
    );
    expect(getByLabelText('New Crew, 2 members')).toBeTruthy();
  });
});

describe('BrandHeader — the screen title is a header landmark', () => {
  it('marks the title with accessibilityRole="header"', () => {
    // One line here gives ~30 screens a header landmark, which is how a screen-reader user
    // orients on arrival.
    const { getByText } = render(
      <View><BrandHeader variant="screen" title="Session" /></View>,
    );
    expect(getByText('Session').props.accessibilityRole).toBe('header');
  });
});
