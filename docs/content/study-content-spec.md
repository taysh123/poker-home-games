# Study Content Authoring Spec — quiz explanations, pool growth, cash/tournament coverage

> **This is a STANDARD, not content.** It defines what a good quiz question + explanation looks like so
> content can be authored (in the workbook) to a consistent bar that matches what the app engine now
> renders. It does **not** add or rewrite any questions — authoring happens in the content workbook and is
> re-exported (see §6). Written to support the S1–S3 engine upgrades (grounding link + claim→reasoning→
> evidence rendering). Honesty bar: **Expert-Calibrated, never GTO/solver-verified.**

---

## 1. Why this exists

The engine now renders each answered question as a **coaching read** and can attach **calibrated evidence**:

- **S3** renders three labelled steps: **THE PLAY** (the correct option's text) → **WHY** (the `Explanation`
  field) → **CALIBRATED REFERENCE** (a grounded, caveated fact, when the question is linked to a concept).
- **S1** surfaces that calibrated reference automatically from the question's `LinkedLessonID` (a `CK-xxx`
  concept id) via the honesty-gated grounding accessor — only `safe_to_assert` claims, verbatim, with their
  caveats ("Not solver-exact." / "Model-dependent (ICM/payouts).").

So the **`Explanation` field is now the "WHY"** — the reasoning a coach gives — and the **numbers come from
grounding, not from prose.** Today many explanations are thin one-liners ("AA: premium pair — open/3-bet
for value from any seat.") and several are duplicated across hands. This spec raises that bar.

---

## 2. The explanation standard — claim → reasoning → adjustment

Author every `Explanation` as the **reasoning + an adjustment**, in this shape (the app supplies the claim
from the correct option and the evidence from grounding — you write the middle):

1. **Reasoning (required):** *why* the correct play is right, in plain coaching language tied to THIS spot
   (position, stack depth, board, opponent tendency). One or two sentences. Reference the concrete features
   of the spot, not a generic hand-strength platitude.
2. **Adjustment (strongly encouraged):** how the answer *shifts by opponent or condition* — "vs players who
   over-fold to 3-bets, add bluffs; vs stations, value-bet thinner." This is what turns a fact into
   coaching and is the single biggest quality lever.

**Do NOT** restate the option ("the answer is raise") — the app already shows THE PLAY. **Do NOT** put
invented exact frequencies/percentages in the prose — link a concept instead (§3) so the *calibrated*
number appears with its caveat.

**Before → after (illustrative of the bar, not content to ship):**

- ❌ *"AA: premium pair — open/3-bet for value from any seat."*
- ✅ *"With the strongest hand in every range, you want the pot big and the money in — open, and 3-bet/4-bet
  for value rather than trapping, since AA rarely needs protection from being outdrawn pre-flop. Adjustment:
  vs a nit who only stacks off with QQ+, slow down on later streets; vs a station, keep piling in value."*
  (+ `LinkedLessonID: CK-001` so the app appends *"UTG opens ~13.4% (RFI) at 100bb 6-max … Not
  solver-exact."* as evidence.)

**Length:** aim for 2–4 sentences. Short is fine if it carries reasoning + an adjustment; a one-clause
hand-strength label is not.

**No duplication:** each hand/spot gets its own reasoning. Identical templated sentences across different
hands (the current AA/JJ/TT copy) are the anti-pattern.

---

## 3. Linking to grounding (so the calibrated number shows)

- Set **`LinkedLessonID` to the relevant concept id** (`CK-xxx`) whenever a calibrated fact exists for the
  spot. The concept ids and their claims live in `coach_grounding` (dataset 0.8.1); e.g. `CK-001` = RFI
  opening frequencies by position, push/fold/ICM concepts exist for tournaments. The app resolves the link
  and shows up to 2 caveated assertions beneath the explanation — **you never type the number.**
- If no calibrated claim fits, leave `LinkedLessonID` empty — the question simply shows no reference. Never
  fabricate a concept link to force a number.
- Keep prose numbers OUT of the explanation. If you want a number shown, it must come through a grounded,
  `safe_to_assert` claim (which carries its own tier + citation + caveat). This is the honesty seam.

---

## 4. Pool growth targets

Current shipped sample is ~30 questions — too thin for real learning. Target coverage (per the schema's
`Category` × `Difficulty` × format):

| Category | Beginner | Intermediate | Advanced |
|----------|----------|--------------|----------|
| RFI (open/fold) | 20+ | 15+ | 10+ |
| 3-bet / defense | 15+ | 15+ | 10+ |
| 4-bet / vs 3-bet | 8+ | 10+ | 8+ |
| Push/fold (short stack) | 15+ | 15+ | 10+ |
| ICM / bubble | 8+ | 12+ | 12+ |
| C-bet / postflop | 10+ | 15+ | 12+ |

- **Difficulty progression must scaffold:** Beginner = one clear principle (position, hand class);
  Intermediate = spot-dependent (sizing, board texture, opponent); Advanced = ICM / exploit / multi-street
  reasoning. A `76s` bubble fold is **Advanced**, not Beginner — don't drop ICM jargon into Beginner copy.
- Spread difficulties within each category (avoid the current Beginner-flood). A learner should be able to
  filter to a difficulty and get a real set.

---

## 5. Cash vs Tournament coverage (must be explicit)

The coach engine is now format-aware; the quiz content should be too. Every relevant category needs BOTH:

- **Cash** — assume 100bb+, chip-EV, no ICM, rake awareness. Concepts: RFI at 100bb, 3-bet/4-bet, c-bet.
  Grounding: the `100bb 6-max` calibrated opens/3-bets.
- **Tournament** — stack-depth aware: short-stack **push/fold** (Nash), **ICM / pay-jump** pressure, antes,
  bubble. Concepts: the `~Xbb Nash push/fold` and `ICM chip-EV breakeven` grounded claims.
- **Tag the format** so questions can be filtered/selected by it (use `Topic`/`Category` conventions or a
  dedicated format column in the workbook). The same hand should appear as distinct cash vs tournament
  questions where the answer differs (a jam that's standard at 15bb MTT is not a 100bb cash decision).

**Minimum bar:** each of the six categories above has at least a cash *and* a tournament question set where
the distinction is meaningful (RFI, 3-bet, push/fold, ICM especially).

---

## 6. Authoring workflow + honesty gate (how, and the non-negotiables)

- **Author in the workbook, not the JSON.** Content ships as hash-pinned packs (`assets/content/0.8.1/*.pack.json`);
  the app validates a SHA-256 content hash and pins the dataset version. **Editing a pack by hand breaks the
  hash** and is quarantined. New/edited content = new workbook rows → re-export → bump the dataset version
  (`0.8.1` → next) → update the bundled artifact + its version pin. Follow the existing export tooling
  (`tools/content-export`), don't hand-edit exports.
- **Row fields to fill well:** `Question`, `OptionA–D` (one clearly correct + plausible distractors),
  `CorrectAnswer`, `Explanation` (to §2), `Category`, `Topic`, `Difficulty`, `LinkedLessonID` (§3),
  `FreeOrPremium`, `ConfidenceLevel`, `Status` = `Approved`/`Published`.
- **Honesty (non-negotiable):**
  - Explanations are **Expert-Calibrated** educational coaching. Never write "GTO", "solver-verified",
    "optimal", or "guaranteed-correct" in an explanation.
  - All quantitative claims come through grounding (§3), which carries the "Not solver-exact" /
    "Model-dependent (ICM/payouts)" caveat — never assert a bare percentage in prose.
  - Illustrative/starter ranges are labelled as such in the UI (S2) — don't describe them as GTO.
  - Distractors should be genuinely plausible (teach the reasoning), not obviously wrong throwaways.

---

## 7. Definition of done (per authored question)

- [ ] One unambiguous correct answer; plausible distractors.
- [ ] `Explanation` gives **reasoning + an adjustment** tied to the spot (not a hand-strength label; not a duplicate).
- [ ] No invented numbers in prose; `LinkedLessonID` set to a real `CK-xxx` concept when a calibrated fact fits.
- [ ] `Difficulty` matches the cognitive load; format (cash/tournament) is clear and tagged.
- [ ] No "GTO/solver/optimal/guaranteed" wording; Expert-Calibrated throughout.
- [ ] `Status = Approved`; exported via tooling (hash valid); dataset version bumped.
