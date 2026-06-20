# 05 — Coach Knowledge Integration Plan

**Deliverable 5.** How the commercial knowledge base grounds the AI Coach — the **knowledge retrieval
architecture** — without changing the client contract and without shipping commercial IP to devices.

---

## 1. The seam (already exists)
- **Client:** `ICoachProvider.analyze(req) → CoachAnalysis` (`apps/poker-mobile/src/features/coach/types.ts`).
  The UI (`CoachResultScreen`) renders a fixed shape: `summary`, `mistakes[]`, `goodDecisions[]`,
  `alternativeLines[]`, `tips[]`, `confidence`, `providerId`, `disclaimer`.
- **Server:** `ICoachAiProvider.AnalyzeAsync(input) → CoachAnalysisResult`
  (`PokerApp.Application/Common/Interfaces/ICoachAiProvider.cs`), today implemented by `MockCoachAiProvider`
  (templated text, no retrieval). A server-authoritative path with credit ledger, fraud check, and audit
  already wraps it (`AnalyzeHandCommandHandler`).

**Decision: knowledge lives and is retrieved on the server.** Commercial knowledge (ranges + `CoachKnowledgeDoc`
concepts) is delivered to the **server** as content packs and never shipped to the device. The vendor key (when
a real LLM is wired) is already server-only. The client contract does **not change**.

## 2. Target retrieval architecture

```
 POST /api/coach/analyze (existing, server-authoritative)
        │  reserve credit · fraud check · audit (existing)
        ▼
 ICoachAiProvider.AnalyzeAsync(input)               ← the injection point
        │
        ├─► KnowledgeStore.retrieve(input)          ← NEW seam (server-side)
        │      • match RangeDoc(s) by {scenario, position, stack, format, hand}
        │      • match CoachKnowledgeDoc(s) by appliesTo {scenario, position, street} + tags
        │      • return a small, ranked context set
        │
        ├─► Grounder
        │      • Phase 1: deterministic templating over retrieved ranges/concepts (no LLM)
        │      • Phase 2: LLM prompt = structured input + retrieved context, with citations
        │
        └─► CoachAnalysisResult (same shape) → mapped to client CoachAnalysis
```

### `KnowledgeStore` (new server component, future)
- Built by ingesting the **same content packs** ([03](03-json-schema-specification.md)) on the server: the
  `ranges[]` give exact strategy lookups; the `knowledge[]` give concept explanations to cite.
- Retrieval is **structured-first** (filter by `appliesTo`/range keys), optionally augmented by text/embedding
  search over `concept` bodies later. Returns a bounded context (top-N) to keep prompts small + costs low.
- Versioned + gated like any pack; premium packs can enrich premium-tier coaching.

### Grounding phases
1. **Deterministic (no vendor):** compose `summary`/`mistakes`/`tips` from the retrieved range (e.g., "From CO,
   T9s is a standard open at ~60% frequency") + concept text. This makes the coach *real* (data-grounded) with
   **no AI vendor**, while still honestly labeled.
2. **LLM-backed:** a real `ICoachAiProvider` builds its prompt from the structured input + retrieved context and
   must cite the knowledge ids it used. Retrieval stays the same; only the generator changes.

## 3. Honesty / labeling
- The **"Demo Analysis — Not Live AI Yet"** banner (`CoachResultScreen`, `CoachScreen`) stays until a real,
  data-grounded provider is wired and selected via `COACH_CONFIG.provider`. The Phase-1 deterministic grounder
  may use a clearly-labeled provider id (e.g., `"grounded-rules"`) and an appropriate `disclaimer` — never
  implying a live AI vendor that isn't there.
- `confidence` reflects retrieval quality (exact range hit → higher; sparse context → lower).

## 4. Optional lightweight client lookup (secondary)
For instant, offline "why" hints next to study spots, the **already-on-device** `RangeDoc`s (from cached free/
entitled packs) can power a tiny client-side explanation (e.g., show the strategy frequencies + a short note).
This is **not** the coach pipeline and must not expose server-only `CoachKnowledgeDoc` IP — it only uses range
data the device already holds. Keeps the coach (commercial knowledge, vendor) firmly server-side.

## 5. Gating + audit
- Coach access continues to use the existing credit policy (`AI_CREDIT_POLICY`) + `ai_coach` entitlement.
- Premium knowledge packs can deepen analyses for premium users; the server enforces entitlement when building
  the per-request context. Existing fraud/audit/credit-ledger flow is unchanged.

## 6. What changes / doesn't
- **No client changes** to integrate knowledge — the provider abstraction absorbs it.
- **New server pieces (future):** a pack-ingestion step into `KnowledgeStore`, a retrieval component, and a
  grounded `ICoachAiProvider` implementation registered in DI (replacing/alongside `MockCoachAiProvider`).
- Nothing here is implemented now; it's the integration contract for when the workbook lands.
