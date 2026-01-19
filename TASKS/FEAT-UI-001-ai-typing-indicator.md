# Task 003: AI typing indicator + disabled interactions

## Problem
Loading states are inconsistent: chat shows a spinner or text, Ask Rosebud uses a spinner, and click targets remain active while AI is responding.

## Impact
- Users cannot tell when the AI is crafting a response.
- Interactions can be triggered during loading, causing confusing UX.

## Proposed Fix
- Add a chat-style animated ellipsis bubble for AI typing.
- Disable interaction on streaming ChatMessage (reasoning toggle) while loading.
- Disable Ask Rosebud suggested question cards and inputs while AI is generating.
- Ensure daily check-in shows the same indicator when AI initiates the first response.

## Acceptance Criteria
- Chat shows a non-clickable animated ellipsis bubble while AI is streaming.
- Check-in now flow shows the same indicator for the initial AI response.
- Ask Rosebud shows the indicator and disables suggested question cards + input during loading.
- ChatMessage interactions (reasoning toggle) are disabled during streaming.
- UI tests cover loading/disabled states.

## References
- app/chat.tsx
- components/ChatMessage.tsx
- components/InlineTypingInput.tsx
- app/ask-rosebud.tsx
- app/(tabs)/today.tsx

## Subtasks
- Add a reusable typing indicator component or extend ChatMessage for ellipsis state.
- Wire indicator into chat streaming and Ask Rosebud loading state.
- Update interactions to be disabled while loading.
- Add UI tests for loading + disabled states.

## Verification
- Unit tests: `npm test -- --runInBand __tests__/ChatScreen.test.tsx __tests__/AskRosebud.test.tsx`
- Manual check: start a check-in and confirm ellipsis indicator appears and buttons are disabled.
