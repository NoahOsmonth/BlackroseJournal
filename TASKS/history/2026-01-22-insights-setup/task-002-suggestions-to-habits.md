# Task 002: Suggestions list -> add HABIT below Ingredients

## Problem
The Reflection flow needs actionable next steps. Suggestions marked as **HABIT** must be addable to the Happiness Recipe and appear as a new **Habits** section **below Ingredients**.

## Impact
- Turns reflection into action
- Creates an ongoing loop (habits) that complements journaling

## Proposed Fix
- Add a new Suggestions screen route: `app/suggestions.tsx` (or `app/entry-suggestions.tsx`) that:
  - shows HABIT suggestion cards
  - each card has "Add to list" button
- Add a new Happiness Recipe item type:
  - Update `services/happinessRecipeStorage.types.ts`: `RecipeItemType = 'ingredient' | 'habit' | 'goal'`
  - Ensure storage CRUD supports the new type
  - Add dedupe logic (case-insensitive text match) in hook/service when adding habits
- Update `app/happiness-recipe.tsx` UI:
  - Render sections in order: Ingredients, Habits, Goals
  - Habits must be visually below Ingredients
  - Continue supporting completion toggle, edit, delete
  - Prefer section-specific empty states over a single combined list

## Acceptance Criteria
- From Entry Reflection, tapping Suggestions opens the Suggestions list.
- Suggestions list shows HABIT cards and "Add to list" buttons.
- Tapping "Add to list" creates a Happiness Recipe item with `type: 'habit'`.
- Happiness Recipe shows a Habits section **below Ingredients** and renders added habits.
- Duplicates are prevented (case-insensitive). UI reflects already-added state.
- Existing ingredient/goal behavior remains intact.

## References
- Happiness Recipe screen: `app/happiness-recipe.tsx`
- Storage: `services/happinessRecipeStorage.ts`
- Hook: `hooks/useHappinessRecipe.ts`

## Subtasks
1. Create the Suggestions screen and UI components (keep UI files < 500 lines).
2. Implement suggestions data flow:
   - simplest first pass: suggestions come from reflection response
   - pass suggestions via route params OR load from a small transient store in `hooks/`
3. Add `habit` to storage types and update storage tests.
4. Refactor Happiness Recipe screen to render type sections (Ingredients -> Habits -> Goals).
5. Add tests:
   - storage: add habit, dedupe
   - UI: habits section renders below ingredients

## Verification
### Unit/Component Tests
- Update `__tests__/services/happinessRecipeStorage.test.ts`
- Add `__tests__/screens/Suggestions.test.tsx`
- Add `__tests__/screens/HappinessRecipeHabits.test.tsx`

Targeted run:
- `npm test -- --testPathPattern=Suggestions --runInBand`

### Manual
- Finish entry -> Suggestions -> Add to list
- Open Happiness Recipe and confirm habit appears below ingredients
- Restart app and confirm habit persists
