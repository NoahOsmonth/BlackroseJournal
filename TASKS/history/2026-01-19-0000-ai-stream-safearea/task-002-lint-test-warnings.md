# Task 002: Eliminate lint + test warnings

## Problem
`expo lint` and/or Jest runs currently emit warnings (even when errors are zero). The user requested these warnings be resolved.

## Impact
- Noisy CI/local output
- Warnings can mask real regressions
- Lower confidence in test signal

## Proposed Fix
- Run the repo quality gate and iteratively remove warnings by fixing the underlying causes (preferred) rather than suppressing rules.
- If a warning cannot be removed without a rule change, document it and justify in `PROGRESS.md`.

## Acceptance Criteria
- `npm run lint` reports **0 errors and 0 warnings**.
- `npm test -- --runInBand` passes and does not emit unexpected console warnings/errors.
- Any required suppressions or rule changes are documented in `PROGRESS.md` with rationale.

## Subtasks
1. Run `npm run lint` and list every warning:
   - Fix issues (unused vars, unsafe console usage, hooks deps, unstable nested components, etc.).
2. Run `npm test -- --runInBand` and address any warnings:
   - Fix `act(...)` warnings by awaiting updates.
   - Remove or explicitly mock noisy `console.*` output.
3. Re-run both until output is clean.
4. Ensure the design file-size check still passes:
   - `npm run check:design`

## Verification
- `npm run lint`
- `npm test -- --runInBand`
- `npm run check:design`
