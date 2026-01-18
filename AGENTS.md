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
## Design Consistency Rules
Maintain a unified look and feel across the app:
- **Use theme tokens:** always pull colors, spacing, fonts, and radii from `constants/theme.ts`—never hardcode values.
- **Consistent spacing:** use a spacing scale (e.g., 4/8/12/16/24) from the theme; avoid magic numbers.
- **Typography:** stick to the defined font families, sizes, and weights in the theme; add new variants to theme first.
- **Component patterns:** reuse existing primitives from `components/ui/` before creating new ones.
- **Naming conventions:** component and style names should be descriptive and follow existing patterns (PascalCase components, camelCase styles/props).
- **Dark/light mode:** ensure new UI respects both color schemes; test visually when possible.
- **Animation style:** keep motion subtle and consistent (use Reanimated patterns already in the codebase).
- **Accessibility:** include accessibility labels/roles; maintain sufficient color contrast.
- **Review before adding:** if a new pattern or color is needed, discuss or document the rationale to avoid one-offs.
## Testing Rules (Required)
- Every change must include **new or updated tests**.
- Prefer user-centric assertions (visible text, accessibility labels) over implementation details.
- Keep snapshots small and intentional; avoid large snapshots.
- For logic/services: test success + failure paths with mocks.
- If a test isn’t feasible, document the reason in `PROGRESS.md` and create a follow-up task.
## Test Folder Organization (`__tests__/`)
Keep the test folder structured to prevent clutter as tests grow:
- **Flat structure OK for now** (< 10 files), but organize when scaling.
- **Naming convention:** `<Subject>.test.ts(x)` — match the source file name.
- **Subfolder strategy (when > 10 tests):**
  - `__tests__/components/` — component-level tests (ChatMessage, Header, etc.)
  - `__tests__/hooks/` — hook tests (useChatOrchestration, etc.)
  - `__tests__/services/` — service/API tests (ai.ts, storage, etc.)
  - `__tests__/screens/` — integration/screen tests (ChatScreen, etc.)
- **Colocated helpers:** test utilities can live in `__tests__/helpers/` or inline if small.
- **Avoid duplication:** shared mocks go in `__tests__/mocks/` or `__mocks__/` (Jest convention).
- **Max test file size:** aim for **< 300 lines**; split if tests grow too large.
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
