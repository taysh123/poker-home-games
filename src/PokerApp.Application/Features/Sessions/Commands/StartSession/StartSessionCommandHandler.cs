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

        if (session.GroupId.HasValue)
        {
            var membership = await context.GroupMembers
                .FirstOrDefaultAsync(m => m.GroupId == session.GroupId.Value && m.UserId == userId, cancellationToken)
                ?? throw new UnauthorizedException("You are not a member of this group.");

            if (membership.Role == GroupRole.Member)
                throw new UnauthorizedException("Only admins and owners can start a session.");
        }
        else if (session.CreatorId != userId)
        {
            throw new UnauthorizedException("Only the session creator can start this session.");
        }

        if (session.Status != SessionStatus.Draft)
            throw new ConflictException("Only Draft sessions can be started.");

        session.Start();

        if (session.GroupId.HasValue)
        {
            var actorName = currentUserService.Username ?? "Unknown";
            var activity = ActivityLog.Create(session.GroupId.Value, userId, actorName,
                ActivityType.SessionStarted, $"{actorName} started session \"{session.Name}\"",
                session.Id);
            await context.ActivityLogs.AddAsync(activity, cancellationToken);
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
