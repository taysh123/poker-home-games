using MediatR;

namespace PokerApp.Application.Features.Auth.Commands.Logout;

// Unit = MediatR's void — the command has no return value.
public sealed record LogoutCommand(string RefreshToken) : IRequest<Unit>;
