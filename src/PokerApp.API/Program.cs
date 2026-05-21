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

// ── CORS ─────────────────────────────────────────────────────────────────────
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

// ── Health checks ────────────────────────────────────────────────────────────
builder.Services.AddHealthChecks();

// ── Response compression ─────────────────────────────────────────────────────
builder.Services.AddResponseCompression(opts => opts.EnableForHttps = true);

// ── Controllers + Swagger ────────────────────────────────────────────────────
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

// ── JWT Authentication ───────────────────────────────────────────────────────
var jwtSection = builder.Configuration.GetSection("JwtSettings");
var jwtSecret = jwtSection["SecretKey"]
                ?? throw new InvalidOperationException("JwtSettings:SecretKey is not configured.");

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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ── Railway PORT binding ─────────────────────────────────────────────────────
// Only override when PORT is explicitly set (Railway/containers) so local
// dev keeps using launchSettings.json (http://localhost:5062).
var railwayPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(railwayPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{railwayPort}");
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "PokerApp API v1"));
}

// CORS must come BEFORE the exception middleware so error responses
// (including 500s) carry the Access-Control-Allow-Origin header. Otherwise
// the browser swallows the real status code with a generic CORS error.
app.UseCors(app.Environment.IsDevelopment() ? "Dev" : "Prod");

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseResponseCompression();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

// ── Auto-migration ──────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Database migration failed at startup.");
    }
}

app.Run();
