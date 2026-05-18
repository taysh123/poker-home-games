using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.AddPlayer;

public sealed class AddPlayerCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<AddPlayerCommand, AddPlayerResponse>
{
    public async Task<AddPlayerResponse> Handle(AddPlayerCommand request, CancellationToken cancellationToken)
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
            throw new ConflictException("Players can only be added to Draft sessions.");

        var targetIsMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == request.UserId, cancellationToken);

        if (!targetIsMember)
            throw new ConflictException("The user is not a member of this group.");

        var alreadyAdded = await context.SessionPlayers
            .AnyAsync(sp => sp.SessionId == request.SessionId && sp.UserId == request.UserId, cancellationToken);

        if (alreadyAdded)
            throw new ConflictException("This player is already in the session.");

        var sessionPlayer = SessionPlayer.Create(request.SessionId, request.UserId);
        await context.SessionPlayers.AddAsync(sessionPlayer, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new AddPlayerResponse(sessionPlayer.Id, sessionPlayer.SessionId, sessionPlayer.UserId);
    }
}
