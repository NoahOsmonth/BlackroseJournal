# Blackrose QA — Master Test Plan

> **Tracker:** the CSVs in [`cases/`](cases/) are the source of truth (open in Excel).
> **Retired cases** live in [`cases/retired/`](cases/retired/) and are excluded from the counts below.
> **Charter:** [`../../QA-Plan.md`](../../QA-Plan.md) · **Defects:** [`DEFECTS.md`](DEFECTS.md) · **Executor prompt:** [`AI-HANDOFF-PROMPT.md`](AI-HANDOFF-PROMPT.md)

## Execution status dashboard

| Suite | CSV | Cases | Pass | Fail | Blocked | N/A | Untested |
|---|---|---|---|---|---|---|---|
| ~~AUTH~~ (retired 2026-09-18 — no auth surface) | [cases/retired/AUTH.csv](cases/retired/AUTH.csv) | ~~10~~ | — | — | — | — | — |
| CHECKINS | [cases/CHECKINS.csv](cases/CHECKINS.csv) | 9 | 6 | 0 | 0 | 0 | 3 |
| GOALS | [cases/GOALS.csv](cases/GOALS.csv) | 7 | 6 | 0 | 1 | 0 | 0 |
| IDENTITY | [cases/IDENTITY.csv](cases/IDENTITY.csv) | 5 | 4 | 0 | 0 | 1 | 0 |
| JOURNAL | [cases/JOURNAL.csv](cases/JOURNAL.csv) | 12 | 12 | 0 | 0 | 0 | 0 |
| LIFECYCLE | [cases/LIFECYCLE.csv](cases/LIFECYCLE.csv) | 8 | 2 | 0 | 0 | 0 | 6 |
| MEMORY | [cases/MEMORY.csv](cases/MEMORY.csv) | 10 | 8 | 0 | 1 | 0 | 1 |
| NEGATIVE | [cases/NEGATIVE.csv](cases/NEGATIVE.csv) | 9 | 5 | 0 | 0 | 0 | 4 |
| PERFORMANCE | [cases/PERFORMANCE.csv](cases/PERFORMANCE.csv) | 7 | 4 | 0 | 1 | 0 | 2 |
| RESPONSIVE | [cases/RESPONSIVE.csv](cases/RESPONSIVE.csv) | 8 | 8 | 0 | 0 | 0 | 0 |
| SETTINGS | [cases/SETTINGS.csv](cases/SETTINGS.csv) | 10 | 6 | 0 | 1 | 0 | 3 |
| THEME | [cases/THEME.csv](cases/THEME.csv) | 12 | 11 | 0 | 0 | 1 | 0 |
| **Total** | | **97** | **72** | **0** | **4** | **2** | **19** |
*Executed: 77 of 97 — 72 Pass / 0 Fail / 4 Blocked / 1 N/A / 19 Untested (run 3, 2026-09-17; all 13 defects closed except the S4 DEF-013).*
*Scope change 2026-09-18: the 10 AUTH cases retired and THEME-07 retired with them (the local-only refactor removed every auth surface and the remote tiers) — 107 → 97 active cases. AUTH is preserved at `cases/retired/AUTH.csv`; THEME-07 stays as a `Retired` row so its ID is never reused.*

## Case ID convention

`<SUITE>-<NN>` — e.g. `AUTH-01`, `JOURNAL-07`, `MEM-05`. IDs are stable; never renumber. Retired cases are marked `N/A` rather than deleted.

## Two-pass rules (visual suites)

- THEME cases are executed **light then dark** in one sitting; each screenshot pair is the evidence (charter §5).
- RESPONSIVE cases run across the viewport/device matrix; each device result is recorded in the row's `Notes`.

## How to update status

- Edit the CSV row for the executed case: `Status`, `Date`, `Evidence`, `Notes`.
- Update the dashboard numbers above to match.
- Failures also open a defect in `DEFECTS.md`.
- Append a dated run summary in `results/`.

## Pre-flight gate (before first case of any session)

```bash
npm test
npx tsc --noEmit
npm run lint
npm run check:design
```

All four green → execution permitted. Any red → record in the run summary and execute documentation-only (no device cases).
