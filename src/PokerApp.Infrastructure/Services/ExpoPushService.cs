using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Sends push notifications via the Expo push API. Best-effort: all failures
/// are logged and swallowed — push delivery must never break a request.
/// </summary>
public class ExpoPushService(
    IHttpClientFactory httpClientFactory,
    AppDbContext context,
    ILogger<ExpoPushService> logger) : IPushNotificationService
{
    private const string ExpoPushUrl = "https://exp.host/--/api/v2/push/send";
    private const int MaxBatchSize = 100;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task SendAsync(
        IEnumerable<Guid> userIds,
        string title,
        string body,
        object? data = null,
        CancellationToken ct = default)
    {
        try
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0) return;

            var deviceTokens = await context.DeviceTokens
                .Where(t => ids.Contains(t.UserId) && t.IsActive)
                .ToListAsync(ct);

            if (deviceTokens.Count == 0) return;

            var client = httpClientFactory.CreateClient();
            var anyDeactivated = false;

            foreach (var batch in deviceTokens.Chunk(MaxBatchSize))
            {
                anyDeactivated |= await SendBatchAsync(client, batch, title, body, data, ct);
            }

            if (anyDeactivated)
                await context.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send push notifications (best-effort, ignored).");
        }
    }

    /// <summary>Sends one batch. Returns true if any token was deactivated.</summary>
    private async Task<bool> SendBatchAsync(
        HttpClient client,
        DeviceToken[] batch,
        string title,
        string body,
        object? data,
        CancellationToken ct)
    {
        var messages = batch
            .Select(t => new ExpoPushMessage(t.Token, title, body, data, "default"))
            .ToList();

        var response = await client.PostAsJsonAsync(ExpoPushUrl, messages, JsonOptions, ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning(
                "Expo push API returned {StatusCode} for a batch of {Count} tokens.",
                (int)response.StatusCode, batch.Length);
            return false;
        }

        var result = await response.Content.ReadFromJsonAsync<ExpoPushResponse>(JsonOptions, ct);
        if (result?.Data is null) return false;

        // Tickets come back in the same order as the messages were sent.
        var anyDeactivated = false;
        for (var i = 0; i < result.Data.Count && i < batch.Length; i++)
        {
            var ticket = result.Data[i];
            if (ticket.Status != "error") continue;

            if (ticket.Details?.Error == "DeviceNotRegistered")
            {
                batch[i].Deactivate();
                anyDeactivated = true;
                logger.LogInformation(
                    "Deactivated unregistered device token for user {UserId}.", batch[i].UserId);
            }
            else
            {
                logger.LogWarning(
                    "Expo push ticket error for user {UserId}: {Error} — {Message}",
                    batch[i].UserId, ticket.Details?.Error, ticket.Message);
            }
        }

        return anyDeactivated;
    }

    private sealed record ExpoPushMessage(string To, string Title, string Body, object? Data, string Sound);

    private sealed class ExpoPushResponse
    {
        public List<ExpoPushTicket>? Data { get; set; }
    }

    private sealed class ExpoPushTicket
    {
        public string? Status { get; set; }
        public string? Message { get; set; }
        public ExpoPushTicketDetails? Details { get; set; }
    }

    private sealed class ExpoPushTicketDetails
    {
        public string? Error { get; set; }
    }
}
