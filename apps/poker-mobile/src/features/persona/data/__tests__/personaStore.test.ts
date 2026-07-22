/**
 * personaStore (Wave 1, slice 1.2) — one AsyncStorage blob `tpoker.persona.v1` holding an
 * account-scoped map (coachStore's byAccount precedent), quarantine-on-corrupt (never silently
 * clear), and the guest→account claim used when a guest signs in for the first time.
 */
const mockMem = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => { mockMem.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockMem.delete(k); }),
}));

import { emptyPersona } from '../../types';
import {
  STORAGE_KEY,
  emptyFile,
  loadFile,
  saveFile,
  personaFor,
  withPersona,
  claimGuestPersona,
} from '../personaStore';

const T0 = '2026-07-22T10:00:00.000Z';

describe('personaStore file lifecycle', () => {
  beforeEach(() => mockMem.clear());

  it('loads an empty file when nothing is stored', async () => {
    const file = await loadFile();
    expect(file).toEqual(emptyFile());
  });

  it('round-trips a saved file', async () => {
    const p = { ...emptyPersona(T0), goal: 'host' as const };
    await saveFile(withPersona(emptyFile(), 'guest', p));
    const loaded = await loadFile();
    expect(personaFor(loaded, 'guest')?.goal).toBe('host');
  });

  it('quarantines a corrupt payload (never silently clears) and returns empty', async () => {
    mockMem.set(STORAGE_KEY, '{not json');
    const file = await loadFile();
    expect(file).toEqual(emptyFile());
    const quarantined = [...mockMem.keys()].filter(k => k.startsWith('tpoker.persona.quarantine.'));
    expect(quarantined).toHaveLength(1);
    expect(mockMem.get(quarantined[0])).toBe('{not json');
    expect(mockMem.has(STORAGE_KEY)).toBe(false);
  });

  it('quarantines a wrong-schema payload too', async () => {
    mockMem.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, byAccount: 'nope' }));
    const file = await loadFile();
    expect(file).toEqual(emptyFile());
    expect([...mockMem.keys()].some(k => k.startsWith('tpoker.persona.quarantine.'))).toBe(true);
  });
});

describe('account map (pure)', () => {
  it('personaFor returns null for unknown accounts', () => {
    expect(personaFor(emptyFile(), 'acct:u1')).toBeNull();
  });

  it('withPersona writes per account key without touching others', () => {
    const guest = { ...emptyPersona(T0), goal: 'improve' as const };
    const acct = { ...emptyPersona(T0), goal: 'host' as const };
    let file = withPersona(emptyFile(), 'guest', guest);
    file = withPersona(file, 'acct:u1', acct);
    expect(personaFor(file, 'guest')?.goal).toBe('improve');
    expect(personaFor(file, 'acct:u1')?.goal).toBe('host');
  });
});

describe('claimGuestPersona — the guest quiz follows the user into the account', () => {
  it('copies the guest persona into an empty account (guest copy retained)', () => {
    const guest = { ...emptyPersona(T0), goal: 'improve' as const, skill: 'solid' as const };
    const file = withPersona(emptyFile(), 'guest', guest);
    const claimed = claimGuestPersona(file, 'acct:u1');
    expect(personaFor(claimed, 'acct:u1')).toEqual(guest);
    expect(personaFor(claimed, 'guest')).toEqual(guest); // future guests on this device unaffected
  });

  it('NEVER overwrites an existing account persona', () => {
    const guest = { ...emptyPersona(T0), goal: 'improve' as const };
    const acct = { ...emptyPersona(T0), goal: 'host' as const };
    let file = withPersona(emptyFile(), 'guest', guest);
    file = withPersona(file, 'acct:u1', acct);
    expect(personaFor(claimGuestPersona(file, 'acct:u1'), 'acct:u1')?.goal).toBe('host');
  });

  it('no guest persona ⇒ file unchanged (same reference)', () => {
    const file = emptyFile();
    expect(claimGuestPersona(file, 'acct:u1')).toBe(file);
  });

  it('claiming into the guest key itself is a no-op', () => {
    const file = withPersona(emptyFile(), 'guest', emptyPersona(T0));
    expect(claimGuestPersona(file, 'guest')).toBe(file);
  });
});
