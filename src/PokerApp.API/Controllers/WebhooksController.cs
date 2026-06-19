using MediatR;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Billing.Commands;

namespace PokerApp.API.Controllers;

/// <summary>
/// Store server notifications (Apple ASSN V2 / Google RTDN). NOT [Authorize] — authenticated by
/// the store's signature (verification is a deferred seam; B2 processes the normalized payload
/// idempotently). Drives server-authoritative subscription state for renew/cancel/refund/grace.
/// </summary>
[ApiController]
[Route("api/webhooks")]
public class WebhooksController(IMediator mediator) : ControllerBase
{
    [HttpPost("apple")]
    public async Task<IActionResult> Apple([FromBody] StoreNotificationDto notification, CancellationToken cancellationToken)
    {
        await mediator.Send(new ProcessStoreNotificationCommand("apple", notification), cancellationToken);
        return NoContent();
    }

    [HttpPost("google")]
    public async Task<IActionResult> Google([FromBody] StoreNotificationDto notification, CancellationToken cancellationToken)
    {
        await mediator.Send(new ProcessStoreNotificationCommand("google", notification), cancellationToken);
        return NoContent();
    }
}
