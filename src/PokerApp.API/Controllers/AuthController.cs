using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Auth.Commands.GoogleLogin;
using PokerApp.Application.Features.Auth.Commands.Login;
using PokerApp.Application.Features.Auth.Commands.Logout;
using PokerApp.Application.Features.Auth.Commands.RefreshToken;
using PokerApp.Application.Features.Auth.Commands.Register;
using PokerApp.Application.Features.Auth.Queries.GetCurrentUser;
using PokerApp.Application.Features.Users.Queries.GetMyStats;

namespace PokerApp.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Signs in (or registers) a user using a Google ID token obtained on the mobile client.
    /// If the email already exists as a password account, it links the Google identity to it.
    /// </summary>
    [HttpPost("google")]
    [ProducesResponseType(typeof(GoogleLoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GoogleLogin(
        [FromBody] GoogleLoginCommand command,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(command, cancellationToken);
        return Ok(response);
    }

    /// <summary>Creates a new user account and returns an initial token pair.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterCommand command,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(Register), new { id = response.UserId }, response);
    }

    /// <summary>Authenticates a user and returns a token pair.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        [FromBody] LoginCommand command,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(command, cancellationToken);
        return Ok(response);
    }

    /// <summary>Exchanges a valid refresh token for a new token pair (rotation).</summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(RefreshTokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(
        [FromBody] RefreshTokenCommand command,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(command, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Revokes the supplied refresh token, invalidating this device's session.
    /// The short-lived access token will expire naturally within its TTL.
    /// </summary>
    [Authorize]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Logout(
        [FromBody] LogoutCommand command,
        CancellationToken cancellationToken)
    {
        await mediator.Send(command, cancellationToken);
        return NoContent();
    }

    /// <summary>Returns the authenticated user's profile. Requires a valid access token.</summary>
    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(GetCurrentUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetCurrentUserQuery(), cancellationToken);
        return Ok(response);
    }

    /// <summary>Returns the authenticated user's lifetime stats and recent sessions.</summary>
    [Authorize]
    [HttpGet("stats")]
    [ProducesResponseType(typeof(MyStatsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyStats(CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetMyStatsQuery(), cancellationToken);
        return Ok(response);
    }
}
