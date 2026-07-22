/**
 * PersonaContext (Wave 1, slice 1.2) — StudyContext's corrected write pattern: updater-based
 * commits against a live fileRef (chained writes COMPOSE, never clobber — the bug class that
 * shipped twice), composed semantic ops only, and the reactive guest→account claim when the
 * signed-in account key appears.
 */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

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

import { PersonaProvider, usePersona } from '../PersonaContext';

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
