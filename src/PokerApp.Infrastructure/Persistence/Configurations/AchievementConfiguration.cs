using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Infrastructure.Persistence.Configurations;

public class AchievementConfiguration : IEntityTypeConfiguration<Achievement>
{
    public void Configure(EntityTypeBuilder<Achievement> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Key).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(300).IsRequired();
        builder.Property(x => x.IconKey).HasMaxLength(60).IsRequired();

        builder.HasIndex(x => x.Key).IsUnique().HasDatabaseName("IX_Achievements_Key");

        builder.ToTable("Achievements");

        builder.HasData(
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), Key = "first_session", Name = "First Blood", Description = "Complete your first session.", IconKey = "trophy-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), Key = "ten_sessions", Name = "Grinder", Description = "Play 10 sessions.", IconKey = "layers-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), Key = "fifty_sessions", Name = "Veteran", Description = "Play 50 sessions.", IconKey = "medal-outline", Rarity = AchievementRarity.Rare },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), Key = "first_win", Name = "Winner", Description = "Win your first session.", IconKey = "thumbs-up-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000005"), Key = "five_win_streak", Name = "Hot Streak", Description = "Win 5 sessions in a row.", IconKey = "flame-outline", Rarity = AchievementRarity.Rare },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000006"), Key = "profit_100", Name = "In the Black", Description = "Reach ₪100 in total profit.", IconKey = "trending-up-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000007"), Key = "profit_1000", Name = "High Roller", Description = "Reach ₪1,000 in total profit.", IconKey = "cash-outline", Rarity = AchievementRarity.Epic },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000008"), Key = "comeback", Name = "Comeback Kid", Description = "Lose big, then win the very next session.", IconKey = "refresh-outline", Rarity = AchievementRarity.Rare },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-000000000009"), Key = "marathon", Name = "Long Night", Description = "Play a session lasting 4+ hours.", IconKey = "time-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-00000000000a"), Key = "triple_rebuy", Name = "Reload", Description = "Rebuy 3+ times in a single session.", IconKey = "repeat-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-00000000000b"), Key = "cash_out_even", Name = "Breakeven Pro", Description = "Cash out exactly even.", IconKey = "remove-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-00000000000c"), Key = "hand_historian", Name = "Hand Tracker", Description = "Log 10 hand records.", IconKey = "document-text-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-00000000000d"), Key = "first_group", Name = "Social Poker", Description = "Join or create your first group.", IconKey = "people-outline", Rarity = AchievementRarity.Common },
            new Achievement { Id = Guid.Parse("10000000-0000-0000-0000-00000000000e"), Key = "profit_5000", Name = "Table Captain", Description = "Reach ₪5,000 in total profit.", IconKey = "star-outline", Rarity = AchievementRarity.Legendary }
        );
    }
}
