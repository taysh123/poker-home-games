using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace PokerApp.Tests;

/// <summary>Offline test crypto: self-signed EC cert + Apple-style JWS signing; RSA + Google OIDC signing.</summary>
internal static class B3Crypto
{
    public static (X509Certificate2 cert, ECDsa key) NewEcCert(DateTime notBefore, DateTime notAfter)
    {
        var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var req = new CertificateRequest("CN=AppleTest", ec, HashAlgorithmName.SHA256);
        var cert = req.CreateSelfSigned(new DateTimeOffset(notBefore, TimeSpan.Zero), new DateTimeOffset(notAfter, TimeSpan.Zero));
        return (cert, ec);
    }

    public static string SignAppleJws(X509Certificate2 cert, ECDsa key, string payloadJson)
    {
        var header = JsonSerializer.Serialize(new
        {
            alg = "ES256",
            x5c = new[] { Convert.ToBase64String(cert.Export(X509ContentType.Cert)) },
        });
        var h = B64u(Encoding.UTF8.GetBytes(header));
        var p = B64u(Encoding.UTF8.GetBytes(payloadJson));
        var sig = key.SignData(Encoding.ASCII.GetBytes($"{h}.{p}"), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        return $"{h}.{p}.{B64u(sig)}";
    }

    public static (RsaSecurityKey publicKey, SigningCredentials creds) NewRsa()
    {
        var rsa = RSA.Create(2048);
        var creds = new SigningCredentials(new RsaSecurityKey(rsa) { KeyId = "test" }, SecurityAlgorithms.RsaSha256);
        var pub = new RsaSecurityKey(rsa.ExportParameters(false)) { KeyId = "test" };
        return (pub, creds);
    }

    public static string SignOidc(SigningCredentials creds, string audience, string issuer, DateTime expires)
    {
        var token = new JwtSecurityToken(issuer, audience, claims: null,
            notBefore: expires.AddMinutes(-30), expires: expires, signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string B64u(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
