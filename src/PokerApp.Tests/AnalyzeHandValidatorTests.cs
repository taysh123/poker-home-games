using PokerApp.Application.Features.Coach.Commands;
using Xunit;

namespace PokerApp.Tests;

public class AnalyzeHandValidatorTests
{
    private static AnalyzeHandCommand Cmd(string? text = "spot", string idem = "key-1", string kind = "hand") =>
        new(kind, text, "AhKs", "BTN", null, idem);

    private static readonly AnalyzeHandCommandValidator Validator = new();

    [Fact]
    public void Valid_WhenWithinBounds() =>
        Assert.True(Validator.Validate(Cmd()).IsValid);

    [Fact]
    public void Invalid_WhenTextTooLong() =>
        Assert.False(Validator.Validate(Cmd(text: new string('x', 5000))).IsValid);

    [Fact]
    public void Invalid_WhenIdempotencyKeyTooLong() =>
        Assert.False(Validator.Validate(Cmd(idem: new string('k', 300))).IsValid);

    [Fact]
    public void Invalid_WhenKindEmpty() =>
        Assert.False(Validator.Validate(Cmd(kind: "")).IsValid);
}
