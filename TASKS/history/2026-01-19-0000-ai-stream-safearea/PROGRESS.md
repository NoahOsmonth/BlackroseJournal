# Progress

## Checklist
- [x] Task 001: Fix web theme toggle + persistence
- [x] Task 002: Eliminate lint + test warnings

## Updates

### 2026-01-19

#### Task 001: Fix web theme toggle + persistence
- Enabled Tailwind class-based dark mode required by NativeWind manual scheme overrides.
- Hardened `useThemeSettings` to:
	- load/apply stored preference safely
	- avoid React hook dependency warnings
	- only update local state after NativeWind successfully applies the scheme
- Updated regression tests to assert explicit `system` theme application when no preference exists.

Files changed:
- `tailwind.config.js`
- `hooks/useThemeSettings.ts`
- `__tests__/hooks/useThemeSettings.test.tsx`

Commands run:
- `npm test -- --testPathPattern=useThemeSettings --runInBand`

Verification:
- Targeted tests passed.

#### Task 002: Eliminate lint + test warnings
- Removed unused variables flagged by ESLint.
- Fixed `react-hooks/exhaustive-deps` warnings by including Reanimated shared values in effect deps.
- Eliminated Jest console noise:
	- added a global `@expo/vector-icons` mock in `jest.setup.js` to prevent Icon async state updates (act warnings)
	- silenced expected `console.error` in the API error-path test of `useChatOrchestration`

Files changed:
- `app/ask-rosebud.tsx`
- `app/chat.tsx`
- `components/ChatMessage.tsx`
- `components/InlineTypingInput.tsx`
- `jest.config.js`
- `jest.setup.js`
- `__tests__/useChatOrchestration.test.ts`

Commands run:
- `npm run lint`
- `npm test -- --runInBand`
- `npm run check:design`

Verification:
- Lint: 0 errors, 0 warnings
- Tests: all passing, no unexpected console warnings/errors
- Design check: passed

