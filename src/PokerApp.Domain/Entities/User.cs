namespace PokerApp.Domain.Entities;

public class User : BaseEntity
{
    public string Username { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;

    private readonly List<GroupMember> _groupMemberships = [];
    public IReadOnlyCollection<GroupMember> GroupMemberships => _groupMemberships.AsReadOnly();

    private User() { }
}
