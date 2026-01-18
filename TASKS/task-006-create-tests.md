# Task 006: Update Docs & Contribution Workflow

## Problem
We want the repo to stay organized over time, which requires lightweight, explicit documentation so future changes follow the same rules.

## Impact
- Contributors accidentally violate size limits or SoC.
- Time is wasted rediscovering conventions.

## Proposed Fix
1. Update `README.md` with:
	- folder ownership (app/components/hooks/services/constants)
	- when to create `features/<feature>/...`
	- how to run quality gates
	- design/UI file size rules (200–500 target, 500 max)
2. (Optional) Add `CONTRIBUTING.md` with a short checklist for PRs.

## Acceptance Criteria
- Docs describe the intended structure and SoC boundaries.
- Docs list the quality gate commands: `npm run lint` and `npm test -- --runInBand` (and optional typecheck if added).
- Docs reflect the testing requirement (tests updated/added per change).
- No broken links in docs.

## References
- `AGENTS.md`
- `PLAN.md`

## Subtasks
- Update README structure section.
- Add/refresh contribution checklist.

## Verification
- Validate docs formatting and links.
