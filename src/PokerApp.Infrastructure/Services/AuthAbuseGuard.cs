using Microsoft.Extensions.Logging;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// B1 logging no-op for the auth abuse seam. Records signals so later phases can back it with
/// real velocity / device-binding / fraud enforcement. Never throws into the auth flow.
/// </summary>
public sealed class AuthAbuseGuard(ILogger<AuthAbuseGuard> logger) : IAuthAbuseGuard
{
    public Task RecordFailedLoginAsync(string emailOrUser, CancellationToken ct = default)
    {
        logger.LogInformation("auth.failed_login");
        return Task.CompletedTask;
    }

    public Task RecordSocialLoginAsync(string provider, Guid userId, CancellationToken ct = default)
    {
        logger.LogInformation("auth.social_login {Provider}", provider);
        return Task.CompletedTask;
    }

    public Task RecordRefreshReuseAsync(Guid userId, CancellationToken ct = default)
    {
        logger.LogWarning("auth.refresh_reuse {UserId}", userId);
        return Task.CompletedTask;
    }
}
