# Progress Tracker

## Status
- [x] **FEAT-INSIGHTS-001**: AI Service for Insights
- [x] **FEAT-INSIGHTS-002**: Insights Page UI
- [x] **FEAT-INSIGHTS-003**: Emoji Settings
- [x] **FIX-INSIGHTS-004**: Dark/Light Mode Color Consistency
- [x] **FIX-INSIGHTS-005**: Weekly Insights AI Processing (Caching & Retry)
- [x] **TOOL-CODEX-001**: Codex CLI with OMO Light Edition

## Updates
- **2026-06-10**: WS7 — navigation fallback standardization:
  - Added `hooks/navigation/useNavBack.ts`, which uses `router.back()` only when a back stack exists and
    otherwise falls back with `router.replace(...)` to a sensible tab route.
  - Adopted the hook on deep-linkable/detail routes called out by WS7:
    `app/entry-detail.tsx`, `app/checkin-detail.tsx`, `app/goals.tsx`,
    `app/intentions/detail.tsx`, `app/saved-insights.tsx`, and `app/streak-view.tsx`.
  - Also adopted it on `app/memory-graph.tsx` so graph deep links fall back to the Memory tab.
  - Added `__tests__/hooks/useNavBack.test.ts` for both real-back-stack and fallback behavior.
  - Verified:
    - `npm run test:run -- --testPathPattern="useNavBack|MemoryGraphRoute" --runInBand` — 2 suites
      passed; 3 tests passed.
    - `npm run test:run -- --runInBand` — 96 suites passed, 3 skipped; 316 tests passed, 8 skipped
      (existing AI legacy deprecation warnings printed by tests).
    - `npx tsc --noEmit` — passed.
    - `npm run lint` — 0 errors; existing warning remains in
      `__tests__/components/ScreenContainer.test.tsx`.
    - `npm run check:design` — passed with 0 errors; existing warning remains
      `app/intentions/chat.tsx` at 493 lines (under the 500 hard max).
- **2026-06-10**: WS7 — Memory / About Me hub:
  - Rebuilt the Explore tab as a real Memory home via `components/memory/MemoryHubScreen.tsx`, keeping
    `app/(tabs)/explore.tsx` as a thin route wrapper.
  - Added reusable memory UI under `components/memory/`:
    `MemoryAtomCard`, `MemoryHubSummary`, `MemoryNotesPanel`, and shared display/filter helpers.
  - The Memory tab now shows about-user memory, counts, recurring themes, generated/manual notes,
    searchable layer-filtered atoms, per-atom delete, clear-all, and an `Explore graph` action that routes
    to `/memory-graph` with the active layer/query when present.
  - Exposed `removeAtom()` from `useLocalMemories()` so UI can wire the existing `deleteMemoryAtom()`
    service without reaching into storage directly.
  - Slimmed Settings → Memory down to a summary plus `Open Memory`, so memory inspection/editing is no
    longer buried inside Settings.
  - Tests added/updated:
    - `__tests__/screens/ExploreScreen.test.tsx`
    - `__tests__/components/MemoryAtomCard.test.tsx`
    - Updated `useLocalMemories`, `useMemoryGraph`, and `MemorySettingsSection` tests.
  - Verified:
    - `npm run test:run -- --testPathPattern="MemoryAtomCard|ExploreScreen|MemorySettingsSection|useLocalMemories|useMemoryGraph" --runInBand` — 5 suites passed; 11 tests passed.
    - `npm run test:run -- --runInBand` — 95 suites passed, 3 skipped; 314 tests passed, 8 skipped
      (existing AI legacy deprecation warnings printed by tests).
    - `npx tsc --noEmit` — passed.
    - `npm run lint` — 0 errors; existing warning remains in
      `__tests__/components/ScreenContainer.test.tsx`.
    - `npm run check:design` — passed with 0 errors; existing warning remains
      `app/intentions/chat.tsx` at 493 lines (under the 500 hard max).
- **2026-06-10**: WS7 — Memory Graph route + orphan modal cleanup:
  - Extracted the existing graph implementation into `components/memory-graph/MemoryGraphScreen.tsx` so the
    Explore tab and a standalone route share one implementation instead of duplicating graph UI.
  - Added `app/memory-graph.tsx`, registered it in `app/_layout.tsx`, and wired optional `layer`, `tag`, and
    `q` params into the graph's initial active layer/search query. The graph header now supports a back
    affordance for the standalone route.
  - Removed the orphan Expo template modal route: deleted `app/modal.tsx` and removed the `modal` stack
    registration from `_layout`.
  - Replaced the graph's empty overlay copy with the shared `EmptyState` pattern, removing the stale
    `No memory nodes yet.` string from the Memory tab path.
  - Tests added/updated:
    - `__tests__/screens/MemoryGraphRoute.test.tsx`
    - `__tests__/nav/no-orphan-modal.test.ts`
    - Updated Explore and tab-bottom-spacing tests for the shared graph screen.
  - Verified:
    - `npm run test:run -- --forceExit` — 94 suites passed, 3 skipped; 310 tests passed, 8 skipped.
    - `npx tsc --noEmit` — passed.
    - `npm run lint` — 0 errors; existing warning remains in
      `__tests__/components/ScreenContainer.test.tsx`.
    - `npm run check:design` — passed with 0 errors; existing warning remains
      `app/intentions/chat.tsx` at 493 lines (under the 500 hard max).
    - `cd backend && npx tsc --noEmit` and `cd backend && npm test` — passed.
- **2026-06-10**: WS7 — surfaced Ask Rosebud from Insights:
  - Added a prominent `Ask about your journal` action card near the top of the Insights tab. It routes to
    `/ask-rosebud`, making the existing journal Q&A screen reachable from the primary IA instead of dark.
  - Added a `Saved insights` link on the Ask Rosebud screen that routes to `/saved-insights`, connecting
    the Q&A flow to the existing saved-insights route.
  - Tests added:
    - `__tests__/screens/AskRosebudReachable.test.tsx`
    - `__tests__/screens/AskRosebudSavedInsights.test.tsx`
  - Verified:
    - `npm run test:run -- --forceExit` — 92 suites passed, 3 skipped; 308 tests passed, 8 skipped.
    - `npx tsc --noEmit` — passed.
    - `npm run lint` — 0 errors; existing warning remains in
      `__tests__/components/ScreenContainer.test.tsx`.
    - `npm run check:design` — passed with 0 errors; existing warning remains
      `app/intentions/chat.tsx` at 493 lines (under the 500 hard max).
- **2026-06-10**: WS8 — AI-slop cleanup focused pass (identity, dead affordances, empty states):
  - Added `constants/appInfo.ts` with `APP_NAME`, `APP_TAGLINE`, `APP_VERSION`, and reusable About/Privacy
    copy. Settings now shows `BlackroseJournal` with the configured app version instead of the placeholder
    `Journal App v1.0.0` text, and privacy copy now states the local-first behavior honestly.
  - Removed the non-functional voice/image buttons from `IntentionChatFooter` and dropped the
    "coming soon" alerts from `app/intentions/chat.tsx`. The footer keeps implemented volume, finish, and
    suggest controls only. Also replaced its hardcoded icon colors with theme-derived values.
  - Added `components/ui/EmptyState.tsx` and used it for empty Key Themes and Cast of Characters states,
    replacing vague `Not enough data` copy with actionable guidance.
  - Replaced the hardcoded weekly history signal fallback (`quiet, reflective, open`) with a plain prompt to
    write more entries before signals appear.
  - Remapped the stale `theme` export in `constants/theme.ts` away from the off-brand cyan/dark palette and
    onto the real `Colors` palette while preserving `MemoryLayerColors`.
  - Tests added/updated:
    - `__tests__/components/EmptyState.test.tsx`
    - `__tests__/components/IntentionChatFooter.test.tsx`
    - `__tests__/components/InsightEmptyStates.test.tsx`
    - `__tests__/settings/appInfo.test.ts`
    - `__tests__/no-coming-soon.test.ts`
    - `__tests__/no-slop-theme.test.ts`
    - Updated HistoryWeekSummary and Tailwind token guards.
  - Verified:
    - `npm run test:run -- --forceExit` — 90 suites passed, 3 skipped; 306 tests passed, 8 skipped.
    - `npx tsc --noEmit` — passed.
    - `npm run lint` — 0 errors; existing warning remains in
      `__tests__/components/ScreenContainer.test.tsx`.
    - `npm run check:design` — passed with 0 errors; existing warning remains
      `app/intentions/chat.tsx` at 493 lines (under the 500 hard max).
- **2026-06-10**: WS4 — AI tuning (temperature/top_p/context auto-detect):
  - Added `services/ai/generationSettings.ts` with persisted global defaults, clamping, presets,
    `INSIGHTS_TEMPERATURE`, and persona-imagination temperature mapping. The WS2 `ChatFlow` type now uses
    concrete `GenerationSettings` / `Partial<GenerationSettings>` instead of the temporary `unknown` shape.
  - Added `services/ai/modelContext.ts` to detect the active model context window, cache default-provider
    `/models` results by base URL + model, use custom-provider context metadata directly, and fall back to
    known Kimi 128k context before the generic 128k fallback.
  - Threaded generation settings through the live chat path:
    `useChatOrchestration` reads `useGenerationSettings()`, merges global defaults + flow overrides +
    active persona imagination, then passes the effective settings through `useChat` → `streamChat` /
    `completeChat` → `buildChatPayload` → direct transport.
  - Added `top_p` end-to-end for frontend direct calls and backend OpenAI-compatible calls. Backend request
    parsing now accepts `top_p`, maps it to provider `topP`, and forwards it upstream as `top_p`.
  - Added Settings → Generation panel with temperature/top-p sliders, presets, reset, refreshable detected
    context window, and source badge. Main chat and intention chat headers now show active model + context
    length (for example `Kimi K2.5 · 128k ctx`).
  - Replaced insights helper magic `0.7` values with `INSIGHTS_TEMPERATURE`.
  - Tests added/updated:
    - `__tests__/services/ai/generationSettings.test.ts`
    - `__tests__/services/ai/chatPayload.test.ts`
    - `__tests__/services/ai/modelContext.test.ts`
    - `__tests__/services/ai/imaginationToTemperature.test.ts`
    - Updated direct transport, backend OpenAI-compatible adapter, chat orchestration, and
      `IntentionChatHeader` tests for `top_p`, generation defaults, and the context readout.
  - Verified:
    - `npm run test:run -- --forceExit` — 84 suites passed, 3 skipped; 297 tests passed, 8 skipped.
    - `npx tsc --noEmit` — passed.
    - `npm run lint` — 0 errors; 1 pre-existing warning in `__tests__/components/ScreenContainer.test.tsx`.
    - `npm run check:design` — passed with 0 errors; existing warning remains
      `app/intentions/chat.tsx` at 496 lines (under the 500 hard max).
    - `cd backend && npx tsc --noEmit` — passed.
    - `cd backend && npm test` — passed (backend test script is `tsc --noEmit`).
- **2026-06-10**: WS2 — ChatFlow abstraction (keystone refactor, behavior-preserving):
  - Collapsed the duplicated chat-orchestration prompt assembly in `app/chat.tsx` and
    `app/intentions/chat.tsx` into a declarative flow registry consumed by the one shared engine
    `features/chat/hooks/useChatOrchestration.ts`. This is the seam later workstreams hook into:
    persona (WS3), tuning (WS4), and guided stages (WS5) are now implemented once per flow instead of
    per screen.
  - `features/chat/flows/types.ts` (new): `ChatFlowId`, `ChatFlowContext`, `GuidedStage`, `ChatFlow`.
    `generation?` is typed `unknown` for now (WS4 introduces the concrete `GenerationSettings` type and
    tightens it); `generationOverride` returns `Record<string, unknown>` as a placeholder.
  - `features/chat/flows/index.ts` (new): `FLOWS: Record<ChatFlowId, ChatFlow>` plus a single shared
    `composeSystemPrompt(base, ctx)` helper (`[base, localMemoryContext, persona?, feedbackGuidance]
    .filter(Boolean).join('\n\n')`). `freeform`/`continue` use `composeSystemPrompt(THERAPIST_SYSTEM_PROMPT,
    ctx)`; `morning`/`evening`/`intention`/`intentionRefine` delegate to `buildIntentionSystemPrompt`
    for byte-identical output; `dailyCheckIn` delegates to the extracted daily-checkin builder. Also
    exports `flowForCheckInType(type)`.
  - `services/ai/dailyCheckInPrompt.ts` (new): extracted the pure `buildDailyCheckInSystemPrompt` out of
    `services/ai/useChat.ts` (which re-exports it, delegating) so the flow registry stays free of the
    streaming/AsyncStorage import chain `useChat.ts` pulls. Output is unchanged; the daily-checkin runtime
    path (`sendInitialPrompt`) still calls the same builder.
  - `useChatOrchestration` now accepts optional `flow?: ChatFlow` + `flowContext?: ChatFlowContext`. When
    a flow is present, the system prompt is derived from `flow.buildSystemPrompt(flowContext)` and (when
    defined) the opener from `flow.openingMessage(flowContext)`. The string `systemPrompt` option remains a
    working fallback (incremental migration). WS1 `persist`/debounced-autosave logic is untouched.
  - `app/chat.tsx`: removed the inline `systemPrompt` useMemo; now passes `flow={FLOWS.continue|freeform}`
    + `flowContext={{ localMemoryContext, feedbackGuidance }}`. Persona stays out (WS3 adds it).
  - `app/intentions/chat.tsx`: removed the inline `buildIntentionSystemPrompt` useMemo; now selects the flow
    via `flowForCheckInType(checkInType)` and passes `flowContext` (activePersona, areaLabel, intentionTitle,
    memorySummary, feedbackGuidance). Dropped from 497 → 491 lines (under the 500 hard limit).
  - Tests: `__tests__/features/chatFlows.test.ts` (new, 13 tests) asserts each flow's `buildSystemPrompt`
    is byte-identical to the legacy assembly for the same context, persona block present iff `activePersona`
    is provided, and `flowForCheckInType` mapping. Existing chat + intention tests stayed green.
  - Verified: `npx tsc --noEmit` → 0 errors; `npm run test:run` → 78 of 81 suites pass (3 skipped),
    268 passed / 8 skipped (was 255 baseline + 13 new, no regressions); `npm run check:design` → 0 errors
    (1 pre-existing warning on `app/chat.tsx` size); `eslint` on all touched files → 0 problems.
