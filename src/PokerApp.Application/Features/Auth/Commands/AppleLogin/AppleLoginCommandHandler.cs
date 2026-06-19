using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using RefreshTokenEntity = PokerApp.Domain.Entities.RefreshToken;

namespace PokerApp.Application.Features.Auth.Commands.AppleLogin;

public sealed class AppleLoginCommandHandler(
    IApplicationDbContext context,
    IJwtService jwtService,
    IAppleAuthService appleAuthService,
    IAuthPolicy authPolicy,
    IAuthAbuseGuard abuseGuard) : IRequestHandler<AppleLoginCommand, AppleLoginResponse>
{
    public async Task<AppleLoginResponse> Handle(AppleLoginCommand request, CancellationToken cancellationToken)
    {
        var info = await appleAuthService.ValidateIdentityTokenAsync(request.IdentityToken, request.Nonce, cancellationToken);
        if (info is null)
            throw new UnauthorizedException("Invalid Apple token.");

        // 1) Match by Apple subject (the stable, verified identity).
        var user = await context.Users
            .FirstOrDefaultAsync(u => u.AppleSubjectId == info.AppleSubjectId, cancellationToken);

        if (user is null)
        {
            // 2) Verified-email linking — only with a real, verified, non-relay email AND an
            //    existing account whose email is itself verified (anti-takeover). Never link relays.
            if (authPolicy.AllowEmailLinking && info.Email is not null && info.EmailVerified && !info.IsPrivateRelay)
            {
                // Apple verified ownership of this real email, so linking to a same-email account is safe.
                var byEmail = await context.Users
                    .FirstOrDefaultAsync(u => u.Email == info.Email, cancellationToken);
                if (byEmail is not null)
                {
                    byEmail.LinkApple(info.AppleSubjectId);
                    byEmail.MarkEmailVerified();
                    user = byEmail;
                }
            }

            // 3) Otherwise create a fresh verified account. Apple may omit the email; synthesize a
            //    unique, non-matching placeholder so it can never collide with or link to a real email.
            if (user is null)
            {
                var emailForStorage = info.Email ?? $"apple_{info.AppleSubjectId}@users.tpoker.local";
                var emailVerified = info.Email is not null && info.EmailVerified;
                var username = await MakeUniqueUsernameAsync(info.Email, cancellationToken);
                user = User.CreateWithApple(username, emailForStorage, info.AppleSubjectId, emailVerified);
                await context.Users.AddAsync(user, cancellationToken);
            }
        }
        else if (info.Email is not null && info.EmailVerified)
        {
            user.MarkEmailVerified();
        }

        var accessToken = jwtService.GenerateAccessToken(user);
        var (refreshTokenPlain, refreshTokenHash, refreshTokenExpiry) = jwtService.GenerateRefreshToken();
        var refreshToken = RefreshTokenEntity.Create(user.Id, refreshTokenHash, refreshTokenExpiry);

        await context.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        await abuseGuard.RecordSocialLoginAsync("apple", user.Id, cancellationToken);

        return new AppleLoginResponse(
            user.Id, user.Username, user.Email, accessToken, refreshTokenPlain,
            user.AvatarEmoji, user.AvatarColor);
    }

    private async Task<string> MakeUniqueUsernameAsync(string? seed, CancellationToken ct)
    {
        var basis = new string((seed ?? "player").Split('@')[0].ToLower()
            .Where(char.IsLetterOrDigit).Take(20).ToArray());
        if (string.IsNullOrEmpty(basis)) basis = "player";

        var taken = await context.Users
            .Where(u => u.Username.StartsWith(basis))
            .Select(u => u.Username)
            .ToListAsync(ct);

        var candidate = basis;
        var suffix = 2;
        while (taken.Contains(candidate))
            candidate = basis + suffix++;

        return candidate;
    }
}
