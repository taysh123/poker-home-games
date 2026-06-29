using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using PokerApp.Application.Common;

namespace PokerApp.API.Middleware;

/// <summary>
/// Applies the <see cref="SecurityHeaderPolicy"/> to every response (set before the body is written). Additive:
/// it adds headers only and never changes the status or body. Wired early in the pipeline (before CORS).
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        foreach (var (key, value) in SecurityHeaderPolicy.Headers(env.IsProduction()))
            context.Response.Headers[key] = value;
        await next(context);
    }
}
