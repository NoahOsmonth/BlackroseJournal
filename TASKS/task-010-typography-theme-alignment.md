# Task 010: Typography & Theme Token Alignment

## Problem
The two example designs use different typography and token sets:
- `example-design/today.html` uses Nunito and a specific token palette
- `example-design/journal-history.html` (currently implemented) uses Inter and a slightly different palette

The spec also requires using theme tokens and consistent light/dark behavior.

## Impact
- Visual cohesion and design accuracy
- Prevents UI drift caused by hardcoded values

## Proposed Fix
- Decide on a typography strategy:
  - Prefer a single app-wide font if it can still match both designs, otherwise document per-screen font choices.
- Ensure all new UI uses `constants/theme.ts` tokens.
- Add any missing tokens needed to match both HTML references.

## Acceptance Criteria
- Typography decision is documented in PLAN or in-code comment.
- Today and Entries match their respective HTML references.
- New UI uses theme tokens (no ad-hoc hex colors scattered across components).
- Light and dark modes remain readable and consistent.

## References
- Design: `example-design/today.html`
- Design: `example-design/journal-history.html`
- Theme tokens: `constants/theme.ts`

## Subtasks
1. Audit current token usage vs both HTML designs.
2. Add missing tokens to `constants/theme.ts`.
3. Decide whether to add Nunito font:
   - if yes, add Google font package + load in `app/_layout.tsx`
4. Update affected components to use tokens.
5. Add/adjust tests that snapshot key typography classes where practical.

## Verification
### Automated
- `npm run check:design`
- `npm test -- --runInBand`

### Manual
- Visual compare Today + Entries against their HTML references in both light/dark.

