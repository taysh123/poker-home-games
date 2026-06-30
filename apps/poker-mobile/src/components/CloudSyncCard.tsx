/**
 * CloudSyncCard — the Cloud Sync section on ProfileScreen (Settings host).
 *
 * HONESTY: `cloud_sync` is NOT live yet (config marks it comingSoon). The SHIPPING
 * state is an honest "Coming soon" card — a Chip + brief copy, NO functional
 * buttons and NO network. The full functional branch (last-backed-up, Back up /
 * Restore, auto-sync, premium gate) is built below but only renders once
 * `isFeatureLive('cloud_sync')` flips true (a future wave). Do not flip the flag here.
 *
 * Styling mirrors ProfileScreen's section cards so it blends into the screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import Chip from './Chip';
import PrimaryButton from './PrimaryButton';
import { useEntitlements } from '../context/EntitlementsContext';
import { isFeatureLive } from '../features/premium/config';
import {
  backupNow,
  restore,
  getLastBackupAt,
  CloudSyncError,
  type CloudSyncErrorReason,
} from '../local/cloudSyncService';
import * as SecureStore from '../utils/storage';
import { timeAgo } from '../utils/formatters';
import { confirmDialog } from '../utils/confirm';
import { showToast } from '../utils/toast';

type Props = {
  /** Invoked from the (future) live branch when a free user taps "Go Premium". */
  onGoPremium?: () => void;
};

const AUTO_SYNC_KEY = 'tpoker.cloudSync.autoSync';

const ERROR_COPY: Record<CloudSyncErrorReason, string> = {
  not_available: "Cloud Sync isn't available yet.",
  requires_account: 'Please sign in again to sync.',
  requires_premium: 'Cloud Sync is a Premium feature.',
  conflict: 'Sync ran into a conflict — please try again.',
  unavailable: 'Sync is unavailable. Check your connection and try again.',
};

function SectionHeader({ showSoon }: { showSoon: boolean }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name="cloud-outline" size={14} color={colors.gold} />
        </View>
        <Text style={styles.sectionTitle} accessibilityRole="header">Cloud Sync</Text>
      </View>
      {showSoon && <Chip label="Coming soon" tone="gold" icon="time-outline" />}
    </View>
  );
}

export default function CloudSyncCard({ onGoPremium }: Props) {
  const live = isFeatureLive('cloud_sync');
  // Read entitlement unconditionally (hook rule) — only consumed in the live branch.
  const { isPremium } = useEntitlements();

  // ── Shipping state: honest "Coming soon", no buttons, no network. ──
  if (!live) {
    return (
      <View style={styles.section} accessibilityLabel="Cloud Sync, coming soon">
        <SectionHeader showSoon />
        <Text style={styles.copy}>
          Automatic backups and multi-device sync for your games. We're putting the
          finishing touches on it — it'll arrive in a future update.
        </Text>
      </View>
    );
  }

  return <CloudSyncLive isPremium={isPremium} onGoPremium={onGoPremium} />;
}

// ── Functional branch (flag-gated; not reached while cloud_sync is comingSoon) ──
function CloudSyncLive({ isPremium, onGoPremium }: { isPremium: boolean; onGoPremium?: () => void }) {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'backup' | 'restore'>(null);
  const [autoSync, setAutoSync] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ts, pref] = await Promise.all([getLastBackupAt(), SecureStore.getItemAsync(AUTO_SYNC_KEY)]);
      if (!cancelled) {
        setLastBackupAt(ts);
        setAutoSync(pref === '1');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const requireToken = useCallback(async (): Promise<string> => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) throw new CloudSyncError('requires_account');
    return token;
  }, []);

  const reportError = (e: unknown) => {
    const reason: CloudSyncErrorReason = e instanceof CloudSyncError ? e.reason : 'unavailable';
    showToast(ERROR_COPY[reason], 'error');
  };

  const handleBackup = useCallback(async () => {
    setBusy('backup');
    try {
      const token = await requireToken();
      const { lastBackupAt: ts } = await backupNow(token);
      setLastBackupAt(ts);
      showToast('Backed up to the cloud.', 'success');
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(null);
    }
  }, [requireToken]);

  const handleRestore = useCallback(() => {
    confirmDialog(
      'Restore from cloud',
      'This merges your cloud games into this device. Nothing on this device is lost.',
      'Restore',
      async () => {
        setBusy('restore');
        try {
          const token = await requireToken();
          await restore(token);
          showToast('Restored from the cloud.', 'success');
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(null);
        }
      },
    );
  }, [requireToken]);

  const toggleAutoSync = useCallback(async (next: boolean) => {
    setAutoSync(next);
    try { await SecureStore.setItemAsync(AUTO_SYNC_KEY, next ? '1' : '0'); } catch { /* best-effort */ }
  }, []);

  // Free users: premium gate → upsell.
  if (!isPremium) {
    return (
      <View style={styles.section}>
        <SectionHeader showSoon={false} />
        <Text style={styles.copy}>
          Back up your games and keep them in sync across every device. Available with
          T Poker Premium.
        </Text>
        <PrimaryButton
          label="Go Premium"
          onPress={() => onGoPremium?.()}
          accessibilityLabel="Go Premium to unlock Cloud Sync"
          style={styles.upsellBtn}
        />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader showSoon={false} />

      <View style={styles.statusRow}>
        <Ionicons name="time-outline" size={15} color={colors.textMuted} />
        <Text style={styles.statusText}>
          {lastBackupAt ? `Last backed up ${timeAgo(lastBackupAt)}` : 'Not backed up yet'}
        </Text>
      </View>

      <View style={styles.btnRow}>
        <PrimaryButton
          label="Back up now"
          onPress={handleBackup}
          loading={busy === 'backup'}
          disabled={busy !== null}
          fullWidth={false}
          style={styles.flexBtn}
        />
        <PrimaryButton
          variant="outline"
          label="Restore"
          onPress={handleRestore}
          loading={busy === 'restore'}
          disabled={busy !== null}
          fullWidth={false}
          style={styles.flexBtn}
        />
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>Auto-sync</Text>
          <Text style={styles.toggleSub}>Back up automatically after each game</Text>
        </View>
        <Switch
          value={autoSync}
          onValueChange={toggleAutoSync}
          trackColor={{ true: colors.gold, false: colors.border }}
          thumbColor={colors.text}
          accessibilityRole="switch"
          accessibilityLabel="Auto-sync after each game"
          accessibilityState={{ checked: autoSync }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.goldFaint,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },

  copy: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  upsellBtn: { marginTop: 14 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  statusText: { fontSize: 13, color: colors.textHigh, fontWeight: '500' },

  btnRow: { flexDirection: 'row', gap: 10 },
  flexBtn: { flex: 1 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 44,
  },
  toggleText: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontSize: 14, color: colors.text, fontWeight: '600' },
  toggleSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
