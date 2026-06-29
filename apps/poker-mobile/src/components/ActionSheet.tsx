import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { USE_NATIVE_DRIVER } from '../theme/motion';
import GlassView from './motion/GlassView';

export type ActionSheetOption = {
  label: string;
  onPress: () => void;
  style?: 'default' | 'destructive' | 'cancel';
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
};

export default function ActionSheet({ visible, onClose, title, subtitle, options }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, bounciness: 0, speed: 20 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 300, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const mainOptions  = options.filter(o => o.style !== 'cancel');
  const cancelOption = options.find(o => o.style === 'cancel');

  function handleOption(opt: ActionSheetOption) {
    onClose();
    // Small delay so sheet closes before action fires
    setTimeout(opt.onPress, Platform.OS === 'web' ? 0 : 100);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheetWrapper,
            { paddingBottom: insets.bottom + 8 },
            { transform: [{ translateY }] },
          ]}
        >
          {/* Main options card */}
          <GlassView style={styles.card}>
            {(title || subtitle) && (
              <View style={styles.header}>
                {title   && <Text style={styles.title}   numberOfLines={1}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
              </View>
            )}
            {mainOptions.map((opt, i) => (
              <React.Fragment key={opt.label}>
                {(i > 0 || title || subtitle) && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => handleOption(opt)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      opt.style === 'destructive' && styles.optionLabelDestructive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </GlassView>

          {/* Cancel — separate card */}
          {cancelOption && (
            <TouchableOpacity
              style={styles.cancelCard}
              onPress={onClose}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={cancelOption.label}
            >
              <Text style={styles.cancelLabel}>{cancelOption.label}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetWrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    gap: 10,
  },
  card: {
    // background comes from GlassView (blur on iOS, colors.surface elsewhere)
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 3,
  },
  title:    { fontSize: 13, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: 0 },
  option: {
    paddingVertical: 17,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  optionLabelDestructive: {
    color: colors.error,
    fontWeight: '600',
  },
  cancelCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 17,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
