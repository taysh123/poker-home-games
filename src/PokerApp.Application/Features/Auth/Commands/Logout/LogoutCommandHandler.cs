using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Auth.Commands.Logout;

public sealed class LogoutCommandHandler(
    IApplicationDbContext context,
    IJwtService jwtService) : IRequestHandler<LogoutCommand, Unit>
{
    public async Task<Unit> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        var tokenHash = jwtService.HashToken(request.RefreshToken);

        var token = await context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, cancellationToken);

        // Idempotent: already revoked or not found — both are success from the client's view.
        // Never reveal whether the token existed; prevents probing for valid tokens.
        if (token is null || token.IsRevoked)
            return Unit.Value;

        token.Revoke();
        await context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
