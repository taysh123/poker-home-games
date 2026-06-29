using PokerApp.Application.Common;
using Xunit;

namespace PokerApp.Tests;

public class CsvSafeTests
{
    [Theory]
    [InlineData("=cmd|'/c calc'!A1")]
    [InlineData("+1+1")]
    [InlineData("-2+3")]
    [InlineData("@SUM(A1:A2)")]
    public void NeutralisesFormulaTriggers(string evil)
    {
        // Quoted field starting with a guard apostrophe so spreadsheets treat it as text.
        Assert.StartsWith("\"'", CsvSafe.Field(evil));
    }

    [Fact]
    public void DoublesEmbeddedQuotes_AndWraps()
    {
        Assert.Equal("\"a\"\"b\"", CsvSafe.Field("a\"b"));
    }

    [Fact]
    public void PlainValue_IsQuoted_Unchanged()
    {
        Assert.Equal("\"Alice\"", CsvSafe.Field("Alice"));
    }

    [Fact]
    public void Null_BecomesEmptyQuoted()
    {
        Assert.Equal("\"\"", CsvSafe.Field(null));
    }
}
