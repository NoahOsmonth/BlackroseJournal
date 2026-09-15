# Context Retention — PLAN.md

**Goal:** the AI never loses the user's past — with Supabase and Hindsight
unreachable, on-device only — and can prove it with numbers rather than
assertions.

**Basis:** Era 1 ("Rosebud Memory Loom", `.planning/archive/idea.md`) phases 3–5
grafted onto the current offline-file architecture
(`.planning/offline-memory/`), plus ClawX Dream consolidation rules.

**Explicitly dead:** Era 2 cloud memory (`LOCAL → MIRROR → SHADOW → CLOUD`) and
its storage keys. Nothing here re-introduces it. See AGENTS.md rule 9 and
`__tests__/backend-local-only.test.ts`.

Evidence base, verified gaps and measured baselines: `RESEARCH.md` (same folder).

Date: 2026-09-15. Status: **proposed — not started.**

---

## Decisions already locked

| Decision | Value |
|---|---|
| Test matrix | Supabase `:54321` **down**, Hindsight `:8787` **down**, OmniRoute `:20128` **up** |
| Model under test | `merge/deepseek/deepseek-v4-flash-0731` (already the repo default; no code change) |
| Platform | Web only (Expo web `:8081` + Playwright) |
| Agent concurrency | **Never more than 3 agents running tasks simultaneously** (hard) |
| Finish latency | Keep the title call **blocking**, lower the cap **8 000 → 2 500 ms** |
| Storage | AsyncStorage only — no `expo-sqlite`, no new native deps, no vectors as truth |

---

## Phase R0 — Measurement harness (no behavior change)

**Why first:** every later phase claims to improve recall. Without a baseline,
"improved" is unfalsifiable. This phase ships no product behavior.

**What is lost today is unmeasured** — see `RESEARCH.md` §3.5–3.6: the published
budgets (12k/file, 30k total, top-K 5, 30s cache) and compaction's
`(... details unavailable in budget.)` placeholder are the mechanisms, but nothing
counts how often the past actually fails to arrive.

### Deliverables

1. **Seeded fixture ledger** — N journal entries spread across simulated months,
   written the same way production writes them (through storage services, so
   digests/atoms/files all stage), with *planted needles*:
   - distinctive nouns unlikely to appear in a probe question,
   - dated events (weekday in prose only — see the day-slip rule in AGENTS.md),
   - a recurring thread across several weeks,
   - one deliberate contradiction pair for R2.
2. **Probe set** — questions with the expected source id(s) for each, including
   lexically-non-overlapping probes ("what was I worried about back then?").
3. **Recall metrics**, computed per probe:
   - **hit-rate** — was the needle's memory file in the retrieved set?
   - **precision** — how many retrieved files were irrelevant?
   - **grounding** — did the assistant reply quote/use the needle, judged from
     the verbatim reply text (not from a summary)?
   - **prompt bytes** consumed by memory context,
   - **wall-clock latency** for retrieval and for the whole turn.
4. **Runner** — a Playwright case following the existing
   `scripts/e2e/pw-memory-recall-offline.mjs` harness (storage clearing, session
   seeding, per-host request blocking, settle heuristics, verbatim capture) with
   Supabase + Hindsight blocked. Emits a machine-readable results artifact.

### Acceptance criteria

- Baseline numbers exist for all six metrics (whatever they are — this phase
  must not be "fixed" by tuning before measuring).
- Re-running the suite on an unchanged tree reproduces the numbers within a
  stated tolerance, or the instability is documented.
- The suite fails loudly if the offline gates are not actually blocking
  (a probe that accidentally reaches Hindsight must be an error, not a pass).

**Dependency:** none. Blocks R1–R3 validation.

---

## Phase R1 — Background/idle Dream consolidation

**Gap:** `_tmp` files staged on finish are promoted only when the model happens
to call `memory_dream` (`RESEARCH.md` §3.2). Nothing schedules it; the only
`AppState` listener in the repo is auth refresh (§3.1).

**What:** give consolidation a trigger, reusing the background pattern already
proven by `services/journal/finishBackgroundStore.ts`.

### Design constraints

- **Single-flight.** Two concurrent Dreams must be impossible — a second
  request coalesces into the running one rather than queueing.
- **Never during a streaming chat turn.** Precedent: the finish-hang incident
  (`RESEARCH.md` §4) showed one starving AI caller jams the whole socket pool
  for every tab. Idle work must yield.
- **Lease-aware.** Respect the account-operation lease discipline so an account
  switch cancels in-flight work and never cross-writes.
- **Bounded and resumable.** Budgeted step count per run; a run that dies
  mid-way must not corrupt the manifest. Precedent for offline backoff:
  `@rosebud_memory_rollup_attempts` (`memoryRollupBuild.ts`) — same shape, own key.
