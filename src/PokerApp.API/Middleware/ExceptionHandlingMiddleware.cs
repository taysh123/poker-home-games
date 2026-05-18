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
            logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, error) = exception switch
        {
            ValidationException ve => (
                HttpStatusCode.BadRequest,
                new ErrorResponse("Validation failure", ve.Errors)),

            NotFoundException nfe => (
                HttpStatusCode.NotFound,
                new ErrorResponse(nfe.Message, null)),

            UnauthorizedAccessException => (
                HttpStatusCode.Unauthorized,
                new ErrorResponse("Unauthorized", null)),

            _ => (
                HttpStatusCode.InternalServerError,
                new ErrorResponse("An unexpected error occurred", null))
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
