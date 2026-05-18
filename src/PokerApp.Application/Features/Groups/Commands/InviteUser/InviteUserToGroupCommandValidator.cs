using FluentValidation;

namespace PokerApp.Application.Features.Groups.Commands.InviteUser;

public sealed class InviteUserToGroupCommandValidator : AbstractValidator<InviteUserToGroupCommand>
{
    public InviteUserToGroupCommandValidator()
    {
        RuleFor(x => x.GroupId).NotEmpty();
        RuleFor(x => x.Username).NotEmpty().MaximumLength(50);
    }
}
