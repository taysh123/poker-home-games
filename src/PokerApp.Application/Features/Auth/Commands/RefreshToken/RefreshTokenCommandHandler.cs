using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Auth.Commands.RefreshToken;

public sealed class RefreshTokenCommandHandler(
    IApplicationDbContext context,
    IJwtService jwtService) : IRequestHandler<RefreshTokenCommand, RefreshTokenResponse>
{
    public async Task<RefreshTokenResponse> Handle(
        RefreshTokenCommand request,
        CancellationToken cancellationToken)
    {
        var tokenHash = jwtService.HashToken(request.Token);

        var storedToken = await context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, cancellationToken);

        if (storedToken is null)
            throw new UnauthorizedException("Invalid refresh token.");

        // Token family revocation: a revoked token being replayed means a potential theft.
        // Revoke ALL active tokens for this user to force re-login on all devices.
        if (storedToken.IsRevoked)
        {
            var familyTokens = await context.RefreshTokens
                .Where(rt => rt.UserId == storedToken.UserId && !rt.IsRevoked)
                .ToListAsync(cancellationToken);

            foreach (var t in familyTokens)
                t.Revoke();

            await context.SaveChangesAsync(cancellationToken);
            throw new UnauthorizedException("Refresh token reuse detected. All sessions invalidated.");
        }

        if (!storedToken.IsActive)
            throw new UnauthorizedException("Refresh token has expired. Please log in again.");

        // Rotate: invalidate the consumed token and issue a fresh pair
        storedToken.Revoke();

        var newAccessToken = jwtService.GenerateAccessToken(storedToken.User);
        var (newRefreshTokenPlain, newRefreshTokenHash, newRefreshTokenExpiry) = jwtService.GenerateRefreshToken();
        var newRefreshToken = Domain.Entities.RefreshToken.Create(
            storedToken.UserId, newRefreshTokenHash, newRefreshTokenExpiry);

        await context.RefreshTokens.AddAsync(newRefreshToken, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new RefreshTokenResponse(newAccessToken, newRefreshTokenPlain);
    }
}
