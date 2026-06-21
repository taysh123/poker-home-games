# Cost & Scalability Audit

First-class review track (Phase D2). **Order-of-magnitude** operating cost + scaling considerations at four user
scales. These are estimates with **explicit assumptions** — not quotes; provider pricing changes and real cost
depends on usage patterns. Use as a planning model, validate against live dashboards before committing.

## Assumptions
- "Users" = registered DAU-ish active base; ~10–20% concurrency at peak.
- Stack = Railway (API container + PostgreSQL), Vercel (web), Expo/EAS (builds + push), + a future AI vendor.
- **No Supabase** (not in the stack). **No real billing/AI cost today** (both mocked) — AI cost only applies
  once a vendor is wired; it then becomes the dominant variable cost.
- Web (Vercel) is cheap until high bandwidth; mobile delivery is via the stores (no app-bandwidth cost to us).

## Billable services + cost drivers
| Service | Driver |
|---|---|
| Railway API compute | concurrency / CPU-RAM; horizontal scale at load |
| Railway PostgreSQL | storage + connection ceiling + IOPS |
| Vercel (web) | bandwidth (free ≤ ~100 GB/mo) |
| Expo EAS builds | per-build (CI; build once per release) |
| Expo push | message volume (free tier generous) |
| **AI vendor (future)** | **inference tokens per coach analysis — dominant at scale** |
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
- **AI inference dominates** beyond ~1k DAU once a vendor is live. The credit policy (free = 1 lifetime, premium
  = 30/mo) is **profit-protective by design** — it caps per-user inference. Cost ≈ (premium subscribers × 30 ×
  per-analysis token cost). Choose a vendor/model with this unit economic in mind; the credit ledger already
  enforces the cap.
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
AI is the single biggest unknown and is **$0 today** (mocked). Any pre-revenue cost claim that assumes live AI
would be fabricated — these ranges flag it as conditional. Validate every figure against provider dashboards
before financial planning.
