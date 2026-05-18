using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using PokerApp.Application.Common.Behaviors;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Services;

namespace PokerApp.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly));

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));

        services.AddSingleton<ISettlementCalculator, SettlementCalculatorService>();

        return services;
    }
}
