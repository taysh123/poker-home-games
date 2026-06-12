namespace PokerApp.Application.Common.Interfaces;

/// <summary>
/// Sends push notifications to users' registered devices. Push delivery is
/// best-effort: implementations must never throw on delivery failures.
/// </summary>
public interface IPushNotificationService
{
    Task SendAsync(
        IEnumerable<Guid> userIds,
        string title,
        string body,
        object? data = null,
        CancellationToken ct = default);
}
