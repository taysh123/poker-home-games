using Microsoft.EntityFrameworkCore;
using PokerApp.Domain.Entities;

namespace PokerApp.Application.Common.Interfaces;

// Abstracts EF Core's DbContext so Application handlers never reference Infrastructure.
// DbSet<T> is acceptable here: EF Core is a first-class .NET citizen and DbSet
// implements IQueryable, making handlers fully testable with in-memory providers.
public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<Group> Groups { get; }
    DbSet<GroupMember> GroupMembers { get; }
    DbSet<Session> Sessions { get; }
    DbSet<BuyIn> BuyIns { get; }
    DbSet<CashOut> CashOuts { get; }
    DbSet<Settlement> Settlements { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<GroupInvitation> GroupInvitations { get; }
    DbSet<SessionPlayer> SessionPlayers { get; }
    DbSet<HandRecord> HandRecords { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
