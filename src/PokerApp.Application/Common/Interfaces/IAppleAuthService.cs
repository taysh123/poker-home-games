namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Identity extracted from a validated Apple Sign In identity token. Email may be null
/// (Apple only returns it on first authorization, or omits it) and may be a private-relay
/// address; callers must not assume it is present or personal.
/// </summary>
public sealed record AppleUserInfo(string AppleSubjectId, string? Email, bool EmailVerified, bool IsPrivateRelay);

public interface IAppleAuthService
{
    /// <summary>
    /// Validates an Apple identity token (signature against Apple's JWKS, issuer, audience,
    /// expiry, and the nonce when supplied). Returns null if the token is invalid/expired.
    /// </summary>
    Task<AppleUserInfo?> ValidateIdentityTokenAsync(string identityToken, string? expectedNonce = null, CancellationToken ct = default);
}
