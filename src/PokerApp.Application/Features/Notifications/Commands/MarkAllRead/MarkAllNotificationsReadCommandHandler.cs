using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Notifications.Commands.MarkAllRead;

public sealed class MarkAllNotificationsReadCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<MarkAllNotificationsReadCommand>
{
    public async Task Handle(MarkAllNotificationsReadCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var unread = await context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync(cancellationToken);

        if (unread.Count == 0) return;

        foreach (var n in unread)
            n.IsRead = true;

        await context.SaveChangesAsync(cancellationToken);
    }
}
