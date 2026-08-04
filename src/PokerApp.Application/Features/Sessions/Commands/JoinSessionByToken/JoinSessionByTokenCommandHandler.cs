using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.JoinSessionByToken;

public sealed class JoinSessionByTokenCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService)
    : IRequestHandler<JoinSessionByTokenCommand, JoinSessionByTokenResponse>
{
    public async Task<JoinSessionByTokenResponse> Handle(
        JoinSessionByTokenCommand request,
        CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var inviteToken = await context.SessionInviteTokens
            .Include(t => t.Session)
            .FirstOrDefaultAsync(t => t.Token == request.Token, cancellationToken)
            ?? throw new NotFoundException(nameof(SessionInviteToken), request.Token);

        if (!inviteToken.IsActive)
            throw new ConflictException("This invite link has expired or is no longer valid.");

        var session = inviteToken.Session;

        if (session.Status != SessionStatus.Draft && session.Status != SessionStatus.Active)
            throw new ConflictException("This session is no longer accepting new players.");

        var alreadyInSession = await context.SessionPlayers
            .AnyAsync(sp => sp.SessionId == session.Id && sp.UserId == callerId, cancellationToken);

        if (alreadyInSession)
        {
            // Idempotent — return their existing player record
            var existingPlayer = await context.SessionPlayers
                .FirstAsync(sp => sp.SessionId == session.Id && sp.UserId == callerId, cancellationToken);

            return new JoinSessionByTokenResponse(session.Id, session.Name, session.Status.ToString(), existingPlayer.Id, session.GroupId);
        }

        var sessionPlayer = SessionPlayer.CreateForUser(session.Id, callerId);
        await context.SessionPlayers.AddAsync(sessionPlayer, cancellationToken);

        inviteToken.Use(callerId);

        if (session.GroupId.HasValue)
        {
            var actorName = currentUserService.Username ?? "Unknown";
            var activity = ActivityLog.Create(
                session.GroupId.Value,
                callerId,
                actorName,
                ActivityType.PlayerJoined,
                $"{actorName} joined session \"{session.Name}\" via invite link",
                session.Id);
            await context.ActivityLogs.AddAsync(activity, cancellationToken);
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Someone else redeemed this single-use token between the IsActive check above and this
            // write. Same mechanism, and same reason the `IsActive` check cannot stand alone, as
            // EndSession's guard: both racers read `UsedAt IS NULL` before either committed. The
            // seat queued above rolls back with the failed transaction, so one token still seats
            // exactly one player.
            // "used or revoked": the token row changing is what this detects, and Revoke() bumps
            // the same token, so the sentence must cover both rather than assert a use.
            throw new ConflictException("This invite link was just used or revoked by someone else.");
        }

        return new JoinSessionByTokenResponse(session.Id, session.Name, session.Status.ToString(), sessionPlayer.Id, session.GroupId);
    }
}
