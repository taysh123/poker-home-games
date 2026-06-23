import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';

interface Props {
  children: React.ReactNode;   // the trigger
  content: React.ReactNode;    // the popover content (web only)
  disabled?: boolean;
  minWidth?: number;
}

/**
 * Web-only hover/focus popover. On native this is a passthrough (renders just the trigger) — callers use
 * `DetailSheet` for the mobile fallback. Keyboard-accessible: focusing the trigger (Tab) opens it; blur closes.
 * No animation ⇒ reduced-motion-safe by construction.
 */
export default function HoverCard({ children, content, disabled, minWidth = 248 }: Props) {
  const [open, setOpen] = useState(false);
  if (Platform.OS !== 'web' || disabled) return <>{children}</>;
  return (
    <View style={styles.wrap}>
      <Pressable
        onHoverIn={() => setOpen(true)}
        onHoverOut={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
      {open ? <View style={[styles.pop, { minWidth }]} pointerEvents="none">{content}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  pop: {
    position: 'absolute',
    top: '100%',
    left: 0,
    zIndex: 1000,
    marginTop: 6,
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    ...shadows.lg,
  },
});
