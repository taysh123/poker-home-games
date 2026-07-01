/**
 * Server-authoritative monetization API (B4). The client reads entitlements + AI credits from the
 * server and routes every analysis through the server proxy — it NEVER decides premium/credits
 * locally. Uses the shared `apiClient` (401 auto-refresh + retry). Fail-closed: any non-mapped
 * failure (network/5xx/unknown) denies as `unavailable` rather than silently allowing.
 */
import apiClient from './apiClient';

export type CoachError = 'requires_account' | 'rate_limited' | 'no_credits' | 'unavailable';

/** Server entitlement (`GET /api/entitlements`). */
export interface ServerEntitlement {
  plan: 'free' | 'premium';
  status: string;
  productId: string | null;
  expiresAt: string | null;
}

/** Server AI credit balance (`GET /api/coach/credits`). */
export interface ServerCoachCredits {
  remaining: number;
  total: number;
  policyKind: string;
  isPremium: boolean;
}

/** Body for `POST /api/coach/analyze` (mirrors backend `AnalyzeHandCommand`). */
export interface AnalyzeRequest {
  kind: string;
  text?: string;
  heroHand?: string;
  heroPosition?: string;
  question?: string;
  idempotencyKey: string;
  board?: string;
  villainPosition?: string;
  stackBb?: number;
  format?: string;
}

/** Structured coaching result (mirrors backend `CoachAnalysisResult`, camelCased). */
export interface ServerCoachAnalysis {
  summary: string;
  mistakes: { title: string; detail: string; street?: string }[];
  goodDecisions: { title: string; detail: string; street?: string }[];
  alternativeLines: { line: string; rationale: string }[];
  tips: string[];
  confidence: string;
  providerId: string;
  disclaimer: string;
}

/** A denial the UI can render. `reason` maps 1:1 to the server's enforcement outcome. */
export class ServerCoachError extends Error {
  reason: CoachError;
  constructor(reason: CoachError) {
    super(reason);
    this.reason = reason;
    this.name = 'ServerCoachError';
  }
}

/** Map a server/HTTP failure to a CoachError. Fail-closed: unknown ⇒ `unavailable` (deny, no false paywall). */
export function mapCoachError(error: unknown): ServerCoachError {
  const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
  if (status === 402) return new ServerCoachError('no_credits');
  if (status === 429) return new ServerCoachError('rate_limited');
  if (status === 401 || status === 403) return new ServerCoachError('requires_account');
  return new ServerCoachError('unavailable');
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export async function getEntitlements(token: string): Promise<ServerEntitlement> {
  const { data } = await apiClient.get<ServerEntitlement>('/api/entitlements', auth(token));
  return data;
}

export async function getCoachCredits(token: string): Promise<ServerCoachCredits> {
  const { data } = await apiClient.get<ServerCoachCredits>('/api/coach/credits', auth(token));
  return data;
}

export async function analyzeHand(req: AnalyzeRequest, token: string): Promise<ServerCoachAnalysis> {
  try {
    const { data } = await apiClient.post<ServerCoachAnalysis>('/api/coach/analyze', req, auth(token));
    return data;
  } catch (error) {
    throw mapCoachError(error);
  }
}

/** Response of `POST /api/billing/checkout` (web billing — Stripe or Paddle). */
export interface CheckoutSession {
  url: string;
  /**
   * Paddle transaction id (txn_…) when the server creates a Paddle transaction via
   * POST /transactions. May be returned directly in the JSON body, or can be parsed from
   * the ?_ptxn= query param in `url`. Optional — backward-compatible with the Stripe shape.
   */
  transactionId?: string;
}

/**
 * Create a Checkout session (web billing). The server returns the redirect URL (and optionally
 * a transactionId for Paddle) and 400s when billing is not configured — entitlement is granted
 * ONLY after the server's webhook (Paddle: subscription.created / transaction.completed;
 * Stripe: checkout.session.completed) verifies the payment.
 */
export async function createCheckoutSession(plan: 'monthly' | 'yearly', token: string): Promise<CheckoutSession> {
  const { data } = await apiClient.post<CheckoutSession>('/api/billing/checkout', { plan }, auth(token));
  return data;
}

/** Validate a completed store purchase server-side; returns the refreshed (authoritative) server entitlement. */
export async function validatePurchase(store: string, purchaseToken: string, token: string): Promise<ServerEntitlement> {
  const { data } = await apiClient.post<ServerEntitlement>('/api/billing/validate', { store, token: purchaseToken }, auth(token));
  return data;
}

/**
 * Verify a completed checkout session on the web success-redirect → returns the refreshed
 * (server-authoritative) entitlement. Idempotent with the billing webhook (same Subscription row).
 *
 * For Paddle: `idOrSession` is the Paddle transaction id (txn_… or the value of ?_ptxn in the
 * success URL). The backend `VerifyCheckoutSessionCommand.SessionId` field receives it.
 * For Stripe: `idOrSession` is the Stripe Checkout Session id (cs_…) from ?session_id=.
 * The field name `sessionId` is kept generic so both flows share the same contract.
 *
 * Returns 400 if the session cannot be verified (not paid, unknown id, billing not configured).
 */
export async function verifyCheckoutSession(idOrSession: string, token: string): Promise<ServerEntitlement> {
  const { data } = await apiClient.post<ServerEntitlement>(
    '/api/billing/verify-session',
    { sessionId: idOrSession },
    auth(token),
  );
  return data;
}
