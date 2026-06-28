using System;
using System.Security.Cryptography;
using System.Text;
using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

/// <summary>
/// Pins the Paddle-Signature verification (the most safety-critical money primitive): HMAC-SHA256 over
/// "{ts}:{rawBody}" with the notification-destination signing secret, hex constant-time compared to h1, with a
/// timestamp tolerance. The expected hex is recomputed in-test with the same HMAC so the asserts are deterministic.
/// Mirrors <see cref="StripeSignatureTests"/>.
/// </summary>
public class PaddleSignatureTests
{
    private const string Secret = "pdl_ntfset_test_secret";
    private static readonly DateTime Now = new(2026, 6, 28, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>Builds a Paddle-Signature header ("ts=<unix>;h1=<hex>") for a raw body + timestamp + secret.</summary>
    private static string Header(string rawBody, DateTime t, string secret)
    {
        var ts = new DateTimeOffset(t, TimeSpan.Zero).ToUnixTimeSeconds();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var mac = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ts}:{rawBody}"));
        return $"ts={ts};h1={Convert.ToHexString(mac).ToLowerInvariant()}";
    }

    [Fact]
    public void Accepts_a_valid_signature()
    {
        const string body = "{\"event_id\":\"evt_1\"}";
        Assert.True(PaddleSignature.Verify(body, Header(body, Now, Secret), Secret, Now));
    }

    [Fact]
    public void Rejects_a_tampered_body()
    {
        var header = Header("{\"event_id\":\"evt_1\"}", Now, Secret);
        Assert.False(PaddleSignature.Verify("{\"event_id\":\"evt_TAMPERED\"}", header, Secret, Now));
    }

    [Fact]
    public void Rejects_a_wrong_secret()
    {
        const string body = "{\"event_id\":\"evt_1\"}";
        Assert.False(PaddleSignature.Verify(body, Header(body, Now, Secret), "pdl_ntfset_other", Now));
    }

    [Fact]
    public void Rejects_a_stale_timestamp_outside_tolerance()
    {
        const string body = "{}";
        var header = Header(body, Now.AddSeconds(-600), Secret); // 600s > 300s default tolerance
        Assert.False(PaddleSignature.Verify(body, header, Secret, Now));
    }

    [Fact]
    public void Accepts_a_timestamp_within_tolerance()
    {
        const string body = "{}";
        var header = Header(body, Now.AddSeconds(-120), Secret); // 120s < 300s default tolerance
        Assert.True(PaddleSignature.Verify(body, header, Secret, Now));
    }

    [Fact]
    public void Fails_closed_on_empty_secret_or_malformed_header()
    {
        const string body = "{}";
        Assert.False(PaddleSignature.Verify(body, Header(body, Now, Secret), "", Now)); // empty secret
        Assert.False(PaddleSignature.Verify(body, null, Secret, Now));                  // missing header
        Assert.False(PaddleSignature.Verify(body, "garbage-no-kv", Secret, Now));       // no key=value pairs
        Assert.False(PaddleSignature.Verify(body, "ts=abc;h1=def", Secret, Now));       // non-numeric ts
        Assert.False(PaddleSignature.Verify(body, "h1=deadbeef", Secret, Now));         // missing ts
        Assert.False(PaddleSignature.Verify(body, $"ts={new DateTimeOffset(Now, TimeSpan.Zero).ToUnixTimeSeconds()}", Secret, Now)); // missing h1
    }
}
