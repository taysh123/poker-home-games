using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Application.Features.Users.Queries.SearchUsers;

public sealed class SearchUsersQueryHandler(
    IApplicationDbContext context,
    ICurrentUserService currentUserService) : IRequestHandler<SearchUsersQuery, List<UserSearchResultDto>>
{
    public async Task<List<UserSearchResultDto>> Handle(SearchUsersQuery request, CancellationToken cancellationToken)
    {
        var callerId = currentUserService.UserId;
        var needle = request.Query.ToLower();

        // Scoped to people the caller already shares a group with (audit 2026-08-05, HIGH #1).
        // This is the DISCOVERY half of the AddPlayer consent fix, and it is not optional:
        // gating the add while leaving search open would still let any account enumerate every
        // username on the platform, and would still surface people the caller cannot legitimately
        // add — an unreachable result is a worse UX than no result. Fixing one and leaving the
        // other fixes nothing.
        return await context.Users
            .AsNoTracking()
            .Where(u => u.Username.ToLower().Contains(needle)
                && context.GroupMembers.Any(mine => mine.UserId == callerId
                    && context.GroupMembers.Any(theirs =>
                        theirs.GroupId == mine.GroupId && theirs.UserId == u.Id)))
            .OrderBy(u => u.Username)
            .Take(20)
            .Select(u => new UserSearchResultDto(u.Id, u.Username, u.AvatarEmoji, u.AvatarColor))
            .ToListAsync(cancellationToken);
    }
}
