# Task: Implement AI Service for Weekly Insights

## Problem
The current `services/ai.ts` lacks a function to analyze a week's worth of entries and generate the structured data required for the Insights page (Emotional Landscape, Themes, Characters).

## Impact
The Insights page cannot display the "Week So Far" section without this backend logic.

## Proposed Fix
Add `generateWeeklyInsights(entries: JournalEntry[])` to `services/ai.ts`.

### Logic
1.  Filter entries to the current week (or provided range).
2.  Construct a prompt that sends the text of these entries to the AI.
3.  Request JSON output with:
    -   `emotionalLandscape`: `{ emotion: string, score: number (0-10), emoji: string }[]`
    -   `keyThemes`: `string[]`
    -   `castOfCharacters`: `string[]`
    -   `weeklySummary`: `string`
4.  Parse and validate the response.
5.  Handle error/fallback (e.g., return empty stats if AI fails).

## Acceptance Criteria
-   `generateWeeklyInsights` exists and is exported.
-   Returns `Promise<WeeklyInsightsResult>`.
-   Includes error handling (try/catch with fallbacks).
-   Unit tests in `__tests__/services/ai.test.ts` (create if missing or add to existing) verify strict JSON parsing.

## Verification
-   `npm test services/ai.ts` (or relevant test file).