- **Soft-fail always.** Provider down ⇒ local keyword fallback, never a throw
  into the UI. `memoryDream.ts` already has that fallback path.
- **Trigger conditions** (any): staged `_tmp` count ≥ threshold · N hours since
  last successful Dream · app-open catch-up (existing rollup behaviour).
- **Status surfacing** via the finish-background-store pattern, visible in the
  Settings memory section.

### Keep intact (do not rebuild)

`runMemoryDream` already implements the ClawX rules — global plan before rewrite,
`merge_reason` + evidence ids, "when unsure keep separate", ≥1 source id per
output. This phase adds a *trigger and a scheduler*, not new consolidation logic.

### Acceptance criteria

- With Supabase + Hindsight down and OmniRoute up: finish an entry, then reach
  the idle condition, and observe `_tmp` staged files promoted to formal files
  **without** the model being asked to call `memory_dream`.
- A Dream started, then interrupted by an account switch or a chat turn, leaves
  the manifest consistent (no partial file, no orphaned `_tmp`).
- R0 hit-rate does not regress after consolidation.
- No new `AppState`/timer work runs while the app is backgrounded on web.

**Depends on:** R0 (to prove non-regression).

---

## Phase R2 — Supersession and fading

**Gap:** Era 1 Phase 3's second half never landed. There is no supersede/decay
path for auto-inferred memory (`RESEARCH.md` §3.4).

**What:** when new evidence conflicts with older inferred memory, the older
should **fade, not vanish** — the Era 1 example: *"user once wanted early
mornings, now repeatedly writes that nights work better → the older memory should
fade."*

### Rules

- Retained invariant from Era 2's constraints: **a source edit or tombstone
  immediately removes retrieval eligibility and invalidates every dependent
  projection.** Deletion is immediate and total, not gradual.
- Fading is for *superseded inference*, never for user-authored content.
  `localMemory.ts:190-192` protects `source: 'manual'` atoms from pruning; that
  protection must be extended to and verified on the file layer.
- Supersession must record *why* (which newer source superseded it) so it is
  auditable and reversible.
- The `deprecated` frontmatter field already exists in the file schema — use it
  rather than inventing a parallel flag.

### Acceptance criteria

- Contradiction pair from R0's fixture: the older memory stops being retrieved
  first, and the newer one wins, with a recorded supersede reason.
- Manual notes and identity profile fields are provably immune (sabotage test:
  remove the protection → red).
- Clearing history still removes everything it should (`clearMemoryFiles` +
  digests + atoms path unchanged).

**Depends on:** R0, R1.

---

## Phase R3 — Retrieval quality: entity links + prospection

**Gap:** Era 1 Phase 4 (partial) and Phase 5 (never built). The mechanism of
"the AI forgot" is usually that the relevant memory is **not lexically similar**
to the current message — which the current lexical shortlist cannot fix.

**What, in order, each gated on R0 metrics:**

