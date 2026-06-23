using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

/// <summary>Returns a fixed key set — lets us drive Google OIDC verification offline.</summary>
internal sealed class FakeOidcKeySource(IReadOnlyCollection<SecurityKey> keys) : IOidcKeySource
{
    public Task<IReadOnlyCollection<SecurityKey>> GetKeysAsync(CancellationToken ct = default) => Task.FromResult(keys);
}

/// <summary>Fake Play Developer API client — returns a canned state (or null = fail-closed).</summary>
internal sealed class FakeGooglePlayClient(GooglePlaySubscriptionState? state) : IGooglePlaySubscriptionsClient
{
    public Task<GooglePlaySubscriptionState?> GetAsync(string purchaseToken, CancellationToken ct = default)
        => Task.FromResult(state);
}

internal static class B3Notif
{
    public static readonly DateTime Now = new(2026, 6, 19, 12, 0, 0, DateTimeKind.Utc);

    public static long Ms(DateTime dt) => new DateTimeOffset(dt, TimeSpan.Zero).ToUnixTimeMilliseconds();

    /// <summary>Builds an Apple ASSN V2 outer JWS wrapping a signed transaction JWS (same cert).</summary>
    public static string AppleNotification(X509Certificate2 cert, ECDsa key, string type, string subtype,
        string uuid, string environment, string originalTxnId, DateTime expires)
    {
        var innerTx = JsonSerializer.Serialize(new { originalTransactionId = originalTxnId, expiresDate = Ms(expires) });
        var signedTx = B3Crypto.SignAppleJws(cert, key, innerTx);
        var outer = JsonSerializer.Serialize(new
        {
            notificationType = type,
            subtype,
            notificationUUID = uuid,
            signedDate = Ms(Now),
            data = new { environment, signedTransactionInfo = signedTx },
        });
        return B3Crypto.SignAppleJws(cert, key, outer);
    }
}

public class StoreNotificationVerifierAppleTests
{
    private static StoreNotificationVerifier Make(X509Certificate2 cert, bool acceptSandbox) =>
        new(new AppleJwsVerifier([cert]),
            new FakeOidcKeySource([]),
            new BillingSettings { Provider = "direct", AcceptSandbox = acceptSandbox },
            new GooglePlaySettings(),
            new StripeSettings(),
            new RevenueCatSettings());

    [Fact]
    public async Task ValidProductionNotification_Normalized()
    {
        var (cert, key) = B3Crypto.NewEcCert(B3Notif.Now.AddDays(-1), B3Notif.Now.AddYears(1));
        var jws = B3Notif.AppleNotification(cert, key, "DID_RENEW", "", "uuid-1", "Production", "orig-7", B3Notif.Now.AddDays(30));

        var dto = await Make(cert, acceptSandbox: false).VerifyAppleAsync(jws, B3Notif.Now);

        Assert.NotNull(dto);
        Assert.Equal("uuid-1", dto!.NotificationUuid);
        Assert.Equal("renew", dto.Type);
        Assert.Equal("orig-7", dto.OriginalTransactionId);
        Assert.Equal(B3Notif.Now.AddDays(30), dto.PeriodEnd);
    }

    [Fact]
    public async Task TamperedOuterSignature_FailsClosed()
    {
        var (cert, key) = B3Crypto.NewEcCert(B3Notif.Now.AddDays(-1), B3Notif.Now.AddYears(1));
        var jws = B3Notif.AppleNotification(cert, key, "DID_RENEW", "", "uuid-1", "Production", "orig-7", B3Notif.Now.AddDays(30));
        var parts = jws.Split('.');
        var tampered = $"{parts[0]}.{parts[1]}x.{parts[2]}";

        Assert.Null(await Make(cert, acceptSandbox: false).VerifyAppleAsync(tampered, B3Notif.Now));
    }

