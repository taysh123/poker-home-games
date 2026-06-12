using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionById;

public sealed class GetSessionByIdQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetSessionByIdQuery, SessionDetailDto>
{
    public async Task<SessionDetailDto> Handle(GetSessionByIdQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;

        var session = await context.Sessions
            .AsNoTracking()
            .Include(s => s.SessionPlayers)
                .ThenInclude(sp => sp.User)
            .Include(s => s.Group)
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        bool hasAccess;
        if (session.GroupId.HasValue)
        {
            hasAccess = await context.GroupMembers
                .AsNoTracking()
                .AnyAsync(m => m.GroupId == session.GroupId.Value && m.UserId == userId, cancellationToken);
        }
        else
        {
            hasAccess = session.CreatorId == userId;
        }
        if (!hasAccess)
            throw new UnauthorizedException("You do not have access to this session.");

        var players = session.SessionPlayers
            .Select(sp => new SessionPlayerDto(
                sp.Id,
                sp.UserId,
                sp.DisplayName,
                sp.IsGuest,
                sp.LinkedUserId,
                sp.User?.AvatarEmoji,
                sp.User?.AvatarColor))
            .ToList();

        return new SessionDetailDto(
            session.Id,
            session.Name,
            session.GroupId,
            session.Group?.Name,
            session.CreatorId,
            session.Status.ToString(),
            session.ChipRatio,
            session.DefaultBuyIn,
            players,
            session.StartedAt,
            session.EndedAt,
            session.CreatedAt,
            session.Notes);
    }
}
