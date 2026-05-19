using FluentValidation;

namespace PokerApp.Application.Features.Sessions.Commands.CreateSession;

public sealed class CreateSessionCommandValidator : AbstractValidator<CreateSessionCommand>
{
    public CreateSessionCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);

        When(x => x.ChipRatio.HasValue, () =>
            RuleFor(x => x.ChipRatio!.Value)
                .GreaterThan(0)
                .WithMessage("Chip ratio must be greater than zero."));

        When(x => x.DefaultBuyIn.HasValue, () =>
            RuleFor(x => x.DefaultBuyIn!.Value)
                .GreaterThan(0)
                .WithMessage("Default buy-in must be greater than zero."));
    }
}
