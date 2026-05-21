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

var builder = WebApplication.CreateBuilder(args);

// ── Layers ──────────────────────────────────────────────────────────────────
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// ── CORS ─────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    // Development: open CORS for local testing
    options.AddPolicy("Dev", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader());

    // Production: restrict to explicitly configured origins
    var allowedOrigins = builder.Configuration
        .GetSection("AllowedOrigins")
        .Get<string[]>() ?? Array.Empty<string>();

    options.AddPolicy("Prod", policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader());
});

// ── Rate Limiting ────────────────────────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Login: 10 attempts per minute
    options.AddFixedWindowLimiter("auth-login", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 10;
        opt.QueueLimit = 0;
        opt.AutoReplenishment = true;
    });

    // Register: 5 attempts per minute
    options.AddFixedWindowLimiter("auth-register", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 5;
        opt.QueueLimit = 0;
        opt.AutoReplenishment = true;
    });

    // Refresh token: 20 requests per minute
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

// ── Controllers ─────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ── JWT Authentication ───────────────────────────────────────────────────────
var jwtSection = builder.Configuration.GetSection("JwtSettings");

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
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSection["SecretKey"]!)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ── Swagger ──────────────────────────────────────────────────────────────────
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

// ── Pipeline ─────────────────────────────────────────────────────────────────
var app = builder.Build();

// Swagger
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();

    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "PokerApp API v1");
    });
}

// CORS
app.UseCors(app.Environment.IsDevelopment() ? "Dev" : "Prod");

// Global exception handling
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Railway handles HTTPS externally
// app.UseHttpsRedirection();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

// Routes
app.MapControllers();

// Health check endpoint for Railway
app.MapHealthChecks("/health");

// Simple root endpoint
app.MapGet("/", () => Results.Ok(new
{
    status = "PokerApp API is running",
    environment = app.Environment.EnvironmentName,
    timestamp = DateTime.UtcNow
}));

// Auto-apply EF Core migrations
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider
        .GetRequiredService<PokerApp.Infrastructure.Persistence.AppDbContext>();

    db.Database.Migrate();
}

app.Run();