# ROADMAP — Blackrose Journal

**Status 2026-11-07.** The app is feature-complete and local-only; this file is the
human-readable forward view: what comes next toward Rosebud parity and what is
explicitly parked. The old open-work list was stale and has been removed; the
live board is the only place work is tracked. It replaces the old root `PLAN.md`.

**Live tracker: Kaneo** at <http://192.168.1.188:5173> (workspace `Blackrose`,
project `Blackrose Journal`). Every item below already exists there as a card,
and cards are the source of truth for status. This file is the narrative mirror;
when they disagree, the board wins. Drive it with `uvx mcp2cli @kaneo ...` (see
AGENTS.md rule 0).

**Standing rule:** nothing here resurrects the cloud-memory platform, its storage
keys (`@rosebud_cloud_memory_mirror_outbox`,
`@rosebud_memory_dataset_binding`), or any remote memory tier. The app is
local-only by decision (2026-09-18); guard test:
`__tests__/backend-local-only.test.ts`.

## Next — Rosebud-parity features we do not have yet

Candidate list, not committed scope. Pick one, write the plan, then implement.

| Feature | Why it matters | Notes |
|---|---|---|
| Voice journaling | Talk an entry out instead of typing | No audio capture in the app today; needs `expo-audio`/`expo-av` plus a transcription step |
| Photo entries | Attach an image to a journal entry or chat turn | `expo-image-picker` is installed but unused on the journal write path |
| Scheduled reminders | Nudge at morning/evening check-in time | No notification stack yet; needs `expo-notifications` + local scheduling |
| Weekly recap | Rolled-up week in the app (and maybe email) | Rollups exist (`memoryRollupStorage`); the weekly *surface* does not |
| Letters to future self | Write now, unlock later | Pure local feature; fits the offline doctrine cleanly |
| Mood tracking | Light per-entry mood signal feeding insights | Atoms carry salience; no explicit mood axis |
| Guided prompt library | Browse and start from a prompt | Prompt weave is centralized in `features/chat/flows` |
| Entry export as image | Share a page of the journal | Export paths exist for backup bundles only |

## Later — parked

- Habit tracking beyond goals/intentions.
- Email-in journaling (needs a server; conflicts with the local-only rule).

## Done

Closed 2026-10-07: note deletion, staged-note retrieval gating, insight-dock a11y,
explore-spec doc drift, baked-in integration model ids, stale `UI_MAP.md` Account
row, and model-less provider rename.

## Documentation map

Root filenames are fixed by `AGENTS.md` (workflow step 1 and the key-files
table), so `ROADMAP.md` and `memory.md` stay at the root; everything else lives
under `docs/`.

| Path | Kind | What it holds |
|---|---|---|
| [`ROADMAP.md`](ROADMAP.md) | **plan** | This file: forward view + doc map |
| [`memory.md`](memory.md) | **reference** | Memory-system contract: stores, write/read paths, tool doctrine (implementation-shaped, verified against code) |
| [`AGENTS.md`](AGENTS.md) | **rules** | Coding standards, workflow, E2E gates, storage-key ownership, what NOT to touch |
| [`notes/local-only-storage.md`](notes/local-only-storage.md) | **reference** | Local-only architecture: account identity, AI transport, storage keys, backup/restore |
| [`README.md`](README.md) | onboarding | Setup, SoC architecture, quality gates |
| `docs/README.md` | index | One-screen index of everything under `docs/` |
| `docs/plans/` | **plans** | Approved, screen-level design plans (e.g. `blackrose-design-rewrite.md`) |
| `docs/compose/spec/` | specs | Agent-loop finality spec (status-only continue) |
| `docs/qa/` | QA | `TEST_PLAN.md` (index + dashboard), `cases/*.csv` (the tracker), `DEFECTS.md`, `results/` (dated run summaries) |
| `example-design/concepts/UI_MAP.md` | design | Screen-by-screen production UI map + Blackrose redesign status; concept PNGs in `generated/` are design source, not test output |

## Deleting documents

- Retired planning docs leave the tree; git history is the archive. If a kept
  document links one, drop the link in the same change.
- Retiring a design concept requires deleting the PNG **and** updating
  `UI_MAP.md` in the same change (AGENTS.md prototype-validation rule).
- Work logs are not kept as a root document; what shipped and why lives in the
  commit messages, the pull requests, and the docs under `docs/`.
