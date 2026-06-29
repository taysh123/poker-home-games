# Solver Vendor Evaluation (design-only) — Matrix · Recommendation · Acquisition Plan

> **Design-only. No adapter built. No external format invented. No licensing rights assumed.**
> Pricing + capabilities are **as of June 2026 from public sources** and **MUST be re-verified at each vendor
> before purchase** — they change. **Redistribution/right-to-use of solved OUTPUT inside a paid app is NOT
> assumed for any vendor** and must be confirmed **in writing** (see `solver-sample-request-spec.md` §7). This
> is not legal advice. All vendors map into the same T-Poker canonical pack (`solver-pack-architecture.md`);
> the differentiators are export/automation, redistribution rights, and adapter cost.

## A. Vendor comparison matrix

| Dimension | **GTO+** | **PioSolver** | **GTO Wizard** | **Simple Postflop** | **MonkerSolver** |
|---|---|---|---|---|---|
| Type | Desktop (postflop) | Desktop (postflop, industry std) | **SaaS** (web) | Desktop + cloud preflop | Desktop (multiway + PLO) |
| Approx. cost *(verify)* | ~$75 one-time | Basic ~$249 / Pro ~$1.1k / Edge higher; PioCloud €1/credit (~6.25h) | $26–$206/mo (Starter $39 · Premium $44 · Ultra $206); ~20% off annual | Local-calc license (unlimited local); preflop cloud "PF-points" ($1499.99 / 50) | €499 one-time (NL+PLO) |
| Export | Ranges/strategy (file/clipboard); proprietary save | Strategy/EV per node; `.cfr` trees; **UPI dumps**; community `pyosolver` | Limited (SaaS; some CSV/range export by tier; product API) | Strategy/EV/equity; reports | Preflop ranges export; solution review |
| EV available | Yes | Yes (per action/node) | Yes (in-product) | Yes | Yes (incl. multiway/PLO) |
| Equity available | Yes | Yes | Yes (in-product) | Yes | Yes |
| Node-tree available | Yes (postflop) | **Yes (full tree)** | Yes (in-product) | Yes | Yes (multiway/PLO trees) |
| Automation / API | **None** (GUI only) | **UPI scripting — best in class** (+ pyosolver) | Product **API exists but license-gated**; account-sharing banned | Cloud preflop service (points); limited scripting | Limited scripting *(verify)*; export-based |
| Redistribution risk | **Verify (EULA)** | **Verify (EULA)** | **HIGHEST** — SaaS data is the product/moat; partnership-only | **Verify (EULA)** | **Verify (EULA)** |
| Licensing | Per-license; commercial redistribution = verify | Per-edition; commercial redistribution = verify | Subscription personal-use; redistribution = explicit data partnership | Local license + cloud points; redistribution = verify | One-time; redistribution = verify |
| Adapter complexity (→ canonical) | Medium (parse exports; **no automation** = manual bottleneck) | Medium–High (UPI script + parse node dumps; trees→`SolverNode`) | N/A unless a data/API license is granted; then API-shaped | Medium (parse exports + cloud preflop output) | High (complex multiway/PLO trees, larger output) |
| Scalability for T Poker | Low–Med (no batch) | **High** (UPI/PioCloud batch; preflop weaker — Pio is postflop-centric) | High data quality **iff** licensed | Medium (cloud preflop helps; local postflop manual) | Med–High for **breadth** (PLO/multiway), heavy |
| MVP | ✅ cheapest real EV/equity/node for a few hand-built packs | ➖ powerful but costlier/overkill | ❌ can't redistribute | ➖ possible | ❌ complexity/cost |
| Commercial launch | ➖ limited by no automation | ✅ strong (automatable, standard) | ⚠️ partnership-only | ➖ possible | ➖ niche (PLO/multiway) |
| Long-term flagship | ❌ | ✅ **(UPI automation = scalable library)** | ⚠️ best data, partnership-gated | ➖ | ➖ complement for PLO/multiway |

**Per-vendor notes**
- **GTO+** — cheapest path to *real* postflop EV/equity/node; great to produce the first 1–2 sample packs by hand. The blocker is **no automation** (GUI export only) → doesn't scale to a large library, and EULA redistribution must be verified.
- **PioSolver** — the strongest *engineering* fit: **UPI** enables reproducible, scriptable exports (and `pyosolver` lowers adapter risk), the node tree maps cleanly to `SolverNode`, and PioCloud handles scale. Postflop-centric (preflop needs a preflop config/solver). Cost climbs at Pro/Edge.
- **GTO Wizard** — the **best data quality** but the **worst redistribution posture**: it's a SaaS whose solved-data library is its core IP (account sharing is a permanent-ban offense). Using its data in T Poker would require an explicit **commercial data/API partnership** that may not be offered. Do **not** plan around it unless such a license is granted in writing.
- **Simple Postflop** — capable (EV/equity/strategy, fixable lines); preflop via a paid cloud-points service. Less of an automation/ecosystem story than Pio; redistribution verify.
- **MonkerSolver** — the **multiway + PLO** specialist (unique coverage). Heavy, complex output ⇒ highest adapter cost; a **complement** for PLO/multiway, not the NLHE core.

