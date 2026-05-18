namespace PokerApp.Domain.Entities;

public class SessionPlayer : BaseEntity
{
    public Guid SessionId { get; private set; }
    public Session Session { get; private set; } = null!;
    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;

    private SessionPlayer() { }

    public static SessionPlayer Create(Guid sessionId, Guid userId)
        => new() { SessionId = sessionId, UserId = userId };
}
