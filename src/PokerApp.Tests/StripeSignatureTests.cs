using System;
using System.Security.Cryptography;
using System.Text;
using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

public class StripeSignatureTests
{
    private const string Secret = "whsec_test_secret";
    private static readonly DateTime Now = new(2026, 6, 24, 12, 0, 0, DateTimeKind.Utc);

    private static string Header(string payload, DateTime t, string secret)
    {
        var ts = new DateTimeOffset(t, TimeSpan.Zero).ToUnixTimeSeconds();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var mac = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ts}.{payload}"));
        return $"t={ts},v1={Convert.ToHexString(mac).ToLowerInvariant()}";
    }

    [Fact]
    public void Accepts_a_valid_signature()
    {
        const string payload = "{\"id\":\"evt_1\"}";
        Assert.True(StripeSignature.Verify(payload, Header(payload, Now, Secret), Secret, Now));
    }

    [Fact]
    public void Rejects_a_tampered_payload()
    {
        var header = Header("{\"id\":\"evt_1\"}", Now, Secret);
        Assert.False(StripeSignature.Verify("{\"id\":\"evt_TAMPERED\"}", header, Secret, Now));
    }

    [Fact]
    public void Rejects_a_wrong_secret()
    {
        const string payload = "{\"id\":\"evt_1\"}";
        Assert.False(StripeSignature.Verify(payload, Header(payload, Now, Secret), "whsec_other", Now));
    }

    [Fact]
    public void Fails_closed_on_empty_secret_or_missing_header()
    {
        const string payload = "{}";
        Assert.False(StripeSignature.Verify(payload, Header(payload, Now, Secret), "", Now));
        Assert.False(StripeSignature.Verify(payload, null, Secret, Now));
    }

    [Fact]
    public void Rejects_a_stale_timestamp_outside_tolerance()
    {
        const string payload = "{}";
        var header = Header(payload, Now.AddMinutes(-10), Secret); // 10m > 5m default tolerance
        Assert.False(StripeSignature.Verify(payload, header, Secret, Now));
    }
}
