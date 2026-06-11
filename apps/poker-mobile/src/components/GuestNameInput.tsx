import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onAdd: () => void;
  /** Recent-name suggestion chips (already filtered by the caller). */
  suggestions: string[];
  onPickSuggestion: (name: string) => void;
  placeholder?: string;
};

/** Name input + Add button + recent-name suggestions — used by the New Game wizards. */
export default function GuestNameInput({
  value,
  onChangeText,
  onAdd,
  suggestions,
  onPickSuggestion,
  placeholder = 'Guest name...',
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addBtn, !value.trim() && styles.addBtnDisabled]}
          onPress={onAdd}
          disabled={!value.trim()}
        >
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsLabel}>Recent:</Text>
          <View style={styles.chipRow}>
            {suggestions.map(name => (
              <TouchableOpacity key={name} style={styles.suggestionChip} onPress={() => onPickSuggestion(name)}>
                <Text style={styles.suggestionChipText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  addBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  suggestions: { gap: 8 },
  suggestionsLabel: { fontSize: 11, color: colors.textDim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  suggestionChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
});
