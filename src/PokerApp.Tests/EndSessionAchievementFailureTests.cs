using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Sessions.Commands.EndSession;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Tests;

/// <summary>
/// Ending a session must survive its own best-effort side effects (audit 2026-08-03, HIGH #7).
///
/// `session.End()` and the cash-outs commit FIRST. Everything after that commit — awarding
/// achievements, sending notifications — is a side effect of a request that has already durably
/// succeeded. The notification blocks were wrapped from the start ("notifications are
/// non-critical"); the achievement evaluation between them was not, so a unique-index race on
/// `(UserId, AchievementKey)` — two EndSession calls for the same user's two different sessions —
/// throws `DbUpdateException`, which `ExceptionHandlingMiddleware` does not map, and the caller
/// gets a bare 500 for a game night that WAS successfully closed out. The client then shows an
/// error over a session the server has already finished.
///
/// Same defect class as PR #74 and PR #78: a best-effort side effect taking down an
/// already-committed critical path.
/// </summary>
public sealed class EndSessionAchievementFailureTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _ctx;

    public EndSessionAchievementFailureTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        _ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options);
        _ctx.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _ctx.Dispose();
        _conn.Dispose();
    }

    private sealed class FakeCurrentUser(Guid id) : ICurrentUserService
    {
        public Guid UserId { get; } = id;
        public string? Email => "host@example.com";
        public string? Username => "host";
        public bool IsAuthenticated => true;
    }

    /// <summary>The real-world failure: a unique-index race inside the evaluator's own SaveChanges.</summary>
    private sealed class ThrowingAchievementEvaluator : IAchievementEvaluator
    {
        public Task<IReadOnlyList<string>> EvaluateAsync(Guid userId, Guid sessionId, CancellationToken ct)
            => throw new DbUpdateException("duplicate key value violates unique constraint \"IX_UserAchievements_UserId_AchievementKey\"");
    }

    /// <summary>A working evaluator, so the happy path can be pinned alongside the failure path.</summary>
    private sealed class StubAchievementEvaluator(params string[] keys) : IAchievementEvaluator
    {
        public Task<IReadOnlyList<string>> EvaluateAsync(Guid userId, Guid sessionId, CancellationToken ct)
            => Task.FromResult<IReadOnlyList<string>>(keys);
    }

    private sealed class NoNotifications : INotificationService
    {
        public Task NotifyAsync(Guid userId, NotificationType type, string title, string body,
            Guid? relatedEntityId = null, CancellationToken ct = default) => Task.CompletedTask;

        public Task NotifyManyAsync(IEnumerable<Guid> userIds, NotificationType type, string title,
            string body, Guid? relatedEntityId = null, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class RecordingNotifications : INotificationService
    {
        public readonly List<(NotificationType Type, string Body)> Sent = [];

        public Task NotifyAsync(Guid userId, NotificationType type, string title, string body,
            Guid? relatedEntityId = null, CancellationToken ct = default)
        {
            Sent.Add((type, body));
            return Task.CompletedTask;
        }

        public Task NotifyManyAsync(IEnumerable<Guid> userIds, NotificationType type, string title,
            string body, Guid? relatedEntityId = null, CancellationToken ct = default)
        {
            Sent.Add((type, body));
            return Task.CompletedTask;
        }
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public readonly List<(LogLevel Level, string Message, Exception? Exception)> Entries = [];

        IDisposable? ILogger.BeginScope<TState>(TState state) => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception), exception));
    }

    private (Guid HostId, Guid SessionId, Guid SeatId) SeedActiveSessionWithOneSeat()
    {
        var host = User.Create("host", "host@example.com", "hash");
        _ctx.Users.Add(host);
        var session = Session.Create("Friday night", host.Id);
        session.Start();
        _ctx.Sessions.Add(session);
        var seat = SessionPlayer.CreateForGuest(session.Id, "Walk-in Willie");
        _ctx.SessionPlayers.Add(seat);
        _ctx.BuyIns.Add(BuyIn.Create(session.Id, seat.Id, 100m));
        _ctx.SaveChanges();
        _ctx.ChangeTracker.Clear();
        return (host.Id, session.Id, seat.Id);
    }

    private EndSessionCommandHandler BuildHandler(
        Guid callerId,
        IAchievementEvaluator evaluator,
        INotificationService? notifications = null,
        CapturingLogger<EndSessionCommandHandler>? logger = null)
        => new(_ctx, new FakeCurrentUser(callerId), evaluator,
            notifications ?? new NoNotifications(),
            logger ?? new CapturingLogger<EndSessionCommandHandler>());

    [Fact]
    public async Task A_failing_achievement_evaluation_does_not_fail_an_already_committed_session_end()
    {
        var seed = SeedActiveSessionWithOneSeat();

        var handler = BuildHandler(seed.HostId, new ThrowingAchievementEvaluator());

        // Must NOT throw: the session end is already committed by the time the evaluator runs.
        await handler.Handle(
            new EndSessionCommand(seed.SessionId, [new FinalStackItem(seed.SeatId, 250m)]),
            CancellationToken.None);

        _ctx.ChangeTracker.Clear();
        var session = await _ctx.Sessions.FirstAsync(s => s.Id == seed.SessionId);
        Assert.Equal(SessionStatus.Finished, session.Status);
        // The money side of the request must be intact too — this is not just "no exception".
        Assert.Equal(1, await _ctx.CashOuts.CountAsync(c => c.SessionPlayerId == seed.SeatId));
    }

    [Fact]
    public async Task A_failing_achievement_evaluation_is_logged_rather_than_swallowed_silently()
    {
        // "Doesn't throw" is only half the requirement. A bare `catch { }` would satisfy the test
        // above while making a broken evaluator completely invisible — nobody would ever learn that
        // players stopped receiving achievements. The failure must leave a record carrying the
        // exception itself, or it is undiagnosable.
        var seed = SeedActiveSessionWithOneSeat();
        var logger = new CapturingLogger<EndSessionCommandHandler>();

        await BuildHandler(seed.HostId, new ThrowingAchievementEvaluator(), logger: logger)
            .Handle(new EndSessionCommand(seed.SessionId, [new FinalStackItem(seed.SeatId, 250m)]),
                CancellationToken.None);

        var entry = Assert.Single(logger.Entries, e => e.Level == LogLevel.Error);
        Assert.IsType<DbUpdateException>(entry.Exception);
        Assert.Contains(seed.SessionId.ToString(), entry.Message);
    }

    [Fact]
    public async Task A_successful_evaluation_still_notifies_the_player_of_each_unlock()
    {
        // The guard must not quietly break the feature it protects. Defaulting the key list to
        // empty on failure is only correct if the SUCCESS path still carries the evaluator's keys
        // through to the notification block below it.
        // "first_win" is part of the seeded catalog (EnsureCreated applies the HasData rows), so the
        // notification body is looked up from the real seed rather than a fixture: name pinned to
        // the literal the user would actually see.
        var seed = SeedActiveSessionWithOneSeat();

        var notifications = new RecordingNotifications();
        await BuildHandler(seed.HostId, new StubAchievementEvaluator("first_win"), notifications)
            .Handle(new EndSessionCommand(seed.SessionId, [new FinalStackItem(seed.SeatId, 250m)]),
                CancellationToken.None);

        Assert.Contains(notifications.Sent, s => s.Type == NotificationType.AchievementUnlocked && s.Body == "Winner");
    }
}
