using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.RemovePlayer;

public sealed class RemovePlayerCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<RemovePlayerCommand>
{
    public async Task Handle(RemovePlayerCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        var callerIsMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == callerId, cancellationToken);

        if (!callerIsMember)
            throw new UnauthorizedException("You are not a member of this group.");

        if (session.Status != SessionStatus.Draft)
            throw new ConflictException("Players can only be removed from Draft sessions.");

        var sessionPlayer = await context.SessionPlayers
            .FirstOrDefaultAsync(sp => sp.SessionId == request.SessionId && sp.UserId == request.UserId, cancellationToken)
            ?? throw new NotFoundException(nameof(SessionPlayer), request.UserId);

        context.SessionPlayers.Remove(sessionPlayer);
        await context.SaveChangesAsync(cancellationToken);
    }
}
