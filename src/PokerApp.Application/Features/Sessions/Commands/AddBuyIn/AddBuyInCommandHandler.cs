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

        var targetIsPlayer = await context.SessionPlayers
            .AnyAsync(sp => sp.SessionId == request.SessionId && sp.UserId == request.UserId, cancellationToken);

        if (!targetIsPlayer)
            throw new NotFoundException("Player", request.UserId);

        if (session.Status != SessionStatus.Active)
            throw new BadRequestException("Buy-ins can only be added to active sessions.");

        var buyIn = BuyIn.Create(session.Id, request.UserId, request.Amount);
        await context.BuyIns.AddAsync(buyIn, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new AddBuyInResponse(buyIn.Id, buyIn.SessionId, buyIn.UserId, buyIn.Amount, buyIn.Timestamp);
    }
}
