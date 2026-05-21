using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.EndSession;

public sealed class EndSessionCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService,
    IAchievementEvaluator achievementEvaluator) : IRequestHandler<EndSessionCommand>
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
                ActivityType.SessionEnded, $"{actorName} ended session \"{session.Name}\"");
            await context.ActivityLogs.AddAsync(activity, cancellationToken);
        }

        await context.SaveChangesAsync(cancellationToken);

        // Award any newly-earned achievements for the session creator
        await achievementEvaluator.EvaluateAsync(userId, request.SessionId, cancellationToken);
    }
}
