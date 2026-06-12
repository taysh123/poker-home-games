namespace PokerApp.Application.Features.Users.Queries.GetWeeklyDigest;

public sealed record WeeklyDigestDto(
    int SessionsPlayed,
    decimal NetProfitLoss,
    BestNightDto? BestNight,
    int TotalMinutesPlayed,
    MostActiveGroupDto? MostActiveGroup,
    int CurrentStreak);

public sealed record BestNightDto(
    Guid SessionId,
    string SessionName,
    decimal ProfitLoss);

public sealed record MostActiveGroupDto(
    Guid GroupId,
    string GroupName,
    int GamesCount);
