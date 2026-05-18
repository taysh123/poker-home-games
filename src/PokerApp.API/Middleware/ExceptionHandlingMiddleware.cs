using System.Net;
using System.Text.Json;
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

            UnauthorizedAccessException => (
                HttpStatusCode.Forbidden,
                new ErrorResponse("Access denied.", null)),

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
