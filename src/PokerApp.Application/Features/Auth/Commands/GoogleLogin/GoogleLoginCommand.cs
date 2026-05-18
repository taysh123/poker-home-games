using MediatR;

namespace PokerApp.Application.Features.Auth.Commands.GoogleLogin;

// idToken comes from the mobile app after the user signs in with Google
public sealed record GoogleLoginCommand(string IdToken) : IRequest<GoogleLoginResponse>;
