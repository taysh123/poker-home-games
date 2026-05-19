using FluentValidation;

namespace PokerApp.Application.Features.Debts.Commands.CreateDebt;

public sealed class CreateDebtCommandValidator : AbstractValidator<CreateDebtCommand>
{
    public CreateDebtCommandValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.FromUserId).NotEqual(x => x.ToUserId).WithMessage("Payer and receiver must be different people.");
        RuleFor(x => x.Reason).MaximumLength(200).When(x => x.Reason != null);
    }
}
