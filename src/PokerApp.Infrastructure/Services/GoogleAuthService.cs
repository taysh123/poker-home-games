using Google.Apis.Auth;
using Microsoft.Extensions.Configuration;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

public sealed class GoogleAuthService(IConfiguration configuration) : IGoogleAuthService
{
    public async Task<GoogleUserInfo?> ValidateIdTokenAsync(string idToken, CancellationToken ct = default)
    {
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = configuration.GetSection("GoogleSettings:ClientIds").Get<IList<string>>()
                    ?? throw new InvalidOperationException("GoogleSettings:ClientIds not configured.")
            };
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            var name = payload.Name ?? payload.Email.Split('@')[0];
            return new GoogleUserInfo(payload.Subject, payload.Email, name);
        }
        catch (InvalidJwtException)
        {
            return null;
        }
    }
}
