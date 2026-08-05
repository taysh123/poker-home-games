using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Persistence;

namespace PokerApp.Infrastructure.Services;

public class AchievementEvaluator(AppDbContext context) : IAchievementEvaluator
{
    public async Task<IReadOnlyList<string>> EvaluateAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken)
    {
        // Load already earned achievements
        var alreadyEarned = (await context.UserAchievements
            .AsNoTracking()
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AchievementKey)
            .ToListAsync(cancellationToken))
            .ToHashSet();

        // Load user's session players
        var sessionPlayers = await context.SessionPlayers
            .AsNoTracking()
            .Where(sp => sp.UserId == userId)
            .Select(sp => new { sp.Id, sp.SessionId })
            .ToListAsync(cancellationToken);

        var sessionIds = sessionPlayers.Select(x => x.SessionId).ToList();
        var spIdBySession = sessionPlayers.ToDictionary(x => x.SessionId, x => x.Id);

        // Load finished sessions (desc by CreatedAt)
        var finishedSessions = await context.Sessions
            .AsNoTracking()
            .Where(s => sessionIds.Contains(s.Id) && s.Status == SessionStatus.Finished)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        if (finishedSessions.Count == 0) return [];

        // Load buy-ins and cash-outs
        var buyIns = await context.BuyIns
            .AsNoTracking()
            .Where(b => sessionIds.Contains(b.SessionId))
            .Select(b => new { b.SessionId, b.SessionPlayerId, b.UserId, b.Amount })
            .ToListAsync(cancellationToken);

        var cashOuts = await context.CashOuts
            .AsNoTracking()
            .Where(c => sessionIds.Contains(c.SessionId))
            .Select(c => new { c.SessionId, c.SessionPlayerId, c.UserId, c.Amount })
            .ToListAsync(cancellationToken);

        decimal GetProfit(Guid sid)
        {
            var spId = spIdBySession.GetValueOrDefault(sid);
            var totalIn = buyIns
                .Where(b => b.SessionId == sid && (b.SessionPlayerId == spId || (b.SessionPlayerId == null && b.UserId == userId)))
                .Sum(b => b.Amount);
            var totalOut = cashOuts
                .Where(c => c.SessionId == sid && (c.SessionPlayerId == spId || (c.SessionPlayerId == null && c.UserId == userId)))
                .Sum(c => c.Amount);
            return totalOut - totalIn;
        }

        var profits = finishedSessions.Select(s => GetProfit(s.Id)).ToList();
        var totalPL = profits.Sum();
        var winsCount = profits.Count(p => p > 0);
        var sessionCount = finishedSessions.Count;

        // Current win streak
        var currentStreak = 0;
        for (var i = 0; i < profits.Count; i++)
        {
            var p = profits[i];
            if (p == 0) break;
            if (i == 0) { currentStreak = p > 0 ? 1 : -1; }
            else if (currentStreak > 0 && p > 0) currentStreak++;
            else break;
        }

        // The just-ended session
        var latestSession = finishedSessions[0];
        var latestProfit = profits[0];

        // Buy-ins count for user in the just-ended session
        var latestSpId = spIdBySession.GetValueOrDefault(sessionId);
        var buyInsForSession = buyIns
            .Count(b => b.SessionId == sessionId && (b.SessionPlayerId == latestSpId || (b.SessionPlayerId == null && b.UserId == userId)));

        // Hand records count across all sessions
        var handCount = await context.HandRecords
            .AsNoTracking()
            .Where(h => sessionIds.Contains(h.SessionId))
            .CountAsync(cancellationToken);

        // Group membership count
        var groupCount = await context.GroupMembers
            .AsNoTracking()
            .CountAsync(gm => gm.UserId == userId, cancellationToken);

        // Session duration
        var durationHours = latestSession.EndedAt.HasValue && latestSession.StartedAt.HasValue
            ? (latestSession.EndedAt.Value - latestSession.StartedAt.Value).TotalHours
            : 0;

        // Evaluate criteria
        var newly = new List<string>();

        void Award(string key)
        {
            if (!alreadyEarned.Contains(key))
                newly.Add(key);
        }

        if (sessionCount >= 1) Award("first_session");
        if (sessionCount >= 10) Award("ten_sessions");
        if (sessionCount >= 50) Award("fifty_sessions");
        if (winsCount >= 1) Award("first_win");
        if (currentStreak >= 5) Award("five_win_streak");
        if (totalPL >= 100) Award("profit_100");
        if (totalPL >= 1000) Award("profit_1000");
        if (totalPL >= 5000) Award("profit_5000");
        if (durationHours >= 4) Award("marathon");
        if (buyInsForSession >= 3) Award("triple_rebuy");
        if (latestProfit == 0) Award("cash_out_even");
        if (handCount >= 10) Award("hand_historian");
        if (groupCount >= 1) Award("first_group");

        // Comeback: second-to-last was a loss >= 200 and latest was a win
        if (profits.Count >= 2 && latestProfit > 0 && profits[1] <= -200)
            Award("comeback");

        if (newly.Count == 0) return [];

        foreach (var key in newly)
        {
            var ua = UserAchievement.Create(userId, key);
            await context.UserAchievements.AddAsync(ua, cancellationToken);
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // MY FAILURE MUST STAY MINE. This evaluator shares the REQUEST'S DbContext — DI resolves
            // IApplicationDbContext to the same scoped AppDbContext that EndSessionCommandHandler
            // and NotificationService hold (DependencyInjection.cs: "the DI container resolves the
            // same scoped instance"). EF does NOT revert the change tracker when SaveChanges fails,
            // so without this the rows queued above stay Added and the NEXT SaveChanges in the
            // request — NotificationService writing its own rows — re-attempts them. Two proven
            // consequences, both discovered by the T0.3 review fleet once EndSession began swallowing
            // this exception instead of dying on it:
            //   · a unique-index race re-throws inside the notification path, so the "session ended"
            //     notification for every OTHER player is destroyed;
            //   · a TRANSIENT failure is worse — the row gets COMMITTED by that unrelated
            //     notification transaction, while EndSession has already logged it as not awarded.
            // Detaching leaves the caller's context exactly as it found it, so the rest of the
            // request proceeds untouched. The throw still propagates; the caller decides what it means.
            foreach (var entry in context.ChangeTracker.Entries<UserAchievement>()
                         .Where(e => e.State == EntityState.Added))
                entry.State = EntityState.Detached;
            throw;
        }

        return newly.AsReadOnly();
    }
}
