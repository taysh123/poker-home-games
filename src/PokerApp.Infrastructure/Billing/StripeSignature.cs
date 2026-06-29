using System.Security.Cryptography;
using System.Text;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Verifies a Stripe webhook signature (the <c>Stripe-Signature</c> header): hand-rolled HMAC-SHA256 over
/// "{t}.{payload}" with the webhook signing secret, with a timestamp tolerance. Mirrors Stripe's documented
/// scheme (no SDK). FAIL-CLOSED: empty secret, missing/malformed header, stale timestamp, or a MAC mismatch
/// ⇒ false. Compared in constant time. Unit-tested in <c>StripeSignatureTests</c>.
/// </summary>
public static class StripeSignature
{
    public static bool Verify(string payload, string? signatureHeader, string secret, DateTime nowUtc, TimeSpan? tolerance = null)
    {
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(signatureHeader) || payload is null)
            return false;

        // Header format: "t=<unix>,v1=<hexmac>[,v1=<hexmac>...]"
        long t = 0;
        var v1 = new List<string>();
        foreach (var part in signatureHeader.Split(','))
        {
            var kv = part.Split('=', 2);
            if (kv.Length != 2) continue;
            var key = kv[0].Trim();
            var val = kv[1].Trim();
            if (key == "t" && long.TryParse(val, out var ts)) t = ts;
            else if (key == "v1") v1.Add(val);
        }
        if (t <= 0 || v1.Count == 0) return false;

        var tol = tolerance ?? TimeSpan.FromMinutes(5);
        var eventTime = DateTimeOffset.FromUnixTimeSeconds(t).UtcDateTime;
        if (Math.Abs((nowUtc - eventTime).TotalSeconds) > tol.TotalSeconds) return false;

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var mac = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{t}.{payload}"));
        var expected = Convert.ToHexString(mac).ToLowerInvariant();

        var ok = false;
        foreach (var candidate in v1)
            ok |= FixedTimeEquals(expected, candidate.ToLowerInvariant());
        return ok;
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        var ba = Encoding.ASCII.GetBytes(a);
        var bb = Encoding.ASCII.GetBytes(b);
        return ba.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ba, bb);
    }
}
