namespace PokerApp.Application.Common.Exceptions;

/// <summary>No AI credits remaining for the account → HTTP 402 (Payment Required).</summary>
public sealed class QuotaExceededException(string message) : Exception(message);
