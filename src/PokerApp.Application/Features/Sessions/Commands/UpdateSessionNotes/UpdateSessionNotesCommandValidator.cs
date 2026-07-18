using FluentValidation;

namespace PokerApp.Application.Features.Sessions.Commands.UpdateSessionNotes;

/// <summary>
/// Bounds Notes to the mapped varchar(500) column so an over-length body returns a clean 400
/// (ValidationException) instead of a DbUpdateException surfaced as HTTP 500. Mirrors the
/// length-bounding pattern used by every other free-text command (group name, hand-record note).
/// </summary>
public sealed class UpdateSessionNotesCommandValidator : AbstractValidator<UpdateSessionNotesCommand>
{
    public UpdateSessionNotesCommandValidator()
    {
        RuleFor(x => x.Notes).MaximumLength(500).When(x => x.Notes != null);
    }
}
