# Agent Operating Guide

## Purpose
Keep the repo clean, modular, and easy to maintain while protecting long-term UX and test quality.

## Non-negotiables ✅
- **Design/UI file size limit:** target **200–500 lines**, hard max **500 lines**.
	- **Design/UI files include:** anything under `app/`, `components/`, `components/ui/`, `global.css`, `constants/theme.ts`, and any theme/style helpers.
	- If a file approaches **450 lines**, split it (extract subcomponents, hooks, styles, or helpers).
- **Code size standards (industry guide):**
	- **Function length:** target **5 lines**; acceptable **5–15 lines** if still single-responsibility.
	- **Component/class size:** **< 200 lines** is the sweet spot.
	- **General file size:** aim for **< 400 lines**; **400–600** only with strong justification.
	- **Critical threshold:** **1,000+ lines** is a refactor stop sign.
	- **Line width:** **80–120 characters** to prevent horizontal scrolling.
	- **Complexity over length:** avoid deep nesting; prefer flatter control flow over long nested `if` chains.
- **Separation of concerns:** UI renders, hooks manage state, services handle I/O.
- **Tests are mandatory for changes:** update existing tests or add new ones every change.

## Repo Structure & Ownership
- `app/`: routes + screens (no heavy business logic).
- `components/`: reusable UI and composite components.
- `components/ui/`: small, atomic UI primitives only.
- `hooks/`: state, data-flow orchestration, side-effects.
- `services/`: API/AI/network/storage integrations.
- `constants/`: theme and static configuration values.
- `__tests__/`: Jest tests (prefer colocated test helpers when needed).

## Separation of Concerns Rules
- UI components **do not** call network/services directly.
- Services **do not** import UI components.
- Hooks **may** call services but should expose simple state + actions to UI.
- Keep utilities pure and side-effect free.
- Avoid circular dependencies across layers.

## Modularity Rules
- One file, one responsibility.
- Prefer composition over large “all-in-one” components.
- Extract repeated UI into `components/` and repeated logic into `hooks/`.
- Keep component props minimal and typed.

## Testing Rules (Required)
- Every change must include **new or updated tests**.
- Prefer user-centric assertions (visible text, accessibility labels) over implementation details.
- Keep snapshots small and intentional; avoid large snapshots.
- For logic/services: test success + failure paths with mocks.
- If a test isn’t feasible, document the reason in `PROGRESS.md` and create a follow-up task.

## Agent Workflow Plan
1. Read `PLAN.md`/`TASKS/` and confirm scope.
2. Identify impacted files and ensure design files stay within the 200–500 line target (max 500).
3. Implement changes with strict SoC and modular structure.
4. Add/update tests for every change.
5. Run relevant tests and fix failures.
6. Update `PROGRESS.md` with outcomes and any follow-ups.

## Definition of Done
- Design/UI files stay within the 200–500 line target (max 500).
- Functions/components/files follow the code size standards above.
- Tests added/updated and passing.
- No new lint/type errors.
- `PROGRESS.md` updated with what changed.