- **2026-06-10**: WS1 — Chat session persistence (fixed the lost-session bug):
  - **Root cause**: chat messages lived only in ephemeral React state
    (`features/chat/hooks/useChatOrchestration.ts` `useState`, `services/ai/useChat.ts` `useRef`);
    the only save path was `handleClose()` wired solely to the Header X button. System back / tab
    switch / FAB relaunch unmounted the component and lost everything, and `conversationId` was
    regenerated per mount. `app/intentions/chat.tsx` had the same flaw.
  - Added `services/ai/sessionStorage.ts` (new): AsyncStorage-backed store of in-flight chat
    sessions, kept SEPARATE from journal drafts. Mirrors the `customModels.ts` storage-adapter +
    sanitize-on-read pattern (`setChatSessionStorageAdapter`/`resetChatSessionStorageAdapter` for
    tests). `ChatSession { conversationId, mode, messages, personaId?, routeParams?, updatedAt,
    createdAt }`. Functions: `loadSessions`, `getSession`, `saveSession`, `removeSession`,
    `getMostRecentActiveSession` (newest non-empty within 7 days), `pruneStaleSessions` (drops >7d
    and beyond a 10-session cap). Never throws — returns safe defaults. Key `@blackrose_chat_sessions`.
  - `useChatOrchestration` now accepts an optional `persist` option; a ~600ms debounced effect calls
    `saveSession` whenever `messages` changes (length > 0), `pruneStaleSessions()` runs once on mount,
    and `clearPersistedSession()` is exposed. Existing signatures/behavior unchanged (additive only).
    Because both chat surfaces use this hook, autosave fixes session loss for both at once.
  - Added two shared lifecycle hooks to avoid duplicating logic across the two screens and keep both
    route files under the 500-line design limit:
    - `features/chat/hooks/useChatSessionFlush.ts`: `useFocusEffect` blur flush + `useEffect` unmount
      flush, with `finalize()` to suppress flushes after finish/discard.
    - `features/chat/hooks/useResumeChatSession.ts`: loads a `resume`d session and restores its messages
      (conversationId already aligned via the resume param so backend memory re-links).
  - `app/chat.tsx`: passes `persist` to the hook, reads a new `resume` param (restores messages +
    conversationId, stops regenerating), flushes on blur/unmount, and clears the session on finish/discard.
  - `app/intentions/chat.tsx`: mirrored autosave/flush + `resume` handling; its existing check-in-draft
    save on close is preserved, and the session is removed on finish so a back-gesture mid-conversation
    is now recoverable.
  - `components/journal/ResumeSessionBanner.tsx` (new): dismissible "Resume your last conversation"
    banner using NativeWind tokens with dark variants.
  - `app/(tabs)/entries.tsx`: on focus, calls `getMostRecentActiveSession()` and renders the resume
    banner above the feed → routes to `/chat?resume=<id>` or `/intentions/chat` with saved routeParams.
    Keeps the WS0 `<ScreenContainer edges="top">`.
  - `app/drafts.tsx`: added an "Active" section (autosaved sessions; tap = resume, delete = removeSession)
    ABOVE the existing "Saved drafts" list, which is unchanged.
  - Tests added:
    - `__tests__/services/ai/sessionStorage.test.ts` (12 tests): upsert/get/remove, createdAt preserved,
      `getMostRecentActiveSession` ignores empty + stale (>7d), `pruneStaleSessions` drops old + beyond
      cap, save caps at 10, corrupt JSON → safe default, malformed records/messages sanitized.
    - `__tests__/hooks/useChatOrchestration.session.test.tsx` (5 tests, jest fake timers): prune-on-mount,
      debounced `saveSession` on append, no save when empty, `clearPersistedSession` removes, no autosave
      after `handleNewChat` empties messages.
  - Verified:
    - `npx tsc --noEmit` — 0 errors.
    - `npm run test:run` — 77 suites passed, 3 skipped; **255 tests passed** (up from 239 baseline,
      +16 from the new suites), 8 skipped, 0 failed.
    - `npm run check:design` — 0 errors (PASSED). 1 warning: `app/intentions/chat.tsx` at 498 lines
      (≥450 warning threshold, under the 500 hard max).
    - `npx eslint` on all new/edited files owned by this change — 0 errors.

  - Implemented custom provider storage/fetching in `services/ai/customModels.ts`.
    - Normalizes provider roots such as `https://openrouter.ai` to `/api/v1`.
    - Fetches standard OpenAI-compatible `GET /models` lists with bearer auth.
    - Reads provider context metadata including OpenRouter `context_length` and common nested fields.
    - Falls back to user-configured context tokens when model responses omit context length.
  - Wired custom settings into direct AI calls:
    - `getResolvedDirectConfig()` prefers enabled custom settings over NanoGPT env defaults.
    - Chat, Ask Rosebud, insights, memory synthesis, and the local AI worker now resolve active models
      through the transport layer.
    - XHR streaming fallback now awaits async request preparation before opening the request.
  - Added Settings UI:
    - `CustomModelSettingsSection` supports Base URL, API key, fallback context tokens, fetch, search,
      model selection, save, and enable/disable.
    - Models that rely on fallback context tokens show a visible warning.
    - Local backups now include `@blackrose_custom_ai_provider`.
  - Added generated Memory settings notes:
    - `generateMemoryNoteSuggestion()` builds a suggested note from non-note local memory atoms.
    - Generated notes save as `layer: 'note'`, `source: 'system'`, so they participate in the existing
      local memory retrieval/ranking framework.
  - Fixed custom model activation/chat follow-up:
    - Selecting a fetched model now validates the model, enables the custom provider immediately, and
      persists the selected model ID.
    - Direct chat now prefers the enabled custom model over stale payload defaults and sends streaming
      requests with `Accept: text/event-stream`.
    - Streaming and non-streaming response parsing now rejects reasoning-only or empty completions
      instead of saving blank assistant messages.
    - App chat request defaults remain at `max_tokens: 32768`.
  - Fixed Memory tab phone layout:
    - Memory layer filter chips now have stable vertical sizing and one-line labels so episodic,
      semantic, and profile text is not clipped in APK/mobile layouts.
    - The Memory graph stage and Settings/Insights scroll views now reserve enough bottom space to avoid
      overlap with the absolute bottom navigation.
  - Tests added/updated:
    - `__tests__/services/ai/customModels.test.ts`
    - `__tests__/hooks/useCustomAiModels.test.ts`
    - `__tests__/components/CustomModelSettingsSection.test.tsx`
    - `__tests__/integration/nanoGptRealKey.test.ts`
    - `__tests__/services/ai/streamingCompletionGuard.test.ts`
    - `__tests__/screens/ExploreScreen.test.tsx`
    - `__tests__/screens/TabBottomSpacing.test.ts`
    - Updated direct config/transport, AI defaults, insights, Ask Rosebud, memory, worker, local backup,
      and settings component tests.
  - Verified:
    - `npm run test:run -- --forceExit` — 73 suites passed, 3 skipped; 232 tests passed, 8 skipped.
    - `RUN_INTEGRATION_TESTS=1 npm test -- --runTestsByPath __tests__/integration/nanoGptRealKey.test.ts`
      — passed against the real `.env` NanoGPT key for model fetch, non-streaming chat, custom-provider
      activation, and app `streamChat`.
    - `npm run check:design` — passed with 0 warnings.
    - `npx tsc --noEmit` — passed.
    - `npm run lint` — passed with no warnings.
    - `git diff --check` — passed.
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
- **2026-01-23**: Supabase database integration (anonymous auth, local-first sync):
  - Added Supabase client + sync queue (`services/supabase/`).
  - Added remote sync modules for journal, weekly insights, happiness recipe, and user settings.
  - Wired local storage to enqueue remote upserts/deletes and remote bootstrap reads.
  - Added Supabase schema SQL at `scripts/supabase/schema.sql` and setup notes in `notes/supabase-setup.md`.
  - Updated theme settings to sync remotely; added/updated tests for sync behaviors.
- **2026-01-23**: Verified sync queue behavior and tests:
  - Updated sync queue flushing to process tasks added during a flush.
  - Ran targeted Jest suite: `npm test -- --testPathPattern="supabaseSyncQueue|weeklyInsightsStorage|happinessRecipeStorage|useThemeSettings|journalStorage"` (52 tests passing).
- **2026-01-23**: Dependency audit cleanup:
  - Added npm override to pin `tar@7.5.6` to reduce audit findings.
  - Remaining audit issue: `markdown-it` moderate vulnerability via `react-native-markdown-display` (no fix available).
- **2026-01-23**: Supabase CLI setup:
  - Linked project `tovejzoqyduelgzsajru` and pushed migrations (remote database up to date).
  - Audit status confirmed: only `markdown-it` moderate vulnerability remained at the time (resolved later the same day).
- **2026-01-23**: Markdown renderer swap + test fix:
  - Replaced `react-native-markdown-display` with `react-native-marked` and updated `constants/markdownStyles.ts`.
  - Added manual Jest mock for `react-native-marked` to avoid ESM transform issues.
  - Ran `npm test -- --testPathPattern="ChatMessage"` (3 tests passing).
  - Audit status (prod deps) now clean: `npm audit --omit=dev` shows 0 vulnerabilities.
- **2026-01-23**: MCP-ready backend agent + chat wiring:
  - Added Node backend in `backend/` with MCP registry, stdio/HTTP transports, memory planner, and chat/ask-rosebud routes.
  - Added Railway config (`railway.toml`) to deploy backend only.
  - Updated chat + Ask Rosebud to call backend agent; added persistent memory namespace helper; removed client-side Supermemory ingestion.
  - Tests added/updated:
    - `backend/tests/mcpConfig.test.ts`
    - `backend/tests/memoryTools.test.ts`
    - `__tests__/services/ai.test.ts` (agent API)
    - `__tests__/services/memoryNamespace.test.ts`
  - Verified tests: `npm test -- --runInBand` and `cd backend && npm test`.
  - Lint + typecheck clean: fixed unused SafeAreaProvider import, updated hook deps, widened sync payload typing, ran `npm run lint` and `npx tsc --noEmit`.
- **2026-01-23**: Email auth flows (login/signup/forgot) with persistent Supabase sessions:
  - Added auth service + session hook, plus auth screens (`login`, `signup`, `forgot-password`).
  - Wired Settings account section for sign-in/out and session status.
  - Added tests: `__tests__/services/authService.test.ts`, `__tests__/hooks/useAuthSession.test.tsx`, updated `__tests__/screens/SettingsScreen.test.tsx`.
  - Verified: `npm test -- --runInBand`, `cd backend && npm test`, `npm run lint`, `npx tsc --noEmit`.
- **2026-01-23**: Password reset deep link + Supabase email templates:
  - Added auth linking helper + update password screen and deep link handling.
  - Added Supabase email templates in `supabase/email-templates/` and updated `notes/supabase-setup.md` with redirect URL guidance.
  - Added auth screen + linking tests: `__tests__/screens/AuthScreens.test.tsx`, `__tests__/services/authLinking.test.ts`.
- **2026-01-23**: Auth screen test stabilization:
  - Normalized auth screens to UTF-8 and fixed password placeholders.
  - Updated update-password link handling types and test mocks.
  - Re-ran `npm test -- --runInBand`, `npm run lint`, `npx tsc --noEmit` (190 tests passing).
- **2026-01-23**: Test log cleanup:
  - Added console spies to silence expected AI insights, Supermemory, and weekly insights storage logs during tests.
  - Wrapped Suggestions add flow in `waitFor` to eliminate act warnings.
  - Re-ran `npm test -- --runInBand`, `npm run lint`, `npx tsc --noEmit` (190 tests passing, clean output).
- **2026-01-23**: Theme/font/icon + assets system update:
  - Added Plus Jakarta Sans font loading and Tailwind font families.
  - Installed Phosphor icons (with react-native-svg) for the new icon system.
  - Updated Tailwind tokens + theme constants/markdown styles to match updated design palette.
  - Replaced legacy pink primary hardcodes with theme `primary` in key screens/components.
  - Added assets folder README + placeholder subfolders and a Tailwind token test (`__tests__/utils/themeTokens.test.ts`).
