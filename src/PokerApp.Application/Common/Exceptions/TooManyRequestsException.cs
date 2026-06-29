namespace PokerApp.Application.Common.Exceptions;

/// <summary>Per-account rate limit hit (e.g. AI analyses too fast) → HTTP 429.</summary>
public sealed class TooManyRequestsException(string message) : Exception(message);
