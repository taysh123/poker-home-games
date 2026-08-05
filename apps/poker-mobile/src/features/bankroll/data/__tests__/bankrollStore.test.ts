/**
 * bankrollStore (B1 — account-scoped, Q2 master plan). Mirrors `personaStore`'s own test
 * structure: file lifecycle (load/quarantine), pure account-map operations, the
 * guest→account claim, and — new here — the v1→v2 migration that turns a device-global
 * pre-scoping blob into the guest bucket (a recorded product decision, not an accident).
 */
import {
  STORAGE_KEY,
  emptyFile,
  addSession,
  updateSession,
  deleteSession,
  updateSettings,
  loadFile,
  saveFile,
  accountDataFor,
  claimGuestBankroll,
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
  it('adds a session with id, defaults, and current schema version, scoped to the account', () => {
    const { file, session } = addSession(emptyFile(), 'guest', cashInput);
    expect(accountDataFor(file, 'guest').sessions).toHaveLength(1);
    expect(file.schemaVersion).toBe(2);
    expect(session.id).toMatch(/^uuid-/);
    expect(session.gameType).toBe('cash');
    expect(session.feesCents).toBe(0);
    expect(session.tags).toEqual([]);
    expect(session.currency).toBe('ILS');
    expect(session.cash).toEqual({ buyInCents: 5000, cashOutCents: 9000 });
    expect(session.tournament).toBeUndefined();
    expect(session.createdAt).toBe(session.updatedAt);
  });

  it('assigns the default bankroll id (multi-bankroll-ready) but honors an explicit one', () => {
    expect(addSession(emptyFile(), 'guest', cashInput).session.bankrollId).toBe('default');
    expect(addSession(emptyFile(), 'guest', { ...cashInput, bankrollId: 'online' }).session.bankrollId).toBe('online');
  });

  it('drops the cash detail when the session is a tournament', () => {
    const { session } = addSession(emptyFile(), 'guest', {
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
    const { file, session } = addSession(emptyFile(), 'guest', cashInput);
    const next = updateSession(file, 'guest', session.id, { venue: 'Aria', tags: ['home'] });
    const updated = accountDataFor(next, 'guest').sessions[0];
    expect(updated.venue).toBe('Aria');
    expect(updated.tags).toEqual(['home']);
  });

  it('clears the opposite detail when game type changes on update', () => {
    const { file, session } = addSession(emptyFile(), 'guest', cashInput);
    const next = updateSession(file, 'guest', session.id, {
      gameType: 'tournament',
      tournament: {
        buyInCents: 10000, feeCents: 1000, rebuyCount: 0, rebuyCents: 0,
        addOnCount: 0, addOnCents: 0, bountyCents: 0, payoutCents: 0,
      },
    });
    const updated = accountDataFor(next, 'guest').sessions[0];
    expect(updated.cash).toBeUndefined();
    expect(updated.tournament).toBeDefined();
  });

  it('deletes a session', () => {
    const { file, session } = addSession(emptyFile(), 'guest', cashInput);
    expect(accountDataFor(deleteSession(file, 'guest', session.id), 'guest').sessions).toHaveLength(0);
  });

  it('updates settings (starting bankroll)', () => {
    const next = updateSettings(emptyFile(), 'guest', { startingBankrollCents: 250000 });
    expect(accountDataFor(next, 'guest').settings.startingBankrollCents).toBe(250000);
    expect(accountDataFor(next, 'guest').settings.currency).toBe('ILS');
  });
});

describe('account isolation (the whole point of B1)', () => {
  it('accountDataFor returns empty defaults for an account that has never written anything', () => {
    const data = accountDataFor(emptyFile(), 'acct:u1');
    expect(data.sessions).toEqual([]);
    expect(data.settings).toEqual({ startingBankrollCents: 0, currency: 'ILS' });
  });

  it('a session added for one account never appears under another', () => {
    const { file } = addSession(emptyFile(), 'guest', cashInput);
    expect(accountDataFor(file, 'guest').sessions).toHaveLength(1);
    expect(accountDataFor(file, 'acct:u1').sessions).toHaveLength(0);
  });

  it('updating settings for one account does not touch another\'s', () => {
    let file = updateSettings(emptyFile(), 'guest', { startingBankrollCents: 100 });
    file = updateSettings(file, 'acct:u1', { startingBankrollCents: 999 });
    expect(accountDataFor(file, 'guest').settings.startingBankrollCents).toBe(100);
    expect(accountDataFor(file, 'acct:u1').settings.startingBankrollCents).toBe(999);
  });

  it('deleting a session from one account cannot touch another account\'s session with the same id shape', () => {
    // Two accounts each add their own session (different generated ids via the mocked
    // sequential UUID); deleting via one account's key must only ever touch that account's array.
    const { file: f1, session: sGuest } = addSession(emptyFile(), 'guest', cashInput);
    const { file: f2 } = addSession(f1, 'acct:u1', cashInput);
    const next = deleteSession(f2, 'acct:u1', sGuest.id); // wrong account's id — no match, no-op
    expect(accountDataFor(next, 'guest').sessions).toHaveLength(1);
    expect(accountDataFor(next, 'acct:u1').sessions).toHaveLength(1);
  });
});

describe('claimGuestBankroll — the guest bankroll history follows the user into the account', () => {
  it('copies the guest bankroll into an empty account (guest copy retained)', () => {
    const { file } = addSession(emptyFile(), 'guest', cashInput);
    const claimed = claimGuestBankroll(file, 'acct:u1');
    expect(accountDataFor(claimed, 'acct:u1').sessions).toHaveLength(1);
    expect(accountDataFor(claimed, 'guest').sessions).toHaveLength(1); // future guests on this device unaffected
  });

  it('THE LOAD-BEARING PROPERTY: NEVER overwrites an existing account\'s bankroll data', () => {
    // An account that already has ITS OWN sessions must not have guest data claimed over it —
    // this is the exact defect the audit found (guest-logged sessions merging into whichever
    // account signs in next). Revert-tested: commenting out the guard in claimGuestBankroll
    // must turn ONLY this test red.
    let file = addSession(emptyFile(), 'guest', cashInput).file;
    file = addSession(file, 'acct:u1', { ...cashInput, venue: 'the account\'s own session' }).file;

    const claimed = claimGuestBankroll(file, 'acct:u1');

    const acctSessions = accountDataFor(claimed, 'acct:u1').sessions;
    expect(acctSessions).toHaveLength(1);
    expect(acctSessions[0].venue).toBe('the account\'s own session');
  });

  it('an account with settings of its own (but zero sessions) still counts as "has its own data"', () => {
    // The guard is entry-presence in byAccount, not "sessions.length > 0" — an account that
    // only ever touched settings is still off-limits for a guest claim. Simpler and safer than a
    // content-based guard: the moment an account writes ANYTHING, it is permanently "theirs".
    let file = addSession(emptyFile(), 'guest', cashInput).file;
    file = updateSettings(file, 'acct:u1', { startingBankrollCents: 777 });

    const claimed = claimGuestBankroll(file, 'acct:u1');

    expect(accountDataFor(claimed, 'acct:u1').sessions).toHaveLength(0); // NOT claimed
    expect(accountDataFor(claimed, 'acct:u1').settings.startingBankrollCents).toBe(777);
  });

  it('no guest bankroll data ⇒ file unchanged (same reference)', () => {
    const file = emptyFile();
    expect(claimGuestBankroll(file, 'acct:u1')).toBe(file);
  });

  it('claiming into the guest key itself is a no-op', () => {
    const { file } = addSession(emptyFile(), 'guest', cashInput);
    expect(claimGuestBankroll(file, 'guest')).toBe(file);
  });
});

describe('persistence + recovery', () => {
  it('round-trips through AsyncStorage', async () => {
    const { file } = addSession(emptyFile(), 'guest', cashInput);
    await saveFile(file);
    const loaded = await loadFile();
    expect(accountDataFor(loaded, 'guest').sessions).toHaveLength(1);
    expect(accountDataFor(loaded, 'guest').sessions[0].cash?.cashOutCents).toBe(9000);
  });

  it('returns an empty file when nothing is stored', async () => {
    expect(accountDataFor(await loadFile(), 'guest').sessions).toHaveLength(0);
  });

  it('quarantines a corrupt payload instead of crashing or losing it', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{ this is not json');
    const loaded = await loadFile();
    expect(accountDataFor(loaded, 'guest').sessions).toHaveLength(0);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some((k: string) => k.startsWith('tpoker.bankroll.quarantine.'))).toBe(true);
  });

  it('quarantines a wrong-schema payload too', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, nonsense: true }));
    const loaded = await loadFile();
    expect(loaded).toEqual(emptyFile());
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some((k: string) => k.startsWith('tpoker.bankroll.quarantine.'))).toBe(true);
  });
});

