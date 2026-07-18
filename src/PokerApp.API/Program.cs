using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PokerApp.API.Middleware;
using PokerApp.Application;
using PokerApp.Application.Common;
using PokerApp.Infrastructure;
using PokerApp.Infrastructure.Identity;
using PokerApp.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ── Layers ──────────────────────────────────────────────────────────────────
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// ── CORS ────────────────────────────────────────────────────────────────────
// Production: read explicit origins from configuration (Railway sets
// AllowedOrigins__0=https://<vercel-domain>). Fall back to the known Vercel
// production domain so a misconfigured deploy still works for the web app.
// Development: open policy so Expo web (localhost:8081/19006) just works.
var configuredOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                         ?? Array.Empty<string>();
var prodOrigins = configuredOrigins.Length > 0
    ? configuredOrigins
    : new[] { "https://poker-home-games-three.vercel.app" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("Dev", policy =>
        policy.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod());

    options.AddPolicy("Prod", policy =>
        policy.SetIsOriginAllowed(origin =>
                prodOrigins.Contains(origin)
                // Vercel preview deployments for this project (scoped to our Vercel team)
                // so PR previews can exercise the API without a per-deploy env change.
                || (origin.StartsWith("https://poker-home-games-", StringComparison.Ordinal)
                    && origin.EndsWith("-tays-projects-d5aefd6e.vercel.app", StringComparison.Ordinal)))
            .AllowAnyHeader().AllowAnyMethod());
});

// ── Rate Limiting ───────────────────────────────────────────────────────────
// Partitioned so ONE client can't exhaust the limit for everyone (audit H1/M2): the auth limiters are keyed
// per client IP, and the coach limiter per authenticated user. The client IP is the real caller only because
// UseForwardedHeaders (below, prod) de-proxies X-Forwarded-For behind Railway; and UseAuthentication runs
// BEFORE UseRateLimiter so http.User is populated for the per-user coach key. Keys are never null (RateLimitKeys).
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    static FixedWindowRateLimiterOptions Window(int permitLimit) => new()
    {
        Window = TimeSpan.FromMinutes(1),
        PermitLimit = permitLimit,
        QueueLimit = 0,
        AutoReplenishment = true,
    };

    static string ClientIp(HttpContext http) => RateLimitKeys.ForClientIp(http.Connection.RemoteIpAddress?.ToString());

    // Auth limiters — per client IP.
    options.AddPolicy("auth-login", http => RateLimitPartition.GetFixedWindowLimiter(ClientIp(http), _ => Window(10)));
    options.AddPolicy("auth-register", http => RateLimitPartition.GetFixedWindowLimiter(ClientIp(http), _ => Window(5)));
    options.AddPolicy("auth-refresh", http => RateLimitPartition.GetFixedWindowLimiter(ClientIp(http), _ => Window(20)));

    // AI analyses — per authenticated user (request-rate backstop; per-account cost control also lives in the credit ledger).
    options.AddPolicy("coach-analyze", http => RateLimitPartition.GetFixedWindowLimiter(
        RateLimitKeys.ForUser(http.User.FindFirstValue(ClaimTypes.NameIdentifier), http.Connection.RemoteIpAddress?.ToString()),
        _ => Window(12)));
});

// ── Response compression + controllers + Swagger ────────────────────────────
builder.Services.AddResponseCompression(opts => opts.EnableForHttps = true);
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "PokerApp API",
        Version = "v1",
        Description = "Poker home games management platform"
    });

    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "Enter: Bearer {your JWT token}",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference
        {
            Type = ReferenceType.SecurityScheme,
            Id = "Bearer"
        }
    };

    c.AddSecurityDefinition("Bearer", securityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { securityScheme, Array.Empty<string>() }
    });
});

// ── JWT Authentication ──────────────────────────────────────────────────────
// Fail-closed: outside Development a missing/short secret is fatal (tokens signed with a padded key never
// validate → silently-broken auth). JwtKey.ResolveSigningKey throws in that case; Development still pads so
// local dev boots. A correctly-configured prod (>=64-char secret) is unaffected. See JwtKey.cs.
var jwtSection = builder.Configuration.GetSection("JwtSettings");
var jwtSecret = jwtSection["SecretKey"] ?? string.Empty;
var jwtSigningKey = JwtKey.ResolveSigningKey(jwtSecret, requireStrongSecret: !builder.Environment.IsDevelopment());

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = jwtSigningKey,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

// ── Railway PORT binding ────────────────────────────────────────────────────
// Only override when PORT is explicitly set (Railway/containers). Otherwise
// local dev keeps using launchSettings.json (http://localhost:5062) and the
// Dockerfile's ASPNETCORE_HTTP_PORTS=8080 default applies in container.
var railwayPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(railwayPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{railwayPort}");
}

// ── Pipeline ────────────────────────────────────────────────────────────────
var app = builder.Build();

var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
startupLogger.LogInformation("PokerApp.API starting. Env={Env} Port={Port} JwtSecretConfigured={JwtConfigured} CorsOrigins={Origins}",
    app.Environment.EnvironmentName,
    railwayPort ?? "(launchSettings)",
    !string.IsNullOrWhiteSpace(jwtSecret) && jwtSecret.Length >= 32,
    string.Join(",", prodOrigins));

