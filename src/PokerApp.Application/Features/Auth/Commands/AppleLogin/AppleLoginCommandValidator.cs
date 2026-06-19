using FluentValidation;

namespace PokerApp.Application.Features.Auth.Commands.AppleLogin;

public sealed class AppleLoginCommandValidator : AbstractValidator<AppleLoginCommand>
{
    public AppleLoginCommandValidator()
    {
        RuleFor(x => x.IdentityToken)
            .NotEmpty().WithMessage("Apple identity token is required.");
    }
}
