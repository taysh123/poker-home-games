using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.StartSession;

public sealed class StartSessionCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<StartSessionCommand>
{
    public async Task Handle(StartSessionCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        var membership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == session.GroupId && m.UserId == userId, cancellationToken)
            ?? throw new UnauthorizedException("You are not a member of this group.");

        if (membership.Role == GroupRole.Member)
            throw new UnauthorizedException("Only admins and owners can start a session.");

        if (session.Status != SessionStatus.Draft)
            throw new ConflictException("Only Draft sessions can be started.");

        session.Start();

        var actorName = currentUserService.Username ?? "Unknown";
        var activity = ActivityLog.Create(session.GroupId, userId, actorName,
            ActivityType.SessionStarted, $"{actorName} started session \"{session.Name}\"");
        await context.ActivityLogs.AddAsync(activity, cancellationToken);

        await context.SaveChangesAsync(cancellationToken);
    }
}
