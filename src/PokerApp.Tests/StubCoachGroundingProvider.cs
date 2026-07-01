using System;
using System.Collections.Generic;
using System.Linq;
using PokerApp.Application.Common.Interfaces;

namespace PokerApp.Tests;

/// <summary>
/// Test double for <see cref="ICoachGroundingProvider"/> returning a fixed set of assertions (honoring the max cap),
/// so provider tests don't depend on the real embedded dataset. <see cref="Empty"/> returns nothing.
/// </summary>
internal sealed class StubCoachGroundingProvider(IReadOnlyList<string> assertions) : ICoachGroundingProvider
{
    public static readonly StubCoachGroundingProvider Empty = new(Array.Empty<string>());

    public IReadOnlyList<string> SelectAssertions(CoachAnalysisInput input, int max = 5)
        => assertions.Count <= max ? assertions : assertions.Take(max).ToList();
}
