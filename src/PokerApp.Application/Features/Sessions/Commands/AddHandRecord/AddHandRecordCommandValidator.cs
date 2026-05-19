using FluentValidation;

namespace PokerApp.Application.Features.Sessions.Commands.AddHandRecord;

public sealed class AddHandRecordCommandValidator : AbstractValidator<AddHandRecordCommand>
{
    public AddHandRecordCommandValidator()
    {
        RuleFor(x => x.WinnerName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PotAmount).GreaterThan(0);
        RuleFor(x => x.Note).MaximumLength(300).When(x => x.Note != null);
    }
}
