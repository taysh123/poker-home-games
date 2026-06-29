namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Server-side auth policy (bound from AuthSettings). Lets handlers enforce verified-only
/// identity rules without referencing configuration/Infrastructure directly. Fail-closed
/// defaults live in the implementation.
/// </summary>
public interface IAuthPolicy
{
    /// <summary>Allow open email/password self-registration. Hardened default: false.</summary>
    bool AllowEmailRegistration { get; }

    /// <summary>Allow linking a social login to an existing account by matching a verified email.</summary>
    bool AllowEmailLinking { get; }
}
