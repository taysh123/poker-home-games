using MediatR;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands;

namespace PokerApp.API.Controllers;

/// <summary>
/// Store server notifications (Apple ASSN V2 / Google RTDN). NOT [Authorize] — authenticated by the
/// store's cryptographic signature, verified here via <see cref="IStoreNotificationVerifier"/>.
/// Raw signed payloads in; on a valid signature the normalized event is processed idempotently +
/// out-of-order-safe by <see cref="ProcessStoreNotificationCommand"/>. Any invalid / unverifiable
/// payload fails CLOSED (401, no state change).
/// </summary>
[ApiController]
[Route("api/webhooks")]
public class WebhooksController(IMediator mediator, IStoreNotificationVerifier verifier) : ControllerBase
{
    /// <summary>Apple App Store Server Notifications V2 — body is the signed JWS payload.</summary>
    [HttpPost("apple")]
    public async Task<IActionResult> Apple([FromBody] AppleNotificationRequest body, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(body?.SignedPayload)) return Unauthorized();
        var dto = await verifier.VerifyAppleAsync(body.SignedPayload, DateTime.UtcNow, cancellationToken);
        if (dto is null) return Unauthorized(); // fail closed — bad signature / rejected sandbox
        await mediator.Send(new ProcessStoreNotificationCommand("apple", dto), cancellationToken);
        return NoContent();
    }

    /// <summary>Google Play RTDN via Pub/Sub push — OIDC token in Authorization, RTDN in message.data.</summary>
    [HttpPost("google")]
    public async Task<IActionResult> Google([FromBody] PubSubEnvelope body, CancellationToken cancellationToken)
    {
        var message = body?.Message;
        if (message is null || string.IsNullOrWhiteSpace(message.Data)) return Unauthorized();
        var authHeader = Request.Headers.Authorization.ToString();
        var dto = await verifier.VerifyGoogleAsync(authHeader, message.MessageId ?? "", message.Data, DateTime.UtcNow, cancellationToken);
        if (dto is null) return Unauthorized(); // fail closed — bad OIDC token / undecodable RTDN
        await mediator.Send(new ProcessStoreNotificationCommand("google", dto), cancellationToken);
        return NoContent();
    }

    public sealed record AppleNotificationRequest(string SignedPayload);

    public sealed record PubSubEnvelope(PubSubMessage? Message);

    public sealed record PubSubMessage(string? Data, string? MessageId);
}
