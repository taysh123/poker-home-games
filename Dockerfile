# ── Build ──────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /source

# Copy project files first — restores layer is cached unless .csproj files change
COPY PokerApp.sln ./
COPY src/PokerApp.API/PokerApp.API.csproj                      src/PokerApp.API/
COPY src/PokerApp.Application/PokerApp.Application.csproj      src/PokerApp.Application/
COPY src/PokerApp.Domain/PokerApp.Domain.csproj                src/PokerApp.Domain/
COPY src/PokerApp.Infrastructure/PokerApp.Infrastructure.csproj src/PokerApp.Infrastructure/

RUN dotnet restore src/PokerApp.API/PokerApp.API.csproj

# Copy source and publish
COPY src/ src/
RUN dotnet publish src/PokerApp.API/PokerApp.API.csproj \
    -c Release \
    --no-restore \
    -o /app/publish

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# .NET 8 container default — Railway routes to this port
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080

ENTRYPOINT ["dotnet", "PokerApp.API.dll"]
