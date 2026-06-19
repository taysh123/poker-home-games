namespace PokerApp.Infrastructure.Identity;

/// <summary>
/// Bound from the "AuthSettings" config section. Hardened, fail-closed defaults: open email
/// registration is OFF (verified providers only); email-linking ON (verified-only logic lives
/// in the handlers).
/// </summary>
public class AuthSettings
{
    public bool AllowEmailRegistration { get; init; } = false;
    public bool AllowEmailLinking { get; init; } = true;
}
