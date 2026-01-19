# Task 003: Navigation Alignment (5-item Tab Bar + Header Links)

## Problem
The spec requires a 5-item bottom navigation with a centered elevated FAB, plus consistent header navigation (Gift -> Rewards, Menu -> Settings). Current navigation may not match the Today design exactly.

## Impact
- Consistent navigation across core flows
- Ensures the app matches the provided HTML references

## Proposed Fix
- Implement a custom tab bar that matches `example-design/today.html`.
- Ensure the FAB is always visible and triggers new entry creation.
- Standardize header behavior across screens.

## Acceptance Criteria
- Bottom nav renders (Today, Explore, FAB, Entries, Settings) matching the Today HTML:
  - FAB elevated, centered, with border ring against background
  - Proper active/inactive colors and label styles
- FAB navigates to chat for a brand-new entry.
- Gift icon navigates to `/rewards`.
- Menu icon navigates to Settings tab.
- Navigation state is correct and stable across stack transitions.

## References
- Spec: Core User Flows section 8 and 9
- Design: `example-design/today.html`

## Subtasks
1. Add `components/navigation/TabBar.tsx` (custom tab bar).
2. Update `app/(tabs)/_layout.tsx` to use the custom tab bar.
3. Ensure the centered FAB does not shift layout or overlap content incorrectly.
4. Update headers on Today/Entries/Explore/Settings to follow the same pattern.

## Verification
### Unit/Component Tests
- Add `__tests__/components/TabBar.test.tsx`
- Targeted run:
  - `npm test -- --testPathPattern=TabBar --runInBand`

### Manual
- Validate FAB press animation and correct navigation.
- Validate active tab styling matches both designs.

