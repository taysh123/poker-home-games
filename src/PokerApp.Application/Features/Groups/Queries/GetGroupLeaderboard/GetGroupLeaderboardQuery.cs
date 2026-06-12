using MediatR;

namespace PokerApp.Application.Features.Groups.Queries.GetGroupLeaderboard;

public sealed record GetGroupLeaderboardQuery(Guid GroupId, string? Period = null) : IRequest<List<PlayerLeaderboardEntryDto>>;

public sealed record PlayerLeaderboardEntryDto(
    Guid UserId,
    string Username,
    int SessionsPlayed,
    decimal TotalProfitLoss,
    decimal? BiggestWin,
    decimal? BiggestLoss,
    int WinsCount,
    decimal AvgProfitLoss,
    string? AvatarEmoji,
    string? AvatarColor);
