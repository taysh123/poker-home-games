using System;
using PokerApp.Application.Common;
using PokerApp.Domain.Enums;
using Xunit;

namespace PokerApp.Tests;

public class SubscriptionStoreParserTests
{
    [Theory]
    [InlineData("apple", SubscriptionStore.Apple)]
    [InlineData("google", SubscriptionStore.Google)]
    [InlineData("stripe", SubscriptionStore.Stripe)]
    [InlineData("revenuecat", SubscriptionStore.RevenueCat)]
    [InlineData("APPLE", SubscriptionStore.Apple)]
    [InlineData(" Stripe ", SubscriptionStore.Stripe)]
    public void Parses_known_stores(string input, SubscriptionStore expected)
    {
        Assert.True(SubscriptionStoreParser.TryParse(input, out var s));
        Assert.Equal(expected, s);
        Assert.True(SubscriptionStoreParser.IsValid(input));
        Assert.Equal(expected, SubscriptionStoreParser.Parse(input));
    }

    [Theory]
    [InlineData("paypal")]
    [InlineData("")]
    [InlineData(null)]
    public void Rejects_unknown_stores(string? input)
    {
        Assert.False(SubscriptionStoreParser.TryParse(input, out _));
        Assert.False(SubscriptionStoreParser.IsValid(input));
        Assert.Throws<ArgumentException>(() => SubscriptionStoreParser.Parse(input));
    }
}
