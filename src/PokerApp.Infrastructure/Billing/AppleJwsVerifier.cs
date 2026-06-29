using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;

namespace PokerApp.Infrastructure.Billing;

/// <summary>
/// Verifies an Apple ES256 JWS (App Store Server Notifications V2 signedPayload / StoreKit2
/// signedTransaction): validates the embedded x5c certificate chain to a configured Apple root,
/// checks validity at `nowUtc`, and verifies the signature. Returns the decoded payload JSON, or
/// null on ANY failure (fail-closed). Trusted roots are injected so it is unit-testable offline.
/// </summary>
public sealed class AppleJwsVerifier(IReadOnlyList<X509Certificate2> trustedRoots)
{
    public string? VerifyAndExtractPayload(string jws, DateTime nowUtc)
    {
        try
        {
            var parts = jws.Split('.');
            if (parts.Length != 3) return null;

            using var header = JsonDocument.Parse(Encoding.UTF8.GetString(Base64Url(parts[0])));
            if (!header.RootElement.TryGetProperty("x5c", out var x5c) || x5c.GetArrayLength() == 0) return null;

            var certs = x5c.EnumerateArray()
                .Select(e => new X509Certificate2(Convert.FromBase64String(e.GetString()!)))
                .ToList();
            try
            {
                var leaf = certs[0];
                if (!ChainIsTrusted(leaf, certs.Skip(1), nowUtc)) return null;

                using var ecdsa = leaf.GetECDsaPublicKey();
                if (ecdsa is null) return null;

                var signingInput = Encoding.ASCII.GetBytes(parts[0] + "." + parts[1]);
                var signature = Base64Url(parts[2]);
                if (!ecdsa.VerifyData(signingInput, signature, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation))
                    return null;

                return Encoding.UTF8.GetString(Base64Url(parts[1]));
            }
            finally
            {
                foreach (var c in certs) c.Dispose();
            }
        }
        catch
        {
            return null;
        }
    }

    private bool ChainIsTrusted(X509Certificate2 leaf, IEnumerable<X509Certificate2> intermediates, DateTime nowUtc)
    {
        if (trustedRoots.Count == 0) return false; // no roots configured ⇒ fail closed
        using var chain = new X509Chain();
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.VerificationTime = nowUtc;
        foreach (var r in trustedRoots) chain.ChainPolicy.CustomTrustStore.Add(r);
        foreach (var i in intermediates) chain.ChainPolicy.ExtraStore.Add(i);
        return chain.Build(leaf);
    }

    private static byte[] Base64Url(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        s += (s.Length % 4) switch { 2 => "==", 3 => "=", _ => "" };
        return Convert.FromBase64String(s);
    }
}
