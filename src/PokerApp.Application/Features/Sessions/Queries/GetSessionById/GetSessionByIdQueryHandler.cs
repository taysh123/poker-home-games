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
            .Include(s => s.SessionPlayers)
                .ThenInclude(sp => sp.User)
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(Session), request.SessionId);

        var isMember = await context.GroupMembers
            .AnyAsync(m => m.GroupId == session.GroupId && m.UserId == userId, cancellationToken);

        if (!isMember)
            throw new UnauthorizedException("You are not a member of this group.");

        var players = session.SessionPlayers
            .Select(sp => new SessionPlayerDto(sp.UserId, sp.User.Username))
            .ToList();

        return new SessionDetailDto(
            session.Id,
            session.Name,
            session.GroupId,
            session.Status.ToString(),
            session.SmallBlind,
            session.BigBlind,
            players,
            session.StartedAt,
            session.EndedAt,
            session.CreatedAt);
    }
}
