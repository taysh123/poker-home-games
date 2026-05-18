using MediatR;

namespace PokerApp.Application.Features.Auth.Queries.GetCurrentUser;

public sealed record GetCurrentUserQuery : IRequest<GetCurrentUserResponse>;
