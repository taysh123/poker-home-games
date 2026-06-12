using FluentValidation;

namespace PokerApp.Application.Features.Auth.Commands.UpdateProfile;

public sealed class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
{
    public UpdateProfileCommandValidator()
    {
        RuleFor(x => x.Username)
            .MaximumLength(50).WithMessage("Username cannot exceed 50 characters.")
            .Matches(@"^[a-zA-Z0-9_]+$").WithMessage("Username may only contain letters, numbers, and underscores.")
            .When(x => x.Username is not null);

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("A valid email address is required.")
            .MaximumLength(255).WithMessage("Email cannot exceed 255 characters.")
            .When(x => x.Email is not null);

        RuleFor(x => x.AvatarEmoji)
            .MaximumLength(16).WithMessage("Avatar emoji cannot exceed 16 characters.")
            .When(x => x.AvatarEmoji is not null);

        RuleFor(x => x.AvatarColor)
            .Matches(@"^#[0-9A-Fa-f]{6}$").WithMessage("Avatar color must be a hex color like #C9A84C.")
            .When(x => !string.IsNullOrEmpty(x.AvatarColor));
    }
}
