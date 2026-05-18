using MediatR;

namespace PokerApp.Application.Features.Auth.Commands.Login;

public sealed record LoginCommand(
    string Email,
    string Password) : IRequest<LoginResponse>;
