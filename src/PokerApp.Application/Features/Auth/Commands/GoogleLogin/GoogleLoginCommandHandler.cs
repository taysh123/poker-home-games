using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using RefreshTokenEntity = PokerApp.Domain.Entities.RefreshToken;

namespace PokerApp.Application.Features.Auth.Commands.GoogleLogin;

public sealed class GoogleLoginCommandHandler(
    IApplicationDbContext context,
    IJwtService jwtService,
    IGoogleAuthService googleAuthService) : IRequestHandler<GoogleLoginCommand, GoogleLoginResponse>
{
    public async Task<GoogleLoginResponse> Handle(
        GoogleLoginCommand request,
        CancellationToken cancellationToken)
    {
        var info = await googleAuthService.ValidateIdTokenAsync(request.IdToken, cancellationToken);
        if (info is null)
            throw new UnauthorizedException("Invalid Google token.");

        // Single query: match by GoogleId first, fall back to email in the same round-trip
        var user = await context.Users
            .FirstOrDefaultAsync(
                u => u.GoogleId == info.GoogleId || u.Email == info.Email,
                cancellationToken);

        if (user is null)
        {
            var username = await MakeUniqueUsernameAsync(info.Name, cancellationToken);
            user = User.CreateWithGoogle(username, info.Email, info.GoogleId);
            await context.Users.AddAsync(user, cancellationToken);
        }
        else if (user.GoogleId != info.GoogleId)
        {
            // Found by email — link this Google identity to the existing account
            user.LinkGoogle(info.GoogleId);
        }

        var accessToken = jwtService.GenerateAccessToken(user);
        var (refreshTokenPlain, refreshTokenHash, refreshTokenExpiry) = jwtService.GenerateRefreshToken();
        var refreshToken = RefreshTokenEntity.Create(user.Id, refreshTokenHash, refreshTokenExpiry);

        await context.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new GoogleLoginResponse(
            user.Id, user.Username, user.Email, accessToken, refreshTokenPlain,
            user.AvatarEmoji, user.AvatarColor);
    }

    private async Task<string> MakeUniqueUsernameAsync(string displayName, CancellationToken ct)
    {
        var base_ = new string(displayName.ToLower()
            .Where(c => char.IsLetterOrDigit(c))
            .Take(20)
            .ToArray());

        if (string.IsNullOrEmpty(base_)) base_ = "user";

        // One query loads all taken variants; collision resolution stays in memory
        var taken = await context.Users
            .Where(u => u.Username.StartsWith(base_))
            .Select(u => u.Username)
            .ToListAsync(ct);

        var candidate = base_;
        var suffix = 2;
        while (taken.Contains(candidate))
            candidate = base_ + suffix++;

        return candidate;
    }
}
