import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
};

export default function AppTextInput({ label, error, hint, prefix, style, onFocus, onBlur, ...rest }: Props) {
  const [isFocused, setIsFocused] = useState(false);

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
        />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
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
    borderRadius: 12,
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
