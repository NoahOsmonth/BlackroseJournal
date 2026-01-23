# Task: Implement Insights Page UI

## Problem
The `Insights` tab is missing. Users need a visual dashboard of their writing habits and emotional trends.

## Impact
Users cannot access the weekly analysis features.

## Proposed Fix
Create `app/(tabs)/insights.tsx` and necessary components, strictly following `example-design/insights.html`.

### Subtasks
1.  **Navigation:** Add `insights` to `app/(tabs)/_layout.tsx`.
2.  **Components:** Create `components/insights/` folder.
    -   `WeeklyReportCard.tsx`: "Unlocks Saturday" logic.
    -   `WritingStatsCard.tsx`: Words, Entries, Daily Words bar chart (using `View` and Flexbox).
    -   `EmotionalLandscapeChart.tsx`: Bar chart with emojis (using `View` and Flexbox).
    -   `KeyThemes.tsx`: Chip layout.
    -   `CastOfCharacters.tsx`: List.
3.  **Screen:** Assemble these in `app/(tabs)/insights.tsx`.
4.  **Hook:** Create `hooks/useWeeklyInsights.ts` to fetch data (mocked for now if backend not ready, but ideally real).
    -   Calculate "Writing Stats" locally from `services/journalStorage.ts`.
    -   Call `generateWeeklyInsights` for the rest.

## Acceptance Criteria
-   Page matches `example-design/insights.html` layout and styling.
-   Charts render data correctly (heights proportional to values).
-   Dark mode is supported (using `nativewind`).
-   File sizes adhere to `AGENTS.md` (< 500 lines).

## Verification
-   Manual verification via Expo Go (if possible) or visually checking code structure against design.
-   Component tests: `npm test __tests__/components/insights` (create these).
