using FluentValidation;

namespace PokerApp.Application.Features.Users.Commands.UnregisterDeviceToken;

public sealed class UnregisterDeviceTokenCommandValidator : AbstractValidator<UnregisterDeviceTokenCommand>
{
    public UnregisterDeviceTokenCommandValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty()
            .MaximumLength(200);
    }
}
