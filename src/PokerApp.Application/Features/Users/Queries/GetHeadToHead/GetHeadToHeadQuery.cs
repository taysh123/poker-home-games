using MediatR;

namespace PokerApp.Application.Features.Users.Queries.GetHeadToHead;

public sealed record GetHeadToHeadQuery(Guid OpponentId) : IRequest<HeadToHeadDto>;
