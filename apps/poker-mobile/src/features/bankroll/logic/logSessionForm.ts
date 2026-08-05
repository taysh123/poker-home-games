/**
 * Pure logic behind LogSessionScreen (B2, audit 2026-08-05). Extracted so the form-building and
 * validation rules are unit-tested without a screen render — this repo's stated convention: logic
 * lives in each feature's logic folder precisely so it's testable without screens.
 */
import type { BankrollGameType, BankrollSource } from '../types';
import type { CreateSessionInput } from '../data/bankrollStore';

/** Parse money input to integer cents; empty → 0; invalid → null. Allows 0 (e.g. busted payout). */
export function parseMoneyCents(input: string): number | null {
  const t = input.trim().replace(/,/g, '');
  if (t === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  return parseInt(w, 10) * 100 + parseInt(f.padEnd(2, '0') || '0', 10);
}

/** Parse a count input (rebuys, add-ons, entrants, finish place, duration); invalid/negative → 0. */
export function parseCount(input: string): number {
  const n = parseInt(input.trim() || '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Native date picker vs raw YYYY-MM-DD text entry (B2). Decoupled from the `polish` flag: the
 * picker was gated on `isFeatureEnabled('polish') && Platform.OS !== 'web'`, and
 * `PROD_FLAGS.polish` is false — so a real prod build degraded to a typed date field, while every
 * dev and beta tester (running with `polish` on) has only ever exercised the picker path. The
 * text-input fallback was the untested one, not the picker.
 *
 * `Platform.OS !== 'web'` is KEPT exactly: `@react-native-community/datetimepicker` has no `.web.js`
 * entry — only `.android.js`/`.ios.js`/`.windows.js` — so this is a real, necessary fallback for an
 * unsupported platform, not a neglected path being newly excluded.
 */
export function shouldShowNativeDatePicker(platformOS: string): boolean {
  return platformOS !== 'web';
}

/** Comma-joined tags for a read-only history-row display, or null if there are none to show. */
export function formatTagsLine(tags: string[]): string | null {
  return tags.length > 0 ? tags.join(', ') : null;
}

export interface LogSessionFormFields {
  gameType: BankrollGameType;
  source: BankrollSource;
  /** 'YYYY-MM-DD' */
  date: string;
  venue: string;
  durationMin: string;
  notes: string;
  tags: string;
  fees: string;
  cashBuyIn: string;
  cashOut: string;
  tBuyIn: string;
  tFee: string;
  tRebuy: string;
  tRebuyCount: string;
  tAddOn: string;
  tAddOnCount: string;
  tPayout: string;
  tBounty: string;
  tEntrants: string;
  tFinish: string;
}

export type BuildSessionResult =
  | { input: CreateSessionInput; error?: undefined }
  | { input?: undefined; error: string };

/** Validate + build a CreateSessionInput from raw form field strings. Pure; no side effects. */
export function buildSessionInput(fields: LogSessionFormFields): BuildSessionResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) return { error: 'Enter a valid date (YYYY-MM-DD).' };
  const startedAt = new Date(`${fields.date}T12:00:00`).toISOString();
  const feesCents = parseMoneyCents(fields.fees);
  if (feesCents === null) return { error: 'Fees must be a number.' };

  const common = {
    gameType: fields.gameType,
    source: fields.source,
    startedAt,
    venue: fields.venue.trim() || undefined,
    durationMinutes: fields.durationMin.trim() ? parseCount(fields.durationMin) : undefined,
    notes: fields.notes.trim() || undefined,
    tags: fields.tags.split(',').map(t => t.trim()).filter(Boolean),
    feesCents,
  };

  if (fields.gameType === 'cash') {
    const buyInCents = parseMoneyCents(fields.cashBuyIn);
    const cashOutCents = parseMoneyCents(fields.cashOut);
    if (buyInCents === null || cashOutCents === null) return { error: 'Buy-in and cash-out must be numbers.' };
    if (buyInCents <= 0) return { error: 'Cash buy-in is required.' };
    return { input: { ...common, cash: { buyInCents, cashOutCents } } };
  }

  const buyInCents = parseMoneyCents(fields.tBuyIn);
  const feeC = parseMoneyCents(fields.tFee);
  const rebuyCents = parseMoneyCents(fields.tRebuy);
  const addOnCents = parseMoneyCents(fields.tAddOn);
  const payoutCents = parseMoneyCents(fields.tPayout);
  const bountyCents = parseMoneyCents(fields.tBounty);
  if ([buyInCents, feeC, rebuyCents, addOnCents, payoutCents, bountyCents].some(v => v === null)) {
    return { error: 'Tournament amounts must be numbers.' };
  }
  if ((buyInCents ?? 0) <= 0) return { error: 'Tournament buy-in is required.' };
  return {
    input: {
      ...common,
      tournament: {
        buyInCents: buyInCents!,
        feeCents: feeC!,
        // HONEST COUNTS (B2, audit 2026-08-05). Previously `rebuyCents! > 0 ? 1 : 0` — a
        // boolean-shaped fabrication that recorded "1 rebuy" identically for a single $50 rebuy
        // and a five-rebuy $500 session. Now the count the user actually typed; 0 when left blank,
        // independent of the money amount.
        rebuyCount: fields.tRebuyCount.trim() ? parseCount(fields.tRebuyCount) : 0,
        rebuyCents: rebuyCents!,
        addOnCount: fields.tAddOnCount.trim() ? parseCount(fields.tAddOnCount) : 0,
        addOnCents: addOnCents!,
        bountyCents: bountyCents!,
        payoutCents: payoutCents!,
        entrants: fields.tEntrants.trim() ? parseCount(fields.tEntrants) : undefined,
        finishPlace: fields.tFinish.trim() ? parseCount(fields.tFinish) : undefined,
      },
    },
  };
}
