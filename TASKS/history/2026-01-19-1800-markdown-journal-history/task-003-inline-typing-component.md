# Task 003: Split Oversized Design/UI Files

## Problem
We have strict size standards:
- Design/UI files: target 200–500 lines (max 500)
- Components: <200 lines sweet spot
- Functions: 5–15 lines

Without an active refactor pass, files will drift past these thresholds.

## Impact
- Oversized UI files become "god components".
- Bugs hide in complexity (deep nesting, repeated logic).
- Harder diffs and slower iteration.

## Proposed Fix
1. Run a line-count audit for all design/UI files (as defined in `AGENTS.md`).
2. For any file >500 lines: split into subcomponents/hooks/helpers.
3. For files approaching 450+ lines: proactively extract responsibilities.
4. Keep behavior stable; focus on shape/structure, not UI redesign.

## Acceptance Criteria
- No design/UI file exceeds 500 lines.
- Large components are decomposed to <200 lines where feasible.
- Functions stay within the 5–15 line guideline when practical.
- Tests are updated/added for touched areas; all tests pass.

## References
- `AGENTS.md`

## Subtasks
- Identify top offenders (line count + complexity).
- Extract:
	- UI-only subcomponents into `components/` or `features/<x>/components/`
	- state + orchestration into `hooks/` or `features/<x>/hooks/`
	- pure helpers into `utils/` (if created) or colocated helper files.

## Verification
- Run `npm test -- --runInBand`.
- Run `npm run lint`.

