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

    /// <summary>Stripe webhooks — RAW body + Stripe-Signature header (HMAC). Fail-closed (401) on bad signature.</summary>
    [HttpPost("stripe")]
    public async Task<IActionResult> Stripe(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(cancellationToken);
        var dto = await verifier.VerifyStripeAsync(payload, Request.Headers["Stripe-Signature"], DateTime.UtcNow, cancellationToken);
        if (dto is null) return Unauthorized(); // fail closed — bad/missing signature or unconfigured
        await mediator.Send(new ProcessStoreNotificationCommand("stripe", dto), cancellationToken);
        return NoContent();
    }

    /// <summary>RevenueCat webhooks — RAW body + shared Authorization-header secret. Fail-closed (401).</summary>
    [HttpPost("revenuecat")]
    public async Task<IActionResult> RevenueCat(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(cancellationToken);
        var dto = await verifier.VerifyRevenueCatAsync(Request.Headers.Authorization.ToString(), body, DateTime.UtcNow, cancellationToken);
        if (dto is null) return Unauthorized(); // fail closed — wrong/missing shared secret or unconfigured
        await mediator.Send(new ProcessStoreNotificationCommand("revenuecat", dto), cancellationToken);
        return NoContent();
    }

    public sealed record AppleNotificationRequest(string SignedPayload);

    public sealed record PubSubEnvelope(PubSubMessage? Message);

    public sealed record PubSubMessage(string? Data, string? MessageId);
}
