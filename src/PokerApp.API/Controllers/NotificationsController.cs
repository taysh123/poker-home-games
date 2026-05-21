using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Notifications.Commands.MarkAllRead;
using PokerApp.Application.Features.Notifications.Queries.GetMyNotifications;

namespace PokerApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationsController(IMediator mediator) : ControllerBase
{
    /// <summary>Returns the authenticated user's notification inbox (last 50, newest first).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(GetMyNotificationsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyNotifications(CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetMyNotificationsQuery(), cancellationToken);
        return Ok(response);
    }

    /// <summary>Marks all unread notifications as read.</summary>
    [HttpPost("read-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        await mediator.Send(new MarkAllNotificationsReadCommand(), cancellationToken);
        return NoContent();
    }
}
