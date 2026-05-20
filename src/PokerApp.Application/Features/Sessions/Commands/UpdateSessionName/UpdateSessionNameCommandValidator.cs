using FluentValidation;

namespace PokerApp.Application.Features.Sessions.Commands.UpdateSessionName;

public sealed class UpdateSessionNameCommandValidator : AbstractValidator<UpdateSessionNameCommand>
{
    public UpdateSessionNameCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Session name is required.")
            .MaximumLength(100).WithMessage("Session name must not exceed 100 characters.");
    }
}
