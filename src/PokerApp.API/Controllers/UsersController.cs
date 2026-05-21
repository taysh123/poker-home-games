using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Users.Queries.GetHeadToHead;
using PokerApp.Application.Features.Users.Queries.GetPlayerProfile;

namespace PokerApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/users")]
public class UsersController(IMediator mediator) : ControllerBase
{
    /// <summary>Returns the career stats and recent form for a player. Requires a shared group.</summary>
    [HttpGet("{userId:guid}/profile")]
    [ProducesResponseType(typeof(PlayerProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPlayerProfile(Guid userId, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetPlayerProfileQuery(userId), cancellationToken);
        return Ok(response);
    }

    /// <summary>Returns head-to-head stats between the authenticated user and a specific opponent.</summary>
    [HttpGet("{opponentId:guid}/head-to-head")]
    [ProducesResponseType(typeof(HeadToHeadDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHeadToHead(Guid opponentId, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetHeadToHeadQuery(opponentId), cancellationToken);
        return Ok(response);
    }
}
