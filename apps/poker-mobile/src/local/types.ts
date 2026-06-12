/**
 * Local (on-device) game data model — guest mode runs entirely on these shapes,
 * persisted in AsyncStorage. Amounts are ALWAYS integer cents (see settlements.ts
 * for why). Field names deliberately mirror the backend Session/SessionPlayer/
 * BuyIn/CashOut DTOs so a future cloud import is a near-direct mapping.
 */

export interface LocalPlayer {
  id: string;
  name: string;
}

export type LocalTxnKind = 'buyin' | 'cashout';

export interface LocalTxn {
  id: string;
  playerId: string;
  kind: LocalTxnKind;
  amountCents: number;
  /** ISO 8601 */
  at: string;
}

export type LocalGameStatus = 'Active' | 'Finished';

export type PayoutPreset = '100' | '60-40' | '50-30-20';
export type BlindPreset = 'turbo' | 'standard' | 'deep';

export interface LocalElimination {
  playerId: string;
  /** 1 = winner; assigned bottom-up as players bust. */
  position: number;
  at: string;
}

export interface LocalTournamentConfig {
  entryFeeCents: number;
  payoutPreset: PayoutPreset;
  blindPreset: BlindPreset;
  eliminations: LocalElimination[];
}

export interface LocalGame {
  id: string;
  schemaVersion: 2;
  name: string;
  /** Local games skip Draft — they are Active from creation. */
  status: LocalGameStatus;
  /** undefined = cash game (v1 files migrate to 'cash'). */
  mode?: 'cash' | 'tournament';
  /** Present only when mode === 'tournament'. */
  tournament?: LocalTournamentConfig;
  createdAt: string;
  endedAt?: string;
  chipRatio?: number;
  defaultBuyInCents?: number;
  players: LocalPlayer[];
  txns: LocalTxn[];
  /** Set after a future "import to cloud account" — reserved, unused for now. */
  importedSessionId?: string;
}

export interface LocalGamesFile {
  schemaVersion: 2;
  games: LocalGame[];
}
