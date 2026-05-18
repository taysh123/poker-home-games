using MediatR;

namespace PokerApp.Application.Features.Auth.Commands.Register;

public sealed record RegisterCommand(
    string Username,
    string Email,
    string Password) : IRequest<RegisterResponse>;
