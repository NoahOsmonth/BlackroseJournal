# Task 006: Ask Rosebud (Insights Chat + Time Range)

## Problem
Ask Rosebud is an insights chat that analyzes journal history over selectable time ranges and references specific entries with dates.

## Impact
- Differentiating feature: turns journaling into actionable self-insight
- Requires careful UX (loading/streaming) and safe prompt design

## Proposed Fix
- Build an Ask Rosebud screen and route.
- Create a small service layer that:
  - fetches entries for the selected time range
  - constructs an analysis prompt
  - streams an AI response
- Render tappable entry references that navigate back to the corresponding entry.

## Acceptance Criteria
- Ask Rosebud screen exists and is reachable from Today.
- Time range selector supports: All-time, This year, This month, This week.
- Suggested question cards exist and trigger analysis.
- AI responses stream and include references to entries with dates.
- Entry references are tappable and navigate to the entry.

## References
- Spec: Core User Flows section 5

## Subtasks
1. Add route/screen (e.g., `app/ask-rosebud.tsx`).
2. Add UI components:
   - time range selector
   - suggested question cards
   - chat transcript
3. Add service helper for collecting entries + building the AI request.
4. Add parsing strategy for entry references (explicit markup in AI output or heuristics).
5. Add tests for time range selection and request-building with mocks.

## Verification
### Unit/Component Tests
- Add `__tests__/screens/AskRosebud.test.tsx`
- Targeted run:
  - `npm test -- --testPathPattern=AskRosebud --runInBand`

### Manual
- Create a few entries, then Ask Rosebud for patterns; verify references navigate correctly.

