using PokerApp.Infrastructure.Billing;
using Xunit;

namespace PokerApp.Tests;

public class AppleJwsVerifierTests
{
    private static readonly DateTime Now = new(2026, 6, 19, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ValidJws_ReturnsPayload()
    {
        var (cert, key) = B3Crypto.NewEcCert(Now.AddDays(-1), Now.AddYears(1));
        var jws = B3Crypto.SignAppleJws(cert, key, "{\"hello\":\"world\"}");
        var payload = new AppleJwsVerifier([cert]).VerifyAndExtractPayload(jws, Now);
        Assert.NotNull(payload);
        Assert.Contains("world", payload);
    }

    [Fact]
    public void TamperedSignature_Rejected()
    {
        var (cert, key) = B3Crypto.NewEcCert(Now.AddDays(-1), Now.AddYears(1));
        var jws = B3Crypto.SignAppleJws(cert, key, "{\"a\":1}");
        var parts = jws.Split('.');
        var tampered = $"{parts[0]}.{parts[1]}x.{parts[2]}"; // mutate payload segment
        Assert.Null(new AppleJwsVerifier([cert]).VerifyAndExtractPayload(tampered, Now));
    }

    [Fact]
    public void UntrustedRoot_Rejected()
    {
        var (signer, key) = B3Crypto.NewEcCert(Now.AddDays(-1), Now.AddYears(1));
        var (other, _) = B3Crypto.NewEcCert(Now.AddDays(-1), Now.AddYears(1));
        var jws = B3Crypto.SignAppleJws(signer, key, "{\"a\":1}");
        Assert.Null(new AppleJwsVerifier([other]).VerifyAndExtractPayload(jws, Now)); // signer not trusted
    }

    [Fact]
    public void ExpiredCert_Rejected()
    {
        var (cert, key) = B3Crypto.NewEcCert(Now.AddYears(-2), Now.AddDays(-1)); // already expired
        var jws = B3Crypto.SignAppleJws(cert, key, "{\"a\":1}");
        Assert.Null(new AppleJwsVerifier([cert]).VerifyAndExtractPayload(jws, Now));
    }

    [Fact]
    public void NoTrustedRoots_FailsClosed()
    {
        var (cert, key) = B3Crypto.NewEcCert(Now.AddDays(-1), Now.AddYears(1));
        var jws = B3Crypto.SignAppleJws(cert, key, "{\"a\":1}");
        Assert.Null(new AppleJwsVerifier([]).VerifyAndExtractPayload(jws, Now));
    }
}

public class GoogleOidcVerifierTests
{
    private static readonly DateTime Now = new(2026, 6, 19, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ValidToken_Accepted()
    {
        var (pub, creds) = B3Crypto.NewRsa();
        var token = B3Crypto.SignOidc(creds, "https://api.tpoker/webhooks/google", "https://accounts.google.com", Now.AddMinutes(10));
        Assert.True(GoogleOidcVerifier.Verify(token, [pub], "https://api.tpoker/webhooks/google", Now));
    }

    [Fact]
    public void WrongAudience_Rejected()
    {
        var (pub, creds) = B3Crypto.NewRsa();
        var token = B3Crypto.SignOidc(creds, "https://evil", "https://accounts.google.com", Now.AddMinutes(10));
        Assert.False(GoogleOidcVerifier.Verify(token, [pub], "https://api.tpoker/webhooks/google", Now));
    }

    [Fact]
    public void WrongKey_Rejected()
    {
        var (_, creds) = B3Crypto.NewRsa();
        var (otherPub, _) = B3Crypto.NewRsa();
        var token = B3Crypto.SignOidc(creds, "aud", "https://accounts.google.com", Now.AddMinutes(10));
        Assert.False(GoogleOidcVerifier.Verify(token, [otherPub], "aud", Now));
    }

    [Fact]
    public void Expired_Rejected()
    {
        var (pub, creds) = B3Crypto.NewRsa();
        var token = B3Crypto.SignOidc(creds, "aud", "https://accounts.google.com", Now.AddMinutes(-5));
        Assert.False(GoogleOidcVerifier.Verify(token, [pub], "aud", Now));
    }
}
