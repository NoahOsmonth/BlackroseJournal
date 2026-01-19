# Task 004: Stats Detail Modals (Streak / Entries / Words)

## Problem
Today’s stat cards must open modals with detailed breakdowns (calendar streak view, monthly entries, word count trend) and smooth slide-up/dismiss UX.

## Impact
- Adds depth and exploration to the Today experience
- Drives retention via visibility into progress

## Proposed Fix
- Add a modal route or component-based modal system for the three stats.
- Implement minimal charting using lightweight components (prefer existing dependencies; add `react-native-svg` only if needed).

## Acceptance Criteria
- Tapping each stat card opens a modal:
  - Streak: calendar view + longest/current streak
  - Entries: monthly bar chart + totals
  - Words: line graph + average words per entry
- Modal slides up from the bottom and dismisses smoothly.
- Close button (X) at top; tapping backdrop dismisses.
- Works in light/dark mode.

## References
- Spec: Core User Flows section 3
- Design: `example-design/today.html` (stats cards)

## Subtasks
1. Create modal screens/components:
   - `components/stats/StreakModal.tsx`
   - `components/stats/EntriesModal.tsx`
   - `components/stats/WordsModal.tsx`
2. Wire stat cards in Today to open the appropriate modal.
3. Add minimal chart components (pure + testable):
   - `components/stats/charts/*`
4. Add tests for open/close behavior and core labels.

## Verification
### Unit/Component Tests
- Add `__tests__/screens/TodayStatsModals.test.tsx`
- Targeted run:
  - `npm test -- --testPathPattern=TodayStatsModals --runInBand`

### Manual
- Validate animation feel and backdrop dismiss.
- Validate charts render without layout overflow.

