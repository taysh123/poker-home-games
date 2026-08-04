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

        bool hasAccess;
        if (session.GroupId.HasValue)
            hasAccess = await context.GroupMembers
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == callerId, cancellationToken);
        else
            hasAccess = session.CreatorId == callerId;
        if (!hasAccess)
            throw new UnauthorizedException("You do not have access to this session.");

        if (session.Status != SessionStatus.Draft && session.Status != SessionStatus.Active)
            throw new ConflictException("Players can only be added to Draft or Active sessions.");

        SessionPlayer sessionPlayer;

        if (request.GuestName is not null)
        {
            var duplicateGuest = await context.SessionPlayers
                .AnyAsync(sp => sp.SessionId == request.SessionId && sp.GuestName == request.GuestName, cancellationToken);

            if (duplicateGuest)
                throw new ConflictException($"A guest named '{request.GuestName}' is already in this session.");

            if (request.LinkedUserId.HasValue)
            {
                var linkedUserExists = await context.Users
                    .AnyAsync(u => u.Id == request.LinkedUserId.Value, cancellationToken);
                if (!linkedUserExists)
                    throw new NotFoundException(nameof(User), request.LinkedUserId.Value);
            }

            sessionPlayer = SessionPlayer.CreateForGuest(request.SessionId, request.GuestName, request.LinkedUserId);
        }
        else
        {
            var userId = request.UserId!.Value;

            // CONSENT GATE (audit 2026-08-05, HIGH #1). A registered user may only be seated in a
            // session's financial ledger by someone they ALREADY SHARE A GROUP WITH — joining a
            // group is the consent gesture. Before this, any account could be created, used to
            // open a standalone session, and then used to seat any stranger found through the
            // (then unscoped) user search: buy-ins recorded against them, a real Settlement row
            // persisted naming them, and no way for them to get out.
            //
            // The rule is deliberately the same for group and standalone sessions. A standalone
            // session has no group to check, and that is exactly the attack path — so the test is
            // "does the TARGET share a group with the CALLER", which is also precisely the set
            // SearchUsersQueryHandler now returns, so a legitimate client can only ever offer
            // people it can actually add.
            //
            // NotFoundException, not Unauthorized: this handler already throws NotFound for a
            // genuinely absent user, so reusing it makes "does not exist" and "exists but is not
            // reachable by you" indistinguishable — the endpoint stops confirming whether an
            // arbitrary account exists. (A non-existent user has no memberships, so `reachable`
            // subsumes the old existence check.)
            //
            // Guests are untouched — see the GuestName branch above. No account, no victim, and
            // add-by-name is the "they're sitting right here" fast path CLAUDE.md protects.
            var reachable = await context.GroupMembers
                .AnyAsync(mine => mine.UserId == callerId
                    && context.GroupMembers.Any(theirs =>
                        theirs.GroupId == mine.GroupId && theirs.UserId == userId),
                    cancellationToken);

            if (!reachable)
                throw new NotFoundException(nameof(User), userId);

            var alreadyAdded = await context.SessionPlayers
                .AnyAsync(sp => sp.SessionId == request.SessionId && sp.UserId == userId, cancellationToken);

            if (alreadyAdded)
                throw new ConflictException("This player is already in the session.");

            sessionPlayer = SessionPlayer.CreateForUser(request.SessionId, userId);
        }

        await context.SessionPlayers.AddAsync(sessionPlayer, cancellationToken);

        if (session.GroupId.HasValue)
        {
            var actorName = currentUserService.Username ?? "Unknown";
            var playerLabel = sessionPlayer.IsGuest ? request.GuestName! : actorName;
            var activity = ActivityLog.Create(session.GroupId.Value, callerId, actorName,
                ActivityType.PlayerJoined, $"{playerLabel} joined session \"{session.Name}\"",
                session.Id);
            await context.ActivityLogs.AddAsync(activity, cancellationToken);
        }

        await context.SaveChangesAsync(cancellationToken);

        return new AddPlayerResponse(
            sessionPlayer.Id,
            sessionPlayer.SessionId,
            sessionPlayer.UserId,
            sessionPlayer.GuestName,
            sessionPlayer.IsGuest,
            sessionPlayer.LinkedUserId);
    }
}
