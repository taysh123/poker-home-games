import React, { forwardRef } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import Avatar from './Avatar';
import { formatCents } from '../utils/money';

export type ShareCardRow = {
  name: string;
  /** e.g. "+₪75" or "wins ₪100" */
  valueText: string;
  positive: boolean;
  /** Tokenized rank label e.g. "#1" for the tournament podium; omitted otherwise. */
  medal?: string;
};

export type ShareCardData = {
  title: string;
  heading: string; // 'GAME OVER' | 'TOURNAMENT COMPLETE'
  potLabel: string; // 'TOTAL POT' | 'PRIZE POOL'
  potCents: number;
  dateText: string;
  rows: ShareCardRow[]; // top 3
};

export const canShareImages = Platform.OS !== 'web';

/** Capture the off-screen card and open the system share sheet (native only). */
export async function shareCardImage(ref: React.RefObject<View | null>): Promise<void> {
  if (!canShareImages || !ref.current) return;
  const uri = await captureRef(ref, { format: 'png', quality: 1 });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share result' });
}

/**
 * Branded result card rendered OFF-SCREEN (absolute, far left) purely as a
 * capture target for image sharing. Never visible in the layout.
 */
const ShareCard = forwardRef<View, { data: ShareCardData }>(({ data }, ref) => {
  if (!canShareImages) return null;
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      {/* Brand */}
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.brand}>T POKER</Text>
      </View>

      <Text style={styles.heading}>{data.heading}</Text>
      <Text style={styles.title} numberOfLines={1}>{data.title}</Text>

      <View style={styles.potWrap}>
        <Text style={styles.potLabel}>{data.potLabel}</Text>
        <Text style={styles.potValue}>{formatCents(data.potCents)}</Text>
      </View>

      {data.rows.map((row, i) => (
        <View key={i} style={[styles.row, i === 0 && styles.rowFirst]}>
          <Text style={styles.medal}>{row.medal ?? `#${i + 1}`}</Text>
          <Avatar name={row.name} size={34} />
          <Text style={styles.rowName} numberOfLines={1}>{row.name}</Text>
          <Text style={[styles.rowValue, { color: row.positive ? colors.success : colors.error }]}>
            {row.valueText}
          </Text>
        </View>
      ))}

      <Text style={styles.footer}>{data.dateText} · tracked with T Poker</Text>
    </View>
  );
});

export default ShareCard;

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: -2000,
    top: 0,
    width: 360,
    padding: 24,
    backgroundColor: colors.backgroundDeep,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    gap: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 30, height: 30 },
  brand: { ...typography.displaySerif, fontSize: 18, color: colors.goldLight, letterSpacing: 3 },
  heading: { fontSize: 11, fontWeight: '800', color: colors.goldLight, letterSpacing: 2.4 },
  title: { ...typography.displaySerif, fontSize: 26, color: colors.text },
  potWrap: { marginVertical: 4 },
  potLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.4 },
  potValue: { ...typography.amountHero, fontSize: 36, color: colors.gold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowFirst: { borderColor: colors.goldMuted, backgroundColor: colors.goldFaint },
  medal: { fontSize: 16, width: 28, textAlign: 'center' },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  rowValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  footer: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
