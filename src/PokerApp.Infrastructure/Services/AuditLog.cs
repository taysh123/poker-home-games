using Microsoft.Extensions.Logging;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Infrastructure.Services;

/// <summary>
/// Structured, alert-ready audit sink. Writes one structured log line per event (category/action/user/
/// data) — a metrics/SIEM pipeline can key off the "audit" message + properties later. Never throws.
/// </summary>
public sealed class AuditLog(ILogger<AuditLog> logger) : IAuditLog
{
    public void Record(AuditCategory category, string action, Guid? userId = null, object? data = null)
    {
        try
        {
            logger.LogInformation(
                "audit {AuditCategory} {AuditAction} {UserId} {@AuditData}",
                category, action, userId, data);
        }
        catch
        {
            // Observability must never break a command.
        }
    }
}
