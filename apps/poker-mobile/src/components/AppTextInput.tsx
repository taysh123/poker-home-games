import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
};

export default function AppTextInput({ label, error, hint, prefix, style, onFocus, onBlur, ...rest }: Props) {
  const [isFocused, setIsFocused] = useState(false);

  // Announce the error explicitly. The live region + alert role below cover Android and web, but
  // NOT iOS: RN maps role "alert" to UIAccessibilityTraitNone and ships no iOS implementation of
  // accessibilityLiveRegion at all. Without this, a VoiceOver user submitting a form got no
  // feedback that it had failed — which is most of the reason this change exists.
  const announcedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (error && error !== announcedRef.current) {
      AccessibilityInfo.announceForAccessibility?.(error);
    }
    announcedRef.current = error;
  }, [error]);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isFocused && !error && styles.labelFocused]}>{label}</Text>
      <View style={[
        styles.inputWrapper,
        !!error && styles.inputWrapperError,
        isFocused && !error && styles.inputWrapperFocused,
      ]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={[styles.input, prefix ? styles.inputWithPrefix : undefined, style as any]}
          placeholderTextColor={colors.textDim}
          onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
          {...rest}
          // React Native has no htmlFor/aria-labelledby, so the visible <Text> above is NOT this
          // input's accessible name — it announced as "text field, <placeholder>". Bind it here so
          // every caller inherits a correct name instead of remembering to pass one.
          // After {...rest} deliberately: `rest.accessibilityLabel` is read explicitly below, so an
          // explicit caller label still wins.
          //
          // `label || undefined`, not `?? label`: one caller passes `label=""` (LocalSessionScreen's
          // Final Count rows, which draw the player's name in a sibling Text instead). `??` would
          // forward the empty string as the accessible name; falling through to `undefined` lets RN
          // derive one instead of pinning an empty label.
          accessibilityLabel={rest.accessibilityLabel ?? (label || undefined)}
        />
      </View>
      {error ? (
        // Covers Android (roleDescription + polite live region) and web (role=alert + aria-live).
        // iOS is covered by the explicit announceForAccessibility above, because RN implements
        // neither of these props there.
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
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
  labelFocused: { color: colors.gold },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.control,
    paddingHorizontal: 16,
  },
  inputWrapperError: { borderColor: colors.error },
  inputWrapperFocused: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceHigh,
  },
  prefix: { fontSize: 16, color: colors.textMuted, marginRight: 6, fontWeight: '600' },
  input: {
    flex: 1,
    minWidth: 0, // allow the input to shrink inside narrow flex containers (web <input> min-width:auto fix)
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputWithPrefix: { paddingLeft: 0 },
  error: { fontSize: 12, color: colors.error, fontWeight: '500' },
  hint: { fontSize: 12, color: colors.textMuted },
});
