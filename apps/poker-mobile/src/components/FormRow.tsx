import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  label: string;
  children: React.ReactNode;
  hint?: string;
};

/**
 * Labelled form row.
 *
 * React Native has no `htmlFor`/`aria-labelledby`, so rendering the label as a SIBLING of the
 * control leaves that control with no accessible name — it announces as "text field,
 * <placeholder>" while looking perfectly labelled on screen. Since this component owns the label
 * and the caller owns the control, the binding has to happen here.
 *
 * We clone ONLY when there is exactly one valid element child that has no `accessibilityLabel`
 * of its own. Multiple children are passed through untouched: with several controls we cannot
 * know which one the label belongs to, and guessing would attach it to the wrong thing.
 */
export default function FormRow({ label, children, hint }: Props) {
  const childArray = React.Children.toArray(children);
  const onlyChild = childArray.length === 1 ? childArray[0] : null;
  const element =
    onlyChild && React.isValidElement(onlyChild)
      ? (onlyChild as React.ReactElement<{ accessibilityLabel?: string }>)
      : null;

  const labelled =
    element && element.props.accessibilityLabel == null
      ? React.cloneElement(element, { accessibilityLabel: label })
      : children;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {labelled}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hint: { fontSize: 12, color: colors.textMuted },
});
