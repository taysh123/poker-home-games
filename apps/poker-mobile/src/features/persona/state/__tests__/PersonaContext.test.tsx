/**
 * PersonaContext (Wave 1, slice 1.2) — StudyContext's corrected write pattern: updater-based
 * commits against a live fileRef (chained writes COMPOSE, never clobber — the bug class that
 * shipped twice), composed semantic ops only, and the reactive guest→account claim when the
 * signed-in account key appears.
 */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

import { PersonaProvider, usePersona } from '../PersonaContext';

// Provider mount + an async store load; on a COLD jest transform cache this exceeds jest's 5s
// default and fails as a TIMEOUT rather than an assertion. CI is always cold (the workflow caches
// node_modules, not jest's transform cache), so this went red there while passing on every warm
// local run. Same treatment as isCelebrating.test.tsx; scoped to this file.
jest.setTimeout(20_000);

const mockMem = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => { mockMem.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockMem.delete(k); }),
}));

let mockUser: { userId: string } | null = null;
jest.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

type Ctx = ReturnType<typeof usePersona>;
let ctx: Ctx;
function Probe() {
  ctx = usePersona();
  return null;
}

async function renderPersona() {
  const utils = render(
    <PersonaProvider>
      <Probe />
    </PersonaProvider>,
  );
  await waitFor(() => expect(ctx.isLoaded).toBe(true));
  return utils;
}

describe('PersonaContext', () => {
  beforeEach(() => {
    mockMem.clear();
    mockUser = null;
  });

  it('starts with no persona for a fresh guest', async () => {
    await renderPersona();
    expect(ctx.persona).toBeNull();
  });

  it('chained writes in one tick BOTH land (updater commits compose)', async () => {
    await renderPersona();
    await act(async () => {
      const a = ctx.answerStep('goal', 'improve');
      const b = ctx.answerStep('skill', 'grinder');
      await Promise.all([a, b]);
    });
    expect(ctx.persona?.goal).toBe('improve');
    expect(ctx.persona?.skill).toBe('grinder');
  });

  it('completeFunnel stamps completedAt exactly once', async () => {
    await renderPersona();
    await act(async () => {
      await ctx.answerStep('goal', 'host');
      await ctx.completeFunnel();
    });
    const first = ctx.persona?.completedAt;
    expect(first).toBeTruthy();
    await act(async () => { await ctx.completeFunnel(); });
    expect(ctx.persona?.completedAt).toBe(first); // idempotent
  });

  it('recordPlacement stores the result AND sets the measured skill in ONE commit', async () => {
    await renderPersona();
    await act(async () => { await ctx.recordPlacement(4, 5); });
    expect(ctx.persona?.placement).toMatchObject({ score: 4, total: 5 });
    expect(ctx.persona?.placement?.at).toBeTruthy();
    expect(ctx.persona?.skill).toBe('grinder'); // measured skill overrides the self-report
  });

  it('placement is WRITE-ONCE — a second run can never overwrite the stored calibration', async () => {
    await renderPersona();
    await act(async () => { await ctx.recordPlacement(4, 5); });
    await act(async () => { await ctx.recordPlacement(0, 5); }); // a re-run must not downgrade
    expect(ctx.persona?.placement?.score).toBe(4);
    expect(ctx.persona?.skill).toBe('grinder');
  });

  it('a low placement lands on "new" and still records the score', async () => {
    await renderPersona();
    await act(async () => { await ctx.recordPlacement(1, 5); });
    expect(ctx.persona?.skill).toBe('new');
    expect(ctx.persona?.placement?.score).toBe(1);
  });

  it('placement survives a remount (it is one-time, so it must persist)', async () => {
    const { unmount } = await renderPersona();
    await act(async () => { await ctx.recordPlacement(3, 5); });
    unmount();

    await renderPersona();
    expect(ctx.persona?.placement?.score).toBe(3);
    expect(ctx.persona?.skill).toBe('solid');
  });

  it('persists across a remount (storage survives)', async () => {
    const { unmount } = await renderPersona();
    await act(async () => { await ctx.answerStep('format', 'tournament'); });
    unmount();

    await renderPersona();
    expect(ctx.persona?.format).toBe('tournament');
  });

  it('claims the guest persona when the user signs in with no account persona', async () => {
    const { unmount } = await renderPersona();
    await act(async () => { await ctx.answerStep('goal', 'improve'); });
    unmount();

    mockUser = { userId: 'u1' }; // signed in — provider remounts in the authed tree
    await renderPersona();
    await waitFor(() => expect(ctx.persona?.goal).toBe('improve')); // claimed into acct:u1
  });

  it('an existing account persona is never overwritten by the guest one', async () => {
    // Seed: account already answered 'host'; guest device answered 'improve'.
    const acct = { schemaVersion: 1, goal: 'host', skill: null, format: null, displayName: null, completedAt: null, updatedAt: 't' };
    const guest = { ...acct, goal: 'improve' };
    mockMem.set('tpoker.persona.v1', JSON.stringify({ schemaVersion: 1, byAccount: { 'acct:u1': acct, guest } }));

    mockUser = { userId: 'u1' };
    await renderPersona();
    expect(ctx.persona?.goal).toBe('host');
  });
});
