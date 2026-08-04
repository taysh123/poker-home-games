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

        if (session.Status == SessionStatus.Active && !sessionPlayer.IsGuest)
            throw new ConflictException("Cannot remove a registered player from an active session.");
        if (session.Status != SessionStatus.Active && session.Status != SessionStatus.Draft)
            throw new ConflictException("Players can only be removed from Draft or Active sessions.");

        // Money-row cleanup now applies to BOTH branches, unconditionally — the Draft branch
        // previously had NONE at all. That gap is the actual, always-reproducible defect: whenever
        // a Draft-status session's removed seat carries a buy-in or cash-out — which normal usage
        // never produces (buy-ins require an Active session), but AddBuyInCommandHandler's
        // auto-start side effect (`if (Draft) session.Start()`) does, if it commits between this
        // handler's read of `session` and this point — the row went straight from "attached to a
        // seat" to "detached by the seat's delete" with nothing in between to catch it.
        // BuyIn/CashOut.SessionPlayerId is ON DELETE SET NULL: a row this cleanup misses is not
        // simply left behind, it is silently orphaned (SessionPlayerId AND UserId both null,
        // attributed to no seat and no user). On main today that amount is silently dropped from
        // every balance calculation; CalculateSettlements' orphaned-money guard instead refuses the
        // whole session forever (fleet finding, 2026-08-04).
        //
        // HONEST LIMIT: this does not add locking. The Active branch already had this exact
        // read-then-remove step immediately before the same SaveChangesAsync below — moving it out
        // of the `if` block closes the Draft branch's gap and removes the duplicated code, but does
        // not further narrow whatever window already existed here for a registered/guest buy-in
        // committed between this read and that commit. Closing that fully needs serializable
        // isolation or locking coordinated with AddBuyIn — out of scope for this fix.
        var buyIns = await context.BuyIns
            .Where(b => b.SessionPlayerId == sessionPlayer.Id)
            .ToListAsync(cancellationToken);
        context.BuyIns.RemoveRange(buyIns);

        var cashOuts = await context.CashOuts
            .Where(c => c.SessionPlayerId == sessionPlayer.Id)
            .ToListAsync(cancellationToken);
        context.CashOuts.RemoveRange(cashOuts);

        context.SessionPlayers.Remove(sessionPlayer);
        await context.SaveChangesAsync(cancellationToken);
    }
}
