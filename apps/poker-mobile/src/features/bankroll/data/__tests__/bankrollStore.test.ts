import {
  emptyFile,
  addSession,
  updateSession,
  deleteSession,
  updateSettings,
  loadFile,
  saveFile,
  type CreateSessionInput,
} from '../bankrollStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});

const cashInput: CreateSessionInput = {
  gameType: 'cash',
  source: 'external',
  startedAt: '2026-06-01T20:00:00.000Z',
  cash: { buyInCents: 5000, cashOutCents: 9000 },
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('addSession', () => {
  it('adds a session with id, defaults, and current schema version', () => {
    const { file, session } = addSession(emptyFile(), cashInput);
    expect(file.sessions).toHaveLength(1);
    expect(file.schemaVersion).toBe(1);
    expect(session.id).toMatch(/^uuid-/);
    expect(session.gameType).toBe('cash');
    expect(session.feesCents).toBe(0);
    expect(session.tags).toEqual([]);
    expect(session.currency).toBe('ILS');
    expect(session.cash).toEqual({ buyInCents: 5000, cashOutCents: 9000 });
    expect(session.tournament).toBeUndefined();
    expect(session.createdAt).toBe(session.updatedAt);
  });

  it('drops the cash detail when the session is a tournament', () => {
    const { session } = addSession(emptyFile(), {
      gameType: 'tournament',
      source: 'external',
      startedAt: '2026-06-01T20:00:00.000Z',
      cash: { buyInCents: 5000, cashOutCents: 9000 }, // should be ignored
      tournament: {
        buyInCents: 10000, feeCents: 1000, rebuyCount: 0, rebuyCents: 0,
        addOnCount: 0, addOnCents: 0, bountyCents: 0, payoutCents: 40000,
      },
    });
    expect(session.cash).toBeUndefined();
    expect(session.tournament?.payoutCents).toBe(40000);
  });
});

describe('updateSession / deleteSession / settings', () => {
  it('updates fields and bumps updatedAt', () => {
    const { file, session } = addSession(emptyFile(), cashInput);
    const next = updateSession(file, session.id, { venue: 'Aria', tags: ['home'] });
    const updated = next.sessions[0];
    expect(updated.venue).toBe('Aria');
    expect(updated.tags).toEqual(['home']);
  });

  it('clears the opposite detail when game type changes on update', () => {
    const { file, session } = addSession(emptyFile(), cashInput);
    const next = updateSession(file, session.id, {
      gameType: 'tournament',
      tournament: {
        buyInCents: 10000, feeCents: 1000, rebuyCount: 0, rebuyCents: 0,
        addOnCount: 0, addOnCents: 0, bountyCents: 0, payoutCents: 0,
      },
    });
    expect(next.sessions[0].cash).toBeUndefined();
    expect(next.sessions[0].tournament).toBeDefined();
  });

  it('deletes a session', () => {
    const { file, session } = addSession(emptyFile(), cashInput);
    expect(deleteSession(file, session.id).sessions).toHaveLength(0);
  });

  it('updates settings (starting bankroll)', () => {
    const next = updateSettings(emptyFile(), { startingBankrollCents: 250000 });
    expect(next.settings.startingBankrollCents).toBe(250000);
    expect(next.settings.currency).toBe('ILS');
  });
});

describe('persistence + recovery', () => {
  it('round-trips through AsyncStorage', async () => {
    const { file } = addSession(emptyFile(), cashInput);
    await saveFile(file);
    const loaded = await loadFile();
    expect(loaded.sessions).toHaveLength(1);
    expect(loaded.sessions[0].cash?.cashOutCents).toBe(9000);
  });

  it('returns an empty file when nothing is stored', async () => {
    expect((await loadFile()).sessions).toHaveLength(0);
  });

  it('quarantines a corrupt payload instead of crashing or losing it', async () => {
    await AsyncStorage.setItem('tpoker.bankroll.v1', '{ this is not json');
    const loaded = await loadFile();
    expect(loaded.sessions).toHaveLength(0);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.bankroll.quarantine.'))).toBe(true);
  });
});
