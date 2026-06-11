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

export interface LocalGame {
  id: string;
  schemaVersion: 1;
  name: string;
  /** Local games skip Draft — they are Active from creation. */
  status: LocalGameStatus;
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
  schemaVersion: 1;
  games: LocalGame[];
}
