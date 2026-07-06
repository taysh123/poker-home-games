import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Motion layer → plain Views (recipes stay real — they're pure).
jest.mock('../../components/motion/PressableScale', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (props: any) => <Pressable {...props} /> };
});
jest.mock('../../components/motion', () => {
  const { View } = require('react-native');
  const recipes = jest.requireActual('../../components/motion/recipes');
  return {
    __esModule: true,
    ...recipes,
    MotiView: ({ children, ...rest }: any) => <View {...rest}>{children}</View>,
  };
});
jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: ({ name }: { name?: string }) => <View testID={`icon-${name}`} /> };
});

import Accordion from '../Accordion';

const ITEMS = [
  { id: 'gambling', title: 'Is T Poker a gambling product?', body: 'No — it never touches real money.' },
  { id: 'age', title: 'Who is it for?', body: 'Adults 18+ running private home games.' },
  { id: 'free', title: 'Is it free?', body: 'Yes, the core game tools are free.' },
];

describe('Accordion — FAQ', () => {
  it('renders every question; all answers start collapsed', () => {
    render(<Accordion items={ITEMS} />);
    for (const it of ITEMS) expect(screen.getByText(it.title)).toBeTruthy();
    for (const it of ITEMS) expect(screen.queryByText(it.body)).toBeNull();
  });

  it('tapping a question expands its answer', () => {
    render(<Accordion items={ITEMS} />);
    fireEvent.press(screen.getByText(ITEMS[0].title));
    expect(screen.getByText(ITEMS[0].body)).toBeTruthy();
  });

  it('single-open: expanding a second question collapses the first', () => {
    render(<Accordion items={ITEMS} />);
    fireEvent.press(screen.getByText(ITEMS[0].title));
    fireEvent.press(screen.getByText(ITEMS[1].title));
    expect(screen.queryByText(ITEMS[0].body)).toBeNull();
    expect(screen.getByText(ITEMS[1].body)).toBeTruthy();
  });

  it('tapping an open question collapses it again', () => {
    render(<Accordion items={ITEMS} />);
    fireEvent.press(screen.getByText(ITEMS[0].title));
    fireEvent.press(screen.getByText(ITEMS[0].title));
    expect(screen.queryByText(ITEMS[0].body)).toBeNull();
  });

  it('a11y: headers are buttons with accessible names and expanded state', () => {
    render(<Accordion items={ITEMS} />);
    const first = screen.getByRole('button', { name: ITEMS[0].title });
    expect(first).toBeTruthy();
    expect(first.props.accessibilityState?.expanded).toBe(false);
    fireEvent.press(first);
    expect(screen.getByRole('button', { name: ITEMS[0].title }).props.accessibilityState?.expanded).toBe(true);
  });

  it('supports an initially-open item', () => {
    render(<Accordion items={ITEMS} initiallyOpenId="age" />);
    expect(screen.getByText(ITEMS[1].body)).toBeTruthy();
  });
});
