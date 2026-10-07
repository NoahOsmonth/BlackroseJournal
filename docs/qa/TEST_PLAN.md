# Blackrose QA — Master Test Plan

> **Tracker:** the CSVs in [`cases/`](cases/) are the source of truth (open in Excel).
> **Retired cases** live in [`cases/retired/`](cases/retired/) and are excluded from the counts below.
> **Charter:** [`../../QA-Plan.md`](../../QA-Plan.md) · **Defects:** [`DEFECTS.md`](DEFECTS.md) · **Executor prompt:** [`AI-HANDOFF-PROMPT.md`](AI-HANDOFF-PROMPT.md)

## Execution status dashboard

| Suite | CSV | Cases | Pass | Fail | Blocked | N/A | Untested |
|---|---|---|---|---|---|---|---|
| ~~AUTH~~ (retired 2026-09-18 — no auth surface) | [cases/retired/AUTH.csv](cases/retired/AUTH.csv) | ~~10~~ | — | — | — | — | — |
| CHECKINS | [cases/CHECKINS.csv](cases/CHECKINS.csv) | 9 | 7 | 0 | 1 | 0 | 1 |
| GOALS | [cases/GOALS.csv](cases/GOALS.csv) | 7 | 6 | 0 | 1 | 0 | 0 |
| IDENTITY | [cases/IDENTITY.csv](cases/IDENTITY.csv) | 5 | 4 | 0 | 0 | 1 | 0 |
| JOURNAL | [cases/JOURNAL.csv](cases/JOURNAL.csv) | 12 | 12 | 0 | 0 | 0 | 0 |
| LIFECYCLE | [cases/LIFECYCLE.csv](cases/LIFECYCLE.csv) | 8 | 6 | 0 | 0 | 0 | 2 |
| MEMORY | [cases/MEMORY.csv](cases/MEMORY.csv) | 10 | 9 | 0 | 1 | 0 | 0 |
| NEGATIVE | [cases/NEGATIVE.csv](cases/NEGATIVE.csv) | 9 | 8 | 0 | 0 | 0 | 1 |
| PERFORMANCE | [cases/PERFORMANCE.csv](cases/PERFORMANCE.csv) | 7 | 5 | 0 | 1 | 0 | 1 |
| RESPONSIVE | [cases/RESPONSIVE.csv](cases/RESPONSIVE.csv) | 8 | 8 | 0 | 0 | 0 | 0 |
| SETTINGS | [cases/SETTINGS.csv](cases/SETTINGS.csv) | 10 | 8 | 0 | 1 | 1 | 0 |
| THEME | [cases/THEME.csv](cases/THEME.csv) | 12 | 11 | 0 | 0 | 1 | 0 |
| **Total** | | **97** | **84** | **0** | **5** | **3** | **5** |
*Executed 92 of 97 — 84 Pass / 0 Fail / 5 Blocked / 3 N/A / 5 Untested (run 4, 2026-10-07).*
*Scope change 2026-09-18: the 10 AUTH cases retired and THEME-07 retired with them (the local-only refactor removed every auth surface and the remote tiers) — 107 → 97 active cases. AUTH is preserved at `cases/retired/AUTH.csv`; THEME-07 stays as a `Retired` row so its ID is never reused.*
*Round 2 (2026-10-07) closed the PLAN/PROGRESS follow-ups and live-verified the fixes plus the offline boot gate — no new tracker cases, dashboard unchanged: [`results/2026-10-07-round2-live.md`](results/2026-10-07-round2-live.md).*

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
