import React from 'react';
import { View, StyleSheet } from 'react-native';
import { chipBreakdown } from '../../utils/pokerTable';

/**
 * Lightweight stacked-chips visual from a cent amount (V2.1 STEP 5.3). Purely cosmetic; reused by Pot
 * and seats. Structured so chips-into-pot motion can be layered on later.
 */
export default function ChipStack({ amountCents, chipWidth = 22 }: { amountCents: number; chipWidth?: number }) {
  const chips = chipBreakdown(amountCents);
  if (chips.length === 0) return null;
  const h = chipWidth * 0.32;
  const step = h * 0.7;
  return (
    <View style={{ width: chipWidth, height: h + step * (chips.length - 1) }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {chips.map((c, i) => (
        <View
          key={i}
          style={[
            styles.chip,
            { width: chipWidth, height: h, borderRadius: h / 2, backgroundColor: c.color, bottom: i * step },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
