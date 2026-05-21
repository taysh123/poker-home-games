using MediatR;

namespace PokerApp.Application.Features.Users.Queries.GetMyAchievements;

public sealed record GetMyAchievementsQuery : IRequest<MyAchievementsDto>;
