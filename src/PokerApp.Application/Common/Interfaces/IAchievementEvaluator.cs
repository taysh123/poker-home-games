namespace PokerApp.Application.Common.Interfaces;

public interface IAchievementEvaluator
{
    /// <summary>
    /// Evaluates and awards any newly earned achievements after a session is completed.
    /// Returns the keys of newly unlocked achievements.
    /// </summary>
    Task<IReadOnlyList<string>> EvaluateAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken);
}
