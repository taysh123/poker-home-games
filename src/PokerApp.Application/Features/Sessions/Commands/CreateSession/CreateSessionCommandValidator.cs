using FluentValidation;

namespace PokerApp.Application.Features.Sessions.Commands.CreateSession;

public sealed class CreateSessionCommandValidator : AbstractValidator<CreateSessionCommand>
{
    public CreateSessionCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.SmallBlind)
            .GreaterThan(0)
            .WithMessage("Small blind must be greater than zero.");

        RuleFor(x => x.BigBlind)
            .GreaterThan(0)
            .WithMessage("Big blind must be greater than zero.")
            .GreaterThanOrEqualTo(x => x.SmallBlind)
            .WithMessage("Big blind must be greater than or equal to small blind.");
    }
}
