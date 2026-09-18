# QA-Plan.md — Blackrose QA Program Charter

> **Status:** Documentation phase complete · Execution phase: pending (handoff prompt ready)
> **Owner:** Product/QA (you) · **Executor:** QA AI via playwriter.dev handoff prompt
> **Last updated:** 2026-09-17

## 1. Goal

Build a real, human-style QA program for Blackrose: **document every test case first, then execute them one by one against the running app, and mark Pass/Fail back in the tracker** — exactly like a QA manager's Excel sheet.

The tracker lives in `docs/qa/cases/` as one CSV per suite (opens directly in Excel). Execution happens against the real app (Expo web build in Chrome via **playwriter.dev**, and real devices where the case says so). Failures go to `docs/qa/DEFECTS.md`.

## 2. Scope

**In scope (app features, local-only):**
- Journal (compose, stream, drafts, finish, detail, reflection)
- Check-ins & intentions (morning, evening, intention chat)
- Goals
- Memory & insights (atoms, memory graph, digests, recall, saved insights)
- Identity (preferred name, facts)
- Settings & account (model config, clear history, demo data, backups)
- Theme & visual (light + dark vs. concept images)
- Performance & responsiveness
- Persistence & lifecycle (background, kill, offline)
- Negative & accessibility

**Explicitly out of scope (per product decision):**
- ❌ Auth — **retired 2026-09-18**: the app has no sign-in/sign-up/password-recovery surface (`app/(auth)/` deleted) and a device-local account id instead. The 10 `AUTH.csv` cases are superseded and moved out of the active set to `docs/qa/cases/retired/AUTH.csv` (history only); `THEME-07` was retired with them.
- ❌ Hindsight long-term memory service — **removed 2026-09-18** (there is no remote memory tier at all)
- ❌ Cloud-memory platform (abandoned — never resurrect)
- ❌ Backend AI proxy — **removed 2026-09-18** (device-direct path is the only path)

## 3. Environment

| Item | Value |
|---|---|
| App under test | Expo web build (`npx expo start --web` / running dev server) |
| Browser | User's own Chrome, driven by **playwriter.dev** (repo skill: `.agents/skills/playwriter/SKILL.md`) |
| Base URL | `http://localhost:8081` (adjust if the dev server picks another port) |
| Auth | None — the app mints a device-local account id on first launch, so every case starts already "signed in" |
| Data state | **Cleared demo data before any memory/recall case** (AGENTS.md rule 8) |
| Color schemes | Every visual case is run **light AND dark** |
| Pre-flight gate | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run check:design` — all green before execution begins |

## 4. Suite inventory

| # | Suite | CSV | Cases | Automatable via playwriter.dev |
|---|---|---|---|---|
| 01 | ~~AUTH~~ (retired 2026-09-18 — no auth surface) | `docs/qa/cases/retired/AUTH.csv` | ~~10~~ | n/a |
| 02 | JOURNAL | `docs/qa/cases/JOURNAL.csv` | 12 | Web yes; haptics manual |
| 03 | CHECKINS | `docs/qa/cases/CHECKINS.csv` | 9 | Mostly yes |
| 04 | GOALS | `docs/qa/cases/GOALS.csv` | 7 | Mostly yes |
| 05 | MEMORY | `docs/qa/cases/MEMORY.csv` | 10 | Recall yes (cleared demo) |
| 06 | IDENTITY | `docs/qa/cases/IDENTITY.csv` | 5 | Mostly yes |
| 07 | SETTINGS | `docs/qa/cases/SETTINGS.csv` | 10 | Mostly yes |
| 08 | THEME | `docs/qa/cases/THEME.csv` | 12 (11 active — THEME-07 retired) | Screenshot compare yes |
| 09 | PERFORMANCE | `docs/qa/cases/PERFORMANCE.csv` | 7 | Timings yes; battery manual |
| 10 | RESPONSIVE | `docs/qa/cases/RESPONSIVE.csv` | 8 | Viewport emulation yes |
| 11 | LIFECYCLE | `docs/qa/cases/LIFECYCLE.csv` | 8 | Web partial; kill/offline manual |
| 12 | NEGATIVE | `docs/qa/cases/NEGATIVE.csv` | 9 | Mostly yes |
| — | **Total** | | **97 active** (107 historical) | |

## 5. Execution workflow (one-by-one, Excel style)

1. **Pre-flight:** run the 4-command gate; record results in the run summary.
2. **Prepare:** boot the app; clear demo data if any memory/recall case is next.
3. **For each case, in CSV order:**
   a. Read the row (Pre-conditions → Steps → Expected Result).
   b. Execute it in the app (playwriter.dev automates web cases; steps marked *manual* are executed by the user on device).
   c. Return to the CSV: set `Status` (Pass / Fail / Blocked / N/A), `Date`, `Evidence` (screenshot path, log path, or verbatim reply), `Notes`.
   d. Any Fail → open a defect row in `docs/qa/DEFECTS.md` (DEF-###), link the Case ID.
4. **After each session:** append a dated summary to `docs/qa/results/`.
5. **After fixes:** re-run only failed cases; update status and defect resolution.

## 6. Status legend

| Status | Meaning |
|---|---|
| `Untested` | Not yet executed (default) |
| `Pass` | Matches expected result |
| `Fail` | Deviates from expected result — defect required |
| `Blocked` | Cannot execute (environment/pre-condition missing) — note why |
| `N/A` | Not applicable to the tested platform |

## 7. Rules of engagement

- **Document first:** all 107 cases are written before execution begins; no ad-hoc case invention mid-run (new findings → defects, and if recurring, a new documented case).
- **Memory/recall cases** run against **cleared demo data**; assistant replies captured **verbatim**.
- **Every visual case** checks light and dark; screenshots are the evidence.
- **Never weaken an expectation** to make a case pass; a wrong expectation gets the case *edited deliberately* with a note, not silently.
- **AGENTS.md layering rules apply** to any fix work arising from defects.
- Nothing outside `docs/qa/`, `QA-Plan.md`, and `PROGRESS.md` is modified during execution (fixes are separate diffs).

## 8. Historical regressions (permanent P1 watchlist)

From AGENTS.md "Living changelog of pain" — these bugs shipped before; their cases may never be dropped:

1. **Lost memory atoms** (concurrent AsyncStorage writes) → LIFECYCLE kill-mid-finish cases
2. **Broken spacing on Goals** (`space-*` silently dropped on native) → GOALS visual cases
3. **Dark-mode invisible text / stuck-black chrome** → THEME full sweep
4. **Recall day-slip** (write date vs. event weekday) → MEMORY recall cases with dated prose

## 9. Artifacts

| Artifact | Purpose |
|---|---|
| `QA-Plan.md` | This charter |
| `docs/qa/TEST_PLAN.md` | Master index of suites and cases |
| `docs/qa/cases/*.csv` | The test-case tracker (the "Excel") |
| `docs/qa/DEFECTS.md` | Defect log |
| `docs/qa/results/` | Dated run summaries |
| `docs/qa/AI-HANDOFF-PROMPT.md` | Copy-paste prompt for the QA executor AI (playwriter.dev) |