    [Fact]
    public async Task SandboxEvent_RejectedWhenSandboxDisabled()
    {
        var (cert, key) = B3Crypto.NewEcCert(B3Notif.Now.AddDays(-1), B3Notif.Now.AddYears(1));
        var jws = B3Notif.AppleNotification(cert, key, "DID_RENEW", "", "uuid-1", "Sandbox", "orig-7", B3Notif.Now.AddDays(30));

        Assert.Null(await Make(cert, acceptSandbox: false).VerifyAppleAsync(jws, B3Notif.Now));
        Assert.NotNull(await Make(cert, acceptSandbox: true).VerifyAppleAsync(jws, B3Notif.Now));
    }

    [Fact]
    public async Task CancelMapping_AutoRenewDisabled()
    {
        var (cert, key) = B3Crypto.NewEcCert(B3Notif.Now.AddDays(-1), B3Notif.Now.AddYears(1));
        var jws = B3Notif.AppleNotification(cert, key, "DID_CHANGE_RENEWAL_STATUS", "AUTO_RENEW_DISABLED", "u2", "Production", "o2", B3Notif.Now.AddDays(10));

        var dto = await Make(cert, acceptSandbox: false).VerifyAppleAsync(jws, B3Notif.Now);
        Assert.Equal("cancel", dto!.Type);
    }
}

public class StoreNotificationVerifierGoogleTests
{
    private const string Aud = "https://api.tpoker/webhooks/google";

    private static StoreNotificationVerifier Make(IReadOnlyCollection<SecurityKey> keys) =>
        new(new AppleJwsVerifier([]),
            new FakeOidcKeySource(keys),
            new BillingSettings { Provider = "direct", AcceptSandbox = false },
            new GooglePlaySettings { PubSubAudience = Aud },
            new StripeSettings(),
            new RevenueCatSettings());

    private static string Rtdn(string purchaseToken, int type) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            subscriptionNotification = new { purchaseToken, notificationType = type },
        })));

    [Fact]
    public async Task ValidOidc_DecodesRtdn()
    {
        var (pub, creds) = B3Crypto.NewRsa();
        var token = B3Crypto.SignOidc(creds, Aud, "https://accounts.google.com", B3Notif.Now.AddMinutes(10));

        var dto = await Make([pub]).VerifyGoogleAsync($"Bearer {token}", "msg-1", Rtdn("ptok-1", 2), B3Notif.Now);

        Assert.NotNull(dto);
        Assert.Equal("msg-1", dto!.NotificationUuid);
        Assert.Equal("renew", dto.Type);
        Assert.Equal("ptok-1", dto.OriginalTransactionId);
    }

    [Fact]
    public async Task BadOidcAudience_FailsClosed()
    {
        var (pub, creds) = B3Crypto.NewRsa();
        var token = B3Crypto.SignOidc(creds, "https://evil", "https://accounts.google.com", B3Notif.Now.AddMinutes(10));

        Assert.Null(await Make([pub]).VerifyGoogleAsync($"Bearer {token}", "msg-1", Rtdn("ptok-1", 2), B3Notif.Now));
    }

    [Fact]
    public async Task MissingAuthHeader_FailsClosed()
    {
        var (pub, _) = B3Crypto.NewRsa();
        Assert.Null(await Make([pub]).VerifyGoogleAsync(null, "msg-1", Rtdn("ptok-1", 2), B3Notif.Now));
    }
}

public class AppleBillingVerifierTests
{
    private static AppleBillingVerifier Make(X509Certificate2 cert, bool acceptSandbox) =>
        new(new AppleJwsVerifier([cert]), new BillingSettings { AcceptSandbox = acceptSandbox });

    private static string Txn(X509Certificate2 cert, ECDsa key, string env, string product, string orig) =>
        B3Crypto.SignAppleJws(cert, key, JsonSerializer.Serialize(new
        {
            environment = env,
            productId = product,
            originalTransactionId = orig,
            purchaseDate = B3Notif.Ms(B3Notif.Now),
            expiresDate = B3Notif.Ms(B3Notif.Now.AddDays(30)),
        }));