// Make a CORS misconfiguration loud: outside Development with no AllowedOrigins set, we fall back to the
// hardcoded production domain. That keeps the web app working, but if it's unintended (e.g. a new domain) it
// would silently reject the real origin — so surface it.
if (!app.Environment.IsDevelopment() && configuredOrigins.Length == 0)
{
    startupLogger.LogCritical(
        "CORS: AllowedOrigins is not configured — falling back to the hardcoded production origin(s): {Origins}. " +
        "Set AllowedOrigins__0 to your web domain if this is not intended.", string.Join(",", prodOrigins));
}

// Fail-loud on a billing misconfig in Production. The mock verifier grants premium for ANY non-empty
// receipt (safe for dev/tests; catastrophic in prod). We log rather than hard-fail because the paywall
// flag is OFF and purchase validation isn't user-reachable yet — but a forgotten env var must be impossible
// to miss. Mirrors the JWT/CORS fail-closed posture. See BillingSettings + MockBillingVerifier.
if (app.Environment.IsProduction())
{
    var billingProvider = builder.Configuration.GetSection("BillingSettings")["Provider"];
    var acceptSandbox = builder.Configuration.GetSection("BillingSettings")["AcceptSandbox"];
    if (!string.Equals(billingProvider, "direct", StringComparison.OrdinalIgnoreCase))
    {
        startupLogger.LogCritical(
            "BILLING: Production is running the MOCK billing verifier (BillingSettings:Provider={Provider}). " +
            "The mock grants premium for ANY non-empty receipt — set BillingSettings__Provider=direct before " +
            "enabling purchases.", billingProvider ?? "(null)");
    }
    else if (string.Equals(acceptSandbox, "true", StringComparison.OrdinalIgnoreCase))
    {
        startupLogger.LogCritical(
            "BILLING: Production has BillingSettings:AcceptSandbox=true — sandbox/TestFlight receipts can grant " +
            "production entitlements. Set BillingSettings__AcceptSandbox=false in production.");
    }
}

// /health registered BEFORE auth/rate-limit/exception middleware so Railway
// can confirm liveness even if downstream middleware misbehaves.
app.MapGet("/health", () => Results.Text("Healthy"));

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "PokerApp API v1"));
}

// De-proxy the client IP so per-IP rate limiting (audit H1) sees the REAL caller, not Railway's edge. Railway
// is a single trusted proxy with a dynamic IP, so we clear KnownNetworks/KnownProxies and trust exactly one
// hop (ForwardLimit = 1 → the rightmost X-Forwarded-For entry). SECURITY: this trusts the immediate proxy to
// have set X-Forwarded-For — correct on Railway, where external traffic can only reach the app via that edge.
// Do NOT run this app directly internet-exposed without a trusted proxy, or a client could spoof X-Forwarded-For
// to dodge/mis-attribute the rate limiter. Skipped in Development (no proxy locally → real socket IP is used).
if (!app.Environment.IsDevelopment())
{
    var forwardedHeaders = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        ForwardLimit = 1,
    };
    forwardedHeaders.KnownNetworks.Clear();
    forwardedHeaders.KnownProxies.Clear();
    app.UseForwardedHeaders(forwardedHeaders);
}

// Defensive HTTP security headers on every response (belt-and-suspenders with Railway's TLS edge):
// nosniff, frame-deny (clickjacking), referrer + permissions policy, report-only CSP, HSTS (prod). Additive.
app.UseMiddleware<SecurityHeadersMiddleware>();

// CORS must come BEFORE the exception middleware so error responses
// (including 500s) carry the Access-Control-Allow-Origin header. Otherwise
// the browser swallows the real status behind a generic CORS error.
app.UseCors(app.Environment.IsDevelopment() ? "Dev" : "Prod");

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseResponseCompression();

// Authentication runs BEFORE the rate limiter so the coach limiter can partition per authenticated user
// (audit M2 — http.User must be populated when the partition key is computed). Authorization still runs
// AFTER, so [Authorize] enforcement is unchanged. Auth-limiter keys (per IP) don't depend on this ordering.
app.UseAuthentication();

app.UseRateLimiter();

app.UseAuthorization();

app.MapControllers();

// ── Deferred database migration ─────────────────────────────────────────────
// Run migrations AFTER Kestrel starts listening so Railway's healthcheck on
// /health succeeds while the migration completes (or fails) in the
// background. Synchronous migrations between Build() and Run() can exceed
// the 60s healthcheck window when there's a cold DB connection or schema
// pending changes, killing the deploy before /health ever responds.
app.Lifetime.ApplicationStarted.Register(() =>
{
    _ = Task.Run(() =>
    {
        using var scope = app.Services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        try
        {
            logger.LogInformation("Applying database migrations...");
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Database.Migrate();
            logger.LogInformation("Database migrations applied.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Database migration failed at startup.");
        }
    });
});

app.Run();
