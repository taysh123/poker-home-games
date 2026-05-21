namespace PokerApp.Application.Features.Users.Queries.GetHeadToHead;

public sealed record HeadToHeadDto(
    Guid OpponentId,
    string OpponentUsername,
    int SessionsTogether,
    int MyWins,
    int OpponentWins,
    int Ties,
    decimal MyProfitVsOpponent,
    DateTime? LastPlayedTogether,
    List<H2HMatchupDto> RecentMatchups
);

public sealed record H2HMatchupDto(
    Guid SessionId,
    string SessionName,
    string GroupName,
    decimal MyProfitLoss,
    decimal OpponentProfitLoss,
    DateTime Date
);
