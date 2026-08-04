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

        var sessionPlayer = await context.SessionPlayers
            .FirstOrDefaultAsync(sp => sp.Id == request.SessionPlayerId && sp.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(SessionPlayer), request.SessionPlayerId);

        // SELF-REMOVAL IS ALWAYS PERMITTED — any session status, and independent of the access
        // check below. It is the recourse that completes the AddPlayer consent gate: someone
        // seated without being asked can always leave (audit 2026-08-05, HIGH #1).
        //
        // It must bypass ACCESS, not just status. In a standalone session `hasAccess` is
        // `session.CreatorId == callerId`, so the person in the seat — who by definition is not
        // the creator — would be rejected before the status guard was ever reached. A standalone
        // session is precisely what an attacker creates (no group required), so an access-only
        // bypass would leave the property failing exactly where it is needed.
        //
        // Keyed on "this seat is MINE", never on the caller merely asking: a stranger still gets
        // the Unauthorized below, or the recourse would itself become an attack.
        //
        // CONSEQUENCE, deliberate: this deletes the seat's buy-ins/cash-outs, like every other
        // removal. Leaving orphaned money behind is the defect PR #78 fixed, and a seat the user
        // never consented to should not leave money attributed to nobody.
        var isSelfRemoval = sessionPlayer.UserId == callerId;

        if (!isSelfRemoval)
        {
            bool hasAccess;
            if (session.GroupId.HasValue)
                hasAccess = await context.GroupMembers
                    .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == callerId, cancellationToken);
            else
                hasAccess = session.CreatorId == callerId;
            if (!hasAccess)
                throw new UnauthorizedException("You do not have access to this session.");

            if (session.Status == SessionStatus.Active && !sessionPlayer.IsGuest)
                throw new ConflictException("Cannot remove a registered player from an active session.");
            if (session.Status != SessionStatus.Active && session.Status != SessionStatus.Draft)
                throw new ConflictException("Players can only be removed from Draft or Active sessions.");
        }

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
