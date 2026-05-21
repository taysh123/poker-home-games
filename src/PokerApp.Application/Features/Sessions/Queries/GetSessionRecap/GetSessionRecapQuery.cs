using MediatR;

namespace PokerApp.Application.Features.Sessions.Queries.GetSessionRecap;

public sealed record GetSessionRecapQuery(Guid SessionId) : IRequest<SessionRecapDto>;
