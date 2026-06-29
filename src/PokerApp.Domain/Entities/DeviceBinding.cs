namespace PokerApp.Domain.Entities;

/// <summary>
/// Binds a verified account to a client device identifier. Powers fraud signals: how many distinct
/// accounts share one device (multi-account / credit farming) and how recently a device was seen.
/// One row per (UserId, DeviceId).
/// </summary>
public class DeviceBinding : BaseEntity
{
    public Guid UserId { get; private set; }
    /// <summary>Opaque client device id (already hashed/installation-scoped on the client).</summary>
    public string DeviceId { get; private set; } = string.Empty;
    public DateTime FirstSeenUtc { get; private set; }
    public DateTime LastSeenUtc { get; private set; }
    public int SeenCount { get; private set; }

    private DeviceBinding() { }

    public static DeviceBinding Create(Guid userId, string deviceId, DateTime nowUtc) =>
        new() { UserId = userId, DeviceId = deviceId, FirstSeenUtc = nowUtc, LastSeenUtc = nowUtc, SeenCount = 1 };

    /// <summary>Record another sighting of this account on this device.</summary>
    public void Touch(DateTime nowUtc)
    {
        LastSeenUtc = nowUtc;
        SeenCount++;
        SetUpdatedAt();
    }
}
