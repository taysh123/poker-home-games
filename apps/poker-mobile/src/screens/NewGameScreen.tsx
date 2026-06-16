import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getMyGroups, getGroupMembers, MyGroupDto, GroupMemberDto } from '../api/groupsApi';
import { createSession, addPlayer, startSession, getGroupSessions } from '../api/sessionsApi';
import AppTextInput from '../components/AppTextInput';
import PrimaryButton from '../components/PrimaryButton';
import StepIndicator from '../components/StepIndicator';
import GuestNameInput from '../components/GuestNameInput';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import DealInOverlay from '../components/DealInOverlay';
import { getRecentGuests, recordGuestName } from '../utils/guestHistory';
import { showToast } from '../utils/toast';
import { useActiveSession } from '../context/ActiveSessionContext';

type Props = NativeStackScreenProps<RootStackParamList, 'NewGame'>;

type AddedPlayer =
  | { type: 'member'; userId: string; username: string }
  | { type: 'guest'; name: string };

export default function NewGameScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { refresh: refreshActiveSession } = useActiveSession();

  // Step: 1 = Details, 2 = Players, 3 = Review
  const [step, setStep] = useState(1);
  const STEP_LABELS = ['Details', 'Players', 'Review'];

  const reviewAnim = useRef(new Animated.Value(0)).current;

  function goToStep(n: number) {
    setStep(n);
    if (n === 3) {
      reviewAnim.setValue(0);
      Animated.timing(reviewAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    }
  }
  const [starting, setStarting] = useState(false);
  const [dealtSessionId, setDealtSessionId] = useState<string | null>(null);

  // Step 1 state
  const defaultName = (() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[new Date().getDay()]} Night`;
  })();
  const [sessionName, setSessionName] = useState(defaultName);
  const [nameError, setNameError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(route.params?.groupId ?? null);
  const [selectedGroupName, setSelectedGroupName] = useState<string>(route.params?.groupName ?? '');
  const [chipRatio, setChipRatio] = useState('');
  const [defaultBuyIn, setDefaultBuyIn] = useState('');
  const [groups, setGroups] = useState<MyGroupDto[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Step 2 state
  const [members, setMembers] = useState<GroupMemberDto[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [guestInput, setGuestInput] = useState('');
  const [recentGuests, setRecentGuests] = useState<string[]>([]);
  const [addedPlayers, setAddedPlayers] = useState<AddedPlayer[]>([]);

  // Load groups and guest history on mount
  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      setGroupsLoading(true);
      try {
        const [g, recent] = await Promise.all([
          getMyGroups(token),
          getRecentGuests(),
        ]);
        setGroups(g);
        setRecentGuests(recent);
        // If no group pre-selected and user has exactly one group, pre-select it
        if (!selectedGroupId && g.length === 1) {
          setSelectedGroupId(g[0].id);
          setSelectedGroupName(g[0].name);
        }
      } finally {
        setGroupsLoading(false);
      }
    })();
  }, []);

  // When a group is selected, pre-fill chip ratio + buy-in from the most recent session
  useEffect(() => {
    if (!selectedGroupId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token || cancelled) return;
        const sessions = await getGroupSessions(token, selectedGroupId);
        if (cancelled) return;
        const last = sessions.find(s => s.chipRatio || s.defaultBuyIn);
        if (!last) return;
        if (last.chipRatio && !chipRatio) setChipRatio(String(last.chipRatio));
        if (last.defaultBuyIn && !defaultBuyIn) setDefaultBuyIn(String(last.defaultBuyIn));
      } catch { /* silent — pre-fill is best-effort */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  // Load members when moving to step 2 with a group selected
  const loadMembers = useCallback(async (groupId: string) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return;
    setMembersLoading(true);
    try {
      const m = await getGroupMembers(token, groupId);
      setMembers(m);
      // Pre-select the current user
      if (user) {
        const me = m.find(mem => mem.userId === user.userId);
        if (me) setSelectedMemberIds(new Set([me.userId]));
      }
    } finally {
      setMembersLoading(false);
    }
  }, [user]);

  function handleNextStep() {
    if (step === 1) {
      if (!sessionName.trim()) {
        setNameError('Session name is required.');
        return;
      }
      setNameError('');
      if (selectedGroupId) {
        loadMembers(selectedGroupId);
      }
      goToStep(2);
    } else if (step === 2) {
      // Build addedPlayers from selections
      const players: AddedPlayer[] = [];
      for (const id of selectedMemberIds) {
        const m = members.find(mem => mem.userId === id);
        if (m) players.push({ type: 'member', userId: m.userId, username: m.username });
      }
      for (const p of addedPlayers.filter(p => p.type === 'guest')) {
        players.push(p);
      }
      setAddedPlayers(players);
      goToStep(3);
    }
  }

  function toggleMember(userId: string) {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function addGuest() {
    const name = guestInput.trim();
    if (!name) return;
    if (addedPlayers.some(p => p.type === 'guest' && p.name.toLowerCase() === name.toLowerCase())) {
      setGuestInput('');
      return;
    }
    setAddedPlayers(prev => [...prev, { type: 'guest', name }]);
    setGuestInput('');
  }

  function removeGuest(name: string) {
    setAddedPlayers(prev => prev.filter(p => !(p.type === 'guest' && p.name === name)));
  }

  const guestSuggestions = guestInput.trim().length > 0
    ? recentGuests.filter(g =>
        g.toLowerCase().includes(guestInput.toLowerCase()) &&
        !addedPlayers.some(p => p.type === 'guest' && p.name.toLowerCase() === g.toLowerCase())
      ).slice(0, 5)
    : [];

  async function handleStartGame() {
    setStarting(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;

      const ratio = chipRatio ? parseFloat(chipRatio) : undefined;
      const buyIn = defaultBuyIn ? parseFloat(defaultBuyIn) : undefined;

      const session = await createSession(token, selectedGroupId, sessionName.trim(), ratio, buyIn);
      const sessionId = session.id;
      const groupId = selectedGroupId ?? '';

      // Add all players — always include the creator (solo sessions have no pre-selected members)
      const memberIds = Array.from(selectedMemberIds);
      if (user?.userId && !memberIds.includes(user.userId)) {
        await addPlayer(token, sessionId, user.userId);
      }
      for (const id of memberIds) {
        await addPlayer(token, sessionId, id);
      }
      const guestNames: string[] = [];
      for (const p of addedPlayers) {
        if (p.type === 'guest') {
          await addPlayer(token, sessionId, undefined, p.name);
          guestNames.push(p.name);
        }
      }

      // Persist guest names
      for (const name of guestNames) {
        await recordGuestName(name);
      }

      // Start the session immediately so it arrives as Active
      await startSession(token, sessionId);
      refreshActiveSession();

      showToast('Game started!', 'success');
      // wow #5: branded "Deal 'Em In" beat, then into the live session.
      setDealtSessionId(sessionId);
    } catch {
      showToast('Failed to start game. Please check your connection and try again.', 'error');
      setStarting(false);
    }
  }

  const allSelectedPlayers: AddedPlayer[] = [
    ...Array.from(selectedMemberIds).map(id => {
      const m = members.find(mem => mem.userId === id);
      return { type: 'member' as const, userId: id, username: m?.username ?? id };
    }),
    ...addedPlayers.filter(p => p.type === 'guest'),
  ];

  return (
    <Screen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="New Game" onBack={() => step > 1 ? goToStep(step - 1) : navigation.goBack()} />

      {/* Step indicator */}
      <StepIndicator steps={STEP_LABELS} current={step} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: Game Details ── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Set the Table</Text>

            <AppTextInput
              label="Session Name"
              value={sessionName}
              onChangeText={setSessionName}
              placeholder={defaultName}
              error={nameError}
              autoFocus
            />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Group</Text>
              {groupsLoading ? (
                <ActivityIndicator color={colors.gold} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
              ) : groups.length === 0 ? (
                <View style={styles.noGroupsBox}>
                  <Text style={styles.noGroupsText}>You need a group to start a game.</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
                    <Text style={styles.noGroupsLink}>+ Create Group</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.groupChip, selectedGroupId === null && styles.groupChipSelected]}
                    onPress={() => { setSelectedGroupId(null); setSelectedGroupName(''); }}
                  >
                    <Text style={[styles.groupChipText, selectedGroupId === null && styles.groupChipTextSelected]}>
                      No Group
                    </Text>
                  </TouchableOpacity>
                  {groups.map(g => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groupChip, selectedGroupId === g.id && styles.groupChipSelected]}
                      onPress={() => { setSelectedGroupId(g.id); setSelectedGroupName(g.name); }}
                    >
                      <Text style={[styles.groupChipText, selectedGroupId === g.id && styles.groupChipTextSelected]}>
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <AppTextInput
                  label="Chip Ratio"
                  value={chipRatio}
                  onChangeText={setChipRatio}
                  placeholder="e.g. 100"
                  keyboardType="decimal-pad"
                  hint="chips per ₪"
                />
              </View>
              <View style={styles.halfField}>
                <AppTextInput
                  label="Default Buy-In"
                  value={defaultBuyIn}
                  onChangeText={setDefaultBuyIn}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  prefix="₪"
                />
              </View>
            </View>

            <PrimaryButton label="Next" onPress={handleNextStep} style={styles.actionButton} />
          </View>
        )}

        {/* ── Step 2: Add Players ── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Assemble Your Crew</Text>

            {selectedGroupId && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Group Members</Text>
                {membersLoading ? (
                  <ActivityIndicator color={colors.gold} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
                ) : (
                  <View style={styles.chipRow}>
                    {members.map(m => {
                      const selected = selectedMemberIds.has(m.userId);
                      return (
                        <TouchableOpacity
                          key={m.userId}
                          style={[styles.memberChip, selected && styles.memberChipSelected]}
                          onPress={() => toggleMember(m.userId)}
                        >
                          <Text style={[styles.memberChipText, selected && styles.memberChipTextSelected]}>
                            {m.username}
                            {m.userId === user?.userId ? ' (you)' : ''}
                          </Text>
                          {selected && <Ionicons name="checkmark" size={12} color={colors.gold} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Add Guest</Text>
              <GuestNameInput
                value={guestInput}
                onChangeText={setGuestInput}
                onAdd={addGuest}
                suggestions={guestSuggestions}
                onPickSuggestion={setGuestInput}
              />
            </View>

            {/* Added guests list */}
            {addedPlayers.filter(p => p.type === 'guest').length > 0 && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Added Guests</Text>
                <View style={styles.chipRow}>
                  {addedPlayers.filter(p => p.type === 'guest').map(p => (
                    <TouchableOpacity
                      key={(p as any).name}
                      style={styles.addedGuestChip}
                      onPress={() => removeGuest((p as any).name)}
                    >
                      <Text style={styles.addedGuestChipText}>{(p as any).name}</Text>
                      <Ionicons name="close" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.actionRow}>
              <PrimaryButton label="Back" onPress={() => goToStep(1)} variant="outline" fullWidth={false} style={styles.stepBackBtn} />
              <PrimaryButton label="Review" onPress={handleNextStep} fullWidth={false} style={styles.nextBtn} />
            </View>
          </View>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Ready to Play?</Text>

            <Animated.View style={[styles.reviewCard, {
              opacity: reviewAnim,
              transform: [{ translateY: reviewAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }]}>
              <View style={styles.reviewAccent} />
              <View style={styles.reviewCardBody}>
                <Text style={styles.reviewName}>{sessionName}</Text>
                <Text style={styles.reviewMeta}>{selectedGroupName || 'No Group'}</Text>
                <Text style={styles.reviewPlayerCount}>
                  {allSelectedPlayers.length} player{allSelectedPlayers.length !== 1 ? 's' : ''} at the table
                </Text>
                <View style={styles.reviewMetaRow}>
                  {defaultBuyIn ? <Text style={styles.reviewChip}>₪{defaultBuyIn} buy-in</Text> : null}
                  {chipRatio ? <Text style={styles.reviewChip}>{chipRatio} chips/₪</Text> : null}
                </View>
              </View>
            </Animated.View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Players</Text>
              {allSelectedPlayers.length === 0 ? (
                <Text style={styles.noPlayers}>No players added — you can add them during the game.</Text>
              ) : (
                <View style={styles.chipRow}>
                  {allSelectedPlayers.map((p, i) => (
                    <View key={i} style={styles.reviewPlayerChip}>
                      <Text style={styles.reviewPlayerName}>
                        {p.type === 'guest' ? p.name : p.username}
                        {p.type === 'guest' ? ' (guest)' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <PrimaryButton label="Back" onPress={() => goToStep(2)} variant="outline" fullWidth={false} style={styles.stepBackBtn} />
              <PrimaryButton
                label="Deal 'Em In 🃏"
                onPress={handleStartGame}
                loading={starting}
                fullWidth={false}
                style={styles.nextBtn}
              />
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
    {dealtSessionId && (
      <DealInOverlay onDone={() => navigation.replace('Session', { sessionId: dealtSessionId!, groupId: selectedGroupId ?? '' })} />
    )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  scroll: { flex: 1 },
  content: { padding: 20 },
  stepContent: { gap: 24 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: colors.text },

  field: { gap: 10 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  groupChipSelected: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  groupChipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  groupChipTextSelected: { color: colors.gold },

  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
  },
  memberChipSelected: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  memberChipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  memberChipTextSelected: { color: colors.gold },
  memberChipCheck: { fontSize: 12, color: colors.gold },

  addedGuestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    backgroundColor: 'rgba(201,168,76,0.10)',
  },
  addedGuestChipText: { fontSize: 13, fontWeight: '600', color: colors.gold },
  addedGuestRemove: { fontSize: 11, color: colors.textMuted },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionButton: { marginTop: 8 },
  stepBackBtn: { flex: 1 },
  nextBtn: { flex: 2 },

  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldMuted,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.goldSm,
  },
  reviewAccent: {
    width: 4,
    backgroundColor: colors.gold,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  reviewCardBody: {
    flex: 1,
    padding: 20,
    gap: 6,
  },
  reviewName: { ...typography.h2, color: colors.text },
  reviewMeta: { fontSize: 14, color: colors.textMuted },
  reviewPlayerCount: { fontSize: 13, color: colors.goldLight, fontWeight: '600' },
  reviewMetaRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reviewChip: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },

  fieldError: { fontSize: 12, color: colors.error, marginTop: 2 },
  noGroupsBox: { gap: 8, padding: 14, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  noGroupsText: { fontSize: 13, color: colors.textMuted },
  noGroupsLink: { fontSize: 13, fontWeight: '700', color: colors.gold },
  noPlayers: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  reviewPlayerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  reviewPlayerName: { fontSize: 13, fontWeight: '600', color: colors.text },
});
