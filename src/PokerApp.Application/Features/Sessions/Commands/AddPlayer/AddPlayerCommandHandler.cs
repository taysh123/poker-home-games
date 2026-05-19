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

        var callerIsMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == callerId, cancellationToken);

        if (!callerIsMember)
            throw new UnauthorizedException("You are not a member of this group.");

        if (session.Status != SessionStatus.Draft && session.Status != SessionStatus.Active)
            throw new ConflictException("Players can only be added to Draft or Active sessions.");

        SessionPlayer sessionPlayer;

        if (request.GuestName is not null)
        {
            var duplicateGuest = await context.SessionPlayers
                .AnyAsync(sp => sp.SessionId == request.SessionId && sp.GuestName == request.GuestName, cancellationToken);

            if (duplicateGuest)
                throw new ConflictException($"A guest named '{request.GuestName}' is already in this session.");

            sessionPlayer = SessionPlayer.CreateForGuest(request.SessionId, request.GuestName, request.LinkedUserId);
        }
        else
        {
            var userId = request.UserId!.Value;

            var userExists = await context.Users
                .AnyAsync(u => u.Id == userId, cancellationToken);

            if (!userExists)
                throw new NotFoundException(nameof(User), userId);

            var alreadyAdded = await context.SessionPlayers
                .AnyAsync(sp => sp.SessionId == request.SessionId && sp.UserId == userId, cancellationToken);

            if (alreadyAdded)
                throw new ConflictException("This player is already in the session.");

            sessionPlayer = SessionPlayer.CreateForUser(request.SessionId, userId);
        }

        await context.SessionPlayers.AddAsync(sessionPlayer, cancellationToken);

        var actorName = currentUserService.Username ?? "Unknown";
        var playerLabel = sessionPlayer.IsGuest ? request.GuestName! : actorName;
        var activity = ActivityLog.Create(session.GroupId, callerId, actorName,
            ActivityType.PlayerJoined, $"{playerLabel} joined session \"{session.Name}\"");
        await context.ActivityLogs.AddAsync(activity, cancellationToken);

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
