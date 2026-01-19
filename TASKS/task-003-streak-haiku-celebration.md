# Task 003: Streak haiku celebration after reflection

## Problem
The post-finish experience should include a celebratory “streak” moment with an AI-generated haiku (per screenshots).

## Impact
- Increases delight and retention
- Provides a lightweight reward loop tied to journaling

## Proposed Fix
- Add a streak celebration route or modal screen (Expo Router):
  - `app/streak-haiku.tsx` (presented as modal) OR a modal component launched from Entry Reflection
- Compute current streak:
  - Prefer a pure util that derives streak from stored entries
  - Or reuse logic from `hooks/useAchievements.ts` (if it already exposes current streak)
- Generate haiku:
  - Add `services/ai.ts` helper: `generateStreakHaiku({ entryText, streakCount }) -> string[3]`
  - Alternatively, include haiku in the reflection response from Task 001
- UI must match screenshot:
  - Big streak number + "DAY STREAK"
  - Confetti/decoration optional
  - Haiku card
  - Share button
  - Continue button
  - Close (X) button

## Acceptance Criteria
- After pressing Continue on Entry Reflection, streak haiku celebration appears.
- Celebration view displays correct streak count (at minimum: non-zero, consistent with stored entries).
- Haiku renders as 3 lines.
- Continue exits back to the app (Today or Entries) without breaking navigation.
- Close (X) skips celebration and exits.

## References
- User-provided screenshot: "1 DAY STREAK" haiku screen
- Existing streak logic (if any):
  - `app/(tabs)/today.tsx` (stats computation)
  - `hooks/useAchievements.ts`

## Subtasks
1. Implement streak calculation source-of-truth (pure util + tests).
2. Add streak haiku screen/modal UI.
3. Wire Entry Reflection Continue -> streak haiku.
4. Add AI helper for haiku generation (or extend reflection generation).
5. Add tests for navigation and haiku rendering.

## Verification
### Unit/Component Tests
- Add `__tests__/utils/streak.test.ts` (if new util)
- Add `__tests__/screens/StreakHaiku.test.tsx`

Targeted run:
- `npm test -- --testPathPattern=StreakHaiku --runInBand`

### Manual
- Finish an entry; confirm Reflection -> Continue -> Haiku
- Confirm Close works
