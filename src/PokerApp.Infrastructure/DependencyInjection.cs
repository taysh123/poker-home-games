using System.Security.Cryptography.X509Certificates;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Billing;
using PokerApp.Infrastructure.Identity;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Services;
using PokerApp.Infrastructure.Settings;

namespace PokerApp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // Register AppDbContext as IApplicationDbContext so handlers never import
        // Infrastructure — the DI container resolves the same scoped instance.
        services.AddScoped<IApplicationDbContext>(sp =>
            sp.GetRequiredService<AppDbContext>());

        services.AddScoped<IUnitOfWork, UnitOfWork>();

        var jwtSettings = configuration.GetSection(nameof(JwtSettings)).Get<JwtSettings>()
            ?? throw new InvalidOperationException("JwtSettings configuration is missing.");
        services.AddSingleton(jwtSettings);
        services.AddScoped<IJwtService, JwtService>();

        services.AddScoped<IPasswordHasher, PasswordHasher>();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        services.AddScoped<IGoogleAuthService, GoogleAuthService>();
        services.AddScoped<IAppleAuthService, AppleAuthService>();
        services.AddScoped<IAuthAbuseGuard, AuthAbuseGuard>();

        // Auth policy (verified-only hardening) — fail-closed defaults if section is absent.
        var authSettings = configuration.GetSection("AuthSettings").Get<AuthSettings>() ?? new AuthSettings();
        services.AddSingleton(authSettings);
        services.AddSingleton<IAuthPolicy, AuthPolicy>();

        // B2 — server-authoritative monetization enforcement.
        var aiCreditSettings = configuration.GetSection("AiCreditSettings").Get<AiCreditSettings>() ?? new AiCreditSettings();
        services.AddSingleton(aiCreditSettings);
        services.AddSingleton<IAiCreditPolicyProvider, AiCreditPolicyProvider>();
        services.AddScoped<IEntitlementService, EntitlementService>();
        services.AddScoped<ICreditLedger, CreditLedger>();

        // AI Coach provider (vendor-neutral; key lives server-side only). Default = deterministic mock
        // (fail-closed, unchanged behaviour); "vendor" selects the real adapter (a stub today that throws
        // until wired). Mirrors the billing provider config switch below.
        var coachAiSettings = configuration.GetSection("CoachAiSettings").Get<CoachAiSettings>() ?? new CoachAiSettings();
        services.AddSingleton(coachAiSettings);
        services.AddScoped<ICoachAiProvider>(sp =>
            CoachAiProviderFactory.Create(coachAiSettings, sp.GetRequiredService<IHttpClientFactory>().CreateClient()));

        // B3 — real store verification (provider-selected; mock retained for dev/tests).
        var billingSettings = configuration.GetSection("BillingSettings").Get<BillingSettings>() ?? new BillingSettings();
        var appleStoreSettings = configuration.GetSection("AppleStoreSettings").Get<AppleStoreSettings>() ?? new AppleStoreSettings();
        var googlePlaySettings = configuration.GetSection("GooglePlaySettings").Get<GooglePlaySettings>() ?? new GooglePlaySettings();
        services.AddSingleton(billingSettings);
        services.AddSingleton(appleStoreSettings);
        services.AddSingleton(googlePlaySettings);

        // Stripe (web) + RevenueCat (mobile) config — EMPTY ⇒ inert/fail-closed (mock stays active). The Stripe
        // Checkout service is registered always (it returns null/BadRequest when unconfigured).
        var stripeSettings = configuration.GetSection("StripeSettings").Get<StripeSettings>() ?? new StripeSettings();
        var revenueCatSettings = configuration.GetSection("RevenueCatSettings").Get<RevenueCatSettings>() ?? new RevenueCatSettings();
        services.AddSingleton(stripeSettings);
        services.AddSingleton(revenueCatSettings);
        services.AddScoped<IStripeCheckoutService>(sp =>
            new StripeCheckoutService(stripeSettings, sp.GetRequiredService<IWebSettings>(), sp.GetRequiredService<IHttpClientFactory>().CreateClient()));

        var appleRoots = appleStoreSettings.RootCertsPem
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => X509Certificate2.CreateFromPem(p))
            .ToList();
        services.AddSingleton(new AppleJwsVerifier(appleRoots));
        services.AddSingleton<IOidcKeySource, GoogleOidcKeySource>();
        services.AddScoped<IGooglePlaySubscriptionsClient, GooglePlaySubscriptionsClient>();
        services.AddScoped<IStoreNotificationVerifier, StoreNotificationVerifier>();

        if (string.Equals(billingSettings.Provider, "direct", StringComparison.OrdinalIgnoreCase))
        {
            services.AddScoped<AppleBillingVerifier>();
            services.AddScoped<GooglePlayBillingVerifier>();
            services.AddScoped(sp => new StripeBillingVerifier(stripeSettings, billingSettings, sp.GetRequiredService<IHttpClientFactory>().CreateClient()));
            services.AddScoped(sp => new RevenueCatBillingVerifier(revenueCatSettings, billingSettings, sp.GetRequiredService<IHttpClientFactory>().CreateClient()));
            services.AddScoped<IBillingVerifier, DirectBillingVerifier>();
        }
        else
        {
            services.AddScoped<IBillingVerifier, MockBillingVerifier>();
        }

        // B5 — fraud/abuse + observability + top-ups (safe defaults: blocking off, top-ups disabled).
        var fraudSettings = configuration.GetSection("FraudSettings").Get<FraudSettings>() ?? new FraudSettings();
        var topUpSettings = configuration.GetSection("TopUpSettings").Get<TopUpSettings>() ?? new TopUpSettings();
        services.AddSingleton(fraudSettings);
        services.AddSingleton(topUpSettings);
        services.AddSingleton<ITopUpCatalog, TopUpCatalog>();
        services.AddSingleton<IAuditLog, AuditLog>();
        services.AddScoped<IFraudEvaluator, FraudEvaluator>();

        services.Configure<WebSettings>(configuration.GetSection("AppSettings"));
        services.AddSingleton<IWebSettings>(sp =>
            sp.GetRequiredService<IOptions<WebSettings>>().Value);

        services.AddScoped<IAchievementEvaluator, AchievementEvaluator>();
        services.AddScoped<INotificationService, NotificationService>();

        services.AddHttpClient();
        services.AddScoped<IPushNotificationService, ExpoPushService>();

        return services;
    }
}
