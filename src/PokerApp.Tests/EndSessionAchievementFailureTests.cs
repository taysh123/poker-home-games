using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Xunit;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Sessions.Commands.EndSession;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;
using PokerApp.Infrastructure.Services;

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
/// This shares PR #74's shape — an unmapped DB exception surfacing as a bare 500 on a user-critical
/// path — with the difference that there the PRIMARY operation failed, while here the request had
/// already committed. (An earlier version of this comment also named PR #78 and called all three
/// "the same defect class"; PR #78 is a data-integrity omission with no 500 and no best-effort step,
/// so that comparison did not survive checking and was removed.)
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

    /// <summary>
    /// The real-world failure: a unique-index race inside the evaluator's own SaveChanges. The
    /// index name is the one the migration actually creates (`IX_UserAchievements_UserId_Key` over
    /// (UserId, AchievementKey)) — a fixture that claims to reproduce a production failure should
    /// not invent an identifier that greps to nothing.
    /// </summary>
    private sealed class ThrowingAchievementEvaluator : IAchievementEvaluator
    {
        public Task<IReadOnlyList<string>> EvaluateAsync(Guid userId, Guid sessionId, CancellationToken ct)
            => throw new DbUpdateException("duplicate key value violates unique constraint \"IX_UserAchievements_UserId_Key\"");
    }

    /// <summary>
    /// Models the real shape: the caller hangs up WHILE the post-commit tail is running (the session
    /// end has already committed with a live token), so the request token is cancelled and the
    /// in-flight work throws. Cancelling the token up front instead would fail the session-end
    /// SaveChanges and never reach the tail at all.
    /// </summary>
    private sealed class CancellingAchievementEvaluator(CancellationTokenSource cts) : IAchievementEvaluator
    {
        public Task<IReadOnlyList<string>> EvaluateAsync(Guid userId, Guid sessionId, CancellationToken ct)
        {
            cts.Cancel();
            throw new OperationCanceledException(cts.Token);
        }
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
        public readonly List<(LogLevel Level, string Message, Exception? Exception,
            IReadOnlyList<KeyValuePair<string, object?>> State)> Entries = [];

        IDisposable? ILogger.BeginScope<TState>(TState state) => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
            // `state` is captured as well as the flattened message: the point of this log is the
            // STRUCTURED SessionId, and asserting only the formatted string lets a refactor to an
            // interpolated string silently destroy every named property while staying green.
            => Entries.Add((logLevel, formatter(state, exception), exception,
                state as IReadOnlyList<KeyValuePair<string, object?>> ?? []));
    }

    /// <summary>
    /// Writes rows and saves on the SHARED context, exactly as the real NotificationService does
    /// (`NotificationService(AppDbContext context, ...)` → `Notifications.AddAsync` →
    /// `SaveChangesAsync`). That shared save is what a poisoned change tracker destroys, so a fake
    /// that only records in memory cannot express this defect.
    /// </summary>
    private sealed class DbWritingNotifications(AppDbContext ctx) : INotificationService
    {
        public async Task NotifyAsync(Guid userId, NotificationType type, string title, string body,
            Guid? relatedEntityId = null, CancellationToken ct = default)
        {
            await ctx.Notifications.AddAsync(Notification.Create(userId, type, title, body, relatedEntityId), ct);
            await ctx.SaveChangesAsync(ct);
        }

        public async Task NotifyManyAsync(IEnumerable<Guid> userIds, NotificationType type, string title,
            string body, Guid? relatedEntityId = null, CancellationToken ct = default)
        {
            foreach (var id in userIds)
                await ctx.Notifications.AddAsync(Notification.Create(id, type, title, body, relatedEntityId), ct);
            await ctx.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Fails any SaveChanges carrying a new UserAchievement row — a deterministic stand-in for the
    /// unique-index race that does not require winning a real one. It targets ONLY the evaluator's
    /// own save, so the handler's session-end commit and the notification writes are untouched.
    /// </summary>
    private sealed class FailAchievementWritesInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
        {
            if (eventData.Context!.ChangeTracker.Entries<UserAchievement>().Any(e => e.State == EntityState.Added))
                throw new DbUpdateException("simulated unique-index race on IX_UserAchievements_UserId_Key");
            return base.SavingChangesAsync(eventData, result, ct);
        }
    }

    private AppDbContext NewContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options);

    private AppDbContext NewContextWithFailingAchievementWrites() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_conn)
            .AddInterceptors(new FailAchievementWritesInterceptor())
            .Options);

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
        // The STRUCTURED property, not just the rendered string: an interpolated-string refactor
        // would keep the message readable while destroying every queryable field in Railway's logs.
        Assert.Contains(entry.State, kv => kv.Key == "SessionId" && Equals(kv.Value, seed.SessionId));
    }

    [Fact]
    public async Task A_cancelled_evaluation_is_not_reported_as_a_server_error()
    {
        // The tail runs AFTER the response's work is committed, so a mobile client backgrounding
        // the app right after the End Game tap cancels the token here routinely. Logging that at
        // Error contradicts the severity rule this handler's own middleware adopted in T0.2
        // ("severity follows the mapped status... only the unmapped 5xx branch is a server fault")
        // and would page on a user closing the app. Swallowing stays correct — the end is committed.
        var seed = SeedActiveSessionWithOneSeat();
        var logger = new CapturingLogger<EndSessionCommandHandler>();
        using var cts = new CancellationTokenSource();

        await BuildHandler(seed.HostId, new CancellingAchievementEvaluator(cts), logger: logger)
            .Handle(new EndSessionCommand(seed.SessionId, [new FinalStackItem(seed.SeatId, 250m)]), cts.Token);

        Assert.DoesNotContain(logger.Entries, e => e.Level == LogLevel.Error);
        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Information);
    }

    [Fact]
    public async Task A_failed_achievement_write_does_not_destroy_the_other_players_session_ended_notification()
    {
        // THE REGRESSION PIN, and the reason the fix lives in AchievementEvaluator rather than here.
        // The evaluator shares the REQUEST'S DbContext with the handler and NotificationService, and
        // EF does not revert the change tracker when SaveChanges fails. Once EndSession began
        // SWALLOWING the evaluator's exception (this slice) instead of dying on it, the request
        // carried on with the failed UserAchievement rows still tracked as Added — so
        // NotificationService's own SaveChanges re-attempted them, threw again, and every other
        // player's "session ended" notification was lost. Swapping a 500 for silent notification
        // loss is not a fix, so the evaluator now detaches what it queued before rethrowing.
        //
        // Uses the REAL AchievementEvaluator (the fix is inside it, so a fake evaluator would prove
        // nothing) and a notification service that saves on the same context, like the real one.
        var host = User.Create("host", "host@example.com", "hash");
        var other = User.Create("other", "other@example.com", "hash");
        Guid sessionId, hostSeatId;
        using (var seedCtx = NewContext())
        {
            seedCtx.Users.AddRange(host, other);
            var session = Session.Create("Friday night", host.Id);
            session.Start();
            seedCtx.Sessions.Add(session);
            var hostSeat = SessionPlayer.CreateForUser(session.Id, host.Id);
            var otherSeat = SessionPlayer.CreateForUser(session.Id, other.Id);
            seedCtx.SessionPlayers.AddRange(hostSeat, otherSeat);
            seedCtx.BuyIns.Add(BuyIn.Create(session.Id, hostSeat.Id, 100m));
            seedCtx.BuyIns.Add(BuyIn.Create(session.Id, otherSeat.Id, 100m));
            seedCtx.SaveChanges();
            (sessionId, hostSeatId) = (session.Id, hostSeat.Id);
        }

        using var ctx = NewContextWithFailingAchievementWrites();
        var handler = new EndSessionCommandHandler(
            ctx, new FakeCurrentUser(host.Id),
            new AchievementEvaluator(ctx),                 // the REAL evaluator
            new DbWritingNotifications(ctx),
            new CapturingLogger<EndSessionCommandHandler>());

        await handler.Handle(
            new EndSessionCommand(sessionId, [new FinalStackItem(hostSeatId, 250m)]),
            CancellationToken.None);

        using var check = NewContext();
        // The achievement write failed and stayed failed — no row leaked in on someone else's commit.
        Assert.Equal(0, await check.UserAchievements.CountAsync());
        // ...and the OTHER player still learned the game ended. This is what the poisoning destroyed.
        Assert.True(await check.Notifications.AnyAsync(n => n.UserId == other.Id && n.Type == NotificationType.SessionEnded));
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
