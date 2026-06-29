# Cost & Scalability Audit

First-class review track (Phase D2). **Order-of-magnitude** operating cost + scaling considerations at four user
scales. These are estimates with **explicit assumptions** — not quotes; provider pricing changes and real cost
depends on usage patterns. Use as a planning model, validate against live dashboards before committing.

## Assumptions
- "Users" = registered DAU-ish active base; ~10–20% concurrency at peak.
- Stack = Railway (API container + PostgreSQL), Vercel (web), Expo/EAS (builds + push), + Anthropic (AI) and Stripe/RevenueCat (billing) once their keys are set.
- **No Supabase** (not in the stack). **$0 billing/AI cost today** (both mock by default) — Anthropic inference +
  Stripe/RevenueCat fees apply only once their keys are set; AI then becomes the dominant variable cost.
- Web (Vercel) is cheap until high bandwidth; mobile delivery is via the stores (no app-bandwidth cost to us).

## Billable services + cost drivers
| Service | Driver |
|---|---|
| Railway API compute | concurrency / CPU-RAM; horizontal scale at load |
| Railway PostgreSQL | storage + connection ceiling + IOPS |
| Vercel (web) | bandwidth (free ≤ ~100 GB/mo) |
| Expo EAS builds | per-build (CI; build once per release) |
| Expo push | message volume (free tier generous) |
| **AI vendor (Anthropic)** | **inference tokens per coach analysis (Claude Sonnet default) — dominant at scale** |
| **Stripe (web billing)** | ~2.9% + $0.30 per transaction on web subscription revenue |
| **RevenueCat (mobile billing)** | free under a monthly-tracked-revenue threshold, then ~1% of tracked revenue (atop the 15–30% store cut) |
| Storage / CDN (future, if server-delivered content) | GB served |
| Analytics (future, if a vendor added) | event volume |

## Scale model (monthly, USD, ranges)
| Scale | Compute + DB | Web/build/push | AI (if live) | Total (rough) |
|---|---|---|---|---|
| **100** | ~$20–40 (1 small instance + starter PG) | ~$0–15 | ~$0–50 | **~$30–80** |
| **1,000** | ~$80–150 (tuned pool, maybe 2 instances) | ~$10–30 | ~$100–300 | **~$200–450** |
| **10,000** | ~$400–800 (multi-instance + read replica + Redis) | ~$50–100 | ~$1k–3k | **~$1.5k–4k** |
| **100,000** | ~$2.5k–6k (managed PG/HA, autoscale, CDN, APM) | ~$0.5k–1k | ~$10k–30k+ | **~$13k–35k+** |

## What drives the curve
- **AI inference (Anthropic) dominates** beyond ~1k DAU once the key is live. The credit policy (free = 1
  lifetime, premium = 30/mo) is **profit-protective by design** — it caps per-user inference. Cost ≈ (premium
  subscribers × 30 × per-analysis Claude token cost). Default model = Sonnet (cost-effective); Opus would raise
  this materially. The credit ledger already enforces the cap.
- **Net revenue per premium** = $11.99/mo or $99.99/yr **minus** the store cut (15–30%) + RevenueCat (~1%) on
  mobile, or Stripe (~2.9%+$0.30) on web — model the AI cost against the *net*, not the gross, price.
- **Compute scales in steps** (instances + load balancer) — the in-memory rate-limiter and no-cache gaps force
  earlier/again-bigger DB load, so the Redis + caching work (see backend-readiness) materially lowers the 1k–10k
  compute/DB cost.
- **DB is the early bottleneck** (connection ceiling + uncached leaderboard/stats sorts). Pool tuning + caching +
  a read replica push the inflection point out.
- **Web/push/build are minor** at all but the largest scale.

## Recommendations by scale
- **→ 1k:** tune Npgsql pool; add Redis (rate-limit + hot reads); move side-effects off the request path. Pick
  the AI vendor with the 30/mo-cap unit cost modelled. ~sub-$500/mo.
- **→ 10k:** multi-instance API + read replica + APM/tracing; CDN if content goes server-delivered.
- **→ 100k:** managed HA Postgres, autoscaling, multi-zone, dedicated observability; renegotiate AI pricing.

## Honesty note
AI is the single biggest unknown and is **$0 today** (Anthropic key not set; mock active). Any pre-revenue cost claim that assumes live AI
would be fabricated — these ranges flag it as conditional. Validate every figure against provider dashboards
before financial planning.
