# Context Retention — RESEARCH.md

Evidence base for `PLAN.md`. Every claim below is verified against this checkout
(AST/read, not inference) unless explicitly labelled *unverified*.

Date: 2026-09-15.

## 1. The question

> "I don't want the AI to lose context of the past."

Made testable, that is three separate questions:

1. **Is the past still stored?** (durability — does a finished entry's meaning
   survive on-device, with Supabase + Hindsight down?)
2. **Is the past findable?** (retrieval — does `memory_search` surface the right
   file for a question that doesn't lexically match it?)
3. **Does the past reach the reply?** (grounding — does the model actually use
   what was retrieved, or does it answer from nothing?)

The current architecture answers (1) well. (2) and (3) are unmeasured.

## 2. Three memory eras in git history

| Era | Doc | Deleted | Recovered to |
|---|---|---|---|
| 1 — Rosebud Memory Loom (phone-local) | `idea.md` (232 lines) | 2026-09-01 `3d044aa` | `.planning/archive/idea.md` |
| 2 — Cloud-Authoritative (Phases 0–9) | 8 plans/specs | 2026-08-18 `f2415ff` | `.planning/archive/docs/superpowers/` |
| 3 — Offline memory rework (current) | `.planning/offline-memory/` | not deleted | — |

### Era 1 roadmap status — where the gaps are

| Phase | Content | Status |
|---|---|---|
| 1 | Episodic/profile/semantic atoms, bounded capsule, weekly summary, local backup | landed |
| 2 | Manual note memory + inspection UI | landed |
| 3 | **Weekly consolidation by a background worker when the app is idle**; contradiction fading | **not built** |
| 4 | Hybrid retrieval: embeddings, entity links, FTS, temporal graph | partial |
| 5 | **Prospection-guided retrieval** | **not built** |

Era 1's own Evaluation section supplies the rubric this plan adopts:

- Does the AI recall relevant themes without being intrusive?
- Does it avoid repeating response styles the user disliked?
- Does it adapt when the user changes?
- Does weekly history help the user understand patterns?
- Does prompt size remain bounded?
- Can the user inspect and control remembered content?

> "The strongest version of this system is not the one that remembers the most.
> It is the one that remembers the right things, at the right confidence, for
> the right moment, while leaving control with the person writing the journal."

### Era 2 — requirements only, never implementation

`LOCAL → MIRROR → SHADOW → CLOUD` was abandoned and removed. AGENTS.md forbids
resurrecting it or its storage keys; `__tests__/backend-local-only.test.ts`
enforces the boundary. Nothing in this plan re-introduces it.

Its **Global Constraints** section is mined for invariants that do not depend on
the cloud platform existing:

- Exactly one signed writer lease may accept mutations; never live dual writes.
- Current user-authored evidence is the **only** autobiographical truth source.
  Assistant text, summaries, preferences, hypotheses and external pages cannot
  authorize user facts.
- A source edit or tombstone **immediately** removes retrieval eligibility and
  invalidates every dependent projection.
- Keep `LOCAL` authoritative until gates pass; never remove local source
  evidence or fallback.
- No natural-language keyword routing. Model interpretation is structured;
  deterministic code owns validation, authorization, budgets, deadlines, policy.
- Memory relevance never grants permission to mention. Retrieval and
  utilization/sensitivity are separate decisions.

## 3. Verified gap inventory

### 3.1 No idle/background consolidation — confirmed

- `services/memory/memoryRollupBuild.ts:22` — *"Runs on app open via
  `ensureMemoryRollupsUpToDate` — not a background timer."*
- The only `AppState` listener in the entire repo is
  `services/supabase/supabaseClient.ts:32-35` (auth token refresh).
- **No scheduler for memory work exists anywhere.**

### 3.2 Dream is tool-only — confirmed

- `runMemoryDream` is invoked from exactly one place:
  `services/ai/tools/memoryFileTools.ts:122` (`memoryDreamTool`), registered at
  `services/ai/tools/registry.ts:27`.
- Consequence: `_tmp` files staged on finish sit un-promoted until the model
  happens to call `memory_dream`. Promotion is model-initiated, not guaranteed.

### 3.3 Staging is on the finish path — confirmed

- `services/memory/memoryStage.ts:50` `stageJournalEntryMemoryFiles`,
  `:107` `stageCheckInMemoryFiles`.
- Wired from `services/journal/journalFinishSideEffects.ts:153` (sequential
  legacy path) and `:244` (background path), plus
  `services/intentions/intentionsStorage.ts:395` (check-in complete branch).

### 3.4 Contradiction fading — not implemented

Era 1 Phase 3's second half. The file schema already has a `deprecated`
frontmatter field, and manual atoms are protected from pruning
(`services/memory/localMemory.ts:190-192`: `source === 'manual'` atoms are
excluded from the prune set). There is no supersede/decay path for
auto-inferred memory, and that protection has **not** been shown to extend to
the file layer.

### 3.5 Published budgets — confirmed constants

`services/memory/memoryRetrieval.ts:42-45`:

```
RECALL_FILE_MAX_CHARS  = 12000
RECALL_TOTAL_MAX_CHARS = 30000
RECALL_TOP_K           = 5
RECALL_CACHE_TTL_MS    = 30000
```

These are load-bearing, not cosmetic: they are what keeps the freeform prompt
inside a ≥32k context window.

### 3.6 Compaction is the literal "loses the past" mechanism — confirmed

`services/ai/conversationCompact.ts` (269 lines) replaces older turns with a
rolling summary, budgets `SUMMARY_TOKEN_BUDGET_MIN = 800` /
`SUMMARY_TOKEN_BUDGET_MAX = 12_000`, triggers on `COMPACT_TRIGGER_RATIO` /
`COMPACT_HARD_RATIO`, and under hard pressure *drops more of the summary itself*
(`:241-245`). Its injected placeholder text is the failure stated plainly
(`:153`):

> `(${older.length} earlier turns compacted; details unavailable in budget.)`

Whatever compaction discards is unrecoverable for that turn unless retrieval
can find it again.

## 4. Performance baseline (measured, from this repo's own debug sessions)

Source: `.planning/debug/finish-entry-hang.resolved.md`.

- Finish hang root cause: a render loop on `/entry-reflection` fired
  `generateEntryReflection` continuously — **28,214 requests, 1,358 pending** —
  saturating Chrome's per-profile socket pool so the entry-title call queueing
  behind it made Finish appear to hang (60s click timeout).
- Post-fix: click → `/entry-reflection` **1,530–2,022 ms**; request count flat.
- Entry title latency with no backlog: **1.43 s**.
- Fixes that hold today: `useCallback` + in-flight map in
  `hooks/journal/useEntryReflection.ts`, `useRefreshOnFinishRun`,
  `FINISH_TITLE_TIMEOUT_MS = 8_000` (`app/chat.tsx:49`).

**Correction to that doc's follow-up list:** it records "the reflection hook
still has no ceiling on a hung `generateEntryReflection`". That is now stale —
`REFLECTION_TIMEOUT_MS = 30_000` exists and is applied
(`hooks/journal/useEntryReflection.ts:16`, `:89`), landed in `076fe31`.

## 5. Current finish-path shape (the performance target)

`app/chat.tsx:260` `handleFinishEntry` is the only place Finish blocks:

1. `finalize()`, `setIsSaving(true)`
2. `setFinishStage('Finding a title')` → `await withTimeout(generateEntryTitle(...), FINISH_TITLE_TIMEOUT_MS)` — **the single blocking AI call**
3. `create`/`update` the entry (storage)
4. `await clearPersistedSession()`, `handleNewChat()`
5. `void runJournalFinishBackground(savedEntry)` — fire-and-forget (`:315`)
6. `router.replace('/entry-reflection')` (`:317`)

`services/journal/finishBackgroundStore.ts` already runs six background steps —
`analysis`, `memories`, `digest`, `identity`, `sessionDigest`, `hindsight` —
with a status banner. So the architecture is already background-shaped; only the
title call blocks.

## 6. Prior art already studied (do not re-research)

`.planning/offline-memory/RESEARCH.md` §2–6 already covers Hermes (`MEMORY.md` +
`USER.md` + `session_search`), OpenClaw (`USER.md`/`MEMORY.md`/daily notes/
`DREAMS.md`, dreaming sweep, memory flush before compaction) and ClawXMemory in
full source (file-memory, retrieval reasoning loop, heartbeat, dream review,
SQLite control plane). The load-bearing ClawX rules for this plan:

- Indexing is **background + staged**: new sessions → `_tmp` → Dream promotes.
- Headers before bodies; recall scans frontmatter + preview, never full bodies.
- Dream: global plan decides boundaries **before** any rewrite; merges require
  `merge_reason` (`rename | alias_equivalence | duplicate_formal_project`) plus
  evidence entry ids; **when unsure, keep separate**.
- Per-rewrite output cites ≥1 source id; deleted ids must be absorbed/redundant.
- User profile rewrite keeps durable identity only — never project progress.

## 7. Constraint extraction (non-negotiable)

From AGENTS.md + the offline-memory non-goals:

- No `expo-sqlite`, no new native dependencies.
- No vectors as the source of truth (Gemini is embeddings-only, never an LLM).
- Every phase must pass with **Supabase `:54321` and Hindsight `:8787`
  unreachable, OmniRoute `:20128` up** — that is the test matrix.
- Storage: one owning module per key, serialized read-modify-write, safe
  `JSON.parse` with a default, `schemaVersion` envelope for any stored shape.
- Layering UI → hooks → services; no `any`; tests are part of the diff.
- Never more than **3 agents running tasks concurrently** (user mandate).

## 8. Open questions this plan deliberately leaves to the eval

- Is lexical shortlist + header scan sufficient, or does recall genuinely need
  entity links (Era 1 Phase 4 leftovers)?
- Does prospection (Era 1 Phase 5) buy recall without blowing the 30k budget?
- What is an acceptable Dream false-merge rate, given merges are destructive-ish?

These are answered by measurement in Phase R0/R3, not by argument.
