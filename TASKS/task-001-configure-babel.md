# Task 001: Add Maintainability Guardrails (Line Limits + SoC)

## Problem
We want a very organized repo, but there is no automated enforcement for:
- design/UI file size limits (target 200–500 lines; max 500)
- basic maintainability thresholds (components <200, files <400 where feasible)
- separation-of-concerns boundaries (UI vs hooks vs services)

## Impact
- Design/UI files can quietly grow past 500 lines.
- Refactors get riskier and reviews get harder.
- SoC violations creep in (UI calling services; circular imports).

## Proposed Fix
1. Add a repo script that scans design/UI globs (per `AGENTS.md`) and reports line counts.
2. Fail when any design/UI file is > 500 lines; warn when >= 450 lines.
3. Wire the script into `package.json` scripts (e.g., `check:design`).
4. (Optional) Add ESLint overrides for `max-lines` / `max-len` where it helps (keep it practical).

## Acceptance Criteria
- `npm run check:design` exists and fails if any design/UI file exceeds 500 lines.
- Output clearly lists offending files and their line counts.
- Scan scope matches `AGENTS.md` design/UI definition.
- The command is documented (README or CONTRIBUTING).

## References
- `AGENTS.md`

## Subtasks
- Create `scripts/check-design-limits.*` (Node script) with clear output.
- Add `check:design` (and optionally `check`) scripts to `package.json`.

## Verification
- Run `npm run check:design` (verify it fails when expected, passes when clean).
- Run `npm run lint`.
- Run `npm test -- --runInBand`.
