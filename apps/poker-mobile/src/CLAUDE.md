# Frontend Architecture — poker-mobile/src

## Directory Map

```
src/
├── api/           # Typed Axios wrappers — one file per backend resource
├── components/    # Shared UI components
├── context/       # React contexts (auth session)
├── hooks/         # Custom React hooks
├── navigation/    # Navigation stack definition
├── screens/       # One file per screen — owns its own state + data fetching
├── theme/         # Design tokens (colors)
└── utils/         # Pure helper modules
```

---

## api/

Each file creates its own `axios` instance with `baseURL = API_BASE_URL` and
`Content-Type: application/json`. Functions accept a `token` argument and attach it
as `Authorization: Bearer <token>`.

| File | Resource |
|------|---------|
| `config.ts` | Exports `API_BASE_URL` — `localhost:5062` on web, LAN IP on mobile |
| `authApi.ts` | `/api/auth/*` — login, register, logout, google |
| `groupsApi.ts` | `/api/groups/*` — list, create, detail, members |
| `sessionsApi.ts` | `/api/sessions/*` and `/api/groups/:id/sessions` |
| `settlementsApi.ts` | `/api/settlements/*` — calculate, list, mark paid |
| `statsApi.ts` | `/api/auth/stats` — user lifetime statistics |

**Pattern for authenticated calls:**
```typescript
const token = await SecureStore.getItemAsync('accessToken'); // via storage.ts
if (!token) return;
const data = await getSomeResource(token, ...args);
```

---

## context/AuthContext.tsx

Provides `{ user, isLoading, login, register, googleLogin, logout }` to the whole app.

