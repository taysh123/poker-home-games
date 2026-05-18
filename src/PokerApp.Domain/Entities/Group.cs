namespace PokerApp.Domain.Entities;

public class Group : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public Guid OwnerId { get; private set; }
    public User Owner { get; private set; } = null!;

    private readonly List<GroupMember> _members = [];
    public IReadOnlyCollection<GroupMember> Members => _members.AsReadOnly();

    private readonly List<Session> _sessions = [];
    public IReadOnlyCollection<Session> Sessions => _sessions.AsReadOnly();

    private Group() { }

    public static Group Create(string name, string? description, Guid ownerId)
        => new()
        {
            Name = name,
            Description = description,
            OwnerId = ownerId
        };

    public void Update(string name, string? description)
    {
        Name = name;
        Description = description;
    }
}
