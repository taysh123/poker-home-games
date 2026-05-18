using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Groups.Queries.GetMyGroups;

public sealed class GetMyGroupsQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<GetMyGroupsQuery, IReadOnlyList<MyGroupDto>>
{
    public async Task<IReadOnlyList<MyGroupDto>> Handle(GetMyGroupsQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;

        return await context.GroupMembers
            .AsNoTracking()
            .Where(m => m.UserId == callerId)
            .Include(m => m.Group)
                .ThenInclude(g => g.Members)
            .OrderBy(m => m.Group.Name)
            .Select(m => new MyGroupDto(
                m.Group.Id,
                m.Group.Name,
                m.Group.Description,
                m.Role.ToString(),
                m.Group.Members.Count,
                m.Group.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
