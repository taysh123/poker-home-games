using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PokerApp.API.Middleware;
using PokerApp.Application;
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
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter("auth-login", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 10;
        opt.QueueLimit = 0;
        opt.AutoReplenishment = true;
    });

    options.AddFixedWindowLimiter("auth-register", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 5;
        opt.QueueLimit = 0;
        opt.AutoReplenishment = true;
    });

    options.AddFixedWindowLimiter("auth-refresh", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 20;
        opt.QueueLimit = 0;
        opt.AutoReplenishment = true;
    });

    // AI analyses: cap request rate (cost control is also enforced per-account in the credit ledger).
    options.AddFixedWindowLimiter("coach-analyze", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 12;
        opt.QueueLimit = 0;
        opt.AutoReplenishment = true;
    });
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

// CORS must come BEFORE the exception middleware so error responses
// (including 500s) carry the Access-Control-Allow-Origin header. Otherwise
// the browser swallows the real status behind a generic CORS error.
app.UseCors(app.Environment.IsDevelopment() ? "Dev" : "Prod");

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseResponseCompression();

app.UseRateLimiter();

app.UseAuthentication();
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
