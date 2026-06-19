using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Coach.Commands;
using PokerApp.Application.Features.Coach.Queries;

namespace PokerApp.API.Controllers;

/// <summary>Server-authoritative AI Coach: credits + the AI proxy (no anonymous AI; vendor key server-side).</summary>
[ApiController]
[Route("api/coach")]
[Authorize]
public class CoachController(IMediator mediator) : ControllerBase
{
    /// <summary>Current AI credit balance for the signed-in account.</summary>
    [HttpGet("credits")]
    [ProducesResponseType(typeof(CoachCreditsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCredits(CancellationToken cancellationToken)
        => Ok(await mediator.Send(new GetCoachCreditsQuery(), cancellationToken));

    /// <summary>Runs an AI analysis: reserves a credit atomically, then proxies to the model.</summary>
    [HttpPost("analyze")]
    [EnableRateLimiting("coach-analyze")]
    [ProducesResponseType(typeof(CoachAnalysisResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status402PaymentRequired)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Analyze([FromBody] AnalyzeHandCommand command, CancellationToken cancellationToken)
        => Ok(await mediator.Send(command, cancellationToken));
}
