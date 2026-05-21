using MediatR;
using PokerApp.Application.Features.Notifications;

namespace PokerApp.Application.Features.Notifications.Queries.GetMyNotifications;

public sealed record GetMyNotificationsQuery : IRequest<GetMyNotificationsResponse>;

public sealed record GetMyNotificationsResponse(
    List<NotificationDto> Notifications,
    int UnreadCount
);
