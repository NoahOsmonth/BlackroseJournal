# Task 008: Rewards Screen (Achievements)

## Problem
The spec requires a Rewards screen reachable via the gift icon, showing streak information and achievements with progress, including a celebration animation for newly unlocked items.

## Impact
- Motivation loop and retention driver
- Centralizes progress feedback beyond raw stats

## Proposed Fix
- Create a Rewards screen and a small achievements model.
- Compute achievement progress from stored journal entries.

## Acceptance Criteria
- Gift icon navigates to Rewards screen.
- Rewards screen shows:
  - current streak
  - achievements grid
  - progress for locked achievements
- Tapping an achievement shows details.
- Celebration animation occurs when viewing newly unlocked achievements (manual verification acceptable).

## References
- Spec: Core User Flows section 7

## Subtasks
1. Create `constants/achievements.ts` (definitions + thresholds).
2. Create `hooks/useAchievements.ts` (compute progress/unlocks).
3. Add `app/rewards.tsx` UI.
4. Wire gift icons on screens to `/rewards`.
5. Add tests for progress computation.

## Verification
### Unit Tests
- Add `__tests__/hooks/useAchievements.test.ts`
- Targeted run:
  - `npm test -- --testPathPattern=useAchievements --runInBand`

### Manual
- Create entries to unlock an achievement and confirm UI updates.