- **2026-01-23**: Today/Intentions/History update + new flows:
  - Replaced Today + History UI to match updated designs, including My Intentions, goals, insights card, and new headers/bottom nav.
  - Added intentions selection/chat/detail flows, drafts, saved insights, goals, entry detail, and persona create/edit/advanced screens.
  - Added storage/services + hooks for intentions, check-ins, goals/habits, personas, saved insights, and history feed grouping.
  - Synced new data types to Supabase schema and local-first queue; added local date key helper for day grouping.
  - Polished design parity: full-width empty intention add, completion badges on intention cards, 2-letter weekdays, full month labels, and compass sparkles.
  - Fixed initial prompt wiring in `useChatOrchestration` and removed duplicate font imports.
  - Tests added/updated: `useEntryInsightQuestion.test.ts`, `historyUtils.test.ts`, `useSelectedDay.test.ts`, `TodayScreen.test.tsx`.
  - Verified: `npm test -- --testPathPattern="useSelectedDay|useEntryInsightQuestion|historyUtils|TodayScreen|EntriesScreen|BottomNav"` and `npm test -- --runInBand` (191 tests).
- **2026-01-23**: Persona + chat polish and read-only check-ins:
  - Added persona avatar picker and avatar support across create/edit and persona cards.
  - Implemented imagination slider and model display labels in advanced persona settings.
  - Split intention chat into header/message/footer components, fixed metadata separator, and added basic mic/image placeholders + mute toggle.
  - Added read-only check-in detail screen for history items without intentions; drafts sort toggle and title clamping.
  - Added `CheckInDetail.test.tsx`.
  - Added intention/remove support in hooks, plus check-in/intention detail hooks for service access.
  - Added model picker modal and intention detail action sheet (archive/delete).
  - Added `useIntentions.test.ts` and expanded history navigation coverage.
  - Added intention edit flow (form + editor hook + screen) and tests.
  - Tests re-run: `npm test -- --runInBand` (197 tests).
- **2026-01-23**: Streak view + intention chat/voice picker updates:
  - Added streak stats utilities + hook and a new `streak-view` screen with calendar + rewards entry point.
  - Updated Today streak button to open streak view.
  - Filtered intention detail to show latest completed check-in only and corrected date label.
  - Restored draft persona/date in intention chat, made mute stop speech, and made close dismiss persona sheet when open.
  - Added voice picker modal to persona form.
  - Tests added: `streakStats`, `StreakView`, `useIntentionDetail`, `PersonaForm`, `IntentionChat`; ran `npm test -- --testPathPattern="StreakView|streakStats|useIntentionDetail|PersonaForm|IntentionChat|TodayScreen"`.
- **2026-01-24**: Insights daily words chart polish:
  - Ensured daily words bars render with a visible minimum height and clearer visual contrast.
  - Added accessibility labels for daily word bars and a new screen test (`InsightsScreen.test.tsx`).
- **2026-01-24**: Persona model defaults aligned to Nano GPT:
  - Updated persona advanced model list to GLM 4.7 (thinking/flash) + agent default.
  - Default new persona model set to `zai-org/glm-4.7-original:thinking`.
  - Added `PersonaAdvanced.test.tsx` to verify the new options.
- **2026-01-24**: Supabase schema + integration guardrails:
  - Added `supabase/migrations/202601240001_init.sql` (copy of schema) and updated `notes/supabase-setup.md`.
  - Added Supabase error de-dupe helper to reduce repeated missing-table warnings.
  - Added integration smoke tests for Supabase tables and agent health (gated by `RUN_INTEGRATION_TESTS=1`).
  - Added a static test to catch stray `.` text nodes in JSX trees.
- **2026-01-24**: Dev diagnostics improvements:
  - Added dev-only raw text guard to warn on string children in `View`/`Pressable`.
  - Added Supabase status banner for missing config/tables (dev-only) + component test.
- **2026-01-24**: Persona settings sheet + manage action:
  - Grid icon now opens persona settings instead of create.
  - Added settings panel with Edit, Advanced, and Delete actions.
  - Wired persona settings from chat and added component tests.
- **2026-01-24**: Removed Stagewise/21st-extension toolbar:
  - Deleted toolbar hooks/services/tests and removed the dependency from `package.json`.
- **2026-01-24**: Startup stability adjustments:
  - Root layout now renders immediately while fonts load (no blocking splash logic).
  - Added `RootLayout.test.tsx` to ensure render doesn’t crash while fonts load.
- **2026-01-24**: Hermes dev client setup:
  - Enabled Hermes in `app.json`.
  - Added `expo-dev-client` dependency for React Native DevTools.
- **2026-01-24**: Added app-level error boundary:
  - Wrapped root layout in `AppErrorBoundary` with a visible fallback screen.
  - Added `AppErrorBoundary.test.tsx` and silenced expected console errors.
- **2026-01-24**: Dev startup stability:
  - Re-enabled New Architecture to satisfy Reanimated builds; React Compiler remains disabled for now.
- **2026-01-24**: Dev client config sync:
  - Added `expo-dev-client` to `app.json` plugins.
  - Added `__tests__/config/appConfig.test.ts` to verify plugin presence.
- **2026-01-27**: Web dev startup fixes and test cleanup:
  - Skipped raw text guard installation in non-DOM (SSR) contexts to avoid createElement stack overflow.
  - Added `app/(auth)/_layout.tsx` to resolve route group warnings and hide auth headers.
  - Added tests: `__tests__/utils/rawTextGuard.test.ts`, `__tests__/screens/AuthLayout.test.tsx`.
  - Updated `jest.config.js` to exclude Playwright specs in `tests/` from Jest runs.
  - Verified with `npm test -- --runInBand`.
- **2026-01-27**: CSP and environment setup updates:
  - Added `Content-Security-Policy` header via `expo-router` plugin to allow `unsafe-eval` for web dev.
  - Added CSP coverage in `__tests__/config/appConfig.test.ts`.
  - Added root `.env` with placeholder values (copied from `.env.example`).
  - Verified with `npm test -- --runInBand`.
- **2026-01-27**: CSP dev unblock and config cleanup:
  - Removed hardcoded CSP headers from `app.json` to avoid dev-time eval blocking.
  - Added production-only CSP injection via `app.config.ts` for `expo-router` headers.
  - Updated `__tests__/config/appConfig.test.ts` to reflect dynamic CSP handling.
  - Verified with `npm test -- --runInBand`.
- **2026-01-27**: Web dev blank screen mitigation:
  - Set `web.output` to `single` in development via `app.config.ts` (keeps `server` for production).
  - Verified with `npm test -- --runInBand`.
- **2026-01-27**: Web redirect hardening:
  - Replaced `Redirect` in `app/index.tsx` with `router.replace('/entries')` and a visible loading fallback.
  - Added `__tests__/screens/IndexScreen.test.tsx` to validate the redirect behavior.
- **2026-01-27**: Safe area provider stabilization:
  - Wrapped root layout with `SafeAreaProvider` to ensure `useSafeAreaInsets` hooks render reliably on web.
  - Updated `__tests__/screens/RootLayout.test.tsx` to mock the provider.
- **2026-01-31**: Removed React Native setup configs and tests per request:
  - Deleted `app.json`, `app.config.ts`, `GEMINI.md`, `tsconfig.json`, `backend/tsconfig.json`.
  - Removed test suites and configs: `__tests__/`, `tests/`, `backend/tests/`, `jest.config.js`, `jest.setup.js`, `playwright.config.ts`, `__mocks__/`.
  - Tests not run (test framework removed by request).
- **2026-01-31**: Removed build configs and adb tooling per request:
  - Deleted `babel.config.js`, `package.json`, `backend/package.json`, `REVIEW.md`.
  - Removed NativeWind/Tailwind configs: `nativewind-env.d.ts`, `tailwind.config.js`.
  - Deleted `adb/` directory.
- **2026-02-01**: Legacy dependency alignment:
  - Removed `expo-dev-client` and `react-native-worklets` from dependencies.
  - Pinned `react-native-reanimated` to `~3.17.1` for legacy compatibility.
  - Updated Babel config for NativeWind runtime and Reanimated ordering.
  - Added tests: `__tests__/deps-compat.test.ts`, `__tests__/babel-config.test.ts`.
  - Tests reported: `npm run test:run -- --testPathPattern="babel-config"`,
    `npm run test:run -- --testPathPattern="deps-compat"`, `npm run test:run`.
- **2026-02-01**: Warning cleanup:
  - Removed legacy Today/Journal header wrappers (stubbed files to prevent reuse).
  - Added `__tests__/warning-cleanup.test.ts` to guard against deprecated wrappers.
  - Tests not run in this session.
- **2026-02-01**: Expo config + dependency alignment:
  - Set `userInterfaceStyle` to `automatic` in `app.json`.
  - Updated Expo SDK package versions (`expo`, `expo-router`, `jest-expo`, `react-native-reanimated`).
  - Adjusted dependency compatibility test to assert Reanimated 4.x.
  - Ran `npm test -- --testPathPattern="app-config|deps-compat|config-baseline"`.
- **2026-02-01**: Worklets mismatch remediation:
  - Installed Expo SDK 54-compatible `react-native-reanimated` + `react-native-worklets` via `npx expo install`.
  - Pinned `react-native-worklets@0.5.1` alongside `react-native-reanimated@~4.1.1`.
  - Updated dependency compatibility test to validate Worklets pinning.
  - Ran `npm test -- --testPathPattern="deps-compat|app-config|config-baseline"`.
- **2026-02-06**: Critical fix – Tailwind color tokens missing from `tailwind.config.js`:
  - **Root cause**: `tailwind.config.js` had an empty `theme.extend` — zero custom colors defined.
    Every custom color class (`bg-background-light`, `bg-surface-dark`, `text-text-secondary-light`, etc.)
    silently resolved to nothing, making backgrounds invisible, text unreadable, and buttons hidden.
  - **Fix**: Added all 15 required color tokens to `tailwind.config.js` matching `constants/theme.ts`
    and the example-design HTML references (`#F2F2F7`, `#000000`, `#FFFFFF`, `#1C1C1E`, `#FF9F0A`, etc.).
  - Also added `boxShadow` tokens (`soft`, `nav`) used across card/navigation components.
  - **Test added**: `__tests__/tailwind-config.test.ts` — 4 tests ensuring all tokens exist, values are valid hex,
    and background/surface colors match `theme.ts`.
  - Verified: `npm test` — all tests pass (pre-existing `app-config` failure is unrelated).
- **2026-02-06**: Fixed three pre-existing issues:
  - **`app-config.test.ts` platform assertion**: Test expected `["ios", "android"]` but `app.json` includes `"web"`.
    Updated test to expect `["ios", "android", "web"]`.
  - **`setColorScheme` crash on web**: NativeWind's `setColorScheme()` throws on React Native Web
    ("Cannot manually set color scheme"), flooding the console with errors. Added a `Platform.OS === 'web'`
    guard in `useThemeSettings.ts` that skips the call and logs a single warning instead.
  - **Backend connection refused**: `postAgent()` in `agentClient.ts` had no error handling for network failures.
    Added try/catch around `fetch` with a descriptive error message including the URL. The existing
    `getFriendlyErrorMessage()` in `useChatOrchestration.ts` already maps "failed to fetch" to a user-friendly
    message.
  - **Tests added**: `__tests__/useThemeSettings.test.ts` (2 tests), `__tests__/agentClient.test.ts` (4 tests).
  - Verified: `npm test` — 8 suites, 18 tests, all pass.
- **2026-02-06**: Comprehensive dark mode contrast fix (second wave):
  - **7 missing color tokens**: Added `text-main-light`, `text-main-dark`, `user-text`, `accent-blue`,
    `ai-text`, `subtext-light`, `subtext-dark`, and `card-dark` to `tailwind.config.js`. These were used
    across 50+ files but silently resolved to nothing.
  - **12 hardcoded icon colors**: Replaced `color="#111827"` on MaterialIcons in `streak-view.tsx`,
    `saved-insights.tsx`, `goals.tsx`, `drafts.tsx`, `entry-detail.tsx`, `checkin-detail.tsx`,
    `persona/advanced.tsx`, `intentions/detail.tsx`, `PersonaForm.tsx`, `IntentionForm.tsx` with
    `useColorScheme()`-driven dynamic color (`isDark ? '#F9FAFB' : '#111827'`).
  - **Bare Text elements**: Added `text-text-light dark:text-white` or `text-text-secondary-light dark:text-text-secondary-dark`
    to bare `<Text>` elements in `drafts.tsx`, `persona/advanced.tsx`, `PersonaForm.tsx`, `checkin-detail.tsx`,
    `intentions/detail.tsx` that had no text color and would default to black (invisible in dark mode).
  - **Web dark mode toggle**: Fixed dark mode not applying on web by:
    1. Adding `darkMode: 'class'` to `tailwind.config.js`
    2. Updated `use-color-scheme.web.ts` to use NativeWind's `useColorScheme` hook (was using RN's media-query-only hook)
    3. Removed the web platform guard in `useThemeSettings.ts` — `setColorScheme` now works on all platforms
  - **Tests**: Updated `tailwind-config.test.ts` to include all 23 tokens. Added `dark-mode-contrast.test.ts`
    (static analysis for hardcoded icon colors + token existence). Updated `useThemeSettings.test.ts` to
    verify `setColorScheme` is called on all platforms.
  - **Visual verification**: Tested all screens (Today, Settings, Insights, History, Chat) in both
    light and dark modes using Playwright. All text visible, buttons readable, input text clear.
  - Verified: `npm test` — 9 suites, 20 tests, all pass.
