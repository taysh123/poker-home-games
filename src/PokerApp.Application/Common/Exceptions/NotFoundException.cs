namespace PokerApp.Application.Common.Exceptions;

public sealed class NotFoundException(string name, object key)
    : Exception($"Entity \"{name}\" ({key}) was not found.");
