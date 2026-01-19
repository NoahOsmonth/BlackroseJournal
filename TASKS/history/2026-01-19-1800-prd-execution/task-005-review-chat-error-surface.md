# Task 005 (Review): Surface AI errors in Chat UI

## Problem
When AI calls fail (missing key, HTTP error, network failure), errors are currently logged to console and loading state is cleared, but the user may not see an actionable explanation.

## Impact
- Confusing UX: chat appears to “do nothing” after a send.
- Harder to support / debug for non-developers.

## Proposed Fix
- Add a small, accessible UI error state for chat:
  - Inline banner near the composer, or a toast/snackbar.
  - Include a Retry action.
  - Ensure input is re-enabled.
- For missing-key specifically, prefer wording that helps developers: "Missing NANO_GPT_API_KEY".

## Acceptance Criteria
- On AI error, user sees a visible error message within 1 second.
- Retry triggers a new request.
- Error message is accessible (screen reader reads it) and does not rely on color alone.
- Tests cover at least one failure path (mock streamChat error -> UI message visible).

## Notes
- Keep business logic in hooks; UI should just render state from `useChatOrchestration`.
