using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.AddBuyIn;

public sealed class AddBuyInCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<AddBuyInCommand, AddBuyInResponse>
{
    public async Task<AddBuyInResponse> Handle(AddBuyInCommand request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        var callerIsMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == callerId, cancellationToken);

        if (!callerIsMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var sessionPlayer = await context.SessionPlayers
            .FirstOrDefaultAsync(sp => sp.Id == request.SessionPlayerId && sp.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException("Player", request.SessionPlayerId);

        if (session.Status == SessionStatus.Finished)
            throw new BadRequestException("Buy-ins cannot be added to a finished session.");

        if (session.Status == SessionStatus.Draft)
            session.Start();

        var buyIn = BuyIn.Create(session.Id, sessionPlayer.Id, request.Amount);
        await context.BuyIns.AddAsync(buyIn, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new AddBuyInResponse(buyIn.Id, buyIn.SessionId, buyIn.SessionPlayerId!.Value, buyIn.Amount, buyIn.Timestamp);
    }
}
