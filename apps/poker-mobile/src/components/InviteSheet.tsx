import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Platform,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { USE_NATIVE_DRIVER } from '../theme/motion';
import PressableScale from './motion/PressableScale';
import { showToast } from '../utils/toast';
import { copyToClipboard } from '../utils/clipboard';
import { buildInviteMessage, formatInviteExpiry, type InviteKind } from '../utils/invite';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Which invite flow — drives the share copy. */
  kind: InviteKind;
  /** The group or session name, shown in the header + share message. */
  title: string;
  /** The deep-link URL to encode in the QR and share/copy. */
  url: string;
  /** Optional ISO expiry — rendered as a human "Expires in …" line. */
  expiresAt?: string;
};

/**
 * Shared invite sheet (2.3) — a bottom-sheet modal that shows a scannable QR of the invite link,
 * plus Share + Copy. ADDITIVE: the existing one-tap Share is unchanged; this is opened from a new
 * "Show QR" action on the group + session invite surfaces. Display-only — no camera/scanner. QR
 * sits on a white tile so its dark modules stay high-contrast against the deep-navy sheet.
 */
export default function InviteSheet({ visible, onClose, kind, title, url, expiresAt }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(360)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, bounciness: 0, speed: 18 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 360, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const expiry = expiresAt ? formatInviteExpiry(expiresAt, Date.now()) : null;

  async function onShare() {
    setSharing(true);
    try {
      await Share.share({ message: buildInviteMessage(kind, title, url), url });
    } catch {
      // Web desktop has no Web Share API — fall back to clipboard.
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Invite link copied!', 'success');
      }
    } finally {
      setSharing(false);
    }
  }

  async function onCopy() {
    try {
      await copyToClipboard(url);
      showToast('Invite link copied!', 'success');
    } catch {
      showToast('Could not copy the link.', 'error');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <TouchableWithoutFeedback onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }, { transform: [{ translateY }] }]}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Scan to join</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{title}</Text>
            </View>
            <PressableScale
              onPress={onClose}
              hitSlop={10}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </PressableScale>
          </View>

          {/* White tile keeps the dark QR modules high-contrast + scannable on the navy sheet. */}
          <View style={styles.qrTile} accessible accessibilityLabel={`QR code to join ${title}`}>
            <QRCode value={url} size={200} color="#0F1923" backgroundColor="#FFFFFF" quietZone={16} />
          </View>

          <Text style={styles.link} numberOfLines={1} ellipsizeMode="middle">{url}</Text>
          {expiry && <Text style={styles.expiry}>{expiry}</Text>}

          <View style={styles.actions}>
            <PressableScale
              onPress={onShare}
              disabled={sharing}
              haptic="medium"
              accessibilityRole="button"
              accessibilityLabel="Share invite link"
              style={styles.shareWrap}
            >
              <LinearGradient
                colors={[colors.goldLight, colors.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.btn, styles.shareBtn, sharing && styles.btnDisabled]}
              >
                <Ionicons name="share-outline" size={18} color={colors.background} />
                <Text style={styles.shareLabel}>Share</Text>
              </LinearGradient>
            </PressableScale>

            <PressableScale
              onPress={onCopy}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Copy invite link"
              style={[styles.btn, styles.copyBtn]}
            >
              <Ionicons name="copy-outline" size={18} color={colors.text} />
              <Text style={styles.copyLabel}>Copy link</Text>
            </PressableScale>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  qrTile: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  link: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  expiry: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  shareWrap: { flex: 1 },
  shareBtn: { width: '100%' },
  btnDisabled: { opacity: 0.6 },
  shareLabel: { ...typography.label, color: colors.background },
  copyBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  copyLabel: { ...typography.label, color: colors.text },
});
