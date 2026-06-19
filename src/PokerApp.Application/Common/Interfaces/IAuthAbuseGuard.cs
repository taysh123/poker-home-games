namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Seam for auth abuse / fraud signals (velocity, device binding, anomaly flags). B1 ships a
/// logging no-op; later it backs server-side rate/fraud enforcement. Calls must never throw
/// into the auth flow (best-effort telemetry).
/// </summary>
public interface IAuthAbuseGuard
{
    Task RecordFailedLoginAsync(string emailOrUser, CancellationToken ct = default);
    Task RecordSocialLoginAsync(string provider, Guid userId, CancellationToken ct = default);
    Task RecordRefreshReuseAsync(Guid userId, CancellationToken ct = default);
}