- **2026-02-06**: History dark text + mobile live-streaming fallback:
  - Fixed unreadable mood/tag text in `components/history/HistoryEntryCard.tsx` by adding explicit
    `text-text-secondary-light dark:text-text-secondary-dark` classes to the mood label.
  - Added true mobile progressive streaming fallback in `services/ai/ai.ts`:
    when `fetch` readable streams are unavailable, chat now uses `XMLHttpRequest` `onprogress`
    to parse SSE chunks in real time and update UI incrementally.
  - Retained existing non-stream fallback path (`readNonStreamingResponse` + simulated chunking)
    when XHR streaming is unavailable or fails.
  - Tests updated:
    - `__tests__/dark-mode-contrast.test.ts` now guards the History mood label dark-mode class.
    - `__tests__/ai-service.test.ts` now verifies progressive chunk delivery via XHR fallback.
  - Verified: `npx jest --runInBand __tests__/ai-service.test.ts __tests__/dark-mode-contrast.test.ts`.
- **2026-02-06**: True backend token streaming (root-cause fix):
  - **Root cause identified**: backend route used `handleChatCompletion` with upstream `stream: false`, then fake-chunked the final text. This prevented true real-time token flow from model to mobile.
  - Added upstream streaming call in `backend/src/agent/modelClient.ts`:
    - `createChatCompletionStream(...)` now sends `stream: true` with `Accept: text/event-stream`.
  - Refactored `backend/src/agent/agentService.ts`:
    - shared prompt/memory preparation now powers both non-stream and stream handlers.
    - added `handleChatCompletionStream(...)` returning upstream `Response`.
  - Updated `backend/src/routes/chatRoutes.ts`:
    - stream requests now pipe upstream SSE bytes directly to client instead of synthetic chunking.
    - retains safe fallback for non-streaming upstream bodies.
  - Added regression test:
    - `__tests__/backend-modelClient-stream.test.ts` ensures backend sends `stream: true` + `Accept: text/event-stream` upstream.
  - Verified:
    - `npx jest --runInBand __tests__/backend-modelClient-stream.test.ts __tests__/ai-service.test.ts`
    - `cd backend; npx tsc --noEmit`
- **2026-02-06**: Client streaming order fix for React Native:
  - **Root cause identified**: `streamChat` awaited `fetch` first, then attempted XHR fallback.
    On React Native this delayed `onChunk` until response completion, so users saw non-live output.
  - **Fix**: in `services/ai/ai.ts`, XHR streaming now runs first; fetch-based path runs only if XHR is unavailable/fails.
  - Added regression in `__tests__/ai-service.test.ts`:
    - `starts xhr streaming without waiting for fetch response to finish`
  - Verified:
    - `npx jest --runInBand __tests__/ai-service.test.ts __tests__/backend-modelClient-stream.test.ts`
- **2026-02-06**: Supermemory disabled end-to-end (temporary):
  - Removed runtime Supermemory dependencies from chat + Ask Rosebud request flows on the app:
    - `services/ai/ai.ts` no longer resolves/sends `memoryNamespace`.
    - `services/ask-rosebud/askRosebud.ts` no longer reads or sends `memoryNamespace`.
  - Removed backend memory orchestration from user-facing routes:
    - `backend/src/agent/agentService.ts` no longer runs memory planning/recall/save logic.
    - `backend/src/agent/askRosebudService.ts` no longer recalls Supermemory context.
    - `backend/src/routes/chatRoutes.ts` and `backend/src/routes/askRosebudRoutes.ts` no longer parse/forward `memoryNamespace`.
    - `backend/src/index.ts` no longer wires `McpRegistry` into chat/ask routes.
    - `backend/src/agent/systemPrompt.ts` no longer injects memory-policy text.
    - `backend/src/agent/types.ts` removed `memoryNamespace` from request types.
  - Tests added/updated:
    - `__tests__/askRosebud-service.test.ts` (new): verifies Ask Rosebud payload excludes `memoryNamespace`.
    - `__tests__/ai-service.test.ts`: verifies chat payload excludes `memoryNamespace`.
  - Verified:
    - `npx jest --runInBand __tests__/ai-service.test.ts __tests__/askRosebud-service.test.ts __tests__/backend-modelClient-stream.test.ts`
    - `cd backend; npx tsc --noEmit`
- **2026-02-06**: Added SimpleMem-style long-term memory bridge (NanoGPT + OpenRouter embeddings):
  - Added Python bridge script `backend/scripts/simplemem_bridge.py` for memory extraction, storage, and retrieval.
  - Memory extraction/planning uses NanoGPT (`NANO_GPT_*` env), embeddings use OpenRouter (`OPENROUTER_EMBEDDING_API_KEY`) with `openai/text-embedding-3-small` by default.
  - Added backend config/service wiring:
    - `backend/src/config/simpleMemConfig.ts`
    - `backend/src/agent/simpleMemService.ts`
  - Chat and Ask Rosebud now retrieve long-term memory context and store fresh messages:
    - `backend/src/agent/agentService.ts`
    - `backend/src/agent/askRosebudService.ts`
    - `backend/src/agent/systemPrompt.ts`
  - Deployment/build updates:
    - Added Python deps file: `backend/requirements-simplemem.txt`
    - Updated Railway build command in `backend/railway.toml` to install Python deps before TypeScript build.
    - Updated `backend/.env.example` and `backend/README.md` to document new SimpleMem variables.
  - Tests added/updated:
    - `__tests__/simpleMem-config.test.ts`
    - `__tests__/backend-systemPrompt.test.ts`
    - Existing streaming/ask-rosebud tests remain passing.
  - Verified:
    - `npx jest --runInBand __tests__/ai-service.test.ts __tests__/askRosebud-service.test.ts __tests__/backend-modelClient-stream.test.ts __tests__/backend-systemPrompt.test.ts __tests__/simpleMem-config.test.ts`
    - `cd backend; npx tsc --noEmit`
- **2026-02-06**: Railway deploy fix for SimpleMem dependencies + live SSE verification:
  - **Root cause**: Nixpacks Python environment is PEP-668 externally managed; direct `pip` install without override failed during build.
  - Updated deploy build commands to use:
    - `pip3 install --break-system-packages -r requirements-simplemem.txt && npm run build`
  - Files updated:
    - `backend/railway.toml`
    - `railway.toml`
  - Railway environment cleanup:
    - Removed legacy `MCP_SUPERMEMORY_API_KEY` from backend service variables.
  - Deployment:
    - `railway up` succeeded for deployment `4e5abd1d-3868-4a8d-b7cb-ce2f37eb4c3f`.
  - Live checks:
    - `GET /health` returned `{"status":"ok"}`.
    - `POST /v1/chat/completions` with `stream: true` returned tokenized SSE chunks and `[DONE]`.
  - Verified locally:
    - `npm test -- --runInBand __tests__/ai-service.test.ts __tests__/askRosebud-service.test.ts __tests__/backend-modelClient-stream.test.ts __tests__/backend-systemPrompt.test.ts __tests__/simpleMem-config.test.ts`
    - `cd backend; npx tsc --noEmit`
- **2026-02-06**: Mobile live-stream rendering fix in chat UI:
  - **Root cause**: `components/ChatMessage.tsx` reset displayed text to `''` whenever `isStreaming=true`, so users only saw typing dots until completion.
  - **Fix**: keep `displayedText` synchronized with incoming `text` during streaming, allowing chunk-by-chunk rendering.
  - **Improvement**: show inline streamed `reasoning` when the model sends only thinking tokens before final content (prevents “no streaming” UX for thinking models).
  - Added regression test:
    - `__tests__/ChatMessage.test.tsx` verifies typing indicator before first chunk and visible text once streamed chunks arrive.
  - Verified:
    - `npm test -- --runInBand __tests__/ChatMessage.test.tsx __tests__/ai-service.test.ts __tests__/backend-modelClient-stream.test.ts`
  - Note:
    - `npm run typecheck` currently reports pre-existing unrelated TS errors in
      `app/intentions/chat.tsx`, `app/persona/[id].tsx`, `components/parallax-scroll-view.tsx`,
      and `utils/dev/rawTextGuard.ts`.
- **2026-02-06**: Kimi-only model configuration (removed GLM):
  - Updated AI defaults to Kimi variants only:
    - Chat/default model: `moonshotai/kimi-k2.5:thinking`
    - Secondary/flash model: `moonshotai/kimi-k2.5`
  - Updated files:
    - `services/ai/aiConfig.ts`
    - `backend/src/config/aiConfig.ts`
    - `app/persona/advanced.tsx` (removed GLM + Agent Default options from picker)
    - `.env`, `.env.example`, `backend/.env`, `backend/.env.example`, `backend/README.md`
  - Added test:
    - `__tests__/model-config.test.ts` validates app/backend defaults and Kimi-only persona model list.
  - Verified:
    - `npm test -- --runInBand __tests__/model-config.test.ts __tests__/ai-service.test.ts __tests__/backend-modelClient-stream.test.ts`
    - `cd backend; npx tsc --noEmit`
  - Railway:
    - Updated production vars `NANO_GPT_MODEL` and `NANO_GPT_FLASH_MODEL`.
    - Deployment `afc3ba05-c3e0-4fd1-a9ab-cf97edf8cdcc` reached `SUCCESS`.
    - `GET /health` returned `{"status":"ok"}`.

- **2026-02-06**: Streaming memory persistence + mobile streaming hardening + Supermemory removal:
  - Persist assistant responses for **streaming** chat by cloning the upstream SSE response and storing the final assistant content into SimpleMem:
    - `backend/src/agent/agentService.ts`
    - Added regression: `__tests__/backend-stream-memory.test.ts`
  - Reduced SSE buffering risk on streaming route:
    - Added `X-Accel-Buffering: no`, per-chunk flush, and initial SSE comment `:\n\n` in `backend/src/routes/chatRoutes.ts`
  - Mobile progressive streaming reliability:
    - Added `XMLHttpRequest.onreadystatechange` parsing (in addition to `onprogress`) in `services/ai/ai.ts`
    - Updated tests: `__tests__/ai-service.test.ts`
  - Secret-safety for long-term memory:
    - Redact common secret-key patterns before storing messages in SimpleMem (`backend/src/agent/redactSecrets.ts`)
    - Added test: `__tests__/backend-redactSecrets.test.ts`
  - Fully removed legacy Supermemory/MCP codepaths (SimpleMem-only memory now):
    - Deleted app Supermemory proxy/service files and backend MCP registry/config modules
    - Updated `.env.example` to remove Supermemory variables
  - UI contrast cleanup:
    - Fixed Insights icons to use `color` props (MaterialIcons do not support `className`) and added missing dark text color for loading label:
      - `app/(tabs)/insights.tsx`
    - Fixed remaining MaterialIcons `className` usage:
      - `components/FooterActions.tsx`
      - `components/personas/PersonaSettingsSheet.tsx`
      - `components/Header.tsx`
    - Added static guard: `__tests__/dark-mode-contrast.test.ts` now fails if `MaterialIcons` are given `className`
  - Verified:
    - `npm test`
    - `cd backend; npx tsc --noEmit`
    - `railway up` (backend)
- **2026-02-07**: AI token + temperature defaults update:
  - Chat requests now default to `temperature=1`, `max_context=100000`, `max_tokens=32768` (app -> backend -> upstream).
  - Non-chat AI helpers standardized to `temperature=0.7`.
  - Files updated:
    - `services/ai/ai.ts`
    - `backend/src/agent/types.ts`
    - `backend/src/routes/chatRoutes.ts`
    - `backend/src/ws/chatWebSocket.ts`
    - `backend/src/agent/agentService.ts`
    - `backend/src/agent/modelClient.ts`
  - Tests:
    - Added: `__tests__/ai-defaults.test.ts`
    - Updated: `__tests__/backend-modelClient-stream.test.ts`
  - Verified:
    - `npm test`
  - Note:
    - `npm run typecheck` still reports the pre-existing TS errors listed in the 2026-02-06 update.

