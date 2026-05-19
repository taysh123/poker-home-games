using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

public class User : BaseEntity
{
    public string Username { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public AppRole AppRole { get; private set; } = AppRole.Regular;

    private readonly List<GroupMember> _groupMemberships = [];
    public IReadOnlyCollection<GroupMember> GroupMemberships => _groupMemberships.AsReadOnly();

    private readonly List<RefreshToken> _refreshTokens = [];
    public IReadOnlyCollection<RefreshToken> RefreshTokens => _refreshTokens.AsReadOnly();

    public string? GoogleId { get; private set; }

    private User() { }

    public static User Create(string username, string email, string passwordHash) =>
        new() { Username = username, Email = email, PasswordHash = passwordHash };

    public static User CreateWithGoogle(string username, string email, string googleId) =>
        new() { Username = username, Email = email, PasswordHash = string.Empty, GoogleId = googleId };

    public void UpdateUsername(string username)
    {
        Username = username;
        SetUpdatedAt();
    }

    public void UpdateEmail(string email)
    {
        Email = email;
        SetUpdatedAt();
    }

    public void UpdatePassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        SetUpdatedAt();
    }

    public void LinkGoogle(string googleId)
    {
        GoogleId = googleId;
        SetUpdatedAt();
    }
}
