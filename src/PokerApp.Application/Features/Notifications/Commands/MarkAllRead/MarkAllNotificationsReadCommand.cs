using MediatR;

namespace PokerApp.Application.Features.Notifications.Commands.MarkAllRead;

public sealed record MarkAllNotificationsReadCommand : IRequest;
