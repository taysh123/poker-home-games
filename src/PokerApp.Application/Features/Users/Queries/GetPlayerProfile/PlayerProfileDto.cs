namespace PokerApp.Application.Features.Users.Queries.GetPlayerProfile;

public sealed record PlayerProfileDto(
    Guid UserId,
    string Username,
    int TotalSessionsPlayed,
    decimal TotalProfitLoss,
    decimal? BiggestWin,
    decimal? BiggestLoss,
    int WinsCount,
    int LossesCount,
    int BreakEvenCount,
    decimal AverageProfitLoss,
    double WinRate,
    int CurrentStreak,
    int LongestWinStreak,
    List<string> RecentForm,
    List<ProfileSessionDto> RecentSessions
);

public sealed record ProfileSessionDto(
    Guid SessionId,
    string SessionName,
    Guid? GroupId,
    string GroupName,
    decimal ProfitLoss,
    DateTime Date
);