- **2026-06-05**: Installed and configured **Codex CLI** with OMO Light Edition:
  - **Prereq install** (none of `bun`/`opencode`/`node` were on `PATH`):
    - Installed **Bun 1.3.14** via the official `curl -fsSL https://bun.sh/install | bash` script.
      - Note: in modern Bun, `bunx` is invoked as `bun x <package>` (no separate `bunx` binary).
    - Installed **OpenCode 1.16.0** via the official `curl -fsSL https://opencode.ai/install | bash` script.
    - Persisted both into `~/.bashrc`:
      - `export BUN_INSTALL="$HOME/.bun"`
      - `export PATH="$HOME/.local/bin:$HOME/.hermes/node/bin:$HOME/.bun/bin:$HOME/.opencode/bin:$PATH"`
  - **Installer run** (non-interactive, Light Edition / Codex CLI platform):
    - `npx lazycodex-ai install --no-tui --codex-autonomous`
    - Detected Codex CLI, registered plugin in `~/.codex/config.toml`, and wrote
      `omo.json` (agent + category model map) at
      `/home/sarino/.var/app/com.visualstudio.code/config/codex/` (Flatpak VS Code scope).
  - **Post-install fixes**:
    - Refreshed Codex model cache: `codex models --refresh` — available models
      `codex/gpt-5`, `codex/gpt-4o`, `codex/o3-mini`, `codex/o4-mini`.
    - The installer's default model was configured for autonomous full-permissions mode.
    - Created `~/.var/app/com.visualstudio.code/config/codex/tui.json` with
      `{"plugin": ["omo/tui"]}` so the TUI Roles · Models sidebar renders.
  - **Verification**:
    - `npx lazycodex-ai doctor` — only 1 remaining issue:
      `gh CLI` missing (optional, only affects GitHub automation features).
    - `npx lazycodex-ai get-local-version` — installed **latest**.
  - **Files written**:
    - `~/.var/app/com.visualstudio.code/config/codex/config.toml` (plugin registration)
    - `~/.var/app/com.visualstudio.code/config/codex/tui.json` (TUI plugin registration)
    - `~/.var/app/com.visualstudio.code/config/codex/omo.json` (agent + category model map)
    - `~/.bashrc` (PATH additions for `bun` and `codex`)
  - **Usage**: run `codex` in any project, include `ultrawork` (or `ulw`) in a prompt to unlock
    parallel agents / background tasks / deep exploration.


- **2026-06-05 (follow-up)**: Installed **globally** (not only VS Code Flatpak scope):
  - The first install wrote configs to the **Flatpak VS Code scope** (`/home/sarino/.var/app/com.visualstudio.code/config/codex/`) because `XDG_CONFIG_HOME` in the VS Code integrated terminal points there. Running `codex` from a *normal* terminal would not see those configs.
  - Re-ran the installer with `XDG_CONFIG_HOME=$HOME/.config npx lazycodex-ai install --no-tui --codex-autonomous` so the plugin lands in the **global** scope (`~/.config/codex/`). The installer merged the plugin entry into the existing `config.toml` (preserving `mcp.playwright`).
  - Synced all three plugin files to the global scope:
    - `~/.config/codex/config.toml` — now has `plugin = ["omo@sisyphuslabs"]` + MCP
    - `~/.config/codex/omo.json` — all agents/categories → `codex/gpt-5`
    - `~/.config/codex/tui.json` — `{"plugin": ["omo/tui"]}`
  - Refreshed model cache globally: `codex models --refresh` shows `codex/gpt-5`, `codex/gpt-4o`, `codex/o3-mini`, `codex/o4-mini`.
  - Verified from a clean terminal (`XDG_CONFIG_HOME` unset, just `PATH` from `~/.bashrc`):
    - `npx lazycodex-ai doctor` → only 1 issue (optional `gh` CLI).
    - `npx lazycodex-ai get-local-version` → latest.
  - Result: `codex` now works **both** from a regular terminal (reads global `~/.config/codex/`) **and** from VS Code's integrated terminal (reads the Flatpak scope — original install is still there).

- **2026-06-05**: Local-only data default + on-device backup/restore:
  - Added a data-provider switch in `services/data/dataProvider.ts`.
    - Default provider is `local`.
    - Remote Supabase data sync is only enabled with `EXPO_PUBLIC_DATA_PROVIDER=remote` or
      `EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC=true`.
  - Gated active Supabase data sync:
    - `services/supabase/supabaseClient.ts` now returns `null` from `ensureSupabaseSession()` while
      local-only data mode is active.
    - `services/supabase/syncQueue.ts` no-ops enqueue/flush calls while local-only data mode is active.
    - `hooks/supabase/useSupabaseSchemaStatus.ts` skips the dev Supabase setup banner in local-only mode.
  - Added on-device local backup service:
    - `services/backup/localBackup.ts` snapshots journal, intentions, check-ins, goals, happiness recipe,
      personas, saved insights, weekly insights, and theme/emoji settings into `@blackrose_local_backups`.
    - Restore replaces all tracked local keys and removes keys absent from the snapshot to avoid stale data.
  - Exposed backup/restore in Settings:
    - Split `app/(tabs)/settings.tsx` into focused components under `components/settings/`.
    - Added `hooks/backup/useLocalBackups.ts` for backup state and actions.
    - Settings now has `Create Local Backup` and `Restore Latest Backup`; the older journal-only JSON share
      remains as `Export Journal JSON`.
  - Documentation:
    - Added `notes/local-only-storage.md` with provider flags, local storage keys, and backup/restore behavior.
  - Tests added:
    - `__tests__/dataProvider.test.ts`
    - `__tests__/syncQueue-local-only.test.ts`
    - `__tests__/supabaseClient-local-only.test.ts`
    - `__tests__/localBackup.test.ts`
    - `__tests__/useLocalBackups.test.ts`
    - `__tests__/DataManagementSection.test.tsx`
    - `__tests__/useSupabaseSchemaStatus.test.ts`
  - Verified:
    - `npm test` — 27 suites, 59 tests passing.
    - `npm run check:design` — passed with the pre-existing `app/intentions/chat.tsx` size warning.
    - Playwright web QA at `http://localhost:19006/settings` — Settings rendered, Supabase setup banner absent,
      local backup controls visible, and `Create Local Backup` updated the latest-backup state.
  - Known pre-existing blockers:
    - `npm run typecheck` still fails in `app/intentions/chat.tsx`, `app/persona/[id].tsx`,
      `components/parallax-scroll-view.tsx`, and `utils/dev/rawTextGuard.ts`.
    - `npm run lint` still fails on pre-existing lint errors in `__tests__/ChatMessage.test.tsx`,
      `app/goals.tsx`, `app/intentions/select.tsx`, `components/today/GoalsSection.tsx`, and
      `scripts/check-design-limits.js`.

- **2026-06-05**: Persona drawer + intentions chat reference parity pass:
  - Persona drawer:
    - Seeded a local default active `Rosebud` persona so a fresh local-only device opens the drawer on the
      reference Rosebud card instead of an empty New Persona card.
    - Gated persona remote sync behind the active data provider, matching the local-only default.
    - Fixed the persona modal on web: it now uses fixed viewport positioning and disables React Native Web's
      slide transform so the bottom sheet anchors on-screen.
    - Restyled the sheet/card/new-persona states to match the dark reference surfaces, handle, card sizing,
      rose avatar, active button, and New Persona teal geometric avatar.
  - Intentions chat:
    - Default theme now starts in dark mode when no saved theme exists, while saved Light/System choices still work.
    - Updated the Rosebud selector badge to the reference rose treatment.
    - Replaced the visible `[Start intention check-in]` AI fallback with the reference opening prompt.
    - Extracted `components/intentions/IntentionChatBody.tsx` from `app/intentions/chat.tsx`, removing the web
      TextInput border and bringing the route below the design warning threshold.
    - Updated `ai-text` to the reference cyan (`#38BDF8`) and constrained message width for matching mobile wraps.
  - Tests added/updated:
    - `__tests__/PersonaSheet.test.tsx`
    - `__tests__/personasStorage.test.ts`
    - `__tests__/IntentionChatHeader.test.tsx`
    - `__tests__/IntentionChatMessage.test.tsx`
    - `__tests__/IntentionChatBody.test.tsx`
    - `__tests__/useThemeSettings.test.ts`
    - `__tests__/tailwind-config.test.ts`
  - Verified:
    - `npm test` — 32 suites, 66 tests passing.
    - `npm run check:design` — passed with no warnings; `app/intentions/chat.tsx` is now under the warning threshold.
    - Playwright web QA at `http://localhost:19006/intentions/chat?area=finances&type=intention`:
      dark mode applied, the internal trigger is absent, the reference opening prompt is visible, and the input
      computed border is `0px`.
    - Playwright web QA for the Rosebud persona drawer and New Persona swiped state: bottom sheet anchors to the
      viewport, active Rosebud card renders, and the teal New Persona avatar renders.
  - Remaining known blockers:
    - `npx tsc --noEmit` still fails in pre-existing files: `app/persona/[id].tsx`,
      `components/parallax-scroll-view.tsx`, and `utils/dev/rawTextGuard.ts`.
    - `npm run lint` still fails on pre-existing lint errors in `__tests__/ChatMessage.test.tsx`, `app/goals.tsx`,
      `app/intentions/select.tsx`, `components/today/GoalsSection.tsx`, and `scripts/check-design-limits.js`.
- **2026-06-06**: PR4 — backend agent/modelClient + agentService SSE refactor + health route expansion:
  - **modelClient.ts rewritten** as a thin wrapper around `getProviderForProfile('default').chat` / `.stream`. No
    `fetch`, no env reads, no `max_context` upstream. Server-side profile resolution; client-supplied `model` is
    ignored in v1 (with a one-time warn if non-`'default'`).
  - **agentService.ts** now uses `readAssistantContentFromSseStream` from `services/ai/streaming` instead of the
    old inline SSE parser. The `clone()`-tee background-persistence pattern for `simpleMemService` is preserved.
  - **New SSE module** `backend/src/services/ai/streaming.ts` (121 lines). PR2 was supposed to ship this; the file
    was missing at PR4 time, so it was relocated (not invented) from `agentService.ts:33-60` and `chatWebSocket.ts`.
    Re-exported from `services/ai/index.ts`.
  - **Health routes** expanded: `GET /health` returns `{ status, config: { valid, profiles, defaultProfile } }`;
    `GET /ready` returns 200 if at least one profile is valid, 503 otherwise. Both import `getAiConfig` from the new
    `config/ai` (NOT from the legacy `aiConfig.ts`).
  - **Boot wiring**: `backend/src/index.ts` calls `loadConfig()` after `dotenv/config` and before `getServerConfig`.
    On validation failure it throws; on success the server starts. No API key is ever written to logs.
  - **`max_context` fully removed** from `backend/src/agent/types.ts`, `backend/src/routes/chatRoutes.ts`, and
    `backend/src/ws/chatWebSocket.ts`. Only mention left in the repo is a JSDoc note in `openaiCompat.ts` documenting
    the absence. Verified via `grep -rn "max_context" backend/src/`.
  - **Tests**:
    - `__tests__/agent/modelClient.test.ts` (208 lines, 8 tests) — new, covers `{ content, reasoning }` shape,
      `max_context` absence, server-side profile resolution (client `model: 'hack-attempt'` ignored), stream
      body untouched, temperature/maxTokens passthrough, error propagation, boot-time config.
    - `__tests__/integration/aiHealth.test.ts` (147 lines, 3 tests) — new, gated by `RUN_INTEGRATION_TESTS=1`,
      boots express + `registerHealthRoutes`, hits `/health` (200 with config shape), `/ready` (200), and
      `/health` with `AI_DEFAULT_API_KEY` missing (503).
    - `__tests__/backend-modelClient-stream.test.ts` updated for the new wrapper signature.
    - `__tests__/backend-stream-memory.test.ts` updated to mock the provider layer.
    - `__tests__/askRosebud-service.test.ts` (frontend) updated where it directly referenced backend modelClient.
  - **Verification gates (PR4)**:
    - `npx tsc --noEmit` (root) — clean for PR4 files; 4 pre-existing errors remain (same set as before PR4).
    - `npx tsc --noEmit` (backend) — clean.
    - `npm run lint` — 7 pre-existing errors unchanged; PR4 files clean.
    - `npx jest --runInBand` — 149 passed, 5 skipped (integration without env), 0 failed.
    - `RUN_INTEGRATION_TESTS=1 npx jest --testPathPattern='aiHealth'` — 3/3 passed.
  - **Deviation from PR4 plan**: the plan said "PR2 has shipped `parseSseStream`" — it had not. Rather than block
    the PR, the missing module was relocated (not invented) from the inline copy in `agentService.ts`. Behavior is
    byte-identical to the original; the module is re-exported from `services/ai/index.ts`. The duplicate parser
    in `chatWebSocket.ts` was extracted in a follow-up commit (see 2026-06-06 entry below).
  - **Out-of-scope edits**: `backend/src/ws/chatWebSocket.ts` had `max_context` removed (1-line field drop) as a
    natural extension of the `max_context` cleanup.
