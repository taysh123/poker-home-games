using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Groups.Queries.GetMyGroups;

public sealed class GetMyGroupsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetMyGroupsQuery, IReadOnlyList<MyGroupDto>>
{
    public async Task<IReadOnlyList<MyGroupDto>> Handle(GetMyGroupsQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        var memberships = await context.GroupMembers
            .AsNoTracking()
            .Where(m => m.UserId == callerId)
            .Include(m => m.Group)
                .ThenInclude(g => g.Members)
            .OrderBy(m => m.Group.Name)
            .ToListAsync(cancellationToken);

        if (memberships.Count == 0) return [];

        var groupIds = memberships.Select(m => m.GroupId).ToList();

        // Get user's session players in finished group sessions
        var sessionPlayerData = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.UserId == callerId
                      && sp.Session.Status == SessionStatus.Finished
                      && sp.Session.GroupId != null
                      && groupIds.Contains(sp.Session.GroupId!.Value))
            .Select(sp => new { sp.Id, sp.SessionId, GroupId = sp.Session.GroupId!.Value })
            .ToListAsync(cancellationToken);

        var groupPL = new Dictionary<Guid, decimal>();
        var groupSessions = new Dictionary<Guid, int>();

        if (sessionPlayerData.Count > 0)
        {
            var sessionIds = sessionPlayerData.Select(sp => sp.SessionId).Distinct().ToList();
            var spIdBySession = sessionPlayerData
                .GroupBy(sp => sp.SessionId)
                .ToDictionary(g => g.Key, g => g.First().Id);

            var allBuyIns = await context.BuyIns
                .AsNoTracking()
                .Where(b => sessionIds.Contains(b.SessionId))
                .Select(b => new { b.SessionId, b.SessionPlayerId, b.UserId, b.Amount })
                .ToListAsync(cancellationToken);

            var allCashOuts = await context.CashOuts
                .AsNoTracking()
                .Where(c => sessionIds.Contains(c.SessionId))
                .Select(c => new { c.SessionId, c.SessionPlayerId, c.UserId, c.Amount })
                .ToListAsync(cancellationToken);

            foreach (var grp in sessionPlayerData.GroupBy(sp => sp.GroupId))
            {
                var gid = grp.Key;
                groupSessions[gid] = grp.Count();
                var totalPL = 0m;

                foreach (var sp in grp)
                {
                    spIdBySession.TryGetValue(sp.SessionId, out var spId);
                    var inAmt = allBuyIns
                        .Where(b => b.SessionId == sp.SessionId &&
                                    (b.SessionPlayerId == spId || (b.SessionPlayerId == null && b.UserId == callerId)))
                        .Sum(b => b.Amount);
                    var outAmt = allCashOuts
                        .Where(c => c.SessionId == sp.SessionId &&
                                    (c.SessionPlayerId == spId || (c.SessionPlayerId == null && c.UserId == callerId)))
                        .Sum(c => c.Amount);
                    totalPL += outAmt - inAmt;
                }

                groupPL[gid] = totalPL;
            }
        }

        return memberships.Select(m => new MyGroupDto(
            m.Group.Id,
            m.Group.Name,
            m.Group.Description,
            m.Role.ToString(),
            m.Group.Members.Count,
            m.Group.CreatedAt,
            groupPL.TryGetValue(m.GroupId, out var pl) ? pl : null,
            groupSessions.GetValueOrDefault(m.GroupId, 0)
        )).ToList();
    }
}
