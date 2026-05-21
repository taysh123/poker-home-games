using PokerApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using PokerApp.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddResponseCompression(opts => opts.EnableForHttps = true);

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy
                .WithOrigins(
                    "https://poker-home-games-three.vercel.app"
                )
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});

// Database
builder.Services.AddInfrastructure(builder.Configuration);

// Railway PORT binding
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

app.UseResponseCompression();

app.UseRouting();

app.UseCors("AllowFrontend");

// Health endpoint
app.MapGet("/health", () => Results.Ok("Healthy"));

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthorization();

app.MapControllers();

// Auto migrations
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    try
    {
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        Console.WriteLine(ex.Message);
    }
}

app.Run();