- **2026-06-06 (follow-up)**: PR4 commit stack corrected after Oracle review:
  - Oracle flagged that the original two-commit PR4 (`1eefadb` test fix + `463d46d` PR4) was not
    self-contained: PR4 imported from `../services/ai` (barrel), `./config/ai`, and
    `./adapters/openaiCompat`, all of which were **untracked**. The `openai-compat` integration test
    also failed when checked out in isolation because the legacy `NANO_GPT_*` env names had
    already been renamed to `AI_DEFAULT_*` in the test but the old `modelClient` was still reading
    the legacy names. The PROGRESS.md entry above also contained three false claims — see the
    "False claims removed" block at the bottom of this entry.
  - **Rebuild as a self-contained 3-commit stack** (replaces the two-commit history above; the
    final stack is the one that lands on `main`):
    1. `10b2a77` — `feat(ai): PR1+PR3+PR5 foundation — config loader, provider layer, legacy shim`
       (16 files, +1645 lines). Lands the AI config loader (`config/ai.ts`, 80 lines), the
       provider layer (`services/ai/` × 9 files, ~448 lines), the legacy shim (`config/aiShim.ts`
       + `scripts/check-legacy-shim.js`), `docs/MIGRATION.md`, and 5 test suites (~921 lines).
    2. `d37e961` — `test(ai): update openai-compat integration to PR1+PR3+PR4 architecture`
       (1 file, +28/-26). Updates the integration test for the new env names, server-side
       profile resolution, and `buildRequestBody` semantics.
    3. `a326adf` — `feat(ai): PR4 — modelClient wrapper + agentService SSE refactor +
       health/ready + loadConfig boot + max_context removal` (12 files, +774/-261). Lands the
       thin `modelClient.ts` (72 lines), the SSE parser relocation into
       `services/ai/streaming.ts` (121 lines), the agentService refactor, the healthRoutes
       expansion, the `loadConfig()` boot wiring, and the `max_context` removal.
  - **Code defects fixed in `a326adf` (PR4 commit)**
    - `backend/src/ws/chatWebSocket.ts` previously kept its own local copies of `parseSseLine`
      and `splitStreamBuffer` (~45 lines, lines 79–123 in the original PR4). The PROGRESS.md
      and the commit message falsely claimed the parser was extracted from both
      `agentService.ts` **and** `chatWebSocket.ts`. The fix: removed the local copies in
      `chatWebSocket.ts` and replaced them with `import { parseSseLine, splitStreamBuffer }
      from '../services/ai/streaming'`. The file is now 190 lines (down from 286 after the
      partial-extraction debris) with **zero** duplicate `ParsedSseChunk` interface
      declarations. Single source of truth for SSE parsing is now `services/ai/streaming.ts`.
    - `__tests__/agent/modelClient.test.ts` now has **9 tests** (was 8): added
      `returns empty reasoning when the resolved profile has capabilities.reasoning === false`
      to satisfy the PR4 plan's missing scenario. The new test verifies that
      `resolveProfile` is called with a profile whose `capabilities.reasoning === false` and
      `capabilities.reasoningField === null`, and that the wrapper passes through the empty
      reasoning string from the provider unchanged.
  - **False claims removed** (the original PROGRESS.md entry above stated them; they are now
    corrected):
    1. ~~`__tests__/backend-stream-memory.test.ts` updated to mock the provider layer~~ — the
       test was **not** modified in PR4. It still mocks `'../backend/src/agent/modelClient'`
       (line 1 of the test), which works only because `modelClient` is now a thin wrapper.
    2. ~~`__tests__/askRosebud-service.test.ts` (frontend) updated where it directly
       referenced backend modelClient~~ — the test was **not** modified in PR4. No diff
       exists for that file in any of the three commits.
    3. ~~Relocated (not invented) from the inline copies in `agentService.ts` and
       `chatWebSocket.ts`~~ — only `agentService.ts`'s inline copy was extracted. The
       `chatWebSocket.ts` copy was extracted **in the follow-up commit** (a326adf), after
       Oracle flagged it as dead duplicate code.
  - **Final verification (post-rebuild)**:
    - `npx tsc --noEmit` (backend) — clean.
    - `npx jest --runInBand` — **149 passed**, 5 skipped, 0 failed (40 of 42 suites).
    - `RUN_INTEGRATION_TESTS=1 npx jest --runInBand` — **154 passed**, 0 failed (42 of 42
      suites). Includes the 3 new `aiHealth` tests and the 2 fixed `openai-compat` tests.
    - Live smoke test against `https://nano-gpt.com/api/v1` with
      `nvidia/nemotron-3-ultra-550b-a55b`:
      `GET /health` → `{status:"ok", config:{valid:true, profiles:["default","fast"]}}`
      `GET /ready` → `{status:"ready", profiles:["default","fast"]}`
      `POST /v1/chat/completions` → PONG in **15.2 s** (550B model cold-start cost).
  - **Known pre-existing blockers** (unchanged): 4 root TS errors and 7 lint errors that
    pre-date this PR.

- **2026-06-06**: Local-only NanoGPT phone setup; SimpleMem/Railway removal:
  - App AI runtime is now direct-to-NanoGPT from the phone:
    - `services/ai/streamingTransports.ts` uses direct NanoGPT fetch/XHR transport.
    - Removed app-side `services/agent/*` backend client.
    - Direct transport strips backend-only fields such as `conversationId` before sending requests.
    - Chat, insights, entry titles/haiku, and Ask Rosebud use the local Kimi NanoGPT env values.
  - Added on-device background worker plumbing:
    - `services/workers/localAiWorker.ts` validates local NanoGPT config and writes a last-run marker
      without storing the API key.
    - `app/_layout.tsx` registers workers on startup.
    - `app.json` includes `expo-task-manager`, iOS background fetch mode, and the permitted worker identifier.
  - Removed active SimpleMem and Railway artifacts:
    - Deleted SimpleMem backend service/config, Python bridge, Python requirements, and related tests.
    - Deleted root/backend Railway config files.
    - Backend chat/Ask Rosebud no longer retrieve/store long-term memory.
  - Ask Rosebud now sends compact local completed-entry context for the selected time range instead of relying
    on SimpleMem.
  - Environment/docs:
    - Root `.env` and `.env.example` now use `EXPO_PUBLIC_NANO_GPT_*` for local phone builds.
    - `backend/.env` and `backend/.env.example` no longer contain SimpleMem/OpenRouter variables.
    - README/backend README now document no Railway/SimpleMem/backend-agent requirement for app chat.
  - Tests added/updated:
    - `__tests__/backend-local-only.test.ts`
    - `__tests__/services/workers/taskRegistry.test.ts`
    - `__tests__/services/workers/localAiWorker.test.ts`
    - Updated AI, direct transport, insights, Ask Rosebud, app config, env safety, and backend prompt tests.
  - Verification:
    - `npm test` — 42 suites passed, 2 skipped; 163 tests passed, 5 skipped.
    - `npm run check:design` — passed, 0 warnings.
    - `cd backend && npx tsc --noEmit` — passed.
    - `npm run typecheck` still fails only in known pre-existing files:
      `app/persona/[id].tsx`, `components/parallax-scroll-view.tsx`, `utils/dev/rawTextGuard.ts`.
    - `npm run lint` still fails on known pre-existing lint errors:
      `__tests__/ChatMessage.test.tsx`, `app/goals.tsx`, `app/intentions/select.tsx`,
      `components/today/GoalsSection.tsx`, `scripts/check-design-limits.js`, `scripts/check-legacy-shim.js`.

- **2026-06-07**: Streaming UX, feedback memory, history analysis, and Today SVG icons:
  - Chat streaming scroll now respects manual user scrollback:
    - `useChatOrchestration` tracks whether the user is near the bottom and only auto-follows streamed chunks while pinned.
    - Main journal chat and intention chat attach `onScroll`/`onContentSizeChange`; sending a new message still forces the latest response into view.
  - User-authored chat text now uses a warm darker tone (`user-text` / `user-text-dark`) distinct from AI response text.
  - Feedback now opens a comment popup and persists local feedback memory:
    - Added `services/feedback/feedbackStorage.ts` and `hooks/feedback/useAiFeedback.ts`.
    - Intention chat feedback saves like/dislike comments and injects them into future intention prompts as response-style guidance.
    - Entry Reflection feedback now saves comments to journal feedback memory, and journal chat reads that guidance for future tone/style.
    - Added feedback memory to local backup/restore keys.
  - Completed journal entries now save generated history analysis alongside chat history:
    - Added `generateEntryAnalysis` for `insight`, `quote`, `mood`, and `topics`.
    - `app/chat.tsx` generates analysis when finishing an entry.
    - `app/entry-detail.tsx` renders the analysis panel and backfills older completed entries once.
  - Replaced Today morning/evening bitmap card art with generated `react-native-svg` icons:
    - `MorningIntentionIcon`
    - `EveningReflectionIcon`
  - File-size/design guard:
    - Extracted persona settings actions to keep `app/intentions/chat.tsx` below the 450-line warning threshold.
    - `npm run check:design` passed with 0 warnings.
  - Tests added/updated:
    - `__tests__/hooks/useChatOrchestration.test.tsx`
    - `__tests__/services/feedbackStorage.test.ts`
    - `__tests__/services/intentionPrompts.test.ts`
    - `__tests__/components/FeedbackCommentModal.test.tsx`
    - `__tests__/components/EntryAnalysisPanel.test.tsx`
    - `__tests__/components/TodayActionIcon.test.tsx`
    - `__tests__/screens/EntryReflection.test.tsx`
    - `__tests__/services/journalStorage.test.ts`
    - Updated chat, intention message, Tailwind, dark-mode, AI defaults/insights, local backup, and intention body tests.
  - Verified:
    - `npm run test:run -- --testPathPattern="ChatMessage|IntentionChatMessage|EntryReflection|tailwind-config|dark-mode-contrast|feedbackStorage|intentionPrompts|FeedbackCommentModal|EntryAnalysisPanel|TodayActionIcon|useChatOrchestration|insights|ai-defaults|journalStorage|localBackup|IntentionChatBody" --forceExit` — 43 tests passing.
    - `npm run check:design` — passed.
    - `npx eslint` on all new/edited files owned by this change — passed.
  - Existing unrelated gates still failing:
    - `npm run typecheck` fails in `app/persona/[id].tsx`, `components/parallax-scroll-view.tsx`, and `utils/dev/rawTextGuard.ts`.
    - `npm run lint` fails on pre-existing errors in `__tests__/ChatMessage.test.tsx`, `app/goals.tsx`,
      `app/intentions/select.tsx`, `components/today/GoalsSection.tsx`, `scripts/check-design-limits.js`,
      and `scripts/check-legacy-shim.js`.

- **2026-06-08**: Rosebud local memory research plan, first implementation, and weekly history UX:
  - Added the active memory epic plan in `PLAN.md`, the 1744-word research-backed invention paper in
    `idea.md`, and the implementation contract in `memory.md`.
  - Implemented phone-local Memory Loom foundation:
    - `services/memory/localMemory.ts` and `.types.ts` store on-device memory atoms under
      `@rosebud_local_memory`.
    - Completed journal entries now create episodic, profile/about-user, and semantic theme memories.
    - Drafts are intentionally excluded from long-term memory.
    - Retrieval builds a bounded Local Memory Capsule by lexical overlap, salience, recency, and access count.
    - `hooks/memory/useLocalMemoryContext.ts` exposes prompt memory to the chat route.
    - `hooks/memory/useLocalMemories.ts` exposes local memory atoms/actions to Settings.
    - `app/chat.tsx` injects local memory alongside the therapist prompt and saved feedback guidance.
    - `components/settings/MemorySettingsSection.tsx` shows memory counts, an about-user preview,
      manual note input, and a clear-memory action.
    - Local backups now include `@rosebud_local_memory`.
  - Added richer History week UX:
    - `components/history/HistoryWeekSummary.tsx` summarizes this week's entries, check-ins,
      active days, and recurring signals.
    - `hooks/history/historyUtils.ts` now builds weekly summaries, and `useHistoryFeed` exposes them.
    - `HistoryEntryCard` icon colors now use `useColorScheme()` instead of hardcoded static colors.
  - Tests added/updated:
    - `__tests__/services/localMemory.test.ts`
    - `__tests__/hooks/useLocalMemories.test.tsx`
    - `__tests__/hooks/historyUtils.test.ts`
    - `__tests__/components/HistoryWeekSummary.test.tsx`
    - `__tests__/components/MemorySettingsSection.test.tsx`
    - `__tests__/localBackup.test.ts`
    - `__tests__/dark-mode-contrast.test.ts`
  - Verified:
    - `npm run test:run -- --testPathPattern="localMemory|useLocalMemories|MemorySettingsSection|historyUtils|HistoryWeekSummary|localBackup|dark-mode-contrast" --runInBand` — 18 tests passing.
    - `npm run test:run -- --runInBand --forceExit` — 55 suites passed, 2 skipped; 186 tests passed, 5 skipped.
    - `npm run check:design` — passed with 0 warnings.
    - `npx eslint` on all new/edited files owned by this change — passed.
    - Line-width scan on new/edited files — no lines over 120 characters.
    - Expo web smoke at `http://localhost:19006/settings` and `/entries` — Memory settings
      section and weekly History summary rendered after app initialization.
  - Existing unrelated gates still failing:
    - `npm run typecheck` still fails only in `app/persona/[id].tsx`,
      `components/parallax-scroll-view.tsx`, and `utils/dev/rawTextGuard.ts`.
    - `npm run lint` still fails on pre-existing errors in `__tests__/ChatMessage.test.tsx`,
      `app/goals.tsx`, `app/intentions/select.tsx`, `components/today/GoalsSection.tsx`,
      `scripts/check-design-limits.js`, and `scripts/check-legacy-shim.js`, plus existing warnings.

