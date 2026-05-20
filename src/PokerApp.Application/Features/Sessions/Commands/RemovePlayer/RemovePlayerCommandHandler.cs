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

        bool hasAccess;
        if (session.GroupId.HasValue)
            hasAccess = await context.GroupMembers
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == callerId, cancellationToken);
        else
            hasAccess = session.CreatorId == callerId;
        if (!hasAccess)
            throw new UnauthorizedException("You do not have access to this session.");

        var sessionPlayer = await context.SessionPlayers
            .FirstOrDefaultAsync(sp => sp.Id == request.SessionPlayerId && sp.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(SessionPlayer), request.SessionPlayerId);

        if (session.Status == SessionStatus.Active)
        {
            if (!sessionPlayer.IsGuest)
                throw new ConflictException("Cannot remove a registered player from an active session.");

            var buyIns = await context.BuyIns
                .Where(b => b.SessionPlayerId == sessionPlayer.Id)
                .ToListAsync(cancellationToken);
            context.BuyIns.RemoveRange(buyIns);

            var cashOuts = await context.CashOuts
                .Where(c => c.SessionPlayerId == sessionPlayer.Id)
                .ToListAsync(cancellationToken);
            context.CashOuts.RemoveRange(cashOuts);
        }
        else if (session.Status != SessionStatus.Draft)
        {
            throw new ConflictException("Players can only be removed from Draft or Active sessions.");
        }

        context.SessionPlayers.Remove(sessionPlayer);
        await context.SaveChangesAsync(cancellationToken);
    }
}
