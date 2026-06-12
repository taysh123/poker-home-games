using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using PokerApp.Application.Features.Users.Commands.RegisterDeviceToken;
using PokerApp.Application.Features.Users.Commands.UnregisterDeviceToken;

namespace PokerApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/users/device-tokens")]
public class DeviceTokensController(IMediator mediator) : ControllerBase
{
    /// <summary>Registers (or reactivates) an Expo push token for the authenticated user's device.</summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RegisterDeviceToken(
        [FromBody] RegisterDeviceTokenCommand command,
        CancellationToken cancellationToken)
    {
        await mediator.Send(command, cancellationToken);
        return NoContent();
    }

    /// <summary>Deactivates an Expo push token (e.g. on logout). Idempotent — succeeds even if the token is unknown.</summary>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UnregisterDeviceToken(
        [FromQuery] string? token,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UnregisterDeviceTokenRequest? body,
        CancellationToken cancellationToken)
    {
        await mediator.Send(new UnregisterDeviceTokenCommand(body?.Token ?? token ?? string.Empty), cancellationToken);
        return NoContent();
    }
}

public sealed record UnregisterDeviceTokenRequest(string? Token);
