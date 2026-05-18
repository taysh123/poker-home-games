# Backend Architecture — PokerApp

## Solution Structure

```
src/
├── PokerApp.API/            # HTTP layer: controllers, middleware, DI, Program.cs
├── PokerApp.Application/    # Business logic: commands, queries, validators, DTOs
├── PokerApp.Domain/         # Core domain: entities, enums (no framework dependencies)
└── PokerApp.Infrastructure/ # Data access: EF Core, migrations, repositories
```

Dependency direction (inner layers never depend on outer):
```
Domain  ←  Application  ←  Infrastructure
                ↑
               API
```

---

## Domain Layer (`PokerApp.Domain`)

Pure C# records and classes. No EF Core, no ASP.NET, no MediatR.

**Entities:**

| Entity | Purpose |
|--------|---------|
| `User` | Player account — email, username, Google ID, refresh tokens |
| `Group` | Poker group — name, owner, members |
| `GroupMember` | Join table: User ↔ Group with role (Owner/Admin/Member) |
| `GroupInvitation` | Pending invite with expiry |
| `Session` | Poker cash game — group, status, blinds, chip ratio |
| `SessionPlayer` | Player in a session — buy-ins, cash-out, final balance |
| `BuyIn` | A single buy-in or rebuy transaction |
| `CashOut` | A cash-out transaction |
| `Settlement` | A payment record: payer → receiver, amount, status |
| `RefreshToken` | JWT refresh token with expiry and revocation flag |
| `BaseEntity` | `Id` (Guid), `CreatedAt`, `UpdatedAt` |

---

## Application Layer (`PokerApp.Application`)

CQRS via MediatR. Each feature folder contains:
- `Commands/` — state-mutating operations (POST/PUT/DELETE)
- `Queries/` — read operations (GET)

Each command/query has:
- `*Command.cs` / `*Query.cs` — the MediatR request record
- `*CommandHandler.cs` / `*QueryHandler.cs` — the handler
- `*CommandValidator.cs` — FluentValidation rules (commands only)
- `*Response.cs` / `*Dto.cs` — typed return types

**Features:**

| Feature | Commands | Queries |
|---------|---------|---------|
| Auth | Login, Register, Logout, RefreshToken, GoogleLogin | GetCurrentUser |
| Groups | CreateGroup, UpdateGroup, InviteUser, AcceptInvitation, DeclineInvitation, LeaveGroup, RemoveMember | GetMyGroups, GetGroupById, GetGroupMembers, GetMyInvitations |
| Sessions | CreateSession, StartSession, EndSession, AddPlayer, RemovePlayer, AddBuyIn, AddCashOut | GetGroupSessions, GetSessionById, GetSessionBalances |
| Settlements | CalculateSettlements, MarkSettlementPaid | GetSessionSettlements |
| Users | — | GetMyStats |

**Adding a new feature:**
1. Create folder `Features/MyFeature/Commands/MyCommand/`
2. Add `MyCommand.cs` (record implementing `IRequest<TResponse>`)
3. Add `MyCommandHandler.cs` (implementing `IRequestHandler<MyCommand, TResponse>`)
4. Add `MyCommandValidator.cs` (inheriting `AbstractValidator<MyCommand>`)
5. Register nothing — MediatR and FluentValidation scan by convention (see `DependencyInjection.cs`)

---

## Infrastructure Layer (`PokerApp.Infrastructure`)

**`AppDbContext.cs`** — EF Core DbContext with all DbSet<T> properties.

**`Configurations/`** — One `IEntityTypeConfiguration<T>` per entity. Keeps entity
mapping out of the DbContext and organises indexes, FK constraints, and column types.

**`Migrations/`** — EF Core migrations. Generate with:
```powershell
cd src/PokerApp.Infrastructure
dotnet ef migrations add MyMigration --startup-project ../PokerApp.API
dotnet ef database update --startup-project ../PokerApp.API
```

---

## API Layer (`PokerApp.API`)

**`Program.cs` — middleware pipeline order (IMPORTANT):**
```csharp
app.UseCors("Dev");                        // 1st — CORS headers on ALL responses
app.UseMiddleware<ExceptionHandlingMiddleware>(); // 2nd — catches exceptions
app.UseHttpsRedirection();                 // (prod only)
app.UseAuthentication();                   // JWT validation
app.UseAuthorization();                    // [Authorize] enforcement
app.MapControllers();
```

CORS must be before the exception middleware so CORS headers are present on error
responses. If reversed, browser CORS errors mask the real HTTP status codes.

**Controllers** — thin. No business logic. Only:
1. Extract user identity: `User.FindFirstValue(ClaimTypes.NameIdentifier)`
2. Build command/query from request body + route params
3. `await _mediator.Send(command)`
4. Return appropriate HTTP status code

**`ExceptionHandlingMiddleware.cs`** — maps domain exceptions to HTTP status codes:

| Exception | HTTP |
|-----------|------|
| `NotFoundException` | 404 |
| `BadRequestException` | 400 |
| `ValidationException` | 400 + field errors |
| `ConflictException` | 409 |
| `UnauthorizedException` | 401 |
| `UnauthorizedAccessException` | 403 |
| anything else | 500 + TraceId |

---

## Auth Flow

```
POST /api/auth/register or /api/auth/login
  → LoginCommandHandler / RegisterCommandHandler
  → validate credentials / create user
  → generate accessToken (JWT, 15 min) + refreshToken (30 days, stored in DB)
  → return { accessToken, refreshToken, userId, username, email }

POST /api/auth/refresh
  → find refresh token in DB → validate not expired, not revoked
  → rotate: revoke old, issue new pair
  → return new { accessToken, refreshToken }

POST /api/auth/logout  [Authorize]
  → revoke refresh token in DB
```

JWT claims: `sub` (userId), `email`, `username`.
Controllers extract `userId` with `User.FindFirstValue(ClaimTypes.NameIdentifier)`.

---

## Development Checklist

- Run backend: `dotnet run --launch-profile http` from `src/PokerApp.API`
- Swagger UI: `http://localhost:5062/swagger`
- Build check: `dotnet build PokerApp.sln` from repo root
- DB connection: set `DefaultConnection` in `appsettings.Development.json`
- Never commit production secrets — use environment variables or user-secrets in prod
