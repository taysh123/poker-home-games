using FluentValidation;

namespace PokerApp.Application.Features.Sessions.Commands.AddBuyIn;

public sealed class AddBuyInCommandValidator : AbstractValidator<AddBuyInCommand>
{
    public AddBuyInCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than 0.")
            .LessThanOrEqualTo(1_000_000).WithMessage("Amount cannot exceed 1,000,000.");
    }
}
