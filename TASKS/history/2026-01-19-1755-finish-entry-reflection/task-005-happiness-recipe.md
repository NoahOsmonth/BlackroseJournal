# Task 005: Happiness Recipe (Ingredients + Goals CRUD)

## Problem
The spec requires a Happiness Recipe feature where users can add ingredients/goals, toggle completion, edit items inline, delete with swipe, and view completed items on a dedicated screen.

## Impact
- Adds actionable habit-building to complement journaling
- Provides a second daily interaction loop beyond chat

## Proposed Fix
- Add a dedicated storage service and hook for recipe items.
- Implement Today preview section + full Happiness Recipe screen.
- Use gesture and haptic feedback patterns consistent with the repo.

## Acceptance Criteria
- Add ingredient:
  - Tap "Add ingredient" -> inline input appears -> save/cancel.
- Add goal:
  - Tap "Add goal" -> inline input with goal icon -> save/cancel.
- Manage items:
  - Tap to toggle completion (moves between sections).
  - Long-press to edit.
  - Swipe left to delete with confirm + undo toast.
- Completed dropdown navigates to a "Happiness Recipe" screen showing active + completed with completion dates.
- All operations persist across restarts.

## References
- Spec: Core User Flows section 4
- Design: `example-design/today.html`

## Subtasks
1. Create types + storage service:
   - `services/happinessRecipeStorage.types.ts`
   - `services/happinessRecipeStorage.ts`
2. Create orchestration hook:
   - `hooks/useHappinessRecipe.ts`
3. Implement Today section UI (Task 001 integration).
4. Implement Happiness Recipe screen route (e.g., `app/happiness-recipe.tsx`).
5. Add tests for CRUD and UI interactions.

## Verification
### Unit Tests
- Add `__tests__/services/happinessRecipeStorage.test.ts`
- Targeted run:
  - `npm test -- --testPathPattern=happinessRecipeStorage --runInBand`

### Manual
- Add/edit/complete/delete items; restart app; confirm persistence.
- Verify gestures feel right on both iOS/Android.
