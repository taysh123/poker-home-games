using PokerApp.Application.Common.Interfaces;
using PokerApp.Infrastructure.Identity;

namespace PokerApp.Infrastructure.Services;

/// <summary>Exposes AuthSettings to the Application layer via IAuthPolicy.</summary>
public sealed class AuthPolicy(AuthSettings settings) : IAuthPolicy
{
    public bool AllowEmailRegistration => settings.AllowEmailRegistration;
    public bool AllowEmailLinking => settings.AllowEmailLinking;
}
