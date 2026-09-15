# Archived Plan Documents

Read-only reference. **Nothing in this directory is executable.** These files
were recovered from git history so that prior architecture work is not lost
again; they were deleted from the tree on purpose.

Created 2026-09-15 by recovering the three memory eras from git.

## Why this exists

The memory architecture went through three eras. The documents for the first
two were deleted, and two live docs kept pointing at them:

- `PLAN.md` listed five cloud-memory files as "the approved 2026-07-28
  architecture" — all deleted a month earlier.
- `memory.md` pointed at `docs/superpowers/plans/2026-08-18-hindsight-integration.md`
  — also deleted.

## Era 1 — Rosebud Memory Loom (phone-local)

| | |
|---|---|
| File | `idea.md` |
| Authored | before 2026-06 |
| Deleted | 2026-09-01, commit `3d044aa` ("dead-code + stale-scratch sweep") |
| Recovered from | `3d044aa^` |

The phone-local design the current memory system descends from: the **memory
atom** primitive, six layers (working / episodic / semantic / profile /
procedural / note), the weekly consolidation loop, a five-phase roadmap, and an
evaluation rubric.

Roadmap status — this matters, because it is where the current gaps are:

| Phase | Content | Status |
|---|---|---|
| 1 | Episodic/profile/semantic atoms, bounded capsule in chat, weekly summary, local backup | **landed** — `services/memory/localMemory.ts`, `useLocalMemoryContext` |
| 2 | Manual note memory + inspection UI | **landed** — `source: 'manual'` atoms protected from pruning (`localMemory.ts:190`), Memory Hub |
| 3 | Weekly consolidation by a **background worker when the app is idle**; contradiction fading | **not built** |
| 4 | Hybrid retrieval — embeddings, entity links, FTS, temporal graph | **partial** — embeddings on session digests/rollups + graph; no SQLite (explicit non-goal) |
| 5 | Prospection-guided retrieval | **not built** |

Phases 3–5 are live input to the context-retention plan.

Verified as of 2026-09-15: `services/memory/memoryRollupBuild.ts:22` states it
runs on app open "— not a background timer"; the only `AppState` listener in the
repo is `services/supabase/supabaseClient.ts` (auth refresh). So there is no
idle/background consolidation scheduler anywhere.

## Era 2 — Cloud-Authoritative Memory, Phases 0–9

| | |
|---|---|
| Files | `docs/superpowers/plans/2026-07-2[89]-cloud-memory-*.md`, `docs/superpowers/specs/2026-07-2[89]-*.md` |
| Authored | 2026-07-28 – 2026-08-01 |
| Deleted | 2026-08-18, commit `f2415ff` ("remove abandoned cloud-memory plan docs") |
| Recovered from | `f2415ff^` |

Ten independently reviewable subprojects on `codex/cloud-memory-phase-N`
branches, moving `LOCAL → MIRROR → SHADOW → CLOUD` with Phase 9 as the only gate
that could retire local heavy stores.

> **DO NOT IMPLEMENT.** The platform was removed, not deferred. AGENTS.md:
> *"never resurrect it or its storage keys"* — `@rosebud_cloud_memory_mirror_outbox`,
> `@rosebud_memory_dataset_binding`. Guard: `__tests__/backend-local-only.test.ts`.

Mine these for **requirements and invariants** — the Global Constraints section
of the master roadmap is a dense list of hard-won rules (single signed writer
lease, never dual-write, local authority retained until gates pass, current
user-authored evidence as the only autobiographical truth source, source edit or
tombstone immediately invalidates dependent projections, "memory relevance never
grants permission to mention", no natural-language keyword routing, tests in
every task). None of that depends on the cloud platform existing.

Do **not** mine them for schema, branches, storage keys, or orchestration.

## Era 3 — Offline memory rework (current)

Not archived here; it lives at `.planning/offline-memory/PLAN.md` +
`RESEARCH.md` and is marked DONE 2026-09-12. It replaced Era 2's cloud path with
on-device file-semantic memory (`services/memory/memoryFiles.ts`,
`memoryRetrieval.ts`, Dream consolidation, Drive backup) and demoted Hindsight to
a fallback tier.

## Also archived

| File | Note |
|---|---|
| `docs/superpowers/plans/2026-08-18-hindsight-integration.md` | Deleted 2026-08-18 by `88845b1` ("remove superpowers framework from workspace") — a different commit from the cloud-memory removal. Recovered from `88845b1^`. Hindsight itself still exists as the deep-history fallback tier (`services/memory/hindsight/`), so this document is historical, not forbidden. |

## Provenance

Every file carries a banner naming its deletion commit and the blob it was
recovered from. Content below the banner is byte-identical to the original tree
except for that banner and a one-line provenance comment.
