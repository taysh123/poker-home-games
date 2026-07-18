using System.Reflection;
using System.Text.Json;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Pins the FAIL-CHEAP AI Coach model default (P0(b), external review 2026-07-07).
/// The coach economics assume Haiku (~$0.006/analysis); Sonnet costs multiples
/// more. The go-live runbook sets CoachAiSettings__Model explicitly on Railway —
/// these pins are the defense-in-depth for the day that env var is missing.
///
/// Deliberately NEVER constructs the provider: the frozen coach-study-quality
/// branch (PR #5) changes the provider's constructor arity, and this test must
/// stay green through that merge — so it pins the const via reflection and the
/// shipped appsettings.json by parsing the file itself.
/// </summary>
public class CoachAiModelDefaultTests
{
    private const string ExpectedModel = "claude-haiku-4-5-20251001";

    [Fact]
    public void Provider_const_fallback_is_haiku()
    {
        var field = typeof(AnthropicCoachAiProvider)
            .GetField("DefaultModel", BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(field);
        Assert.Equal(ExpectedModel, field!.GetRawConstantValue());
    }

    [Fact]
    public void Shipped_appsettings_default_model_is_haiku()
    {
        var repoRoot = FindRepoRoot();
        var appsettingsPath = Path.Combine(repoRoot, "src", "PokerApp.API", "appsettings.json");
        Assert.True(File.Exists(appsettingsPath), $"appsettings.json not found at {appsettingsPath}");

        // The shipped appsettings.json carries // comments — skip them when parsing.
        using var doc = JsonDocument.Parse(
            File.ReadAllText(appsettingsPath),
            new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true });

        var model = doc.RootElement.GetProperty("CoachAiSettings").GetProperty("Model").GetString();
        Assert.Equal(ExpectedModel, model);
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "PokerApp.sln")))
        {
            dir = dir.Parent;
        }

        Assert.NotNull(dir);
        return dir!.FullName;
    }
}
