using MediatR;

namespace PokerApp.Application.Features.Users.Queries.SearchUsers;

public sealed record SearchUsersQuery(string Query) : IRequest<List<UserSearchResultDto>>;

public sealed record UserSearchResultDto(Guid UserId, string Username);
