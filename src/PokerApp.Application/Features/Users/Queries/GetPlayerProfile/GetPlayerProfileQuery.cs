using MediatR;

namespace PokerApp.Application.Features.Users.Queries.GetPlayerProfile;

public sealed record GetPlayerProfileQuery(Guid UserId) : IRequest<PlayerProfileDto>;
