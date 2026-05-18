using FluentValidation;

namespace PokerApp.Application.Features.Sessions.Commands.AddCashOut;

public sealed class AddCashOutCommandValidator : AbstractValidator<AddCashOutCommand>
{
    public AddCashOutCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than 0.")
            .LessThanOrEqualTo(1_000_000).WithMessage("Amount cannot exceed 1,000,000.");
    }
}
