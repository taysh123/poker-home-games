using MediatR;

namespace PokerApp.Application.Features.Users.Commands.UnregisterDeviceToken;

public sealed record UnregisterDeviceTokenCommand(string Token) : IRequest;
