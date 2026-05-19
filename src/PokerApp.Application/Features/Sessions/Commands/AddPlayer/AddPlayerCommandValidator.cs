using FluentValidation;

namespace PokerApp.Application.Features.Sessions.Commands.AddPlayer;

public sealed class AddPlayerCommandValidator : AbstractValidator<AddPlayerCommand>
{
    public AddPlayerCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();

        RuleFor(x => x)
            .Must(x => x.UserId.HasValue ^ (x.GuestName is not null))
            .WithMessage("Exactly one of UserId or GuestName must be provided.");

        When(x => x.GuestName is not null, () =>
        {
            RuleFor(x => x.GuestName!)
                .NotEmpty().WithMessage("Guest name cannot be empty.")
                .MaximumLength(50).WithMessage("Guest name cannot exceed 50 characters.");
        });
    }
}
