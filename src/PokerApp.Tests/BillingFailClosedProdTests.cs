using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Production billing must FAIL CLOSED. The mock verifier grants an Active premium subscription for ANY
/// non-empty receipt — safe as a dev/test seam, catastrophic in production. These tests pin three layers:
/// (1) verifier selection: in Production a non-"direct" provider resolves to a DISABLED verifier (never mock),
/// (2) sandbox acceptance defaults to false (missing config can never mean "accept sandbox receipts"),
/// (3) appsettings.Production.json pins Provider=direct + AcceptSandbox=false so a forgotten Railway var
///     cannot re-open the hole. Complements SecuritySandboxEntitlementTests (audit H4).
/// </summary>
public class BillingFailClosedProdTests
{
    // --- Layer 1: verifier selection ---------------------------------------------------------

    [Theory]
    [InlineData("mock")]
    [InlineData("MOCK")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("paddle")] // unknown values must not fall back to mock in prod
    public void Selection_NonDirectProvider_InProduction_IsDisabled(string? provider)
    {
        Assert.Equal(BillingVerifierKind.Disabled, BillingVerifierSelection.Resolve(provider, isProduction: true));
    }

    [Theory]
    [InlineData("direct")]
    [InlineData("DIRECT")]
    public void Selection_DirectProvider_IsDirect_InEveryEnvironment(string provider)
    {
        Assert.Equal(BillingVerifierKind.Direct, BillingVerifierSelection.Resolve(provider, isProduction: true));
        Assert.Equal(BillingVerifierKind.Direct, BillingVerifierSelection.Resolve(provider, isProduction: false));
    }

    [Theory]
    [InlineData("mock")]
    [InlineData("")]
    [InlineData(null)]
    public void Selection_NonDirectProvider_OutsideProduction_IsMock(string? provider)
    {
        // Dev/test seam preserved: local runs and the test suite keep the mock verifier.
        Assert.Equal(BillingVerifierKind.Mock, BillingVerifierSelection.Resolve(provider, isProduction: false));
    }

    // --- Layer 1b: the disabled verifier grants nothing --------------------------------------

    [Fact]
    public async Task DisabledVerifier_ReturnsNull_ForAnyReceipt()
    {
        var verifier = new DisabledBillingVerifier();
        Assert.Null(await verifier.VerifyAsync(SubscriptionStore.Apple, "any-receipt"));
        Assert.Null(await verifier.VerifyAsync(SubscriptionStore.Google, "totally-legit-token"));
        Assert.Null(await verifier.VerifyAsync(SubscriptionStore.Paddle, ""));
    }

    // --- Layer 2: sandbox acceptance is opt-in, never a default ------------------------------

    [Fact]
    public void BillingSettings_AcceptSandbox_DefaultsToFalse()
    {
        Assert.False(new BillingSettings().AcceptSandbox);
    }

    [Fact]
    public async Task EntitlementService_WithoutBillingSettings_ExcludesSandboxSubs()
    {
        // A bare EntitlementService (no BillingSettings supplied) must fail closed: a sandbox/mock-minted
        // subscription grants nothing. Tests that WANT sandbox acceptance pass AcceptSandbox=true explicitly.
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Subscription.Create(
            uid, SubscriptionStore.Apple, "tpoker.premium.monthly", "mock-receipt",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(20), true, isSandbox: true, DateTime.UtcNow));
        await ctx.SaveChangesAsync();

        var ent = await new EntitlementService(ctx).GetAsync(uid);
        Assert.False(ent.IsPremium);
    }

    // --- Layer 3: the shipped Production config pins the fail-closed posture ------------------

    [Fact]
    public void ProductionAppSettings_PinProviderDirect_AndRejectSandbox()
    {
        var path = Path.Combine(FindRepoRoot(), "src", "PokerApp.API", "appsettings.Production.json");
        Assert.True(File.Exists(path), $"appsettings.Production.json not found at {path}");

        using var doc = JsonDocument.Parse(File.ReadAllText(path), new JsonDocumentOptions
        {
            CommentHandling = JsonCommentHandling.Skip,
            AllowTrailingCommas = true,
        });

        Assert.True(doc.RootElement.TryGetProperty("BillingSettings", out var billing),
            "appsettings.Production.json must pin a BillingSettings section (fail-closed billing).");
        Assert.Equal("direct", billing.GetProperty("Provider").GetString());
        Assert.False(billing.GetProperty("AcceptSandbox").GetBoolean());
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "PokerApp.sln")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Repo root (PokerApp.sln) not found.");
    }
}