**Session lifecycle:**
1. On startup: `restoreSession()` reads `user` from storage → if found, sets state
2. On login/register: calls API → `saveSession()` → `setUser()` first (drives navigation),
   then persists tokens to storage best-effort (failure doesn't block navigation)
3. On logout: calls `/api/auth/logout` server-side, then `clearSession()` → `setUser(null)`
4. AppNavigator renders auth screens when `user === null`, app screens otherwise

---

## utils/storage.ts

Platform-aware key-value storage wrapper with the same async API as `expo-secure-store`.

- **Web**: delegates to `localStorage` (expo-secure-store's native bindings don't work in browsers)
- **Native**: delegates to `expo-secure-store` (encrypted Keychain/Keystore)

All files that need token persistence import from here — never import `expo-secure-store` directly.

```typescript
import * as SecureStore from '../utils/storage'; // not 'expo-secure-store'
```

---

## hooks/

| File | Purpose |
|------|---------|
| `useGoogleAuth.ts` | Wraps `expo-auth-session` Google OAuth. Returns `{ prompt, ready }`. Disabled on web (no `webClientId`). |

---

## navigation/AppNavigator.tsx

Two trees branched on `user === null` — but the logged-out tree is a **full guest
experience**, not a login wall:

**Guest tree** (`user === null`):
- Onboarding (first run only) → `GuestTabNavigator` (route name `MainTabs`)
- Guest tabs: GuestHome | LocalSessions | GroupsAuthGate | GuestStats
- Local game screens: LocalNewGame, LocalSession, LocalSessionSummary
- Login/Register pushed as dismissible modals; JoinSession/JoinGroup show a
  "Sign in to join" CTA that stashes a pending invite (`utils/pendingInvite.ts`)
  and resumes the join after login

**Authed tree** (`user !== null`): `TabNavigator` (Home | AllSessions | GroupsList | Stats)
+ all server-backed deep screens + the same local game screens (a guest who logs in
mid-game can still reach their local game).

Both tab navigators share `tabScreenOptions` and render `LiveGameBar` (which unions
server `activeSession` with the local `activeGame` — server wins).

React Navigation automatically swaps trees when `user` changes — no manual `navigation.replace()` needed. Logout lands on guest Home.

---

## screens/

Each screen is self-contained. It owns:
- Local state (loading, error, data)
- Token read from storage
- API call on mount (or `useFocusEffect`)
- Navigation actions

**Screens inventory:**

| Screen | Route | Tab? | Purpose |
|--------|-------|------|---------|
| `LoginScreen` | Login | — | Email/password sign-in |
| `RegisterScreen` | Register | — | New account creation |
| `HomeScreen` | Home | ✅ Tab 1 | Dashboard: active sessions, quick stats, groups |
| `AllSessionsScreen` | AllSessions | ✅ Tab 2 | All sessions across groups (active first, then recent) |
| `GroupsListScreen` | GroupsList | ✅ Tab 3 | All user groups |
| `StatsScreen` | Stats | ✅ Tab 4 | Lifetime P&L, win/loss record, session history |
| `CreateGroupScreen` | CreateGroup (modal) | — | New group form |
| `GroupDetailScreen` | GroupDetail | — | Group info, members, leaderboard, activity |
| `InvitationsScreen` | Invitations | — | Accept/decline group invites |
| `EditGroupScreen` | EditGroup (modal) | — | Edit group name/description |
| `SessionsListScreen` | SessionsList | — | Sessions in a group |
| `CreateSessionScreen` | CreateSession (modal) | — | New session form |
| `SessionScreen` | Session | — | Unified live + finished session (Draft/Active/Finished adaptive) |
| `SettlementScreen` | Settlement | — | Who owes who, mark paid |
| `ProfileScreen` | Profile | — | Edit profile, change password, delete account |
| `SplashScreen` | — | — | Initial loading screen |
| `GuestHomeScreen` | (guest) Home | ✅ Tab 1 | Guest dashboard: start/resume local game, recent games, sign-in upsell |
| `LocalSessionsScreen` | (guest) AllSessions | ✅ Tab 2 | Local games list (live first) |
| `GroupsAuthGateScreen` | (guest) GroupsList | ✅ Tab 3 | Premium sign-in gate for Groups |
| `GuestStatsScreen` | (guest) Stats | ✅ Tab 4 | Table stats from local games + upsell |
| `LocalNewGameScreen` | LocalNewGame | — | 3-step local game wizard (both trees) |
| `LocalSessionScreen` | LocalSession | — | Live local game: buy-ins/cash-outs, undo, end flow with final stacks |
| `LocalSessionSummaryScreen` | LocalSessionSummary | — | Results, cash settlement pairs, confetti, delete |

---

## local/ — guest game engine

| File | Purpose |
|------|---------|
| `types.ts` | `LocalGame`/`LocalPlayer`/`LocalTxn` — amounts are ALWAYS integer cents |
| `settlements.ts` | TS port of backend `SettlementCalculatorService.cs` — keep in sync; pinned by Jest fixtures |
| `localGamesStore.ts` | Pure mutations + AsyncStorage persistence (`tpoker.localGames.v1`), corrupt-data quarantine |
| `localStats.ts` | Table-level stats from finished local games |
| `__tests__/` | Jest suites (run `npx jest` before committing) |

State lives in `context/LocalGamesContext.tsx` (max one Active game, serialized writes).

---

## theme/colors.ts

All colors are defined here. Never hardcode hex values in component files.

| Token | Value | Use |
|-------|-------|-----|
| `background` | `#0F1923` | Screen backgrounds |
| `surface` | `#1A2535` | Cards, inputs |
| `surfaceHigh` | `#1E2D3D` | Raised surfaces, avatar |
| `border` | `#243447` | Card borders, dividers |
| `gold` | `#C9A84C` | Primary accent, buttons |
| `goldLight` | `#E8C97A` | Highlighted amounts |
| `text` | `#FFFFFF` | Primary text |
| `textMuted` | `#7A8A99` | Labels, secondary text |
| `textDim` | `#3A4A5A` | Placeholders, disabled |
| `error` | `#E74C3C` | Error states |
| `success` | `#27AE60` | Positive outcomes |

---

## components/

| File | Purpose |
|------|---------|
| `ActionSheet.tsx` | Bottom sheet with options; glass card on iOS |
| `AppTextInput.tsx` | Labeled input with focus/error states, prefix, hint |
| `Badge.tsx`, `EmptyState.tsx`, `FormRow.tsx`, `SectionCard.tsx` | Small layout/labels |
| `GoogleAuthButton.tsx` | "Continue with Google" — native only until `webClientId` configured |
| `GroupListItem.tsx`, `SessionListItem.tsx` | List rows (LIVE pill, W/L/E badges) |
| `PrimaryButton.tsx` | Gold/outline/danger button — internally a `PressableScale` (spring + haptic) |
| `SkeletonCard.tsx`, `SkeletonRow.tsx` | Loading placeholders with `Shimmer` sweep |
| `StatWidget.tsx`, `RecapCard.tsx`, `Toast.tsx`, `LoadingScreen.tsx` | Stats/feedback |
| `StepIndicator.tsx`, `GuestNameInput.tsx` | Extracted wizard pieces shared by NewGame + LocalNewGame |

### components/motion/ — Reanimated 4 primitives

| File | Purpose |
|------|---------|
| `PressableScale.tsx` | Base touchable: spring press-scale + optional haptic |
| `Shimmer.tsx` | Gradient sweep for skeletons (opacity pulse on web) |
| `AnimatedNumber.tsx` | rAF count-up for money values |
| `GlassView.tsx` | iOS blur surface; solid fallback elsewhere. Static chrome only |
| `Celebration.tsx` | Confetti burst on game end; auto-unmounts |

**Web caveat:** `Alert.alert` is a no-op on react-native-web — use `utils/confirm.ts` for confirmations that must work on web.

---

## Adding a New Screen

1. Add the route name + params to `RootStackParamList` in `AppNavigator.tsx`
2. Add `<Stack.Screen>` inside the appropriate stack (auth or app)
3. Create `src/screens/MyNewScreen.tsx`
4. If it needs auth: read token from `storage.getItemAsync('accessToken')`
5. Create or reuse an API function in `src/api/`
