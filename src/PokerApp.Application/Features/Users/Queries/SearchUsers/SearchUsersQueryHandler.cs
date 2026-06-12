using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Users.Queries.SearchUsers;

public sealed class SearchUsersQueryHandler(
    IApplicationDbContext context) : IRequestHandler<SearchUsersQuery, List<UserSearchResultDto>>
{
    public async Task<List<UserSearchResultDto>> Handle(SearchUsersQuery request, CancellationToken cancellationToken)
    {
        return await context.Users
            .AsNoTracking()
            .Where(u => u.Username.ToLower().Contains(request.Query.ToLower()))
            .OrderBy(u => u.Username)
            .Take(20)
            .Select(u => new UserSearchResultDto(u.Id, u.Username, u.AvatarEmoji, u.AvatarColor))
            .ToListAsync(cancellationToken);
    }
}
