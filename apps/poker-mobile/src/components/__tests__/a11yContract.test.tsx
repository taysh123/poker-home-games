/**
 * Accessibility contracts for the shared form/chrome components.
 *
 * These four components are where the app's a11y leverage lives: fixing them repairs ~45 defects
 * across ~20 screens, because a screen using `AppTextInput` or `PrimaryButton` should inherit a
 * correct accessible name rather than remembering to supply one.
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
import { Text, TextInput, View } from 'react-native';
import { render } from '@testing-library/react-native';

import AppTextInput from '../AppTextInput';
import BrandHeader from '../BrandHeader';
import FormRow from '../FormRow';
import PrimaryButton from '../PrimaryButton';

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

  it('announces its inline error instead of rendering it silently', () => {
    // Auth failures on Login/Register were rendered as a plain <Text> — never announced.
    const { getByText } = render(<AppTextInput label="Password" error="Incorrect password" />);
    const errorNode = getByText('Incorrect password');
    expect(errorNode.props.accessibilityLiveRegion).toBe('polite');
    expect(errorNode.props.accessibilityRole).toBe('alert');
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

describe('FormRow — binds its label to the control it wraps', () => {
  it('labels a single unlabelled child', () => {
    const { getByLabelText } = render(
      <FormRow label="Chip ratio"><TextInput placeholder="100" /></FormRow>,
    );
    expect(getByLabelText('Chip ratio')).toBeTruthy();
  });

  it('leaves an already-labelled child untouched', () => {
    const { getByLabelText, queryByLabelText } = render(
      <FormRow label="Chip ratio"><TextInput accessibilityLabel="Chips per shekel" /></FormRow>,
    );
    expect(getByLabelText('Chips per shekel')).toBeTruthy();
    expect(queryByLabelText('Chip ratio')).toBeNull();
  });

  it('passes multiple children through unchanged rather than guessing', () => {
    // Cloning is only safe for a single control; with several we cannot know which owns the label.
    const { getByText } = render(
      <FormRow label="Blinds"><Text>a</Text><Text>b</Text></FormRow>,
    );
    expect(getByText('a')).toBeTruthy();
    expect(getByText('b')).toBeTruthy();
  });

  it('tolerates a non-element child without crashing', () => {
    // Cloning must be guarded by isValidElement — a null/conditional child is common.
    const { getByText } = render(
      <FormRow label="Notes">{null}<Text>after</Text></FormRow>,
    );
    expect(getByText('after')).toBeTruthy();
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
