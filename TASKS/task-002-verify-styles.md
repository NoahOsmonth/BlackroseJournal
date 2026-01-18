# Task 002: Modularize Chat Feature (SoC)

## Problem
Chat-related UI and state orchestration can easily become entangled as features grow (streaming, reasoning, typing, scrolling, persistence). We want a clean, feature-oriented structure that keeps `app/` routes thin and prevents UI from doing I/O.

## Impact
- Large screen files and complex components become harder to maintain.
- SoC boundaries get blurry (UI components fetching/streaming).
- Tests become brittle because responsibilities are mixed.

## Proposed Fix
1. Introduce a feature module for chat (e.g., `features/chat/`).
2. Move chat-only components into `features/chat/components/` and logic into `features/chat/hooks/`.
3. Keep `services/ai.ts` as the I/O boundary; hooks call services; UI calls hooks.
4. Keep `app/index.tsx` (and other routes) thin: compose UI + invoke hooks.

## Acceptance Criteria
- `app/` route files remain thin (render + wiring only; no heavy business logic).
- Chat orchestration is in hooks (state, streaming lifecycle, side effects).
- UI components do not import services directly.
- All chat-related tests pass (existing tests updated as needed).

## References
- `AGENTS.md`
- React Native testing overview: https://reactnative.dev/docs/testing-overview

## Subtasks
- Create `features/chat/` folder structure and move chat-specific code.
- Add a small public surface (index exports) for the chat feature.
- Update imports and tests.

## Verification
- Run `npm run lint`.
- Run `npm test -- __tests__/ChatScreen.test.tsx`.

