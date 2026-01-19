# Progress

## Checklist
- [x] Task 001: Fix AI streaming on mobile (null body)
- [x] Task 002: Remove hardcoded AI secrets + configure env
- [x] Task 003: Eliminate SafeAreaView deprecation warning
- [x] Task 004: Untrack .env + add guard
- [x] Task 005: Surface AI errors in chat UI
- [x] Task 006: Fix web AI env loading
- [x] Task 007: Align chat document layout
- [x] Task 008: Add Go deeper send button

## Updates

### Task 001: Fix AI streaming on mobile (null body)
- Added streaming capability detection and non-streaming fallback with clearer error context.
- Added unit coverage for streaming, fallback, and HTTP error paths.
- Files: `services/ai.ts`, `__tests__/services/ai.test.ts`.
- Verification: `npm run lint`, `npm test -- --runInBand`, `npm run check:design`.

### Task 002: Remove hardcoded AI secrets + configure env
- Removed hardcoded AI key and centralized config via Expo app config + constants.
- Added `.env.example`, updated `.gitignore`, and documented env setup in README.
- Added missing-key test coverage.
- Manual: rotate the previously exposed API key in the Nano GPT dashboard.
- Files: `services/ai.ts`, `services/aiConfig.ts`, `app.config.ts`, `.env.example`, `.gitignore`, `README.md`, `__tests__/services/ai.test.ts`.
- Verification: `npm run lint`, `npm test -- --runInBand`, `npm run check:design`.

### Task 003: Eliminate SafeAreaView deprecation warning
- Added `SafeAreaProvider` at the app root.
- Added regression guard test to prevent `react-native` SafeAreaView imports.
- Files: `app/_layout.tsx`, `__tests__/SafeAreaViewImports.test.ts`.
- Verification: `npm run lint`, `npm test -- --runInBand`, `npm run check:design`.

### Task 004: Untrack .env + add guard
- Removed `.env` from git tracking and added a guard test to prevent re-tracking.
- Manual: rotate any previously exposed API key(s) in the Nano GPT dashboard.
- Files: `__tests__/envTracking.test.ts`.
- Verification: `npm run lint`, `npm test -- --runInBand`, `npm run check:design`.

### Task 005: Surface AI errors in chat UI
- Added user-visible error banner with retry/dismiss actions in chat.
- Exposed error state + retry from `useChatOrchestration` and added tests.
- Files: `features/chat/hooks/useChatOrchestration.ts`, `app/chat.tsx`, `__tests__/ChatScreen.test.tsx`, `__tests__/useChatOrchestration.test.ts`.
- Verification: `npm run lint`, `npm test -- --runInBand`, `npm run check:design`.

### Task 006: Fix web AI env loading
- Added EXPO_PUBLIC_* fallbacks for Expo web env inlining in AI config.
- Added EXPO_PUBLIC_* entries to `.env` for local web development.
- Added test coverage for EXPO_PUBLIC fallback behavior.
- Files: `services/aiConfig.ts`, `.env`, `__tests__/services/ai.test.ts`.
- Verification: `npm test -- --runInBand __tests__/services/ai.test.ts`.

### Task 007: Align chat document layout
- Updated chat message and inline typing components to use document-style typography (no bubbles).
- Added ChatMessage component tests covering reasoning toggle behavior.
- Files: `components/ChatMessage.tsx`, `components/InlineTypingInput.tsx`, `constants/markdownStyles.ts`, `__tests__/components/ChatMessage.test.tsx`.
- Verification: `npm test -- --runInBand`.

### Task 008: Add Go deeper send button
- Added Go deeper CTA (mobile-style) that sends the inline message and disabled state when empty/loading.
- Moved footer actions into the scroll flow so buttons move down as chat grows.
- Added InlineTypingInput text-change coverage and updated ChatScreen tests for Go deeper behavior.
- Files: `app/chat.tsx`, `components/FooterActions.tsx`, `components/InlineTypingInput.tsx`, `__tests__/ChatScreen.test.tsx`, `__tests__/InlineTypingInput.test.tsx`.
- Verification: `npm test -- --runInBand`.

---

## Review Notes (2026-01-19)

### Verification (reviewer)
- Ran: `npm test -- --runInBand` (PASS: 17/17 suites)
- Ran: `npm run check:design` (PASS: 0 errors, 0 warnings)
- Ran: `npm run lint` (no issues reported in output)

### Follow-ups
- **P0:** Rotate any previously exposed API key(s) if not already rotated.



