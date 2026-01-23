# Progress Tracker

## Status
- [x] **FEAT-INSIGHTS-001**: AI Service for Insights
- [x] **FEAT-INSIGHTS-002**: Insights Page UI
- [x] **FEAT-INSIGHTS-003**: Emoji Settings
- [x] **FIX-INSIGHTS-004**: Dark/Light Mode Color Consistency
- [x] **FIX-INSIGHTS-005**: Weekly Insights AI Processing (Caching & Retry)

## Updates
- **2026-01-22**: Initialized plan for Insights page.
- **2026-01-22**: Implemented `generateWeeklyInsights` in `services/ai.ts` with unit tests.
- **2026-01-22**: Implemented `app/(tabs)/insights.tsx`, `hooks/useWeeklyInsights.ts`, and UI components (`EmotionalLandscapeChart`, `KeyThemes`, `CastOfCharacters`).
- **2026-01-22**: Updated `BottomNav` to include "Insights" and "History".
- **2026-01-22**: Implemented Emoji Style settings in `useThemeSettings` and `SettingsScreen`.
- **2026-01-22**: Connected Emoji Style to `EmotionalLandscapeChart`.
- **2026-01-22**: Verified with tests (`EmotionalLandscapeChart.test.tsx`, `BottomNav.test.tsx`).
- **2026-01-22**: Fixed dark/light mode color inconsistency on Insights page:
  - Added `text-primary-light` (#111827) and `text-primary-dark` (#F9FAFB) tokens to tailwind.config.js
  - Updated `text-secondary-light` (#6B7280) and `text-secondary-dark` (#9CA3AF) to match example design
  - Enhanced `KeyThemes.tsx` to match design (main theme as large title, secondary as pills)
  - Enhanced `EmotionalLandscapeChart.tsx` with emotion tags and dynamic opacity for active/inactive emotions
  - All 152 tests passing
- **2026-01-22**: Fixed Weekly Insights AI Processing issues:
  - **Weekly Persistence**: Created `services/weeklyInsightsStorage.ts` for caching insights by week key
  - **Caching Logic**: Hook now checks cache first, only calls AI once per week (or when entry count changes)
  - **Retry Logic**: Added retry mechanism with 3-second delays and max 3 retries for JSON parsing and rate limit errors
  - **Files Modified**:
    - `services/weeklyInsightsStorage.ts` (new) - Storage service for weekly insights caching
    - `services/ai.ts` - Added retry logic with `delay()`, `isRetryableError()`, and retry loop in `generateWeeklyInsights`
    - `hooks/useWeeklyInsights.ts` - Added cache check and save, `forceRefresh` option
  - **Tests Added**:
    - `__tests__/services/weeklyInsightsStorage.test.ts` (new) - 10 tests for storage functions
    - `__tests__/services/aiInsights.test.ts` - 6 tests updated/added for retry logic
  - All 166 tests passing, no TypeScript errors, no new lint errors
- **2026-01-23**: Unified navigation + organized hooks/services:
  - Added shared `AppHeader` for Today/History and routed actions through `useHeaderActions` + `useTabNavigation`.
  - Updated Today/Entries screens and WeekdaySelector to use centralized navigation handlers.
  - Organized hooks/services into feature folders with compatibility re-exports.
  - Updated screen tests for new navigation calls and hook paths.
- **2026-01-23**: Test stabilization after refactor:
  - Fixed AI insights test mock to target `services/ai/aiConfig`.
  - Corrected web re-export in `services/stagewiseToolbar.web.ts`.
  - Re-ran Jest: all 168 tests passing.