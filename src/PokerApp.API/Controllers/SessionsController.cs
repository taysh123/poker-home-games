using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PokerApp.Application.Features.Sessions.Commands.AddPlayer;
using PokerApp.Application.Features.Sessions.Commands.CreateSession;
using PokerApp.Application.Features.Sessions.Commands.EndSession;
using PokerApp.Application.Features.Sessions.Commands.RemovePlayer;
using PokerApp.Application.Features.Sessions.Commands.StartSession;
using PokerApp.Application.Features.Sessions.Commands.AddBuyIn;
using PokerApp.Application.Features.Sessions.Commands.AddCashOut;
using PokerApp.Application.Features.Sessions.Queries.GetGroupSessions;
using PokerApp.Application.Features.Sessions.Queries.GetSessionBalances;
using PokerApp.Application.Features.Sessions.Queries.GetSessionById;

namespace PokerApp.API.Controllers;

[Authorize]
[ApiController]
public class SessionsController(IMediator mediator) : ControllerBase
{
    /// <summary>Creates a new Draft session in the group. Any group member can create.</summary>
    [HttpPost("api/groups/{groupId:guid}/sessions")]
    [ProducesResponseType(typeof(CreateSessionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateSession(
        Guid groupId,
        [FromBody] CreateSessionRequest body,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(
            new CreateSessionCommand(groupId, body.Name, body.SmallBlind, body.BigBlind, body.ChipRatio, body.DefaultBuyIn),
            cancellationToken);

        return CreatedAtAction(nameof(GetSessionById), new { id = response.Id }, response);
    }

    /// <summary>Returns all sessions for a group, newest first. Only group members can view.</summary>
    [HttpGet("api/groups/{groupId:guid}/sessions")]
    [ProducesResponseType(typeof(IReadOnlyList<SessionSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGroupSessions(Guid groupId, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetGroupSessionsQuery(groupId), cancellationToken);
        return Ok(response);
    }

    /// <summary>Returns full session details including player list. Only group members can view.</summary>
    [HttpGet("api/sessions/{id:guid}")]
    [ProducesResponseType(typeof(SessionDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionById(Guid id, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetSessionByIdQuery(id), cancellationToken);
        return Ok(response);
    }

    /// <summary>Starts a Draft session. Requires Owner or Admin role in the group.</summary>
    [HttpPost("api/sessions/{id:guid}/start")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> StartSession(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new StartSessionCommand(id), cancellationToken);
        return NoContent();
    }

    /// <summary>Ends an Active session. Requires Owner or Admin role in the group.</summary>
    [HttpPost("api/sessions/{id:guid}/end")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> EndSession(Guid id, CancellationToken cancellationToken)
    {
        await mediator.Send(new EndSessionCommand(id), cancellationToken);
        return NoContent();
    }

    /// <summary>Adds a registered user or named guest as a player in a Draft or Active session.</summary>
    [HttpPost("api/sessions/{id:guid}/players")]
    [ProducesResponseType(typeof(AddPlayerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddPlayer(
        Guid id,
        [FromBody] AddPlayerRequest body,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new AddPlayerCommand(id, body.UserId, body.GuestName), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Removes a player from a Draft or Active (guests only) session.</summary>
    [HttpDelete("api/sessions/{id:guid}/players/{sessionPlayerId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RemovePlayer(Guid id, Guid sessionPlayerId, CancellationToken cancellationToken)
    {
        await mediator.Send(new RemovePlayerCommand(id, sessionPlayerId), cancellationToken);
        return NoContent();
    }

    /// <summary>Records a buy-in or rebuy for a player in an Active session.</summary>
    [HttpPost("api/sessions/{id:guid}/buyins")]
    [ProducesResponseType(typeof(AddBuyInResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddBuyIn(
        Guid id,
        [FromBody] AddBuyInRequest body,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new AddBuyInCommand(id, body.SessionPlayerId, body.Amount), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Records a cash-out for a player in an Active session.</summary>
    [HttpPost("api/sessions/{id:guid}/cashouts")]
    [ProducesResponseType(typeof(AddCashOutResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddCashOut(
        Guid id,
        [FromBody] AddCashOutRequest body,
        CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new AddCashOutCommand(id, body.SessionPlayerId, body.Amount), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Returns live balances for all players: total invested, cashed out, and profit/loss.</summary>
    [HttpGet("api/sessions/{id:guid}/balances")]
    [ProducesResponseType(typeof(SessionBalancesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBalances(Guid id, CancellationToken cancellationToken)
    {
        var response = await mediator.Send(new GetSessionBalancesQuery(id), cancellationToken);
        return Ok(response);
    }
}

public sealed record CreateSessionRequest(string Name, decimal SmallBlind, decimal BigBlind, decimal? ChipRatio, decimal? DefaultBuyIn);
public sealed record AddPlayerRequest(Guid? UserId, string? GuestName);
public sealed record AddBuyInRequest(Guid SessionPlayerId, decimal Amount);
public sealed record AddCashOutRequest(Guid SessionPlayerId, decimal Amount);
