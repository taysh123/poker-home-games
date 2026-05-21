using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Notifications;

namespace PokerApp.Application.Features.Notifications.Queries.GetMyNotifications;

public sealed class GetMyNotificationsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetMyNotificationsQuery, GetMyNotificationsResponse>
{
    public async Task<GetMyNotificationsResponse> Handle(GetMyNotificationsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var notifications = await context.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new NotificationDto(n.Id, n.Type.ToString(), n.Title, n.Body, n.RelatedEntityId, n.IsRead, n.CreatedAt))
            .ToListAsync(cancellationToken);

        var unreadCount = notifications.Count(n => !n.IsRead);

        return new GetMyNotificationsResponse(notifications, unreadCount);
    }
}
