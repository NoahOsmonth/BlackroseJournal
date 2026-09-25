# PLAN — Current Plan and Documentation Map

**Status 2026-09-24.** There is no single active forward plan. The app is in a
maintained, feature-complete local-only state; open work is a small set of
gated follow-ups (see [PROGRESS.md → Open follow-ups](PROGRESS.md)).

**Standing rule:** nothing here resurrects the cloud-memory platform, its
storage keys (`@rosebud_cloud_memory_mirror_outbox`,
`@rosebud_memory_dataset_binding`), or any remote memory tier. The app is
local-only by decision (2026-09-18); guard test:
`__tests__/backend-local-only.test.ts`.

## Open work (in priority order)

1. **Fix note deletion** — deleting a note from Explore must also remove its
   `'note'` memory file (via `deleteMemoryFilesBySourceSessions`) and journal
   entry. Currently only the atom shard is deleted, so the note stays
   searchable. Smallest, highest-value fix on the list.
2. **Retrieval gating for staged notes** — `memory_search` can miss a `_tmp`
   note whenever any formal thread exists; the fix belongs in
   `memoryRetrieval.ts`'s project_memory branch, not the write path.
3. **R3 (entity/alias → temporal → prospection)** — only after a
   real-restatement ledger prices supersession on journal-like data. The R0
   ledger's `superseded: 0` is by design, so the gate is unmet.
4. **Insight dock a11y parity** — Escape / Android back-to-close; optional
   label shortening to un-stagger the icon row (copy change, needs a call).
5. **Doc drift** — `design.md:227` in the explore spec still describes the
   pre-fix drift mechanism.

## Documentation map

Where each kind of document lives. Root filenames are fixed by
`AGENTS.md` (workflow step 1 and the key-files table), so `PLAN.md`,
`PROGRESS.md`, and `memory.md` stay at the root; everything else lives under
`docs/`.

| Path | Kind | What it holds |
|---|---|---|
| [`PLAN.md`](PLAN.md) | **plan** | This file: current plan + doc map |
| [`PROGRESS.md`](PROGRESS.md) | **log** | Work log, newest effort last; full text in git history |
| [`memory.md`](memory.md) | **reference** | Memory-system contract: stores, write/read paths, tool doctrine (implementation-shaped, verified against code) |
| [`AGENTS.md`](AGENTS.md) | **rules** | Coding standards, workflow, E2E gates, storage-key ownership, what NOT to touch |
| [`notes/local-only-storage.md`](notes/local-only-storage.md) | **reference** | Local-only architecture: account identity, AI transport, storage keys, backup/restore |
| [`README.md`](README.md) | onboarding | Setup, SoC architecture, quality gates |
| `docs/README.md` | index | One-screen index of everything under `docs/` |
| `docs/plans/` | **plans** | Approved, screen-level design plans (e.g. `blackrose-design-rewrite.md`) |
| `docs/superpowers/plans/` | plans | Historical executable plans (offline-memory waves, agent loop, explore write path); superseded by `PROGRESS.md`'s log but kept for line-level traceability |
| `docs/superpowers/specs/` | specs | Design specs for the plans above, incl. the HTML visual companion |
| `docs/compose/spec/` | specs | Agent-loop finality spec (status-only continue) |
| `docs/qa/` | QA | `TEST_PLAN.md` (index + dashboard), `cases/*.csv` (the tracker), `DEFECTS.md`, `results/` (dated run summaries), `AI-HANDOFF-PROMPT.md` |
| `.planning/offline-memory/` | **plans** | The DONE offline-memory rework: `PLAN.md` + `RESEARCH.md` |
| `.planning/context-retention/` | **plans** | Context-retention plan (R0–R5); R0–R2.6 landed, R3 gated — read `PLAN.md` for the phases, `RESEARCH.md` for the evidence base |
| `.planning/debug/` | post-mortems | Resolved debug sessions (e.g. the finish-entry hang) |
| `.planning/archive/` | **read-only** | Recovered Era 1/2 memory documents. **Nothing here is executable**; mine for requirements and invariants only (see its README) |
| `example-design/concepts/UI_MAP.md` | design | Screen-by-screen production UI map + Blackrose redesign status; concept PNGs in `generated/` are design source, not test output |
| `QA-Plan.md` | QA | QA program charter (root level per the charter's own references) |

## Deleting documents

- Planning docs move to `.planning/archive/` (with a provenance banner) rather
  than vanishing — the Era 1/2 deletion caused two live docs to dangle until
  they were recovered from git.
- Retiring a design concept requires deleting the PNG **and** updating
  `UI_MAP.md` in the same change (AGENTS.md prototype-validation rule).
- `PROGRESS.md` condenses rather than accumulates: when it grows past
  ~400 lines, fold finished efforts into one dated paragraph per era and keep
  the full text in git history.
