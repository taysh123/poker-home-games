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
            logger.LogError(ex, "Unhandled exception. TraceId: {TraceId}. Message: {Message}. InnerException: {InnerMessage}",
                context.TraceIdentifier, ex.Message, ex.InnerException?.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var traceId = context.TraceIdentifier;
        var (statusCode, error) = exception switch
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
            // a row carrying a concurrency token (renaming a session, editing notes, starting one,
            // AddBuyIn's Draft auto-start), which would otherwise surface a bare 500.
            DbUpdateConcurrencyException => (
                HttpStatusCode.Conflict,
                new ErrorResponse("This was changed by someone else while you were working on it. Refresh and try again.", null)),

            _ => (
                HttpStatusCode.InternalServerError,
                new ErrorResponse($"An unexpected error occurred. TraceId: {traceId}", null))
        };

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