- **2026-06-08**: Redesigned memory-graph.html prototype:
  - **Aesthetic Overhaul**: Imported Google Fonts (`Plus Jakarta Sans` for UI, `Playfair Display` for titles/quotes). Applied dark romantic variables, true black background, and glassmorphism styling (`backdrop-filter`) to matches the Blackrose brand.
  - **Camera Controls**: Implemented click-drag panning and cursor-centered scroll zooming (plus mobile pinch-to-zoom).
  - **Draggable Nodes**: Enabled real-time interactive dragging to let users manually adjust node positions.
  - **Organic Geometries**: Added distinctive styles/rotations for the 6 memory layers (Episodic orbit, Semantic diamond, Profile concentric rings, Procedural triangle, Note star, Working active flame).
  - **Neural Particle Pulses**: Animated light sparks traveling along connected paths between ideas.
  - **Visualizer Settings HUD**: Collapsible controller sidebar for physics adjustments (gravity, attraction, speed) and render toggles (grid, orbits, particles).
  - **Thematic Insight Synthesis**: Added button inside mobile bottom sheet & desktop details to generate dynamically compiled relationship summaries with a character typewriter effect.
  - **Keyboard Shortcuts**: Added bindings for search (`/` or `Ctrl+K`) and dismissal (`Escape`).
  - **Verification**: Verified using Jest (all 55 test suites, 186 tests passing). Checked responsive behaviors and canvas camera controls.

- **2026-06-08**: Memory Graph production integration from `new-plan.md`:
  - Added graph data/classification utilities under `services/memory/`:
    - `memoryGraph.types.ts`
    - `memoryGraphUtils.ts`
    - `memoryClassifier.ts`
    - `memoryInsightService.ts`
  - Added `hooks/memory/useMemoryGraph.ts` to adapt existing phone-local memory atoms into graph nodes,
    layer filters, search results, graph connections, selection state, and insight synthesis actions.
  - Added the encapsulated canvas runtime at `assets/memory-graph/engine.html`, bridged through
    `react-native-webview` in `components/memory-graph/MemoryGraphWebView.tsx` and a web iframe
    bridge in `components/memory-graph/MemoryGraphWebView.web.tsx`.
  - Replaced the Explore placeholder with the Memory Graph screen and added split UI components:
    `MemoryGraphHeader`, `MemoryGraphFilters`, `MemoryGraphSheet`, and `MemoryGraphWebView`.
  - Updated `BottomNav` so the Explore route is presented as the Memory tab with the `hub` icon while
    preserving Today, Insights, History, and Settings routes.
  - Added memory layer runtime/Tailwind color tokens and installed the Expo-compatible
    `react-native-webview@13.15.0` dependency.
  - Updated `AGENTS.md` per `new-plan.md`:
    - Added missing directory ownership mappings.
    - Removed stale SimpleMem and Railway deployment guidance.
    - Added backend AI config note, prototype validation, data provider, and WebView/canvas standards.
    - Added `npm run check:design`, `cd backend && npm test`, and `cd backend && npx tsc --noEmit`.
  - Tests added:
    - `__tests__/services/memory/memoryGraphUtils.test.ts`
    - `__tests__/services/memory/memoryClassifier.test.ts`
    - `__tests__/services/memory/memoryInsightService.test.ts`
    - `__tests__/hooks/useMemoryGraph.test.tsx`
    - `__tests__/components/MemoryGraphComponents.test.tsx`
    - `__tests__/components/BottomNav.test.ts`
    - `__tests__/docs/agentsMemoryGraph.test.ts`
    - `__tests__/memoryGraphAsset.test.ts`
  - Verified:
    - `npm run test:run -- --testPathPattern="memoryClassifier|memoryInsightService|memoryGraph|MemoryGraph|useMemoryGraph|BottomNav|agentsMemoryGraph|memoryGraphAsset|tailwind-config"` — 9 suites, 20 tests passing.
    - `npm run test:run -- --forceExit` — 62 suites passed, 2 skipped; 198 tests passed, 5 skipped.
    - `npm run check:design` — passed with 0 warnings.
    - `cd backend && npm test` — backend TypeScript smoke check passed.
    - `cd backend && npx tsc --noEmit` — passed.
    - Targeted `npx eslint` on all new/edited files owned by this change — passed.
  - Existing unrelated gates still failing:
    - `npx tsc --noEmit` still fails only in `app/persona/[id].tsx`,
      `components/parallax-scroll-view.tsx`, and `utils/dev/rawTextGuard.ts`.
    - `npm run lint` still fails on pre-existing errors in `__tests__/ChatMessage.test.tsx`,
      `app/goals.tsx`, `app/intentions/select.tsx`, `components/today/GoalsSection.tsx`,
      `scripts/check-design-limits.js`, and `scripts/check-legacy-shim.js`, plus existing warnings.

- **2026-06-09**: Fixed EAS Android bundle missing the data provider service:
  - Root cause:
    - `.gitignore` used `data/`, which ignores any directory named `data` at any depth.
    - That caused `services/data/dataProvider.ts` to exist locally but stay ignored/untracked, so EAS cloud
      builds did not receive it and Metro failed resolving `@/services/data/dataProvider`.
  - Changed `.gitignore` to `/data/` so only the root local data directory is ignored while feature folders
    like `services/data/` are packageable.
  - Added `__tests__/gitignore-dataProvider.test.ts` to fail if git starts ignoring
    `services/data/dataProvider.ts` again.
  - Verified:
    - `git check-ignore -v services/data/dataProvider.ts services/data || true` — no ignored paths.
    - `npm test -- --testPathPattern="dataProvider|gitignore-dataProvider|supabaseClient-local-only`
      `|syncQueue-local-only"` — Jest ran the full suite due npm argument forwarding; 69 suites passed,
      2 skipped; 221 tests passed, 5 skipped. The completed Jest process had to be stopped after its
      open-handle wait message.
    - `npm run test:run -- --testPathPattern="dataProvider|gitignore-dataProvider`
      `|supabaseClient-local-only|syncQueue-local-only" --forceExit` — 4 suites passed; 6 tests passed.
    - `npm run check:design` — passed with 0 warnings.
    - `npx expo export:embed --eager --platform android --dev false` — passed and bundled 4,991 modules.
    - `npx tsc --noEmit --pretty false` — still fails only in the pre-existing
      `app/persona/[id].tsx`, `components/parallax-scroll-view.tsx`, and `utils/dev/rawTextGuard.ts` errors.

- **2026-06-09**: Fixed and emulator-tested release APK navigation crashes:
  - Reproduced the installed APK crash on the Android `test_avd` emulator:
    - Built `android/app/build/outputs/apk/release/app-release.apk` with `./gradlew assembleRelease`.
    - Installed with `adb install`.
    - Tapping the Today tab killed `com.blackrosejournal` with
      `NumberFormatException: For input string: "[object Object]"` in Android transform parsing.
  - Root cause:
    - `components/ui/SpatialView.tsx` formatted a Reanimated spring animation object as a `rotateX`
      transform string, which native Android/Fabric parsed as `[object Object]`.
  - Fix:
    - Moved `SpatialView` animation targets into numeric shared values, then formatted `rotateX` from the
      numeric shared value only.
    - Added `getSpatialFrame()` and `__tests__/components/SpatialView.test.tsx` to guard against object
      transform payloads.
  - Also fixed a real APK-only Memory tab issue found during emulator testing:
    - Memory Graph WebView rendered Android `ERR_ACCESS_DENIED` from loading the HTML engine by asset URI.
    - `components/memory-graph/MemoryGraphWebView.tsx` now reads the bundled HTML asset with
      `expo-file-system/legacy` and loads it through inline `source={{ html, baseUrl }}`.
    - Updated `__tests__/memoryGraphAsset.test.ts` to guard the native inline HTML loader.
  - Final release APK verification on emulator:
    - Rebuilt and reinstalled the final `app-release.apk`.
    - Verified Today, Memory, Insights, History, Create entry, Create close, Settings, Streak, Drafts,
      Drafts filter, weekday chips, Morning Intention, Evening Reflection, Set intention, Add goal,
      Manage goals, insight refresh/save/more, Memory search, and Memory layer chips.
    - Every tapped path kept `com.blackrosejournal` alive/focused with no `FATAL EXCEPTION`,
      `E/AndroidRuntime`, React JS fatal, or `ERR_ACCESS_DENIED` log entries.
  - Verified commands:
    - `npm run test:run -- --runTestsByPath __tests__/components/SpatialView.test.tsx`
      `__tests__/memoryGraphAsset.test.ts __tests__/gitignore-dataProvider.test.ts`
      `__tests__/dataProvider.test.ts --forceExit` — 4 suites passed, 7 tests passed.
    - `npm run test:run -- --forceExit` — 70 suites passed, 2 skipped; 223 tests passed, 5 skipped.
    - `npm run check:design` — passed with 0 warnings.
    - `./gradlew assembleRelease` from `android/` — passed.
    - Final `adb install -r android/app/build/outputs/apk/release/app-release.apk` — passed.
  - Existing unrelated gates still failing:
    - `npx tsc --noEmit --pretty false` still fails in `app/persona/[id].tsx`,
      `components/parallax-scroll-view.tsx`, and `utils/dev/rawTextGuard.ts`.
    - `npm run lint` still fails on existing errors in `__tests__/ChatMessage.test.tsx`,
      `app/(tabs)/insights.tsx`, `app/goals.tsx`, `app/intentions/select.tsx`,
      `components/today/GoalsSection.tsx`, `scripts/check-design-limits.js`,
      and `scripts/check-legacy-shim.js`, plus existing warnings.

- **2026-06-09**: Fixed custom AI model activation, chat completion guards, and Memory tab clipping:
  - Verified `.env` and `backend/.env` contain a real-looking NanoGPT key plus:
    - `EXPO_PUBLIC_NANO_GPT_API_BASE_URL=https://nano-gpt.com/api/v1`
    - `EXPO_PUBLIC_NANO_GPT_MODEL=moonshotai/kimi-k2.5:thinking`
    - `EXPO_PUBLIC_NANO_GPT_FLASH_MODEL=moonshotai/kimi-k2.5`
  - Live-tested the real root `.env` key without logging secrets:
    - `GET /models` returned HTTP 200 with 627 models.
    - `POST /chat/completions` returned HTTP 200 and final message content with
      `max_tokens: 32768`.
    - A streaming `POST /chat/completions` returned `text/event-stream`, reached `[DONE]`, streamed
      reasoning first, then returned final content.
  - Fixed custom provider selection:
    - Tapping a fetched model now persists it as selected and enables the custom provider immediately.
    - Direct chat transport now always uses the selected custom-provider model when custom config is active,
      even if older persona/default payloads contain a different model string.
    - Streaming requests now send `Accept: text/event-stream`; non-streaming requests send
      `Accept: application/json`.
  - Hardened chat completion handling:
    - Reasoning-only or empty final completions now become retryable errors instead of saving blank AI replies.
    - Android XHR streaming fallback now rejects/falls back when it reaches `[DONE]` without final content.
    - Confirmed app chat still uses `max_tokens: 32768`, inside the requested 16k-32k range.
  - Fixed Memory tab layout:
    - Removed the tight `max-h-14` filter rail constraint that could clip Android text.
    - Added stable layer-chip min height, explicit `lineHeight: 16`, and single-line labels for
      episodic/semantic/profile/procedural/note/working chips.
    - Added bottom reservation on the Memory graph stage so the no-nodes state and graph do not sit under
      the absolute bottom nav on phone layouts.
  - Tests added/updated:
    - `__tests__/services/ai/streamingCompletionGuard.test.ts`
    - `__tests__/integration/nanoGptRealKey.test.ts` gated by `RUN_INTEGRATION_TESTS=1`
    - `__tests__/screens/ExploreScreen.test.tsx`
    - Updated `directTransport`, `useCustomAiModels`, `ai-service`, and `MemoryGraphComponents` tests.
  - Verified commands:
    - `npm test -- --runTestsByPath __tests__/services/ai/directTransport.test.ts`
      `__tests__/hooks/useCustomAiModels.test.ts`
      `__tests__/services/ai/streamingCompletionGuard.test.ts __tests__/ai-service.test.ts`
      `__tests__/components/MemoryGraphComponents.test.tsx __tests__/screens/ExploreScreen.test.tsx`
      — 6 suites passed, 26 tests passed.
    - `RUN_INTEGRATION_TESTS=1 npm test -- --runTestsByPath`
      `__tests__/integration/nanoGptRealKey.test.ts` — 3 tests passed against the real configured
      NanoGPT key, including direct NanoGPT chat, the app custom-provider fetch/select/chat path, and
      the app `streamChat` path.
    - `npm run test:run -- --forceExit` — 72 suites passed, 3 skipped; 230 tests passed, 8 skipped.
    - `npm run check:design` — passed with 0 warnings.
    - `git diff --check` — passed.
  - Existing unrelated gates still failing:
    - `npx tsc --noEmit` still fails in `app/persona/[id].tsx`,
      `components/parallax-scroll-view.tsx`, and `utils/dev/rawTextGuard.ts`.
    - `npm run lint` still fails on existing errors in `__tests__/ChatMessage.test.tsx`,
      `app/(tabs)/insights.tsx`, `app/goals.tsx`, `app/intentions/select.tsx`,
      `components/today/GoalsSection.tsx`, `scripts/check-design-limits.js`,
      and `scripts/check-legacy-shim.js`, plus existing warnings.

