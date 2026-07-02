# Deploying the `security-hardening` branch — Railway config

These are the deploy-time settings the security fixes need. **TL;DR: you do NOT need to add any new Railway
environment variable.** The one setting that must be correct is one you already have.

---

## The per-IP rate limiting + `UseForwardedHeaders` (audit H1)

The auth rate limiters are now partitioned **per client IP**. To see the *real* client IP behind Railway's
edge proxy (instead of the proxy's own IP), `Program.cs` calls `app.UseForwardedHeaders(...)` — but **only when
the app is NOT in the Development environment**, with this exact config (hardcoded, no env var):

```csharp
// Program.cs — runs only when !app.Environment.IsDevelopment()
var forwardedHeaders = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    ForwardLimit = 1,            // trust exactly ONE proxy hop = Railway's edge
};
forwardedHeaders.KnownNetworks.Clear();   // Railway's proxy IP is dynamic, so we trust the immediate hop
forwardedHeaders.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeaders);
```

### What you must set on Railway

| Setting | Correct value | Notes |
|---------|---------------|-------|
| `ASPNETCORE_ENVIRONMENT` | **`Production`** | **Already set** (existing required var). This is what gates the de-proxy block. Do NOT remove or change it. |
| *(anything for forwarded headers)* | **— none —** | There is **no** `ForwardedHeaders__*` / proxy / hop-count env var. The hop count is `ForwardLimit = 1` in code. **Do not invent one, and do not set `KnownProxies`** — that would break it. |

Railway sets the `X-Forwarded-For` header automatically; the app reads it. Nothing else is required.

### ⚠️ The two ways this can go wrong (and how you'd know)

1. **`ASPNETCORE_ENVIRONMENT` is missing or set to `Development`** → the `UseForwardedHeaders` block is **skipped**
   → the app reads **Railway's proxy IP** as every caller's IP → all clients land in **one shared bucket** →
   the auth limit (10 logins/min) is enforced **across all users at once** = **accidental lockout under load.**
   *Symptom:* legitimate users get 429 on login/refresh even at low traffic; logs show the same IP for everyone.
   *Fix:* ensure `ASPNETCORE_ENVIRONMENT=Production` is set on Railway.

2. **Running this app internet-exposed WITHOUT a trusted proxy** (i.e. not behind Railway's edge) → because we
   cleared `KnownProxies`/`KnownNetworks`, a client could **spoof `X-Forwarded-For`** to dodge or mis-attribute
   the rate limiter. On Railway this is safe (external traffic can only reach the app via Railway's edge). If you
   ever move off Railway to a host without a single trusted proxy, revisit this config.

### How to verify after deploy
- Hit `POST /api/auth/login` rapidly (>10/min) from **one** machine → you get 429; from a **second** machine on a
  **different** IP, login still works. (If the second machine is also throttled, forwarded headers aren't applying
  → check setting #1 above.)

## The other fixes (no deploy config)
- **M2** (coach limiter per authenticated user), **M1** (social-login empty-hash 401 guard), **H2/H3/H4**
  (billing) — no Railway settings required; they work from the code alone.
