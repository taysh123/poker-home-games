namespace PokerApp.Domain.Entities;

/// <summary>
/// Server-authoritative cloud backup of an opaque client blob — one row per (user, namespace).
/// The server NEVER interprets the payload; it stores, versions, and scopes it to the owning user.
/// Premium-gated at the application layer. <see cref="Version"/> drives optimistic concurrency so a
/// stale client write can be rejected instead of silently clobbering a newer one.
/// </summary>
public class CloudBackup : BaseEntity
{
    public Guid UserId { get; private set; }
    public string Namespace { get; private set; } = string.Empty;
    /// <summary>Opaque serialized client blob (stored as text). The server does not parse it.</summary>
    public string Payload { get; private set; } = string.Empty;
    /// <summary>Monotonically increasing per (user, namespace). Starts at 1, bumps on every apply.</summary>
    public int Version { get; private set; }

    private CloudBackup() { }

    public static CloudBackup Create(Guid userId, string ns, string payload) =>
        new()
        {
            UserId    = userId,
            Namespace = ns,
            Payload   = payload,
            Version   = 1,
        };

    /// <summary>Replace the stored payload, bump the version, and touch UpdatedAt.</summary>
    public void Apply(string payload)
    {
        Payload = payload;
        Version++;
        SetUpdatedAt();
    }
}
