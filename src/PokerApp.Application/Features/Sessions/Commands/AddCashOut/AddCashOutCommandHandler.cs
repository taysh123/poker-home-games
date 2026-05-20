using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.AddCashOut;

public sealed class AddCashOutCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<AddCashOutCommand, AddCashOutResponse>
{
    public async Task<AddCashOutResponse> Handle(AddCashOutCommand request, CancellationToken cancellationToken)
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
            ?? throw new NotFoundException("Player", request.SessionPlayerId);

        if (session.Status != SessionStatus.Active)
            throw new BadRequestException("Cash-outs can only be added to active sessions.");

        var cashOut = CashOut.Create(session.Id, sessionPlayer.Id, request.Amount);
        await context.CashOuts.AddAsync(cashOut, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return new AddCashOutResponse(cashOut.Id, cashOut.SessionId, cashOut.SessionPlayerId!.Value, cashOut.Amount, cashOut.Timestamp);
    }
}
