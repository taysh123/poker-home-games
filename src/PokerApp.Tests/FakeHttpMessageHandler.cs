using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace PokerApp.Tests;

/// <summary>Test handler returning a canned response; records the last request (and its body, captured while the
/// request is still alive — callers that dispose the request via <c>using</c> would otherwise throw on a late read).
/// No network.</summary>
internal sealed class FakeHttpMessageHandler(HttpStatusCode status, string body, string contentType = "application/json") : HttpMessageHandler
{
    public HttpRequestMessage? LastRequest { get; private set; }

    /// <summary>The outbound request body, read at send time (null when the request had no content).</summary>
    public string? LastRequestBody { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        LastRequest = request;
        if (request.Content is not null)
            LastRequestBody = await request.Content.ReadAsStringAsync(ct);
        return new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, contentType),
        };
    }
}
