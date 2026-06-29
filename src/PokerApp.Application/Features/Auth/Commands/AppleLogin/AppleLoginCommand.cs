using MediatR;

namespace PokerApp.Application.Features.Auth.Commands.AppleLogin;

public sealed record AppleLoginCommand(string IdentityToken, string? Nonce = null) : IRequest<AppleLoginResponse>;
