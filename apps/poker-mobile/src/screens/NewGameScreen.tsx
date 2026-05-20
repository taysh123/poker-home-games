import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getMyGroups, getGroupMembers, MyGroupDto, GroupMemberDto } from '../api/groupsApi';
import { createSession, addPlayer, startSession } from '../api/sessionsApi';
import AppTextInput from '../components/AppTextInput';
import PrimaryButton from '../components/PrimaryButton';
import { getRecentGuests, recordGuestName } from '../utils/guestHistory';
import { showToast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'NewGame'>;

type AddedPlayer =
  | { type: 'member'; userId: string; username: string }
  | { type: 'guest'; name: string };

export default function NewGameScreen({ route, navigation }: Props) {
  const { user } = useAuth();

  // Step: 1 = Details, 2 = Players, 3 = Review
  const [step, setStep] = useState(1);
  const STEP_LABELS = ['Details', 'Players', 'Review'];

  function goToStep(n: number) {
    setStep(n);
  }
  const [starting, setStarting] = useState(false);

  // Step 1 state
  const [sessionName, setSessionName] = useState('Game Night');
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

      // Add all players
      for (const id of selectedMemberIds) {
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

      showToast('Game started!', 'success');
      navigation.replace('Session', { sessionId, groupId });
    } catch {
      Alert.alert('Failed to start game', 'Please check your connection and try again.');
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? goToStep(step - 1) : navigation.goBack()} hitSlop={12}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Game</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <React.Fragment key={n}>
              {i > 0 && <View style={[styles.stepConnector, (done || active) && styles.stepConnectorActive]} />}
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, active && styles.stepCircleActive, done && styles.stepCircleDone]}>
                  <Text style={[styles.stepCircleText, active && styles.stepCircleTextActive, done && styles.stepCircleTextDone]}>
                    {done ? '✓' : String(n)}
                  </Text>
                </View>
                <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: Game Details ── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Game Details</Text>

            <AppTextInput
              label="Session Name"
              value={sessionName}
              onChangeText={setSessionName}
              placeholder="Game Night"
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

            <PrimaryButton label="Next →" onPress={handleNextStep} style={styles.actionButton} />
          </View>
        )}

        {/* ── Step 2: Add Players ── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Players</Text>

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
                          {selected && <Text style={styles.memberChipCheck}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Add Guest</Text>
              <View style={styles.guestInputRow}>
                <TextInput
                  style={styles.guestInput}
                  value={guestInput}
                  onChangeText={setGuestInput}
                  placeholder="Guest name..."
                  placeholderTextColor={colors.textDim}
                  onSubmitEditing={addGuest}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addGuestBtn, !guestInput.trim() && styles.addGuestBtnDisabled]}
                  onPress={addGuest}
                  disabled={!guestInput.trim()}
                >
                  <Text style={styles.addGuestBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              {guestSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  <Text style={styles.suggestionsLabel}>Recent:</Text>
                  <View style={styles.chipRow}>
                    {guestSuggestions.map(name => (
                      <TouchableOpacity
                        key={name}
                        style={styles.suggestionChip}
                        onPress={() => { setGuestInput(name); }}
                      >
                        <Text style={styles.suggestionChipText}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
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
                      <Text style={styles.addedGuestRemove}> ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.actionRow}>
              <PrimaryButton label="← Back" onPress={() => goToStep(1)} variant="outline" fullWidth={false} style={styles.backBtn} />
              <PrimaryButton label="Review →" onPress={handleNextStep} fullWidth={false} style={styles.nextBtn} />
            </View>
          </View>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review</Text>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewName}>{sessionName}</Text>
              <Text style={styles.reviewMeta}>{selectedGroupName || 'No Group'}</Text>
              <View style={styles.reviewMetaRow}>
                {defaultBuyIn ? <Text style={styles.reviewChip}>₪{defaultBuyIn} buy-in</Text> : null}
                {chipRatio ? <Text style={styles.reviewChip}>{chipRatio} chips/₪</Text> : null}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Players ({(selectedMemberIds.size + addedPlayers.filter(p => p.type === 'guest').length) || allSelectedPlayers.length})
              </Text>
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
              <PrimaryButton label="← Back" onPress={() => goToStep(2)} variant="outline" fullWidth={false} style={styles.backBtn} />
              <PrimaryButton
                label="Start Game ▶"
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
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backArrow: { fontSize: 28, color: colors.text, lineHeight: 32 },
  headerTitle: { flex: 1, ...typography.h3, color: colors.text },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepItem: { alignItems: 'center', gap: 6 },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 18,
    marginHorizontal: 4,
    maxWidth: 48,
  },
  stepConnectorActive: { backgroundColor: colors.gold },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.15)' },
  stepCircleDone: { borderColor: colors.gold, backgroundColor: colors.gold },
  stepCircleText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stepCircleTextActive: { color: colors.gold },
  stepCircleTextDone: { color: colors.background },
  stepLabel: { fontSize: 11, fontWeight: '600', color: colors.textDim, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  stepLabelActive: { color: colors.gold },

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

  guestInputRow: { flexDirection: 'row', gap: 10 },
  guestInput: {
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
  addGuestBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGuestBtnDisabled: { opacity: 0.5 },
  addGuestBtnText: { fontSize: 14, fontWeight: '700', color: colors.background },

  suggestions: { gap: 8 },
  suggestionsLabel: { fontSize: 11, color: colors.textDim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  suggestionChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },

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
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },

  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  reviewName: { fontSize: 22, fontWeight: '800', color: colors.text },
  reviewMeta: { fontSize: 14, color: colors.textMuted },
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
