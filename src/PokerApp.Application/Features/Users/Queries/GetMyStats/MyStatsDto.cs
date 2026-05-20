namespace PokerApp.Application.Features.Users.Queries.GetMyStats;

public sealed record MyStatsDto(
    int TotalSessionsPlayed,
    decimal TotalProfitLoss,
    decimal? BiggestWin,
    decimal? BiggestLoss,
    int WinsCount,
    int LossesCount,
    int BreakEvenCount,
    decimal AverageProfitLoss,
    List<RecentSessionDto> RecentSessions
);

public sealed record RecentSessionDto(
    Guid SessionId,
    string SessionName,
    Guid? GroupId,
    string GroupName,
    string UserRole,
    string Status,
    decimal? ProfitLoss,
    DateTime CreatedAt
);
