using MediatR;

namespace PokerApp.Application.Features.Users.Queries.GetMyStats;

public sealed record GetMyStatsQuery : IRequest<MyStatsDto>;