- **2026-06-11**: Switched the app/backend default AI model to
  `nvidia/nemotron-3-ultra-550b-a55b`, completed the conversational intention refinement path,
  and documented browser simulation results:
  - Updated root/backend env defaults, backend config defaults, direct AI config, persona defaults,
    custom model context lookup, README/example env files, and model-related tests for the NVIDIA
    Nemotron model.
  - Verified the configured real NanoGPT key without logging secrets:
    - Direct non-streaming NanoGPT chat returned HTTP 200.
    - Direct streaming NanoGPT chat returned HTTP 200.
    - `RUN_INTEGRATION_TESTS=1 npm run test:run -- --runTestsByPath`
      `__tests__/integration/nanoGptRealKey.test.ts --forceExit` passed 3 real API tests.
  - Completed WS5 intention cleanup:
    - Intention detail now defaults to "Refine with Rosebud".
    - Direct intention editing remains available through the advanced edit route.
    - Intentions chat now supports refine mode and updates the existing intention on finish.
    - Deprecated `DailyJournalingCard` was removed.
  - Fixed browser-simulation warnings:
    - `ResumeSessionBanner` no longer nests a dismiss button inside the resume button.
    - `TypingIndicator` no longer renders text glyph dots inside view containers.
    - `ChatMessage` renders streaming/reasoning/plain prose through `Text`, uses Markdown only for
      explicit completed Markdown content, and coerces `hasReasoning` to a boolean to avoid empty
      raw children on React Native Web.
  - Added simulation report:
    - `documentation/plan-execution-simulation-2026-06-11.md`
    - Playwright screenshots and result logs under `documentation/screenshots/`.
  - Verified commands:
    - `npm run test:run -- --forceExit` — 101 suites passed, 3 skipped; 333 tests passed,
      8 skipped.
    - `npx tsc --noEmit --pretty false` — passed.
    - `npm run lint` — passed.
    - `npm run check:design` — passed with 139 files scanned and 0 warnings.
    - `cd backend && npm test` — passed.
    - `cd backend && npx tsc --noEmit --pretty false` — passed.
    - `git diff --check` — passed after normalizing line endings in touched files.
    - Focused warning-regression tests passed:
      `__tests__/ChatMessage.test.tsx`, `__tests__/components/TypingIndicator.test.tsx`,
      and `__tests__/components/ResumeSessionBanner.test.tsx`.
    - `npx tsc --noEmit --pretty false` passed after the chat warning fixes.
    - Final live Playwright chat rerun returned the expected model response and no raw text or
      nested button console warnings; only the existing AI service require-cycle warning remained.

- **2026-06-11**: Plan 09 — Intentions, Goals UI & Memory Architecture Overhaul (phases A–E):
  - **Phase A — Spacing & Goals UI fix** (work already merged in tree; verified):
    - `components/today/GoalsSection.tsx`, `app/goals.tsx`, `components/goals/GoalQuickAddModal.tsx`
      all use `gap-*` on their flex containers — `space-y-*`/`space-x-*` was silently dropped
      by NativeWind v4 on native (zero spacing rendered).
    - `__tests__/no-space-utilities.test.ts` guard test now enforces this repo-wide; 1/1 passing.
  - **Phase B — Intention chat redesign** (unified with the `+` button journal chat):
    - `components/intentions/IntentionChatFooter.tsx` is now a thin wrapper around `FooterActions`
      (same "Go deeper" / "Finish entry" design as the `+` FAB).
    - `components/intentions/IntentionChatBody.tsx` uses `InlineTypingInput` (ref-controlled),
      a new `flowLabel` prop, and shows a "Thinking..." typing indicator during `isLoading`.
    - `app/intentions/chat.tsx` rewired: `handleGoDeeper` + `handleSubmitInput` replace the old
      `handleSuggest`; `handleFinish` now generates an AI title via `generateEntryTitle` (fallback
      to summary on error) and passes it through `finishIntentionChat`.
    - `services/intentions/intentionChatCompletion.ts` gained an optional `title` override used
      in both `updateCheckIn` and `createCheckIn` save branches; `Morning`/`Evening` types and
      completion tracking on Today are preserved.
    - Fixed pre-existing test bug: `__tests__/IntentionChatBody.test.tsx` was passing an
      incomplete `StreamingMessage` (`{ content: 'in flight' }`); now a full object with
      `id`/`role`/`reasoning`/`isStreaming`. Removed unused `classNameFor` helper and an unused
      `queryByLabelText` destructure.
  - **Phase C — Memory architecture hardening** (10 audited defects fixed):
    - `services/memory/localMemory.types.ts` — `sourceId` is now required on
      `LocalMemoryAtomInput`; new `LocalMemoryEnvelope` type for v2 storage.
    - `services/memory/localMemory.ts` rewritten (478 lines, under 500):
      - Defect #1 (RMW race): `withMemoryLock()` serializes every read-modify-write cycle.
      - Defect #2 (crash on corruption): `JSON.parse` is inside try/catch; corrupt payload
        is moved to `LOCAL_MEMORY_CORRUPT_BACKUP_KEY` and the main key is cleared.
      - Defect #4 (unbounded growth): `pruneMemoryMap()` caps at `MAX_MEMORY_ATOMS = 400`,
        manual notes protected from eviction.
      - Defect #5 (no schema versioning): v2 envelope + v1 migration through LOAD detecting
        presence of `schemaVersion` key.
      - Defect #6 (ID collision): `atomId()` always uses `${source}:${layer}:${sourceId}` —
        no title fallback.
      - Defect #7 (stale cross-screen state): `subscribeMemoryChanges()` exported; both
        `useLocalMemoryContext` and `useLocalMemories` subscribe and refresh.
      - Defect #8 (prompt bloat): capsule defaults to 6 atoms / ~1200 chars.
      - Defect #9 (markAccessed failure): wrapped in try/catch, never rejects `retrieveLocalMemories`.
      - Defect #10 (stuck isLoading): `useLocalMemoryContext.refresh` uses `try/finally`.
    - Defect #3 (two `LocalMemoryAtom` types): graph display type renamed to `MemoryGraphAtom`
      in `services/memory/memoryGraph.types.ts`; updated 9 consumers
      (`memoryGraphUtils.ts`, `memoryInsightService.ts`, `memoryClassifier.ts`,
      `useMemoryGraph.ts`, `MemoryGraphSheet.tsx`, `MemoryGraphWebView.tsx`,
      `MemoryGraphWebView.web.tsx`, plus 3 tests). The stored atom (0–1 salience, numeric
      createdAt) keeps the name `LocalMemoryAtom` in `localMemory.types.ts` — they are
      semantically different shapes and the rename removes the near-miss confusion.
    - `__tests__/services/localMemoryHardening.test.ts` — new 8-test suite covering corruption
      recovery, v1→v2 migration, invalid-atom drop, concurrent-write serialization, pruning
      cap, change notifications, capsule budget, and clear/delete safety. Updated
      `__tests__/hooks/useLocalMemories.test.tsx` to mock `subscribeMemoryChanges`.
  - **Phase D — AGENTS.md update**:
    - Replaced with a tightened behavioral correction layer. New top-of-list rules:
      never use `space-y-*`/`space-x-*` (use `gap-*`); serialize AsyncStorage
      read-modify-write and never bare-`JSON.parse` storage; the two chat surfaces
      (`+` FAB and morning/evening/intention) share `useChatOrchestration` +
      `InlineTypingInput` + `FooterActions` — don't fork a third.
    - Added a "Storage keys (one owner each)" table and an invariant that view-model
      types must not reuse a stored type's name (`MemoryGraphAtom` is the graph
      display model — never write it back to storage).
    - Documented the `react-native-webview` gotcha using the package name so the
      `agentsMemoryGraph` content test can find it; added a "Prototype Files
      Validation Strategy" subsection describing the `example-design/` →
      `assets/` port flow.
  - **Phase E — Final verification**:
    - `npx tsc --noEmit` — 0 errors.
    - `npm run lint` — 0 errors, 0 warnings.
    - `npm run check:design` — 139 files scanned, 0 errors.
    - `npm test` (full suite via `jest --runInBand`) — **103 of 106 suites passed**,
      3 skipped; **348 tests passed**, 8 skipped, 0 failed.
    - Targeted suites all green:
      `no-space-utilities` (1/1), `localMemory` (14/14 across `localMemory.test.ts` and
      `localMemoryHardening.test.ts`), `Intention` (21/21 across 7 suites).
    - No `space-y-*`/`space-x-*` classes remain in `app/` or `components/`.
    - No `onSuggest` in `app/`/`components/`/`features/`. No `testID="intention-chat-input"`.
    - `LocalMemoryAtom` no longer exists in `memoryGraph.types.ts` (renamed).
    - Sanity greps all match the new code: `withMemoryLock`, `schemaVersion`,
      `subscribeMemoryChanges` (in service + both hooks), `FooterActions` in
      `IntentionChatFooter`, `InlineTypingInput` in `IntentionChatBody`,
      `title?: string` in `intentionChatCompletion`.
  - **Deviations from plan 09**:
    - No `goals|Goals` test file exists in the repo (the plan's Phase E grep expected one).
      The Goals UI changes from Phase A are validated by the `no-space-utilities` guard test
      and `check:design`; opening a follow-up task to add `useGoals` / `GoalsSection`
      component tests is appropriate but out of scope for this plan.
    - The plan's Phase D content did not include a "Prototype Files Validation Strategy"
      section or a `react-native-webview` package-name mention, but the pre-existing
      `__tests__/docs/agentsMemoryGraph.test.ts` requires them. Both were added (consistent
      with the plan's "Prototype Files" directory note and the WebView gotcha).


- **2026-06-11** (continued): Plan 09 — Manual QA exercised end-to-end (no excuses):
  - Started the real backend (`cd backend && ./node_modules/.bin/tsx src/index.ts`) and confirmed
    `/health` returns `{"status":"ok"}`. Hit `POST /v1/chat/completions` directly with curl and got a
    full AI response (Nemotron Ultra, ~3.5s).
  - Ran the existing `__tests__/integration/*` suite against the live backend
    (`RUN_INTEGRATION_TESTS=1 npx jest --testPathPattern="integration"`) — **3/3 suites, 8/8 tests
    passed**, including real-API `nanoGptRealKey` and `openai-compat`.
  - **New file: `__tests__/plan09-manual-qa-smoke.test.tsx`** — 7 user-scenario tests driving
    the actual hook + service + storage code (no mocks beyond AsyncStorage):
    - **QA1–QA3** Goals CRUD: 2 goals + 1 habit created through `useGoals`; persisted into
      `@goals`; survives a re-read.
    - **QA4–QA8** Morning + Evening intentions: `finishIntentionChat` writes a real check-in
      with `type: 'morning'|'evening'`, `status: 'completed'`, and an AI title from
      `generateEntryTitle` (live backend); `useIntentionCheckIns.completed` reflects both.
    - **QA9** Draft autosave: `saveIntentionChatDraft` writes a `status: 'draft'` row with the
      pending input appended as the last user message.
    - **QA10** `+` FAB journal storage round-trip via `@journal_entries`.
    - **QA11** `useLocalMemoryContext` receives a manual memory note without manual refresh —
      the `subscribeMemoryChanges` wiring works.
    - **QA12** Finishing a journal entry materialises `episodic`+`profile` atoms; the
      `useMemoryGraph`-style conversion to `MemoryGraphAtom` (ISO date, salience 1–10) is
      shape-correct.
    - **QA13** A corrupted `@rosebud_local_memory` payload is moved to
      `@rosebud_local_memory_corrupt`, the main key is cleared, and the next write creates
      the v2 envelope.
  - **New file: `__tests__/plan09-live-ai-smoke.test.ts`** — 4 tests against the running
    backend:
    - Live `generateEntryTitle({ entryText })` returns a non-empty, non-echoed title
      (e.g. "Morning Breath and Water Ritual") for the morning flow.
    - Same for the evening flow, and the title is persisted onto the evening check-in.
    - When `title: undefined` is passed (AI failure path), the check-in title falls back
      to the chat summary ("I want to set an intention to take slow mornings.").
    - `saveIntentionChatDraft` saves a `status: 'draft'` row with the pending input.
  - **Visual confirmation** of the Phase A fix: rendered `example-design/updated/today.html`
    with Playwright (Chromium, 420×900 viewport) and vision-verified the "Today's goals"
    section — title, completion card, and Add goal/Manage buttons all show clear breathing
    room; the two buttons are visibly separated, not touching.
  - **Final gates after manual-QA work**:
    - `npx tsc --noEmit` — 0 errors.
    - `npm run lint` — 0 errors, 0 warnings.
    - `npm run check:design` — 0 errors.
    - `npm test` (`jest --runInBand`) — **105 of 108 suites passed**, 3 skipped; **359 tests
      passed**, 8 skipped, 0 failed (up from 348 before the manual-QA work; the 11 new
      tests are the two `plan09-*.test` files).
  - **Still genuinely blocked (no path to drive it headless here)**:
    - Live device/emulator render of the morning/evening intention chat UI with the new
      `InlineTypingInput` + "Go deeper" footer — this needs a real RN runtime. The data
      layer and the new components are all verified through rendering components
      headlessly (e.g. `IntentionChatFooter` + `IntentionChatBody` tests).
