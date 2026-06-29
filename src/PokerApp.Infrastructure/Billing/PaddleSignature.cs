using System.Security.Cryptography;
using System.Text;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Verifies a Paddle Billing webhook signature (the <c>Paddle-Signature</c> header): hand-rolled HMAC-SHA256 over
/// the signed payload <c>"{ts}:{rawBody}"</c> (the timestamp, a literal colon, then the RAW request body) keyed by
/// the notification-destination signing secret (<c>pdl_ntfset_…</c>), with a timestamp tolerance. There is no
/// official .NET Paddle SDK, so this mirrors Paddle's documented Node scheme by hand. FAIL-CLOSED: empty secret,
/// missing/malformed header, stale timestamp, or a MAC mismatch ⇒ false. The hex MACs are compared in constant
/// time. Operates on the RAW body string (never deserialize-then-reserialize — even whitespace breaks the MAC).
/// Unit-tested in <c>PaddleSignatureTests</c>.
///
/// PADDLE-VERIFY: header format "ts=&lt;unix&gt;;h1=&lt;hex&gt;" (semicolon-separated; multiple hN entries can
/// appear during key rotation — any matching one passes). The default <paramref name="toleranceSeconds"/> here is
/// 300s, deliberately wider than Paddle's SDK default of 5s: a strict 5s window rejects legitimate events under
/// real-server clock skew / processing delay (research §4 + VERIFY item 3). Keep the server clock NTP-synced.
/// </summary>
public static class PaddleSignature
{
    public static bool Verify(string rawBody, string? signatureHeader, string secret, DateTime nowUtc, int toleranceSeconds = 300)
    {
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(signatureHeader) || rawBody is null)
            return false;

        // Header format: "ts=<unix>;h1=<hexmac>[;h1=<hexmac>...]" (semicolon-separated key=value pairs).
        long ts = 0;
        var hashes = new List<string>();
        foreach (var part in signatureHeader.Split(';'))
        {
            var kv = part.Split('=', 2);
            if (kv.Length != 2) continue;
            var key = kv[0].Trim();
            var val = kv[1].Trim();
            if (key == "ts" && long.TryParse(val, out var parsed)) ts = parsed;
            else if (key == "h1") hashes.Add(val);
        }
        if (ts <= 0 || hashes.Count == 0) return false;

        var eventTime = DateTimeOffset.FromUnixTimeSeconds(ts).UtcDateTime;
        if (Math.Abs((nowUtc - eventTime).TotalSeconds) > toleranceSeconds) return false;

        // Signed payload = ts + ":" + rawBody (literal colon).
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var mac = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{ts}:{rawBody}"));
        var expected = Convert.ToHexString(mac).ToLowerInvariant();

        var ok = false;
        foreach (var candidate in hashes)
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
