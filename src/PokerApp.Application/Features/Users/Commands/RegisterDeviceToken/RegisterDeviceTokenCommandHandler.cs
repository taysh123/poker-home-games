using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Users.Commands.RegisterDeviceToken;

public sealed class RegisterDeviceTokenCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<RegisterDeviceTokenCommand>
{
    public async Task Handle(RegisterDeviceTokenCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        // Upsert by token: a device token is globally unique, so if it already
        // exists (e.g. a different user logged in on the same device), reassign
        // it to the current user and reactivate it.
        var existing = await context.DeviceTokens
            .FirstOrDefaultAsync(t => t.Token == request.Token, cancellationToken);

        if (existing is not null)
        {
            existing.ReassignTo(userId, request.Platform);
        }
        else
        {
            var deviceToken = DeviceToken.Create(userId, request.Token, request.Platform);
            await context.DeviceTokens.AddAsync(deviceToken, cancellationToken);
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
