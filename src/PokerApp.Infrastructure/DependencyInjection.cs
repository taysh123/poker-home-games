using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PokerApp.Application.Common.Interfaces;
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
