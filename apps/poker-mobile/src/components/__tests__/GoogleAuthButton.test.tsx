import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// PressableScale is GoogleAuthButton's root — mock it to a plain touchable that
// forwards all props (including the merged `style` array + accessibilityLabel) so we
// can inspect exactly what the button hands its root element.
jest.mock('../motion/PressableScale', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (props: any) => <Pressable {...props} /> };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: ({ name }: { name?: string }) => <View testID={`icon-${name}`} /> };
});

import GoogleAuthButton from '../GoogleAuthButton';

const root = () => screen.getByLabelText('Continue with Google');

describe('GoogleAuthButton — external style forwarding', () => {
  // The Apple-above-Google reorder relies on this: when Apple renders first, the
  // (now-second) Google button carries the 12px separator via an external style.
  it('applies an external style onto the button root', () => {
    render(<GoogleAuthButton onPress={() => {}} style={{ marginTop: 12 }} />);
    expect(StyleSheet.flatten(root().props.style)).toMatchObject({ marginTop: 12 });
  });

  it('adds no stray margin when no style is passed (flush single-provider layout)', () => {
    render(<GoogleAuthButton onPress={() => {}} />);
    expect(StyleSheet.flatten(root().props.style).marginTop).toBeUndefined();
  });
});
