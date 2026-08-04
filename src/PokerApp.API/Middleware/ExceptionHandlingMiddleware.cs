using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Exceptions;

namespace PokerApp.API.Middleware;

public class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            // Severity follows the mapped status, not the fact that an exception was thrown. Every
            // 4xx here is an EXPECTED, handled outcome — a validation failure, a 404, and now a lost
            // optimistic-concurrency race, which this slice deliberately made routine. Logging those
            // at Error as "Unhandled" made them indistinguishable from genuine faults in Railway's
            // logs, which would have defeated the point of turning the race into a 409 at all.
            // Only the unmapped 5xx branch is a server fault.
            var (statusCode, error) = Map(ex, context.TraceIdentifier);

            if (statusCode >= HttpStatusCode.InternalServerError)
                logger.LogError(ex, "Unhandled exception. TraceId: {TraceId}. Message: {Message}. InnerException: {InnerMessage}",
                    context.TraceIdentifier, ex.Message, ex.InnerException?.Message);
            else
                logger.LogInformation("Handled {Exception} -> {Status}. TraceId: {TraceId}. Message: {Message}",
                    ex.GetType().Name, (int)statusCode, context.TraceIdentifier, ex.Message);

            await WriteAsync(context, statusCode, error);
        }
    }

    private static (HttpStatusCode StatusCode, ErrorResponse Error) Map(Exception exception, string traceId)
    {
        return exception switch
        {
            BadRequestException bre => (
                HttpStatusCode.BadRequest,
                new ErrorResponse(bre.Message, null)),

            ValidationException ve => (
                HttpStatusCode.BadRequest,
                new ErrorResponse("Validation failure", ve.Errors)),

            NotFoundException nfe => (
                HttpStatusCode.NotFound,
                new ErrorResponse(nfe.Message, null)),

            ConflictException ce => (
                HttpStatusCode.Conflict,
                new ErrorResponse(ce.Message, null)),

            UnauthorizedException ue => (
                HttpStatusCode.Unauthorized,
                new ErrorResponse(ue.Message, null)),

            QuotaExceededException qee => (
                HttpStatusCode.PaymentRequired,
                new ErrorResponse(qee.Message, null)),

            TooManyRequestsException tmre => (
                HttpStatusCode.TooManyRequests,
                new ErrorResponse(tmre.Message, null)),

            UnauthorizedAccessException => (
                HttpStatusCode.Forbidden,
                new ErrorResponse("Access denied.", null)),

            // A lost optimistic-concurrency race is a CONFLICT, not a server fault: the row this
            // request read was changed by someone else before it could write, so its UPDATE matched
            // zero rows (audit 2026-08-03, HIGH #3). The handlers that own a user-facing race —
            // EndSession, JoinSessionByToken — translate this into their own ConflictException with
            // specific copy and never reach here. This is the safety net for every OTHER writer of
            // a row carrying a concurrency token (renaming a session, editing notes), which would
            // otherwise surface a bare 500.
            //
            // NOTE for future readers: a 409 here is NOT proof that a concurrent WRITE happened. EF
            // raises this exception for any UPDATE/DELETE that matches zero rows — including a row
            // deleted meanwhile, or a detached entity attached with a key that never existed, which
            // is a programming bug that deserves a 500. No such shape exists in this codebase today
            // (the only DbSet-level attach/update usage was checked), but if one is introduced this
            // mapping will quietly turn it into a 409.
            DbUpdateConcurrencyException => (
                HttpStatusCode.Conflict,
                new ErrorResponse("This was changed by someone else while you were working on it. Refresh and try again.", null)),

            _ => (
                HttpStatusCode.InternalServerError,
                new ErrorResponse($"An unexpected error occurred. TraceId: {traceId}", null))
        };
    }

    private static Task WriteAsync(HttpContext context, HttpStatusCode statusCode, ErrorResponse error)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var json = JsonSerializer.Serialize(error, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        return context.Response.WriteAsync(json);
    }
}

internal sealed record ErrorResponse(string Message, object? Errors);
