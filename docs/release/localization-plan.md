# T Poker — Localization Plan (English launch → Hebrew post-launch)

> **Status: PLAN ONLY — nothing here is built.** This is the blueprint for adding Hebrew as a
> post-launch update. T Poker launches **English-only**; this document scopes the later work honestly so
> it can be estimated, phased, and resourced. It is deliberately blunt about cost: **RTL is the largest
> part of the job — larger than translating the words.**
>
> Skills used to produce this: `superpowers:brainstorming` (explored the real codebase scope) →
> `superpowers:writing-plans` (file-level, honest, phased blueprint).

---

## 1. Decision & current state

- **Launch English-only. Add Hebrew later** as its own project, using this plan.
- **No i18n framework exists today.** Every UI string is a hard-coded English literal in JSX. There is
  **no** `react-i18next` / `i18n-js` / `react-intl` in the app.
- **What already helps:**
  - `expo-localization` is already a dependency (device locale/region detection available for free).
  - Currency/number formatting is **partially** centralized: `utils/money.ts` (`formatCents`), a
    `currencyPrefs` feature flag (OFF in prod ⇒ ₪ ILS default), `utils/currency.ts`, and some `Intl.`
    usage in a handful of screens. This is a head start on the *numbers* side, not the *words* side.
  - The design system is token-based (`theme/*`), so a global font/line-height swap for Hebrew is feasible
    in one place.
- **What does not exist:** any translation catalog, any `t('key')` indirection, any RTL handling, any
  language toggle, any Hebrew copy.

**Scale (measured, this branch):**
- ~**40 screen-level surfaces**: ~24 core screens in `src/screens/` + ~16 feature screens/components under
  `src/features/{study,coach,bankroll,premium,solver,mastery}/ui/`.
- **Directional styling is pervasive:** **145+** occurrences of physical-direction properties
  (`marginLeft/Right`, `paddingLeft/Right`, `left/right`, `textAlign`, `flexDirection`, `chevron-back`,
  `slide_from_right`) across **40+** files (HomeScreen alone: 43). Every one is a potential RTL fix.

---

## 2. Scope & honest cost

### a. i18n infrastructure

**Recommended library: `react-i18next` (on `i18next`).** Reasons: it is the mature standard, supports
**plurals and gendered/context variants** (Hebrew needs both — e.g. masculine/feminine verb forms,
dual/plural number forms), lazy-loads namespaces, and integrates cleanly with React. It pairs with
`expo-localization` for initial device-locale detection.

- **Lighter alternative:** `i18n-js` (fnando) + `expo-localization` — smaller, simpler, common in Expo
  apps, but weaker plural/gender handling. Acceptable for a small string set; **not** recommended given
  Hebrew's grammatical needs and ~40 surfaces.
- **Setup (small, ~2–3 days):**
  - `i18n/index.ts` initializes i18next with `en` (and later `he`) resource bundles, `fallbackLng: 'en'`,
    namespaces per area (`common`, `session`, `tournament`, `settlement`, `stats`, `groups`, `study`,
    `coach`, `paywall`, `onboarding`).
  - Wrap the app once in `App.tsx` with `I18nextProvider` (single touch-point).
  - A `useT()` thin wrapper over `useTranslation` so screens import one local hook.
- **Language toggle + persistence:** a picker in **`ProfileScreen`** (next to the existing currency
  picker pattern — there is already a `CurrencyPickerScreen` to mirror). Persist the chosen language via
  the existing `utils/storage` wrapper (key e.g. `tpoker.lang`); on startup read it, else fall back to
  `expo-localization` device locale, else `en`. A language change that flips RTL requires an app reload
  (see RTL below) — the toggle must warn + reload.

### b. String externalization

This is the **mechanical bulk**: extract every hard-coded English string into `en` translation files and
replace it with `t('namespace.key')`.

- **Scope:** ~40 screen surfaces + ~40 shared components (`src/components/**`) that contain copy. A rough
  order-of-magnitude is **~1,200–1,800 distinct strings** (titles, labels, buttons, empty states, toasts,
  helper text, validation messages, the canonical "The Final Count" copy, paywall benefit copy, onboarding
  slides, achievement names/descriptions, etc.). This is an estimate from file count × typical strings/
  screen, not a line count — a precise census is the first task of the real project.