    [Fact]
    public async Task ValidTransaction_MappedToActiveSubscription()
    {
        var (cert, key) = B3Crypto.NewEcCert(B3Notif.Now.AddDays(-1), B3Notif.Now.AddYears(1));
        var jws = Txn(cert, key, "Production", "premium_monthly", "orig-1");

        var sub = await Make(cert, acceptSandbox: false).VerifyAsync(SubscriptionStore.Apple, jws);

        Assert.NotNull(sub);
        Assert.Equal(SubscriptionStore.Apple, sub!.Store);
        Assert.Equal("premium_monthly", sub.ProductId);
        Assert.Equal("orig-1", sub.OriginalTransactionId);
        Assert.False(sub.IsSandbox);
        Assert.Equal(SubscriptionStatus.Active, sub.Status);
    }

    [Fact]
    public async Task SandboxTransaction_RejectedWhenDisabled()
    {
        var (cert, key) = B3Crypto.NewEcCert(B3Notif.Now.AddDays(-1), B3Notif.Now.AddYears(1));
        var jws = Txn(cert, key, "Sandbox", "premium_monthly", "orig-1");

        Assert.Null(await Make(cert, acceptSandbox: false).VerifyAsync(SubscriptionStore.Apple, jws));
        Assert.NotNull(await Make(cert, acceptSandbox: true).VerifyAsync(SubscriptionStore.Apple, jws));
    }

    [Fact]
    public async Task WrongStore_ReturnsNull()
    {
        var (cert, key) = B3Crypto.NewEcCert(B3Notif.Now.AddDays(-1), B3Notif.Now.AddYears(1));
        var jws = Txn(cert, key, "Production", "p", "o");
        Assert.Null(await Make(cert, acceptSandbox: true).VerifyAsync(SubscriptionStore.Google, jws));
    }

    [Fact]
    public async Task BadSignature_FailsClosed()
    {
        var (cert, _) = B3Crypto.NewEcCert(B3Notif.Now.AddDays(-1), B3Notif.Now.AddYears(1));
        Assert.Null(await Make(cert, acceptSandbox: true).VerifyAsync(SubscriptionStore.Apple, "not.a.jws"));
    }
}

public class GooglePlayBillingVerifierTests
{
    private static readonly BillingSettings Accept = new() { AcceptSandbox = true };

    [Fact]
    public async Task ClientState_MappedToSubscription()
    {
        var state = new GooglePlaySubscriptionState("premium_monthly", B3Notif.Now, B3Notif.Now.AddDays(30), true, false, SubscriptionStatus.Active);
        var verifier = new GooglePlayBillingVerifier(new FakeGooglePlayClient(state), Accept);

        var sub = await verifier.VerifyAsync(SubscriptionStore.Google, "ptok-1");

        Assert.NotNull(sub);
        Assert.Equal(SubscriptionStore.Google, sub!.Store);
        Assert.Equal("premium_monthly", sub.ProductId);
        Assert.Equal("ptok-1", sub.OriginalTransactionId);
    }

    [Fact]
    public async Task NullClientResult_FailsClosed()
    {
        var verifier = new GooglePlayBillingVerifier(new FakeGooglePlayClient(null), Accept);
        Assert.Null(await verifier.VerifyAsync(SubscriptionStore.Google, "ptok-1"));
    }

    [Fact]
    public async Task SandboxRejectedWhenDisabled()
    {
        var state = new GooglePlaySubscriptionState("p", B3Notif.Now, B3Notif.Now.AddDays(30), true, true, SubscriptionStatus.Active);
        var verifier = new GooglePlayBillingVerifier(new FakeGooglePlayClient(state), new BillingSettings { AcceptSandbox = false });
        Assert.Null(await verifier.VerifyAsync(SubscriptionStore.Google, "ptok-1"));
    }
}
