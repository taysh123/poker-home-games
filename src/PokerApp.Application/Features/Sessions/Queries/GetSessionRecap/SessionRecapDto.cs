namespace PokerApp.Application.Features.Sessions.Queries.GetSessionRecap;

public sealed record SessionRecapDto(
    Guid SessionId,
    string SessionName,
    string? GroupName,
    string? Duration,
    DateTime Date,
    decimal TotalPot,
    int PlayerCount,
    int HandCount,
    RecapPlayerDto? BiggestWinner,
    RecapPlayerDto? BiggestLoser,
    decimal? BiggestPotAmount,
    string? BiggestPotWinner,
    List<RecapPlayerDto> Players,
    List<string> Highlights);

public sealed record RecapPlayerDto(string Username, decimal ProfitLoss, bool IsGuest);
