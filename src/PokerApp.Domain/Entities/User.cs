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
    /// <summary>Apple Sign In subject ('sub') — opaque, stable per Apple ID. Verified identity.</summary>
    public string? AppleSubjectId { get; private set; }
    /// <summary>Whether the email is verified (true for Google/Apple-provided emails). Legacy
    /// email/password accounts default to false (grandfathered for login).</summary>
    public bool EmailVerified { get; private set; }

    public string? AvatarEmoji { get; private set; }
    public string? AvatarColor { get; private set; }

    private User() { }

    public static User Create(string username, string email, string passwordHash) =>
        new() { Username = username, Email = email, PasswordHash = passwordHash, EmailVerified = false };

    public static User CreateWithGoogle(string username, string email, string googleId) =>
        new() { Username = username, Email = email, PasswordHash = string.Empty, GoogleId = googleId, EmailVerified = true };

    public static User CreateWithApple(string username, string email, string appleSubjectId, bool emailVerified) =>
        new() { Username = username, Email = email, PasswordHash = string.Empty, AppleSubjectId = appleSubjectId, EmailVerified = emailVerified };

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

    public void UpdateAvatarEmoji(string? avatarEmoji)
    {
        AvatarEmoji = avatarEmoji;
        SetUpdatedAt();
    }

    public void UpdateAvatarColor(string? avatarColor)
    {
        AvatarColor = avatarColor;
        SetUpdatedAt();
    }

    public void LinkGoogle(string googleId)
    {
        GoogleId = googleId;
        SetUpdatedAt();
    }

    public void LinkApple(string appleSubjectId)
    {
        AppleSubjectId = appleSubjectId;
        SetUpdatedAt();
    }

    public void MarkEmailVerified()
    {
        if (EmailVerified) return;
        EmailVerified = true;
        SetUpdatedAt();
    }
}
