using FluentValidation;

namespace PokerApp.Application.Features.Users.Commands.RegisterDeviceToken;

public sealed class RegisterDeviceTokenCommandValidator : AbstractValidator<RegisterDeviceTokenCommand>
{
    private static readonly string[] AllowedPlatforms = ["ios", "android"];

    public RegisterDeviceTokenCommandValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty()
            .MaximumLength(200)
            .Must(t => t is not null && t.StartsWith("ExponentPushToken"))
            .WithMessage("Token must be a valid Expo push token (ExponentPushToken[...]).");

        RuleFor(x => x.Platform)
            .NotEmpty()
            .Must(p => AllowedPlatforms.Contains(p))
            .WithMessage("Platform must be 'ios' or 'android'.");
    }
}
