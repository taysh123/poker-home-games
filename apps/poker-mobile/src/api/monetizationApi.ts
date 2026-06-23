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

/** Response of `POST /api/billing/checkout` (web Stripe). */
export interface CheckoutSession {
  url: string;
}

/**
 * Create a Stripe Checkout session (web billing). The server returns the redirect URL and 400s when Stripe is
 * not configured — entitlement is granted ONLY after the server's Stripe webhook verifies the payment.
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
