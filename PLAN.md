# Epic Plan: Weekly Insights & Analytics

## Goal
Implement a fully functional **Insights** tab that provides AI-powered weekly analysis of the user's journal entries. The design must strictly follow `example-design/insights.html`. Key features include an Emotional Landscape chart, Key Themes, Cast of Characters, and writing statistics. Additionally, users must be able to customize the emoji style used in the analytics.

## Design References
- `example-design/insights.html` (Strict adherence required)
- `AGENTS.md` (Code style and limits)

## Scope
1.  **AI Backend:** new `generateWeeklyInsights` in `services/ai.ts`.
2.  **Data Logic:** `hooks/useWeeklyInsights.ts` to aggregate data and call AI.
3.  **UI Implementation:**
    -   `app/(tabs)/insights.tsx`
    -   Components: `WeeklyReportCard`, `WritingStatsCard`, `WeekSoFarCard` (with charts).
    -   Navigation update.
4.  **Settings:** Emoji style customization.

## Architecture
- **Service Layer:** `services/ai.ts` handles prompt engineering and JSON parsing for insights.
- **Hook Layer:** `hooks/useWeeklyInsights.ts` manages state, storage access, and AI calls.
- **UI Layer:** Pure presentational components in `components/insights/` composed in `app/(tabs)/insights.tsx`.
- **State/Settings:** `hooks/useThemeSettings.ts` or similar for persisting emoji preference.

## Quality Gate
```bash
npm run lint
npm test -- --runInBand
npm run check:design
```

## Testing Strategy
-   **Unit Tests:**
    -   `services/ai.ts`: Mock network calls, verify JSON parsing and fallback logic.
    -   `hooks/useWeeklyInsights.ts`: Verify data aggregation (word counts) and loading states.
    -   Components: Snapshot tests for charts and cards.
-   **Integration:**
    -   Verify the full flow from "Settings change" -> "Insights update".

## Definition of Done
-   Insights tab matches the HTML design pixel-perfect (within RN constraints).
-   "Daily Words" and "Emotional Landscape" charts render correctly with dynamic data.
-   AI analysis returns valid themes and characters.
-   Emoji settings work and persist.
-   Code complies with `AGENTS.md` (file size limits).