describe('v1 → v2 migration — RECORDED DECISION: pre-scoping data becomes the guest bucket', () => {
  it('a device-global v1 blob loads as guest-scoped data, not lost and not misattributed', async () => {
    // Exactly the shape the OLD (pre-B1) store wrote: flat, no byAccount, no owner attribution.
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      settings: { startingBankrollCents: 50000, currency: 'ILS' },
      sessions: [{
        id: 'legacy-1', gameType: 'cash', source: 'external', currency: 'ILS',
        startedAt: '2026-01-01T00:00:00.000Z', feesCents: 0, tags: [],
        cash: { buyInCents: 10000, cashOutCents: 15000 },
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }));

    const loaded = await loadFile();

    expect(loaded.schemaVersion).toBe(2);
    // RECORDED DECISION (Q2 master plan, B1): unattributed legacy data lands in GUEST, not in
    // whichever account happens to be signed in at migration time — the claim-on-sign-in path
    // (claimGuestBankroll, wired in BankrollContext) is what carries it into an account, exactly
    // like a brand-new guest→account claim. This is the behaviour a returning beta tester
    // expects ("my data is just still there"), not a surprise to report.
    const guestData = accountDataFor(loaded, 'guest');
    expect(guestData.sessions).toHaveLength(1);
    expect(guestData.sessions[0].id).toBe('legacy-1');
    expect(guestData.settings.startingBankrollCents).toBe(50000);
    // And it is NOT pre-attributed to any account — only claimGuestBankroll can move it there,
    // and only if that account has none of its own (the load-bearing property, tested above).
    expect(accountDataFor(loaded, 'acct:u1').sessions).toHaveLength(0);
  });

  it('a v1 blob with no settings/sessions at all still migrates to a valid (empty) guest bucket', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, sessions: [] }));
    const loaded = await loadFile();
    expect(accountDataFor(loaded, 'guest')).toEqual({ settings: { startingBankrollCents: 0, currency: 'ILS' }, sessions: [] });
  });

  it('a v2 blob loads through unchanged (identity migration, defensive per-account defaults)', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      byAccount: { 'acct:u1': { settings: { startingBankrollCents: 300 }, sessions: [] } },
    }));
    const loaded = await loadFile();
    expect(accountDataFor(loaded, 'acct:u1').settings).toEqual({ startingBankrollCents: 300, currency: 'ILS' });
  });
});
