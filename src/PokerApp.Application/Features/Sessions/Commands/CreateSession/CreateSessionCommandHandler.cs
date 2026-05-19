using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Sessions.Commands.CreateSession;

public sealed class CreateSessionCommandHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<CreateSessionCommand, CreateSessionResponse>
{
    public async Task<CreateSessionResponse> Handle(CreateSessionCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var groupExists = await context.Groups
            .AnyAsync(g => g.Id == request.GroupId, cancellationToken);

        if (!groupExists)
            throw new NotFoundException(nameof(Group), request.GroupId);

        var isMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == request.GroupId && m.UserId == userId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var session = Session.Create(
            request.Name, request.GroupId,
            request.ChipRatio, request.DefaultBuyIn);

        await context.Sessions.AddAsync(session, cancellationToken);

        var actorName = currentUserService.Username ?? "Unknown";
        var activity = ActivityLog.Create(request.GroupId, userId, actorName,
            ActivityType.SessionCreated, $"{actorName} created session \"{request.Name}\"");
        await context.ActivityLogs.AddAsync(activity, cancellationToken);

        await context.SaveChangesAsync(cancellationToken);

        return new CreateSessionResponse(
            session.Id,
            session.Name,
            session.GroupId,
            session.Status.ToString(),
            session.ChipRatio,
            session.DefaultBuyIn,
            session.CreatedAt);
    }
}
