using PokerApp.Application.Features.Auth.Commands.ChangePassword;
using PokerApp.Application.Features.Sessions.Commands.AddHandRecord;
using PokerApp.Application.Features.Sessions.Commands.UpdateSessionNotes;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Security-hardening validator guards (audit findings L2, L8, L7):
///  - change-password must enforce the same complexity rules as registration;
///  - AddHandRecord.PotAmount must be bounded (over-cap => 400, not a DB 500);
///  - UpdateSessionNotes must bound Notes length (over-length => 400, not a DB 500).
/// </summary>
public class SecurityValidatorHardeningTests
{
    // ── L2: change-password complexity (mirror RegisterCommandValidator) ──
    private static readonly ChangePasswordCommandValidator ChangePw = new();

    [Fact]
    public void ChangePassword_RejectsPasswordMissingUppercase() =>
        Assert.False(ChangePw.Validate(new ChangePasswordCommand("OldPass123", "lowercase1")).IsValid);

    [Fact]
    public void ChangePassword_RejectsPasswordMissingDigit() =>
        Assert.False(ChangePw.Validate(new ChangePasswordCommand("OldPass123", "NoDigitsHere")).IsValid);

    [Fact]
    public void ChangePassword_AcceptsCompliantPassword() =>
        Assert.True(ChangePw.Validate(new ChangePasswordCommand("OldPass123", "NewPass456")).IsValid);

    // ── L8: AddHandRecord.PotAmount upper bound (match AddBuyIn cap of 1,000,000) ──
    private static readonly AddHandRecordCommandValidator AddHand = new();

    [Fact]
    public void AddHandRecord_RejectsPotAmountAboveCap() =>
        Assert.False(AddHand.Validate(new AddHandRecordCommand(Guid.NewGuid(), "Bob", 2_000_000m, null)).IsValid);

    [Fact]
    public void AddHandRecord_AcceptsPotAmountWithinCap() =>
        Assert.True(AddHand.Validate(new AddHandRecordCommand(Guid.NewGuid(), "Bob", 1000m, null)).IsValid);

    // ── L7: UpdateSessionNotes.Notes length bound (Notes column is varchar(500)) ──
    private static readonly UpdateSessionNotesCommandValidator UpdateNotes = new();

    [Fact]
    public void UpdateSessionNotes_RejectsNotesOverColumnLength() =>
        Assert.False(UpdateNotes.Validate(new UpdateSessionNotesCommand(Guid.NewGuid(), new string('x', 501))).IsValid);

    [Fact]
    public void UpdateSessionNotes_AcceptsNotesWithinLength() =>
        Assert.True(UpdateNotes.Validate(new UpdateSessionNotesCommand(Guid.NewGuid(), new string('x', 500))).IsValid);

    [Fact]
    public void UpdateSessionNotes_AcceptsNullNotes() =>
        Assert.True(UpdateNotes.Validate(new UpdateSessionNotesCommand(Guid.NewGuid(), null)).IsValid);
}
