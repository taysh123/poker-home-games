namespace PokerApp.Domain.Enums;

public enum ActivityType
{
    SessionCreated   = 1,
    SessionStarted   = 2,
    SessionEnded     = 3,
    PlayerJoined     = 4,
    DebtCreated      = 5,
    DebtSettled      = 6,
    MemberJoined     = 7,
    MemberLeft       = 8,
    MemberRemoved    = 9,
}