- **Watch-outs (not just `<Text>`):**
  - Interpolated strings (`` `${player.name} cashed out ${formatCents(cents)}` ``) → ICU/i18next
    interpolation with **plurals** (`{{count}} player` vs `players`; Hebrew has more plural categories).
  - Strings passed as props (`title=`, `label=`, `subtitle=`, `placeholder=`), `confirmDialog`/`showToast`
    messages, `accessibilityLabel`s (must also be translated for VoiceOver/TalkBack).
  - Backend-originated strings: notification titles/bodies, achievement catalog (seeded in C#),
    settlement/recap narrative strings. Decide per-string: translate **client-side by key** (preferred —
    backend sends a key + params) vs translating on the server. The achievement catalog and notification
    copy are the main server-side English today.
  - Content packs (study lessons/quizzes under `content/`) are a large separate body of **prose** — treat
    as Phase 2+ (translate as content, not UI strings).
- **Effort:** ~**1.5–2.5 weeks** of careful, mostly-mechanical work + review. Best done area-by-area
  (namespace by namespace) with a lint rule (e.g. `eslint-plugin-i18next/no-literal-string`) added at the
  end to prevent regressions.

### c. RTL — the largest part (be honest)

Hebrew is right-to-left. This is **not** a translation task; it is a **layout** task touching most of the
app, and it is realistically the single biggest line item.

- **What React Native gives "for free":** `I18nManager.forceRTL(true)` flips the root flex direction and
  default text alignment — **but** (1) it requires an **app reload** to take effect (so the language toggle
  must reload), and (2) `react-native-web` RTL support is **partial/inconsistent** — web needs `dir="rtl"`
  on the document and has its own quirks. We ship web (Vercel), so web RTL is real scope, not free.
- **Physical → logical properties.** The 145+ physical-direction styles must become direction-aware:
  `marginLeft` → `marginStart`, `paddingRight` → `paddingEnd`, `left:` → `start:` (where supported), and
  `textAlign:'left'` → `'auto'`/`'start'`. RN supports `marginStart/End`/`start/end`; some `position`
  cases and web need manual handling. This is a sweep across **40+ files**.
- **Icon & glyph mirroring.** Back chevrons (`chevron-back`), forward `>` affordances in list rows
  (`SessionListItem`, settlement `→` arrows, "Sam → Alex"), progress/step indicators, and any
  directional iconography must mirror. The settlement arrow (`payer → receiver`) is semantically
  directional and needs deliberate handling, not just a flip.
- **The animations we just built (S10) are RTL-sensitive and must be revisited:**
  - **`SwipeableRow`** reveals its action on a **left** swipe (right-side panel). In RTL the natural swipe
    direction and panel side **invert** — `renderRightActions` → `renderLeftActions`, threshold/overshoot
    mirrored. (`components/SwipeableRow.tsx`.)
  - **Stack transitions** use `animation: 'slide_from_right'` (`navigation/AppNavigator.tsx`). In RTL,
    "forward" should slide from the **left**. Needs an RTL-aware animation choice.
  - `AnimatedNumber`, confetti, and the achievement modal are direction-neutral (no change).
- **Highest-risk screens** (dense, custom layouts): the **live session screens**
  (`LocalSessionScreen`, `SessionScreen`) and the **tournament dashboard** (clock, blinds, ±level controls,
  player rows), the **Final Count** step, **settlement** rows (directional arrows), the **immersive felt
  table** (`components/table/**` — seat positions, stack badges, dealer button are spatially placed and
  may need explicit RTL math), and the **Stats/Track** charts (`react-native-svg` axes are LTR by
  construction — decide whether charts stay LTR, which is common and acceptable).
- **Effort:** ~**2–4 weeks**, screen-by-screen, with device testing on both iOS and Android **and** web in
  RTL. This dominates the project. A pragmatic mitigation: ship RTL for the **core flow** first (Phase 1)
  and accept LTR-leaning polish on deep/secondary screens until Phase 2.

### d. Landing site (`apps/landing`)

Separate Next.js static-export site, currently English-only (copy lives in `apps/landing/lib/content.ts`
+ block components). Options:
- **Phase 2 / lower priority** (marketing can stay English at first launch of Hebrew app).
- When done: add a `he` locale. Because it's a **static export**, prefer `next-intl` with locale-routed
  static pages (`/he/...`) or duplicate-by-locale content; set `dir="rtl"` + a Hebrew web font. The
  screenshot **showcase** images (the S12 gallery) would ideally be re-captured from the Hebrew app.
- Effort: ~**3–5 days** once the app strings exist (much of the copy overlaps).

### e. Numbers, dates, currency, keyboard, AI Coach

- **Currency/numbers:** partially solved. Keep amounts as integer cents; format via `Intl.NumberFormat`
  with the active locale. The `currencyPrefs` flag + `utils/currency.ts` already exist — extend, don't
  rebuild. Hebrew uses Western Arabic numerals, so digits are unaffected; separators/placement follow
  `Intl`.
- **Dates/relative time:** `utils/formatters.ts` `timeAgo`/`formatMinutes` produce English ("just now",
  "1h 23m"). Replace with locale-aware formatting (`Intl.RelativeTimeFormat` / i18next plurals). Small but
  pervasive (used widely).
- **Keyboard / input:** numeric inputs (buy-ins, stacks) are unaffected. Text inputs (player names, group
  names) already accept Hebrew (RN handles the system keyboard). Verify `textAlign` on inputs flips.
- **AI Coach:** the analysis is generated by the server (`AnthropicCoachAiProvider`) with an **English
  system prompt**. Recommendation: **Phase 1 — keep the generated coaching content English** even in a
  Hebrew UI (translate the Coach *chrome*: buttons, headers, the disclaimer, credit copy — but the
  hand-analysis text stays English, clearly the model's output). **Phase 2 — optionally** localize by
  translating the system prompt + requesting Hebrew output (the model can produce Hebrew; cost/quality
  testing needed). Never machine-translate the coaching post-hoc.

### f. Effort estimate & phasing

Rough order-of-magnitude (engineering only; **actual Hebrew copy needs a native translator**, separate):

| Workstream | Effort |
|------------|--------|
| i18n infra (library, provider, toggle, persistence) | ~2–3 days |
| String externalization (~40 surfaces + components) | ~1.5–2.5 weeks |
| **RTL (layout, icons, animations, testing) — the big one** | **~2–4 weeks** |
| Numbers/dates/currency locale-awareness | ~2–3 days |
| Landing site Hebrew | ~3–5 days |
| Hebrew translation (native speaker, external) | parallel, not eng time |
| **Total (engineering)** | **~5–8 weeks**, RTL-dominated |

**Suggested phasing:**
- **Phase 0 — pipeline, no Hebrew (de-risk):** add i18n infra + externalize strings, with `en` as the only
  language. No visible change, no RTL. Proves the catalog/build works and locks in the lint guard. Shippable
  invisibly with the English launch or just after.
- **Phase 1 — Hebrew MVP:** translate + RTL the **core flow only** — onboarding, Home, live cash/tournament
  session, Final Count, settlement, stats — plus the language toggle. Deep/secondary screens (study, solver,
  group admin) stay English until Phase 2. This is the smallest honest "Hebrew is usable" release.
- **Phase 2 — full coverage:** all remaining screens, study/content prose, AI Coach output, and the landing
  site; full RTL polish on the immersive table and charts.

---

## 3. Should we scaffold i18n *now*? — No (plan-only), and why

The user offered the option to scaffold just the i18n setup + a language toggle (English only) now, **if**
genuinely low-risk and additive. **Recommendation: do NOT scaffold it now — keep it plan-only.** Reasons:
- A *useful* scaffold isn't isolated: the `I18nextProvider` must wrap `App.tsx`, and a language toggle
  must touch `ProfileScreen` — both are **existing files in the buildout**, so it carries buildout risk
  for **zero** benefit while English is the only language.
- An *isolated* scaffold (an unused `i18n/index.ts` + empty `en.json` + an unwired hook) is dead code that
  adds noise and can rot before the real project starts.
- The real value of Phase 0 (the pipeline) only materializes alongside string externalization, which is
  the actual multi-week project — not something to half-start at launch.

If/when the localization project begins, **Phase 0 above is the correct first step** — done deliberately,
with the lint guard, not as a launch-time fragment.

---

## 4. Risks & notes

- **RTL on react-native-web is the sharpest risk.** Budget explicit web-RTL testing; some `position`/
  transform cases won't auto-flip. Consider whether the **web** build ships Hebrew at all in Phase 1, or
  Hebrew is mobile-first.
- **`I18nManager` reload UX:** flipping RTL mid-session requires an app restart. The toggle must set the
  flag, persist, and prompt a reload (`expo-updates`/`Updates.reloadAsync()` on native; a page reload on
  web).
- **Plural/gender correctness** in Hebrew needs a real translator + i18next plural rules; do not approximate.
- **Backend strings** (notifications, achievement catalog, recap narratives) need a key-based contract or a
  server-side locale — decide early; it affects the API.
- **Charts** (`react-native-svg`) are LTR by construction; leaving axes LTR inside an RTL screen is a common,
  acceptable compromise — call it out in design.
- Keep amounts as **integer cents** throughout (unchanged) — only *formatting* is localized.
