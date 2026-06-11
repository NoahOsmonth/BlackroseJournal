# Plan Execution Simulation - 2026-06-11

## Scope

This pass executed the active `plan/` work for the chat/intention/model surface:

- Default app/backend model set to `nvidia/nemotron-3-ultra-550b-a55b`.
- Persona defaults, custom model context lookup, backend defaults, examples, and tests updated.
- Intention editing now routes through conversational refinement by default.
- Deprecated Today daily journaling card removed.
- Chat autosave/resume, route reachability, visual layout, and live model response paths simulated.

## Real API Checks

Real NanoGPT checks used the configured local `.env` keys without printing secrets.

- Direct non-streaming `POST /chat/completions` with
  `nvidia/nemotron-3-ultra-550b-a55b`: HTTP 200, returned
  `BlackroseJournal Nemotron Ultra smoke ok.`
- Direct streaming `POST /chat/completions` with the same model: HTTP 200,
  streamed and returned `BlackroseJournal Nemotron Ultra smoke ok.`
- Gated integration:
  `RUN_INTEGRATION_TESTS=1 npm run test:run -- --runTestsByPath __tests__/integration/nanoGptRealKey.test.ts --forceExit`
  passed 3 tests against the real configured NanoGPT path.

## Automated Gates

Latest full-suite pass:

- `npm run test:run -- --forceExit` - 101 suites passed, 3 skipped; 333 tests passed, 8 skipped.
- `npx tsc --noEmit --pretty false` - passed.
- `npm run lint` - passed.
- `npm run check:design` - passed, 139 files, 0 warnings.
- `cd backend && npm test` - passed.
- `cd backend && npx tsc --noEmit --pretty false` - passed.
- `git diff --check` - passed.

Focused regression checks after the browser-warning fixes:

- `npm run test:run -- --runTestsByPath __tests__/ChatMessage.test.tsx __tests__/components/TypingIndicator.test.tsx __tests__/components/ResumeSessionBanner.test.tsx --forceExit`
  passed 3 suites and 9 tests.
- `npx tsc --noEmit --pretty false` - passed.

## Browser Simulation

Expo web ran at `http://localhost:19006`. Playwright captured the route matrix in
`documentation/screenshots/`:

- `today.png`
- `entries.png`
- `insights.png`
- `memory.png`
- `settings.png`
- `chat.png`
- `morning.png`
- `evening.png`
- `ask-rosebud.png`
- `memory-graph.png`
- `drafts.png`
- `persona-generate.png`

Representative inspected screenshots showed:

- Settings and chat headers display `nemotron 3 ultra 550b a55b - 1M ctx`.
- The bottom navigation and pinned chat footer did not obscure the inspected content.
- Ask Rosebud, Memory Graph, Drafts, persona generation, Morning Intention, and Evening Reflection were reachable.

## Chat Autosave Simulation

The first chat simulation sent a real browser chat prompt and navigated to History.
Saved result: `documentation/screenshots/chat-simulation.txt`.

- `chat_text_seen=true`
- `resume_banner_or_resume_text_seen=true`
- The History screen showed `Resume your last conversation` with the last user prompt.

## Console Findings And Fixes

Initial Playwright console capture exposed:

- Nested button warning in `ResumeSessionBanner`.
- React Native Web raw text warning while chat streamed.
- Existing require-cycle warning:
  `services/ai/ai.ts -> services/ai/useChat.ts -> services/ai/ai.ts`.
- Existing RN web deprecation warnings for `shadow*` and `props.pointerEvents`.

Fixes made:

- `ResumeSessionBanner` now uses a `View` container with sibling resume/dismiss `Pressable`s.
- `TypingIndicator` now renders dot `View`s instead of text bullet glyphs.
- `ChatMessage` now keeps streaming text plain, uses Markdown only for completed AI content with explicit Markdown syntax, renders reasoning as plain text, and coerces `hasReasoning` to a boolean so empty reasoning does not become a raw child.

Final live chat rerun:

- Result file: `documentation/screenshots/chat-rerun-result.txt`.
- `body_includes_expected_phrase=true`.
- No nested button warnings.
- No raw text node warnings.
- Only residual relevant console item was the existing AI service require-cycle warning.

## Residual Notes

- The AI service require cycle remains as pre-existing technical debt.
- RN web `shadow*` and `props.pointerEvents` deprecation warnings were seen during broad route capture.
- A Supabase config warning appeared on one broad route capture where Supabase env values were not present in that browser route context.
- Expo reported package-version warnings when the dev server started; they did not block simulation.
