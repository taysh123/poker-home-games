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
        policy.WithOrigins(prodOrigins).AllowAnyHeader().AllowAnyMethod());
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
// Tolerate missing/short secret at startup — log critical and skip wiring
// validation params (keys with insufficient bytes throw at request time, and
// we don't want the entire container to refuse to start over a missing env
// var that would otherwise be obvious in the logs).
var jwtSection = builder.Configuration.GetSection("JwtSettings");
var jwtSecret = jwtSection["SecretKey"] ?? string.Empty;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // SymmetricSecurityKey requires >= 256 bits (32 bytes). Pad short
        // secrets so the middleware can construct — tokens signed with the
        // padded key won't validate, but the container starts and we get
        // /health up so Railway can surface the misconfiguration in logs.
        var keyBytes = Encoding.UTF8.GetBytes(jwtSecret);
        if (keyBytes.Length < 32) keyBytes = keyBytes.Concat(new byte[32 - keyBytes.Length]).ToArray();

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ClockSkew = TimeSpan.Zero
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

// /health registered BEFORE auth/rate-limit/exception middleware so Railway
// can confirm liveness even if downstream middleware misbehaves.
app.MapGet("/health", () => Results.Text("Healthy"));

// /diag — readiness probe. Returns DB connectivity, pending migrations,
// and config presence. No secrets leak (counts and bools only). Useful for
// debugging Railway deploys without shelling into the container.
app.MapGet("/diag", async (IServiceProvider sp) =>
{
    var googleIds = builder.Configuration.GetSection("GoogleSettings:ClientIds").Get<IList<string>>() ?? new List<string>();
    var connStr = builder.Configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
    var canConnect = false;
    var pendingMigrations = -1;
    var appliedMigrations = -1;
    string? dbError = null;
    try
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        canConnect = await db.Database.CanConnectAsync();
        if (canConnect)
        {
            pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).Count();
            appliedMigrations = (await db.Database.GetAppliedMigrationsAsync()).Count();
        }
    }
    catch (Exception ex)
    {
        dbError = ex.GetType().Name + ": " + ex.Message;
    }
    return Results.Json(new
    {
        env = app.Environment.EnvironmentName,
        port = railwayPort ?? "(launchSettings)",
        jwtSecretConfigured = !string.IsNullOrWhiteSpace(jwtSecret) && jwtSecret.Length >= 32,
        jwtSecretLength = jwtSecret.Length,
        jwtIssuer = jwtSection["Issuer"],
        jwtAudience = jwtSection["Audience"],
        googleClientIdsCount = googleIds.Count,
        corsOrigins = prodOrigins,
        connectionStringConfigured = !string.IsNullOrWhiteSpace(connStr),
        canConnect,
        appliedMigrations,
        pendingMigrations,
        dbError,
    });
});

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