1. **Entity/alias links** — people, places, recurring names ("cast of
   characters" already exists as a surface in Insights). Lets "how is she doing"
   reach a memory stored under a name.
2. **Temporal graph queries** — Era 1's example: *"what has changed about work
   over the last month?"* Uses the existing day digests / session digests /
   rollups rather than a new store.
3. **Prospection (Phase 5)** — before answering, generate 2–3 reflective
   retrieval paths and retrieve for each, then answer.

**Adoption rule:** a change ships only if it improves R0 hit-rate/grounding
**without** an unacceptable precision drop or a budget overrun. Any change that
grows prompt bytes must say what it displaces. Default to rejecting complexity
that does not move the metric.

### Acceptance criteria

- Lexically-non-overlapping probe set goes from baseline to measurably better.
- No probe exceeds the file/total budgets; top-K respected.
- Recall latency stays within the R0-measured band (state the band, or the phase
  fails).

**Depends on:** R0. R1/R2 not required.

---

## Phase R4 — Finish-path performance budget

**Target decided:** keep the title call blocking, lower the cap.
`FINISH_TITLE_TIMEOUT_MS` 8 000 → **2 500 ms** (`app/chat.tsx:49`).

**Justification (measured, not assumed):** entry-title latency with no backlog
is **1.43 s** (`RESEARCH.md` §4). 2 500 ms gives ~1.7× headroom over the measured
p50 while cutting the worst case from 8 s to 2.5 s.

### Work

- Lower the constant.
- Assert the budget in the perf case family (T7xx): **Finish blocking worst case
  ≤ 2 500 ms**, plus recorded p50/p95 for the title call and for
  click → `/entry-reflection`.
- Add a regression guard for the socket-pool failure mode: assert request volume
  stays flat while the reflection screen is open. The original incident was
  **28,214 requests / 1,358 pending** — a flat-line assertion catches a
  reintroduced render loop before it becomes a 60s hang.
- Confirm no new background step was added to the blocking path (the six
  `finishBackgroundStore` steps must stay off it).

### Not in scope

Moving the title off the blocking path. Explicitly declined; the local
`generateTitle` fallback stays a fallback.

### Acceptance criteria

- Finish blocks on exactly one AI call, bounded at 2 500 ms.
- Request count flat on the reflection screen for ≥30 s.
- Title still AI-generated in the happy path (lowering the cap must not
  silently make the fallback the normal case).

**Depends on:** R0 (for the harness).

---

## Phase R5 — Compaction durability

**Gap:** compaction is the literal "loses the past" mechanism — it replaces
older turns with a bounded summary and, under pressure, shrinks the summary
itself, injecting `(N earlier turns compacted; details unavailable in budget.)`
(`RESEARCH.md` §3.6). Whatever it drops is unrecoverable for that turn unless
retrieval can find it again.

**What:**

- Define what is **guaranteed** to survive compaction (identity, clock, day
  digests, memory capsule) versus what is summarized — and make that an asserted
  contract, not an emergent property.
- Compaction must never silently drop a memory/file id the model referenced
  earlier in the turn; if a referenced id can't fit, that is a retrieval failure
  to surface, not a silent truncation.
- Carry the Era 2 invariant forward: assistant summaries can never authorize user
  facts. A compacted summary is not a source.

### Acceptance criteria

- A long session that crosses the compaction threshold still answers a
  needle-recall probe about an early turn **from the store**, not from a
  hallucinated summary.
- The summary never becomes the provenance for a user fact.
- Prompt stays inside the ≥32k requirement for the freeform prompt.

**Depends on:** R0, R1.

---

## Budgets and thresholds (single source of truth)

| Quantity | Value | Source |
|---|---|---|
| Memory file budget | 12 000 chars | `memoryRetrieval.ts:42` |
| Total recall budget | 30 000 chars | `memoryRetrieval.ts:43` |
| Retrieval top-K | 5 | `memoryRetrieval.ts:44` |
| Recall cache TTL | 30 000 ms | `memoryRetrieval.ts:45` |
| Finish blocking worst case | 2 500 ms | **this plan** (was 8 000) |
| Measured title p50 | ~1 430 ms | `RESEARCH.md` §4 |
| Reflection ceiling | 30 000 ms | `useEntryReflection.ts:16` (exists, `076fe31`) |
| Summary token budget | 800–12 000 | `conversationCompact.ts:40-41` |
| Min freeform context | ≥32k tokens | AGENTS.md agent-harness doctrine |
| Concurrent agents | ≤3 | user mandate |

---

## Non-goals

- No `expo-sqlite`, no vectors as source of truth, no new native dependencies.
- No cloud memory, no MIRROR/SHADOW/CLOUD, no resurrection of Era 2 storage keys.
- No Hindsight removal — it stays the deep-history fallback tier.
- No timer that polls while the app is backgrounded.
- No destructive Dream merges. "When unsure, keep separate."
- Not a UI redesign. Settings surfacing reuses existing memory screens.

---

## Verification discipline (per phase)

Follows AGENTS.md workflow:

1. Unit tests for the layer touched; tests are part of the diff.
2. **Sabotage evidence** — break it, confirm red, restore, confirm green. Paste
   real output. Never mock the unit under test.
3. **Live E2E against the running app** for anything touching structured
   extraction, identity, consolidation, or recall — with demo seed cleared
   first (seed pollutes digests and invalidates recall assertions).
4. **Offline gate** — Supabase + Hindsight unreachable, OmniRoute up; journal
   renders, 0 uncaught page errors.
5. Gates: `npx tsc --noEmit`, `npm run lint`, `npm run check:design`,
   `npm test`.
6. `PROGRESS.md` updated with outcomes and follow-ups.

A phase is not done because tests are green — the Jest-green-but-live-broken
failure mode is documented in AGENTS.md and is exactly the risk here.

---

## Risks

| Risk | Mitigation |
|---|---|
| Idle work drains battery / hurts UX | Bound steps per run, no backgrounded timers, yield to active chat |
| Dream rewrites lose content | Keep the "when unsure keep separate" rule, require ≥1 source id per output, keep `_tmp` until promotion succeeds |
| Idle Dream starves the socket pool | Never run during a streaming turn — the finish-hang incident is the precedent |
| Eval overfits to planted needles | Include lexically-non-overlapping and contradiction probes; report precision, not just hit-rate |
| Lowering the title cap makes the fallback normal | Assert the happy path still produces an AI title |
| Scope creep into Era 2 | Archive banner + guard test + explicit non-goals |

---

## Open items for the operator

- Exact idle trigger thresholds (staged-count, hours-since-Dream) are unset —
  R1 proposes defaults and the operator confirms.
- Acceptable Dream false-merge rate is undefined — R2/R3 should propose one.
- Whether R3's prospection ships at all depends on R0 numbers; it may be
  correctly rejected.
