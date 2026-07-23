# T Poker — Google Play Data Safety (submission record)

> ⛔ **SUPERSEDED (2026-07-23) — do NOT file from this document.** It was verified June 17,
> 2026, **before** consent-gated PostHog EU analytics shipped (PR #28), so its "no analytics
> SDK" scoping (§1.3) and four-data-type answer set (§5) are now **incomplete** — filing from
> it would UNDER-declare analytics and risk a repeat 2.3.6 rejection. File instead from
> **[release/store-data-safety.md](release/store-data-safety.md)**, which is PostHog-aware and
> carries the correct Google Play **and** Apple App Privacy grids, including the guest-vs-signed-in
> Data-Linked split and the Tracking=No reasoning. This file is kept only for its security/
> credential detail (§2); note also that the store category is now **Education**, not the
> "Lifestyle / Utilities" that §6 still names.

_Last verified: June 17, 2026 against the live codebase. Publisher (seller of record): **Tay Shofer**._

This was the code-grounded source for the Google Play **Data Safety** form **as of June 2026**;
it is now superseded (see banner above). Re-verify before each submission if auth, push, or
third-party integrations change.

---

## 1. Scoping facts that drive every answer

1. **Guest mode collects nothing.** Guest games (players, buy-ins, cash-outs,
   settlements) live only in on-device AsyncStorage and are never transmitted off the
   device. Google defines *collection* as data transmitted off the device, so **guest
   data is not declared**. Everything below applies **only to account users**.
2. **No "Sharing" anywhere.** Google excludes transfers to *service providers /
   processors acting on the developer's behalf* from "Sharing." T Poker's only third
   parties — **Railway** (PostgreSQL hosting), **Vercel** (web hosting), **Expo /
   exp.host** (push relay → FCM/APNs), **Google** (OAuth sign-in) — are all processors.
   There is no data selling, no ad network, no analytics broker. → **Shares = No** for
   every field.
3. **No analytics / crash / ads / tracking SDK.** `apps/poker-mobile/package.json`
   contains only Expo modules, React Navigation, axios, and Reanimated. → **App info
   and performance (Crash logs / Diagnostics / Other) = Not collected.**
4. **Nothing is processed ephemerally.** All collected data is persisted in
   PostgreSQL. → **Processed ephemerally = No** for every field.
5. **All collection is encrypted in transit** (HTTPS/TLS via Railway + Vercel).

---

## 2. Security / credential storage (verified in source)

| Credential | Algorithm | Where | Source file |
|---|---|---|---|
| Account password | **bcrypt** (BCrypt.Net-Next 4.2.0, work factor 12) | `User.PasswordHash` in PostgreSQL | `src/PokerApp.Infrastructure/Identity/PasswordHasher.cs` |
| Refresh token | **SHA-256** (hex) of 64 random bytes (512-bit entropy) | `RefreshToken.TokenHash` in PostgreSQL | `src/PokerApp.Infrastructure/Identity/JwtService.cs` |
| Access token | JWT, HMAC-SHA256 signed, 15-min expiry | not stored server-side | `JwtService.GenerateAccessToken` |

Plain-text passwords are never stored or logged. `PRIVACY.md`, `public/privacy.html`,
`docs/HANDOFF.md`, and `README.md` all state this correctly.

> **Note re: "password" as a Data Safety type** — Google's data-type taxonomy has no
> field for passwords/credentials collected solely for authentication, so password is
> not a separately declarable item. It is captured implicitly by the security answers
> below (encrypted in transit; hashed at rest).

---

## 3. Complete data inventory → Google category mapping

| What T Poker handles (account users) | Declared? | Google category → field |
|---|---|---|
| Username / display name | ✅ Collect | **Personal info → Name** |
| Email address (email sign-up + Google) | ✅ Collect | **Personal info → Email address** |
| App user GUID + Google account ID (`GoogleId`) | ✅ Collect | **Personal info → User IDs** |
| Groups, sessions, buy-ins, cash-outs, settlements, hand records, notes, achievements, avatar emoji/color | ✅ Collect | **App activity → Other user-generated content** |
| Expo push token + platform (native, opt-in only) | ✅ Collect | **Device or other IDs → Device or other IDs** |
| Password | ❌ no Data Safety field | hashed (bcrypt); see §2 |
| Location | ❌ No | — (no location permission/use) |
| Financial info | ❌ No | poker amounts are self-entered game records, not financial-account data; no payment processing (see §6) |
| Contacts | ❌ No | invites use the OS share sheet; app never reads contacts |
| Messages | ❌ No | in-app notifications/invites are system-generated, not user messaging |
| Photos/Video, Audio, Files, Calendar, Web history, Health | ❌ No | — |
| Crash logs / Diagnostics | ❌ No | no analytics/crash SDK |

---

## 4. Per-field detail

### Personal info → Name (username)
- **Collects:** Yes · **Shares:** No · **Ephemeral:** No
- **Purpose:** App functionality; Account management
- **Required:** Yes (required to create an account; the account itself is optional via guest mode)

### Personal info → Email address
- **Collects:** Yes · **Shares:** No · **Ephemeral:** No
- **Purpose:** App functionality; Account management
- **Required:** Yes (required to register)

### Personal info → User IDs (app GUID + Google ID)
- **Collects:** Yes · **Shares:** No · **Ephemeral:** No
- **Purpose:** App functionality; Account management; Fraud prevention, security & compliance (authentication)
- **Required:** Yes (auto-generated per account)

### App activity → Other user-generated content (all game/group records)
- **Collects:** Yes · **Shares:** No · **Ephemeral:** No
- **Purpose:** App functionality
- **Required:** Optional ("users can choose") — created only in a cloud account; fully avoidable in guest mode

### Device or other IDs → Device or other IDs (Expo push token + platform)
- **Collects:** Yes · **Shares:** No (Expo/FCM/APNs are delivery processors) · **Ephemeral:** No
- **Purpose:** App functionality (deliver notifications)
- **Required:** Optional ("users can choose") — collected only on iOS/Android after the user grants notification permission; declining leaves the in-app inbox fully working

---

## 5. Exact questionnaire answers (in Google's order)

**Data collection and security**
- *Does your app collect or share any of the required user data types?* → **Yes**
- *Is all of the user data collected by your app encrypted in transit?* → **Yes**
- *Do you provide a way for users to request that their data be deleted?* → **Yes**
  - In-app: **Profile → Delete Account** (immediate)
  - Deletion-request URL: `https://poker-home-games-three.vercel.app/privacy.html#delete`

**Data types — tick exactly these four, leave all others unticked**
- Personal info → ✅ Name, ✅ Email address, ✅ User IDs
- App activity → ✅ Other user-generated content
- Device or other IDs → ✅ Device or other IDs

**Per-type answers**

| Data type | Collected? | Shared? | Ephemeral? | Required/optional | Purposes |
|---|---|---|---|---|---|
| Name | Collected | Not shared | No | Required | App functionality, Account management |
| Email address | Collected | Not shared | No | Required | App functionality, Account management |
| User IDs | Collected | Not shared | No | Required | App functionality, Account management, Fraud prevention & security |
| Other user-generated content | Collected | Not shared | No | Optional | App functionality |
| Device or other IDs | Collected | Not shared | No | Optional | App functionality |

**Security practices**
- *Is your data encrypted in transit?* → **Yes**
- *Can users request that data be deleted?* → **Yes** (in-app + URL above)
- *Has your app been independently validated against a security standard?* → **No** (optional)
- *Committed to Google Play Families Policy?* → **No** (18+, not directed at children)

---

## 6. Classification decision to be aware of

**Financial info = No (deliberate).** The buy-in / cash-out / settlement amounts are
self-entered **scorekeeping**, not the user's bank or payment-account data, and no real
money moves through the app. Google's "Financial info" concerns a user's actual
financial accounts/payments. Declaring these as game records (App activity → Other
user-generated content) is correct and consistent with the store positioning
(**Lifestyle / Utilities, not Casino**). Be ready to repeat the reviewer note —
"scorekeeping and expense-settlement tool, no wagering, no real-money play, no payouts"
— if asked.
