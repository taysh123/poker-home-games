using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.DeleteSession;

public sealed class DeleteSessionCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<DeleteSessionCommand>
{
    public async Task Handle(DeleteSessionCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        var membership = await context.GroupMembers
            .FirstOrDefaultAsync(m => m.GroupId == session.GroupId && m.UserId == userId, cancellationToken)
            ?? throw new UnauthorizedException("You are not a member of this group.");

        if (membership.Role == GroupRole.Member)
            throw new UnauthorizedException("Only admins and owners can delete a session.");

        var actorName = currentUserService.Username ?? "Unknown";
        var activity = ActivityLog.Create(
            session.GroupId, userId, actorName,
            ActivityType.SessionEnded,
            $"{actorName} deleted session \"{session.Name}\"");
        await context.ActivityLogs.AddAsync(activity, cancellationToken);

        // EF cascade deletes: BuyIns, CashOuts, Settlements, SessionPlayers, HandRecords
        context.Sessions.Remove(session);
        await context.SaveChangesAsync(cancellationToken);
    }
}
