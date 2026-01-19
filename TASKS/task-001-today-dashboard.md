# Task 001: Today Dashboard Screen (Design + Day Navigation)

## Problem
The epic spec requires a Today dashboard that matches `example-design/today.html` and supports day navigation (S M T W T F S) with a calendar shortcut to Entries.

## Impact
- Primary entry point for daily check-ins
- Anchors several downstream flows (stats modals, Happiness Recipe, Ask Rosebud)

## Proposed Fix
- Implement the Today UI in `app/(tabs)/today.tsx` using small extracted components under `components/today/`.
- Add a lightweight day-selection hook (e.g., `hooks/useSelectedDay.ts`) so the weekday selector can drive screen state.
- Use theme tokens from `constants/theme.ts` (avoid hardcoded colors).

## Acceptance Criteria
- Today screen matches `example-design/today.html` (layout, spacing, colors, typography, radii, shadows).
- Header:
  - Left gift icon navigates to Rewards.
  - Title shows formatted date (e.g., "Sunday, Jan 18th").
  - Right menu icon navigates to Settings.
- Weekday selector:
  - Current/selected day is visually highlighted.
  - Tapping a day updates selected day state.
  - Calendar icon navigates to the Entries tab.
- Stats cards for Streak/Entries/Words are present and tappable (wires to Task 004).
- Daily Journaling card is present with a "Check in now" CTA (wires to Task 002).
- Happiness Recipe section preview and action buttons exist (wires to Task 005).
- Ask Rosebud section header + range dropdown UI exists (wires to Task 006).

## References
- Spec: Core User Flows sections 1 and 2
- Design: `example-design/today.html`
- Existing navigation: `app/(tabs)/_layout.tsx`

## Subtasks
1. Split UI into components (keep each <200 lines):
   - `components/today/TodayHeader.tsx`
   - `components/today/WeekdaySelector.tsx`
   - `components/today/StatCard.tsx`
   - `components/today/DailyJournalingCard.tsx`
   - `components/today/HappinessRecipeSection.tsx`
   - `components/today/AskRosebudSection.tsx`
2. Implement `app/(tabs)/today.tsx` composition.
3. Add navigation handlers:
   - Gift -> `/rewards`
   - Menu -> Settings tab
   - Calendar icon -> Entries tab
4. Add accessibility labels and hit slop for small icons.

## Verification
### Unit/Component Tests
- Add `__tests__/screens/TodayScreen.test.tsx`
- Targeted run:
  - `npm test -- --testPathPattern=TodayScreen --runInBand`

### Manual
- Visually compare to `example-design/today.html` (including dark mode).
- Tap weekday buttons and confirm highlight changes.
- Tap calendar icon and confirm Entries opens.

