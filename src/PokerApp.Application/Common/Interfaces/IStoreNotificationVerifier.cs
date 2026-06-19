using PokerApp.Application.Features.Billing.Commands;

namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Verifies a SIGNED store webhook and normalizes it to a StoreNotificationDto. Returns null when
/// the signature is invalid, the payload can't be trusted, or a sandbox event is rejected in prod
/// (fail-closed → the controller responds 401 and no state changes).
/// </summary>
public interface IStoreNotificationVerifier
{
    /// <summary>Apple App Store Server Notifications V2 — verify the JWS `signedPayload`.</summary>
    Task<StoreNotificationDto?> VerifyAppleAsync(string signedPayload, DateTime nowUtc, CancellationToken ct = default);

    /// <summary>Google Play RTDN via Pub/Sub push — verify the OIDC auth + decode the message.</summary>
    Task<StoreNotificationDto?> VerifyGoogleAsync(string? authorizationHeader, string messageId, string base64Data, DateTime nowUtc, CancellationToken ct = default);
}
