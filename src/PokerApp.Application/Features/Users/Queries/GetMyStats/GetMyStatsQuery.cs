using MediatR;

namespace PokerApp.Application.Features.Users.Queries.GetMyStats;

public sealed record GetMyStatsQuery(string? Period = null) : IRequest<MyStatsDto>;
