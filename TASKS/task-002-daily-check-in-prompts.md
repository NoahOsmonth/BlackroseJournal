# Task 002: Daily Check-In Prompts (Time-Based) + Chat Context

## Problem
The Daily Check-In flow requires time-based prompts and a chat initialization path that displays the prompt as a system message and triggers an AI follow-up.

## Impact
- Core journaling loop for everyday usage
- Ensures chat is context-aware (daily check-in vs freeform vs continue-entry)

## Proposed Fix
- Add a small prompt selector utility (pure function) that returns the correct prompt block based on local time.
- Extend chat route to accept an explicit mode and prompt context via route params.
- Ensure chat shows a system message for the prompt and triggers the first AI follow-up.

## Acceptance Criteria
- Time windows match the spec:
  - Morning (5am-11am)
  - Afternoon (12pm-4pm)
  - Evening (5pm-9pm)
  - Night (10pm-4am)
- Today > "Check in now" opens chat configured for daily check-in.
- Chat shows a system message containing the chosen prompt title and supporting text.
- AI sends a follow-up question based on the prompt (can be via system prompt augmentation or first user-visible assistant message).
- While AI responds:
  - input is disabled
  - a loading indicator is shown
  - streaming text is used for AI messages
- On save/finish, user returns to Today or Entries (per existing navigation).

## References
- Spec: Core User Flows section 1

## Subtasks
1. Create `constants/dailyPrompts.ts` with the four prompts.
2. Add `services/dailyPrompt.ts` (or `hooks/useDailyPrompt.ts`) with a pure selector:
   - input: Date
   - output: { period, title, promptText }
3. Update Today screen "Check in now" CTA to navigate to chat with params:
   - `mode=dailyCheckIn`
   - `promptPeriod=<morning|afternoon|evening|night>`
4. Update `app/chat.tsx` (or orchestration hook) to:
   - render a system message for the prompt
   - trigger first AI follow-up
5. Add unit tests for prompt selection boundaries.

## Verification
### Unit Tests
- Add `__tests__/dailyPrompt.test.ts`
- Targeted run:
  - `npm test -- --testPathPattern=dailyPrompt --runInBand`

### Manual
- Change device time (or mock Date in dev build) and confirm prompt changes.
- Tap Today > Check in now and confirm prompt appears as system message.

