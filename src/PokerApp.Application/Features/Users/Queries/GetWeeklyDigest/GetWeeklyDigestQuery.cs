using MediatR;

namespace PokerApp.Application.Features.Users.Queries.GetWeeklyDigest;

public sealed record GetWeeklyDigestQuery : IRequest<WeeklyDigestDto>;
