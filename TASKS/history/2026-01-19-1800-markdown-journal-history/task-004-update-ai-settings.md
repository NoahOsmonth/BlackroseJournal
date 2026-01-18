# Task 004: Consolidate UI Primitives & Theme Helpers

## Problem
Reusable UI patterns and theme values can end up duplicated across screens/components, which increases file size and makes design changes harder.

## Impact
- Inconsistent UI and styling patterns.
- Theme changes require touching many files.
- Risk of circular dependencies when styles and components import each other.

## Proposed Fix
1. Keep `components/ui/` reserved for small, atomic primitives.
2. Centralize theme values in `constants/theme.ts` (and small helper modules if needed).
3. Move repeated styling patterns into helpers (pure functions/objects), not into screens.
4. Ensure no services import UI and no theme helpers import services.

## Acceptance Criteria
- Shared primitives live in `components/ui/` and are used consistently.
- Theme/style helpers are centralized and do not create circular imports.
- No design/UI file exceeds 500 lines.
- Lint and tests pass.

## References
- `constants/theme.ts`
- `components/ui/*`
- `AGENTS.md`

## Subtasks
- Identify duplicated patterns (buttons, text, containers, spacing).
- Extract to `components/ui/` or `constants/theme.ts` helpers.
- Update usages.

## Verification
- Run `npm run lint`.
- Run `npm test -- --runInBand`.