## B. Recommendation report
*(All gated on written redistribution/right-to-use — see §D. Recommendations are about fit, not granted rights.)*
- **Best under $100 → GTO+** (~$75, verify). Cheapest way to get genuine postflop EV/equity/node for a small,
  hand-built set of sample/MVP packs. Accept the no-automation ceiling.
- **Best under $500 → PioSolver Basic** (~$249, verify) for the NLHE core — industry-standard output + the
  upgrade path to **UPI** automation. (Choose **MonkerSolver €499** instead only if PLO/multiway is the priority.)
- **Best long-term → PioSolver (Pro/Edge + UPI + PioCloud)** — automation is the decisive factor for building a
  real solver-pack *library* at scale; canonical-mapping + community tooling de-risk the adapter. Add
  **MonkerSolver** later as the PLO/multiway complement.
- **Best for importing real data into T Poker → PioSolver.** UPI gives reproducible, automatable, well-documented
  exports that map cleanly to the canonical pack (EV/equity/node) with the lowest scaling risk. GTO Wizard has
  better *data* but is partnership-gated for redistribution — not the import source unless a data license is
  explicitly granted.

## C. First Real Solver Data Acquisition Plan (exact, ordered)
1. **Legal first — confirm rights in writing (no purchase-for-redistribution before this).** Contact GTO+ and
   PioSolver (and GTO Wizard *only* to ask about a commercial data/API partnership) using
   `solver-sample-request-spec.md` §7: may we **redistribute solved OUTPUT inside a paid app**? audience (free
   vs premium)? attribution? territory? Get a dated written answer.
2. **Buy the cheapest viable for a SAMPLE.** Order: **GTO+** (~$75) to produce the first real export sample →
   **PioSolver Basic** (~$249) for the automation-path sample (only if budget + step-1 rights look viable).
   Defer Pro/Edge/Monker until the canonical mapping is proven.
3. **Generate export samples** (per the request spec §1): at least one preflop-ish range **and** one postflop
   node carrying EV/equity + tree, in the vendor's **native** export format, plus its format documentation.
4. **Acceptance test** (request spec §8 — design-only mapping, no shipped adapter): map a small real slice →
   canonical → `prepareImport`/`validatePack` (schema, enums, `freq`/`equity` 0..1, `evBb` finite, tree
   integrity, hash); confirm tier honesty (`solver` only if genuine); spot-check values vs the source (never
   invented); confirm stable round-trip hash.
5. **Validate legality before any in-app inclusion:** written right-to-use on file; record audience/attribution/
   territory + the tier claim; separate consent for any future public-spot library. Only then build the
   vendor-specific adapter and run the **Solver Flip Readiness Checklist**.

## D. Risks & legal considerations
- **#1 risk — redistribution rights.** A personal-use license to *run* a solver is **not** a license to
  **redistribute its solved output** commercially inside another product. **GTO Wizard** (SaaS) is the highest
  risk (its data is its moat; partnership-only). For desktop solvers (GTO+/Pio/Simple/Monker) you generate the
  solves, but the **EULA may still restrict commercial redistribution of outputs** — **verify in writing; assume
  nothing.**
- **Pricing volatility** — tiers/prices changed in 2026 (e.g. GTO Wizard); re-verify before purchase.
- **Automation/scaling cost** — a real library needs automation; PioCloud credits/compute is an ongoing cost;
  GTO+ has none (manual ceiling).
- **Data-quality vs cost** — GTO Wizard/Pio (high) vs GTO+/Simple (good, cheaper); Monker unique for PLO/multiway.
- **Vendor lock — mitigated** by the canonical pack: swapping/adding a vendor is a new adapter, not a rebuild.
- **Honesty** — only genuine solver output is tier `solver`; no fabricated EV/equity/node; illustrative stays
  labelled until a verified pack lands.

## E. Exact next human actions
1. Pick a **budget tier** (under $100 / under $500 / long-term) from §B.
2. Send the **written redistribution/right-to-use queries** (request-spec §7) to **GTO+** and **PioSolver**
   (and GTO Wizard re: partnership). Do not buy-for-redistribution before answers.
3. On a viable answer, **purchase GTO+ first** (sample) [+ **PioSolver Basic** if pursuing automation].
4. **Produce export samples** + format docs per the request spec.
5. **Hand the samples back** to build a draft adapter + run the acceptance test (§C.4) and the
   **Solver Flip Readiness Checklist**.
6. Keep the signed **right-to-use** on file before any in-app inclusion.

## Sources (public, as of June 2026 — verify before purchase)
- PioSOLVER — products / UPI / pricing: https://piosolver.com/products/ · https://piosolver.com/docs/upi/ · https://piosolver.com/docs/piocloud/pricing/ · community wrapper: https://github.com/weston/pyosolver
- GTO Wizard — pricing/plans 2026: https://www.pokernews.com/news/2026/03/gto-wizard-subscription-plans-new-features-pricing-50908.htm · subscription help: https://help.gtowizard.com/subscription/
- GTO+ / general solver comparison: https://solvers.poker/ · https://www.hudstore.poker/5-best-gto-poker-solvers
- MonkerSolver: https://monkerware.com/solver.html · https://www.monkerguy.com/help.htm
- Simple Postflop: https://simplepoker.com/en/Solutions/Simple_Postflop · https://www.hudstore.poker/software/simple-postflop
