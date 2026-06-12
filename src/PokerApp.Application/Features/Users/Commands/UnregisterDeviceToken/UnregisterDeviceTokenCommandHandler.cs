using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Users.Commands.UnregisterDeviceToken;

public sealed class UnregisterDeviceTokenCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<UnregisterDeviceTokenCommand>
{
    public async Task Handle(UnregisterDeviceTokenCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        // Idempotent: silently succeed if the token doesn't exist (or belongs
        // to someone else) — unregistering is best-effort on logout.
        var deviceToken = await context.DeviceTokens
            .FirstOrDefaultAsync(t => t.Token == request.Token && t.UserId == userId, cancellationToken);

        if (deviceToken is null) return;

        deviceToken.Deactivate();
        await context.SaveChangesAsync(cancellationToken);
    }
}
