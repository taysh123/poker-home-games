/**
 * BankrollContext (B1 — account-scoped, Q2 master plan). Mirrors PersonaContext's own test
 * structure: updater-based commits compose, persistence survives a remount, the guest→account
 * claim fires on sign-in, and — the load-bearing property — an account's own data is never
 * overwritten by a guest claim.
 */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

import { BankrollProvider, useBankroll } from '../BankrollContext';
import { STORAGE_KEY } from '../../data/bankrollStore';
import type { CreateSessionInput } from '../../data/bankrollStore';

// Provider mount + an async store load; on a COLD jest transform cache this can exceed jest's 5s
// default and fail as a TIMEOUT rather than an assertion (CI is always cold — the workflow caches
// node_modules, not the transform cache). Same treatment as PersonaContext.test.tsx /
// isCelebrating.test.tsx; scoped to this file.
jest.setTimeout(20_000);

const mockMem = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => { mockMem.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockMem.delete(k); }),
  getAllKeys: jest.fn(async () => [...mockMem.keys()]),
}));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${++n}` };
});

let mockUser: { userId: string } | null = null;
jest.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

type Ctx = ReturnType<typeof useBankroll>;
let ctx: Ctx;
function Probe() {
  ctx = useBankroll();
  return null;
}

async function renderBankroll() {
  const utils = render(
    <BankrollProvider>
      <Probe />
    </BankrollProvider>,
  );
  await waitFor(() => expect(ctx.isLoaded).toBe(true));
  return utils;
}

const cashInput: CreateSessionInput = {
  gameType: 'cash',
  source: 'external',
  startedAt: '2026-06-01T20:00:00.000Z',
  cash: { buyInCents: 5000, cashOutCents: 9000 },
};

describe('BankrollContext', () => {
  beforeEach(() => {
    mockMem.clear();
    mockUser = null;
  });

  it('starts with no sessions for a fresh guest', async () => {
    await renderBankroll();
    expect(ctx.sessions).toHaveLength(0);
    expect(ctx.settings).toEqual({ startingBankrollCents: 0, currency: 'ILS' });
  });

  it('chained writes in one tick BOTH land (updater commits compose)', async () => {
    await renderBankroll();
    await act(async () => {
      const a = ctx.addSession(cashInput);
      const b = ctx.updateSettings({ startingBankrollCents: 50000 });
      await Promise.all([a, b]);
    });
    expect(ctx.sessions).toHaveLength(1);
    expect(ctx.settings.startingBankrollCents).toBe(50000);
  });

  it('persists across a remount (storage survives)', async () => {
    const { unmount } = await renderBankroll();
    await act(async () => { await ctx.addSession(cashInput); });
    unmount();

    await renderBankroll();
    expect(ctx.sessions).toHaveLength(1);
    expect(ctx.sessions[0].cash?.cashOutCents).toBe(9000);
  });

  it('deleteSession and updateSession only ever touch the signed-in account\'s own data', async () => {
    await renderBankroll();
    const session = await act(async () => ctx.addSession(cashInput));
    await act(async () => { await ctx.updateSession(session.id, { venue: 'Aria' }); });
    expect(ctx.sessions[0].venue).toBe('Aria');
    await act(async () => { await ctx.deleteSession(session.id); });
    expect(ctx.sessions).toHaveLength(0);
  });

  it('claims the guest bankroll when the user signs in with no account bankroll', async () => {
    const { unmount } = await renderBankroll();
    await act(async () => { await ctx.addSession(cashInput); });
    unmount();

    mockUser = { userId: 'u1' }; // signed in — provider remounts in the authed tree
    await renderBankroll();
    await waitFor(() => expect(ctx.sessions).toHaveLength(1)); // claimed into acct:u1
    expect(ctx.sessions[0].cash?.cashOutCents).toBe(9000);
  });

  it('THE LOAD-BEARING PROPERTY: an existing account bankroll is never overwritten by the guest one', async () => {
    // Seed directly: account already has its OWN session; guest device has a DIFFERENT one.
    // This is the exact defect the audit found — guest-logged sessions merging into whichever
    // account signs in next — closed by the entry-presence guard in claimGuestBankroll.
    mockMem.set(STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      byAccount: {
        guest: { settings: { startingBankrollCents: 0, currency: 'ILS' }, sessions: [{
          id: 'guest-session', gameType: 'cash', source: 'external', currency: 'ILS',
          startedAt: '2026-01-01T00:00:00.000Z', feesCents: 0, tags: [], venue: 'guest device',
          cash: { buyInCents: 100, cashOutCents: 100 },
          createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        }] },
        'acct:u1': { settings: { startingBankrollCents: 0, currency: 'ILS' }, sessions: [{
          id: 'account-session', gameType: 'cash', source: 'external', currency: 'ILS',
          startedAt: '2026-02-01T00:00:00.000Z', feesCents: 0, tags: [], venue: 'the account\'s own',
          cash: { buyInCents: 200, cashOutCents: 200 },
          createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z',
        }] },
      },
    }));

    mockUser = { userId: 'u1' };
    await renderBankroll();

    expect(ctx.sessions).toHaveLength(1);
    expect(ctx.sessions[0].id).toBe('account-session');
    expect(ctx.sessions[0].venue).toBe('the account\'s own');
  });

  it('on logout the guest scope shows again; the account\'s bankroll is retained, not shown', async () => {
    // LIVE transition on the SAME mounted provider instance — not unmount/remount. In production,
    // BankrollProvider is declared ONCE at the App.tsx root, ABOVE AppNavigator; it is
    // AppNavigator (nested inside it) that swaps Guest/Authed trees on `user`. The provider itself
    // never remounts on login/logout — only `accountKeyFor(user)` recomputes on the next render.
    // `rerender` on the same tree is what actually exercises that: fileRef/writeQueue survive,
    // and the claim effect re-fires from a LIVE instance rather than a cold reload.
    mockUser = { userId: 'u1' };
    const { rerender } = await renderBankroll();
    await act(async () => { await ctx.addSession({ ...cashInput, venue: 'account session' }); });
    expect(ctx.sessions).toHaveLength(1);

    // Log out: same instance, new user value.
    mockUser = null;
    await act(async () => { rerender(<BankrollProvider><Probe /></BankrollProvider>); });
    expect(ctx.sessions).toHaveLength(0); // guest scope — the account's data is NOT shown here

    // Sign back in as the SAME account, still the same instance — retained, not lost.
    mockUser = { userId: 'u1' };
    await act(async () => { rerender(<BankrollProvider><Probe /></BankrollProvider>); });
    await waitFor(() => expect(ctx.sessions).toHaveLength(1));
    expect(ctx.sessions[0].venue).toBe('account session');
  });

  it('RECORDED DECISION: existing (pre-scoping) beta data lands in guest and is claimed on first sign-in', async () => {
    // The exact shape the OLD (pre-B1) unscoped store wrote to disk.
    mockMem.set(STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      settings: { startingBankrollCents: 75000, currency: 'ILS' },
      sessions: [{
        id: 'legacy-session', gameType: 'cash', source: 'external', currency: 'ILS',
        startedAt: '2026-01-01T00:00:00.000Z', feesCents: 0, tags: [], venue: 'pre-B1 data',
        cash: { buyInCents: 300, cashOutCents: 500 },
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }));

    // A returning beta tester opens the updated app already signed in.
    mockUser = { userId: 'u1' };
    await renderBankroll();

    await waitFor(() => expect(ctx.sessions).toHaveLength(1));
    expect(ctx.sessions[0].venue).toBe('pre-B1 data');
    expect(ctx.settings.startingBankrollCents).toBe(75000);
  });
});
