using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.EndSession;

public sealed class EndSessionCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IAchievementEvaluator achievementEvaluator,
    INotificationService notificationService,
    ILogger<EndSessionCommandHandler> logger) : IRequestHandler<EndSessionCommand>
{
    public async Task Handle(EndSessionCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var session = await context.Sessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        if (session.GroupId.HasValue)
        {
            var membership = await context.GroupMembers
                .FirstOrDefaultAsync(m => m.GroupId == session.GroupId.Value && m.UserId == userId, cancellationToken)
                ?? throw new UnauthorizedException("You are not a member of this group.");

            if (membership.Role == GroupRole.Member)
                throw new UnauthorizedException("Only admins and owners can end a session.");
        }
        else if (session.CreatorId != userId)
        {
            throw new UnauthorizedException("Only the session creator can end this session.");
        }

        if (session.Status != SessionStatus.Active)
            throw new ConflictException("Only Active sessions can be ended.");

        if (request.FinalStacks is { Count: > 0 })
        {
            var validPlayerIdList = await context.SessionPlayers
                .Where(sp => sp.SessionId == request.SessionId)
                .Select(sp => sp.Id)
                .ToListAsync(cancellationToken);
            var validPlayerIds = validPlayerIdList.ToHashSet();

            foreach (var stack in request.FinalStacks)
            {
                if (!validPlayerIds.Contains(stack.SessionPlayerId))
                    throw new BadRequestException($"Player {stack.SessionPlayerId} is not in this session.");
                if (stack.Amount < 0)
                    throw new BadRequestException("Final stack amounts cannot be negative.");

                var cashOut = CashOut.Create(session.Id, stack.SessionPlayerId, stack.Amount);
                await context.CashOuts.AddAsync(cashOut, cancellationToken);
            }
        }

        session.End();

        if (session.GroupId.HasValue)
        {
            var actorName = currentUserService.Username ?? "Unknown";
            var activity = ActivityLog.Create(session.GroupId.Value, userId, actorName,
                ActivityType.SessionEnded, $"{actorName} ended session \"{session.Name}\"",
                session.Id);
            await context.ActivityLogs.AddAsync(activity, cancellationToken);
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another end-game submit committed between this handler's read of `session` above and
            // this write, so the session's Version no longer matches the one this request read and
            // the UPDATE matched zero rows. The `Status != Active` check cannot catch that on its
            // own: both racers read Active before either committed (audit 2026-08-03, HIGH #3).
            //
            // Crucially, SaveChanges is a single transaction, so the CashOut rows queued above roll
            // back with it. That is the whole point — otherwise both requests write a full
            // FinalStacks set, and every settlement projection sums CashOut rows per seat with no
            // dedupe, so the duplicate silently DOUBLES that player's cash-out.
            //
            // COPY: "ended or changed", not "ended" — the dominant cause is a second end, but this
            // catch fires whenever the Session row this request read no longer matches, so the
            // sentence must not assert an ending that may not have happened.
            //
            // A concurrent DELETE reaches here only when NO final stacks were submitted. With
            // stacks — the real "End Game & Settle" shape — the CashOut insert's foreign-key
            // violation wins the batch first, surfacing as a DbUpdateException (not a
            // DbUpdateConcurrencyException), which nothing maps and which therefore 500s. That is a
            // pre-existing gap in the delete-vs-write race, not something this guard introduced;
            // it is recorded in the T0.2 fleet disposition rather than papered over here.
            throw new ConflictException(
                "This session was already ended or changed by someone else. Refresh to see the latest.");
        }

        // ── Everything below this line is a BEST-EFFORT SIDE EFFECT ────────────────────────────
        // The session end and its cash-outs are already durably committed above. Nothing here may
        // turn a request that succeeded into a failure the caller sees (audit 2026-08-03, HIGH #7).
        //
        // Awarding achievements was the one step in this tail that ran unguarded, while the
        // notification blocks below it had been wrapped from the start. The evaluator writes
        // UserAchievement rows, so a unique-index race on (UserId, AchievementKey) — the same user
        // ending two different sessions at once — throws DbUpdateException. Nothing maps that, so
        // the caller got a bare 500 for a game night the server had already closed out, and the
        // client showed an error over a finished session. Same defect class as PR #74 and PR #78.
        //
        // LOGGED, not silently swallowed: a failure here means a player did not get an achievement
        // they earned. That is invisible to everyone unless it is recorded, and a systematic
        // failure (a broken evaluator, not a one-off race) would otherwise never surface at all.
        IReadOnlyList<string> newAchievementKeys = [];
        try
        {
            newAchievementKeys = await achievementEvaluator.EvaluateAsync(userId, request.SessionId, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Achievement evaluation failed after session {SessionId} was ended by user {UserId}. " +
                "The session end itself is committed and unaffected; any achievements earned in it were not awarded.",
                request.SessionId, userId);
        }

        // Notify the creator about each newly unlocked achievement (best-effort)
        if (newAchievementKeys.Count > 0)
        {
            try
            {
                var achievementNames = await context.Achievements
                    .Where(a => newAchievementKeys.Contains(a.Key))
                    .Select(a => a.Name)
                    .ToListAsync(cancellationToken);

                foreach (var name in achievementNames)
                {
                    await notificationService.NotifyAsync(
                        userId,
                        NotificationType.AchievementUnlocked,
                        "Achievement unlocked!",
                        name,
                        cancellationToken: cancellationToken);
                }
            }
            catch (Exception ex)
            {
                // Non-critical (the session ended regardless) but no longer SILENT — the same
                // reasoning as the achievement guard above: an unrecorded failure here is a
                // notification nobody knows was never sent.
                logger.LogWarning(ex,
                    "Achievement-unlock notifications failed after session {SessionId} ended.", request.SessionId);
            }
        }

        // Notify all registered players that the session ended (best-effort)
        try
        {
            var playerUserIds = await context.SessionPlayers
                .Where(sp => sp.SessionId == request.SessionId && sp.UserId.HasValue && sp.UserId.Value != userId)
                .Select(sp => sp.UserId!.Value)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (playerUserIds.Count > 0)
            {
                await notificationService.NotifyManyAsync(
                    playerUserIds,
                    NotificationType.SessionEnded,
                    "Session Ended",
                    $"\"{session.Name}\" has been wrapped up. Check your final results.",
                    session.Id,
                    cancellationToken);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Session-ended notifications failed after session {SessionId} ended.", request.SessionId);
        }
    }
}
