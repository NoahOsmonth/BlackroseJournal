# AGENTS.md

You are a brilliant, fast, literal-minded contractor with amnesia between tasks. You follow exactly what is written here, nothing more. This file is a **behavioral correction layer for this repo's specific failure modes** — not general best practices. If a rule isn't here, don't infer it from vibes.

Every rule below prevents a real bug that already happened. Rules are ordered by how often they get violated.

---

## Most-violated rules (read first)

### 1. Every color is a token. Both schemes. Every `<Text>` has a `dark:` variant.

Theme is **two-way**. Bugs go both directions:

| Failure | Symptom |
|---|---|
| Missing `dark:` / dark icon hex | Text/icons **invisible on dark** |
| Hardcoded dark chrome only (`bg-black`, `bg-gray-950`, `text-white` on surfaces, `#070B14`) | UI **stuck black in light mode** |

Bare `<Text className="text-gray-900">` is invisible in dark mode because RN text does not inherit color from parent Views. Hardcoded `bg-black/90` (BottomNav) and `bg-gray-950` ("Open the map") shipped black bars/cards in white mode.

```tsx
// BAD — dark-only chrome, light mode stays black
<View className="bg-black/90">…</View>
<View className="bg-gray-950 dark:bg-black">…</View>
<Text className="text-white">Open the map</Text>
// style={{ backgroundColor: '#070B14' }} forever

// BAD — light-only text, dark mode invisible
<Text className="text-gray-900">Hello</Text>
<Icon color="#111827" />

// GOOD — both schemes
<View className="bg-surface-light/95 dark:bg-black/90">…</View>
<Text className="text-text-light dark:text-white">Open the map</Text>
const isDark = useColorScheme() === 'dark';
const iconColor = isDark ? '#F9FAFB' : '#111827';
const stageBg = isDark ? '#06080F' : '#EEF1F8';
```

**WebViews / HTML engines** (memory graph): host theme is **not** automatic. Bridge `colorScheme` with a message (e.g. `SET_THEME`) and paint both palettes in the engine. RN stage wrapper behind the WebView must match.

Exceptions (ok to stay scheme-agnostic): dimmed modal scrims (`bg-black/50`), pure shadows, primary CTA labels on a solid brand fill when both schemes use the same fill.

Two color systems coexist — pick the right one per file:
- `tailwind.config.js` — NativeWind classes. Add new tokens here first. NativeWind silently drops undefined tokens — no error, just invisible UI.
- `constants/theme.ts` — JS runtime values for non-NativeWind code.

Guard tests: `__tests__/tailwind-config.test.ts`, `__tests__/dark-mode-contrast.test.ts`, `__tests__/components/BottomNav.test.ts`, `__tests__/memoryGraphAsset.test.ts`. Web dark mode requires `darkMode: 'class'` in `tailwind.config.js`.

### 2. Never use `space-y-*` or `space-x-*`. Use `gap-*` on the flex container.

NativeWind v4 cannot compile `space-*` utilities on native (they need CSS child selectors). They are **silently dropped — zero spacing renders on iOS/Android** even when the web build looks fine. This shipped a broken Goals screen.

```tsx
// BAD — renders with NO spacing on native
<View className="space-y-2">{items}</View>
<View className="flex-row space-x-2">{buttons}</View>

// GOOD
<View className="gap-3">{items}</View>
<View className="flex-row gap-3">{buttons}</View>
```

Spacing language: `gap-3` (12px) is the baseline for grouped content and the minimum for button rows; `gap-4` for side-by-side primary actions; `gap-6` between sections. Guard test: `__tests__/no-space-utilities.test.ts`.

### 3. UI → hooks → services. Never skip a layer. Never loop back.

```tsx
// BAD — screen calling service directly
function JournalScreen() {
  const data = await fetch('/api/journal');
}

// GOOD — screen calls hook, hook calls service
function JournalScreen() {
  const { entries } = useJournalEntries();
}
```

- UI components do not import from `services/`.
- Services do not import from `components/` or `hooks/`.
- `utils/` is pure — no I/O, no hooks, no side effects.
- No circular dependencies across layers.

### 4. AsyncStorage writes: serialize read-modify-write, never bare-`JSON.parse` reads.

AsyncStorage has no transactions. Two interleaved load→save cycles silently drop one side's data — this lost memory atoms in production code.

```ts
// BAD — concurrent callers overwrite each other
const map = JSON.parse(await AsyncStorage.getItem(KEY) ?? '{}');
map[id] = item;
await AsyncStorage.setItem(KEY, JSON.stringify(map));

// GOOD — every read-modify-write goes through the service's lock,
// and parsing tolerates corruption (see services/memory/localMemory.ts)
await withLock(async () => {
  const map = await loadSafely();   // try/catch JSON.parse -> safe default
  map[id] = item;
  await save(map);
});
```

Rules, falsifiable per service file:
- One module owns each storage key; nothing else touches that key (keys table below).
- All mutations of a key are funneled through one serialized queue in that module.
- Every `JSON.parse` of a storage payload is inside try/catch with a safe default.
- New persisted shapes get a `schemaVersion` envelope and a migration path. Never change a stored shape without one.

### 5. Two chat surfaces share one engine. Don't fork a third.

`app/chat.tsx` (journal, `+` FAB) and `app/intentions/chat.tsx` (morning/evening/intention check-ins) both run on `useChatOrchestration` + `InlineTypingInput` + the `FooterActions` design ("Go deeper" / "Finish entry"). They differ only in flows/prompts and save target (`@journal_entries` vs `@intention_checkins`). When touching chat UI: change the shared component, not one surface. New conversational features reuse this stack — do not hand-roll a chat screen.

Prompt weave lives in **one place**: `features/chat/flows` (`composeSystemPrompt` / `composeHistoryContextBlocks`). Do not reassemble clock + memory + digests + tools policy per screen.

### 6. Design/UI files are 200–500 lines, hard max 500.

Applies to `app/`, `components/`, `global.css`, `constants/theme.ts`, theme/style helpers. At 450 lines, split. Enforced by `npm run check:design`.

### 7. Tests are part of the diff.

Every change updates or adds tests. If a test isn't feasible, document why in `PROGRESS.md` and create a follow-up task — never silently skip.

### 8. Use the shared navigation primitives.

`AppHeader` (`components/navigation`) for Today + History headers, `useHeaderActions`, `useTabNavigation`. Prefer `router.navigate` over `router.push` for tab switches. Don't reinvent navigation per screen.

### 9. AI context is layered; long-term recall is Hindsight-backed.

| Layer | What | Where |
|---|---|---|
| Clock | Local date/time in system prompt | `utils/date.ts` → `buildClockContext` via `composeHistoryContextBlocks` |
| Day digests | Extractive calendar rollups | `@blackrose_day_digests` / `dayDigestStorage.ts` |
| Memory capsule | Ranked atoms (with dates on lines) | `localMemory.ts` → `buildLocalMemoryContext` |
| Full transcripts | On demand only | Tools: `get_conversation` reads journal/check-in storage |
| Session compact | Older turns → rolling summary when ctx fills | `conversationCompact.ts` inside `streamChat` / `completeChat` |
| Long-term recollections | Hindsight container (local-first) | `services/memory/hindsight/` — retain on finish, recall block + `recall_memory` tool |

Long-term memory is **Hindsight** (vectorize-io, local Docker): every completed journal entry / check-in fires a fire-and-forget retain (`retainJournalEntryToHindsight` / `retainCheckInToHindsight`); recall surfaces as the always-on `## Relevant long-term context` block (via `useHindsightRecallContext` → `ChatFlowContext.retrievedHistoryContext`) and on-demand via the `recall_memory` agent tool. Everything is **soft-fail**: Hindsight down → chat, finish path, and navigation are unaffected. Gemini (`gemini-embedding-001`, 768-dim) is **embeddings-only — never an LLM**; all LLM work goes to OpenRouter (`dots-studio/dots-3-note-preview:free` default). The abandoned custom cloud-memory platform (`LOCAL → MIRROR → SHADOW → CLOUD`) was removed 2026-08-18 — never resurrect it or its storage keys (`@rosebud_cloud_memory_mirror_outbox`, `@rosebud_memory_dataset_binding`).

Guard: `__tests__/backend-local-only.test.ts` (cloud-memory removal boundary + credential isolation).

### 10. System prompts: long freeform vs short guided — don't mix them up.

| Surface | Prompt | File |
|---|---|---|
| Freeform / continue journal | Full curiosity companion (~5k–8k words) | `constants/rosebudCompanionPrompt.ts` → `THERAPIST_SYSTEM_PROMPT` in `constants/aiPrompts.ts` |
| Morning / evening / intention / daily check-in | Shorter guided companion | `GUIDED_COMPANION_SYSTEM_PROMPT` in `constants/aiPrompts.ts` |

- Regenerate long prompt: `node scripts/generate-rosebud-prompt.mjs` (target **5000–8000 words**; test gate in `__tests__/constants/rosebudCompanionPrompt.test.ts`).
- Do **not** paste the 8k-word prompt into intention/daily paths — free models will blow context.
- Tool doctrine for freeform also lives in `HISTORY_TOOLS_POLICY` (`services/ai/tools/definitions.ts`) — keep prompt + policy aligned when editing tools.

### 11. On-device tools are MCP-like and proactive — not "only when asked."

Registry: `services/ai/tools/*`. Agent loop: `services/ai/agentLoop.ts`. Wired from `services/ai/ai.ts` (`streamChat`).

| Tool | Use |
|---|---|
| `get_clock` | Liberally — rants, first turns, night/day energy. Never invent time. |
| `list_recent_days` | Orient early; multi-day themes |
| `get_day` | `yesterday` / weekday / `YYYY-MM-DD` digests |
| `get_conversation` | Full transcript when digests aren't enough |
| `search_history` | Topic search across digests + atoms |
| `get_identity` | Re-read always-on identity profile (usually already injected) |
| `update_identity` | Optional pin of durable identity; secondary to automatic extraction |

- Soft-fail if the provider rejects tools → fall back to streaming + clock/digests/eager prefetch (`historyPrefetch.ts`).
- Proactive enablement: history intent, long rants, tired/work/today cues, first real turns — **not** every `"hi"` (latency). See `shouldEnableHistoryTools` in `ai.ts`.
- Clear history must also `clearDayDigests()` **and** `clearIdentityProfile()` (`useClearJournalHistory`).
- **Identity core memory** is separate from ranked atoms: `@rosebud_identity_profile` via `identityProfile.ts` / turn-level `identityExtraction.ts`. Always inject `## Identity` early in `composeHistoryContextBlocks` — never rely on the 6-atom capsule for preferred name.

---

## Storage keys (one owner each)

| Key | Owning module |
|---|---|
| `@journal_entries` | `services/journal/journalStorage.ts` |
| `@intentions`, `@intention_checkins` | `services/intentions/intentionsStorage.ts` |
| `@goals` | `services/goals/goalsStorage.ts` |
| `@rosebud_local_memory` (v2 envelope, pruned at 400 atoms) | `services/memory/localMemory.ts` |
| `@rosebud_identity_profile` (always-on name/pronouns/people/facts) | `services/memory/identityProfile.ts` |
| `@blackrose_day_digests` (calendar-day rollups for AI history tools) | `services/memory/dayDigestStorage.ts` |
| `@rosebud_session_digest_index` + `@rosebud_session_digest:<id>` (sharded session digests + embeddings; index has no vectors) | `services/memory/sessionDigestStorage.ts` |
| `@rosebud_memory_rollup_index` + `@rosebud_memory_rollup:<kind>:<periodKey>` (week/month/year rollups + embeddings) | `services/memory/memoryRollupStorage.ts` |
| `@rosebud_memory_rollup_attempts` (last LLM attempt per period — offline backoff) | `services/memory/memoryRollupBuild.ts` |
| `@blackrose_local_backup_session_digest:<backupId>:<sessionId>` (backup bodies only; meta in `@blackrose_local_backups`) | `services/backup/localBackup.ts` |
| `@blackrose_custom_ai_provider` (OpenRouter/custom provider, freeOnly, recentModelIds, selected model) | `services/ai/customModels.ts` |
| `@blackrose_generation_settings` | `services/ai/generationSettings.ts` |
| `@blackrose_model_context_cache` | `services/ai/modelContext.ts` |
| chat autosave sessions | `services/ai/sessionStorage.ts` |

View-model types must not reuse a stored type's name (e.g. `MemoryGraphAtom` is the graph display model — ISO dates, 1–10 salience — never write it back to storage).

**Write-path coupling:** journal finish → `saveJournalEntryMemories` **and** `upsertJournalDayDigest` **and** `buildAndSaveSessionDigest` **and** fire-and-forget `retainJournalEntryToHindsight` (`journalFinishSideEffects.ts`). Check-in complete → `saveIntentionCheckInMemories` **and** `upsertCheckInDayDigest` **and** `buildAndSaveSessionDigest` **and** fire-and-forget `retainCheckInToHindsight` (`intentionsStorage.ts` completed branch). Local backup includes day digests + packed session-digest bundle (`services/backup/localBackup.ts`). Clear history must also `clearSessionDigests()` and `clearMemoryRollups()`.

**Session digest sharding:** never store all embeddings under one AsyncStorage key (Android ~2MB/key). One record key per digest + lightweight index. Aggregate Android DB size: `AsyncStorage_db_size_in_MB` in `android/gradle.properties`.

---

## Directory intent

- `app/` — routes and screens. No business logic.
- `components/` — reusable composite UI. `components/ui/` is atomic primitives only.
- `hooks/<feature>/` and `services/<feature>/` — feature-scoped state and I/O. New code imports from the feature path, not from root (root-level files may exist as legacy re-exports only).
- `features/chat/` — shared chat engine (`useChatOrchestration`, flows, session flush/resume).
- `constants/aiPrompts.ts`, `constants/rosebudCompanionPrompt.ts` — companion system prompts.
- `services/ai/` — transport, tools, agent loop, compact, streaming (phone → provider).
- `services/memory/` — localMemory atoms + day digests + graph helpers; `services/memory/hindsight/` is the Hindsight client (retain/recall/reflect, soft-fail).
- `backend/` — Node AI proxy (optional local agent). AI provider config lives in `backend/src/config/ai/`. **`NANO_GPT_*` env names are legacy.** Production chat remains **device-direct** (`directTransport.ts`); the backend is not part of the chat path.
- `example-design/` — HTML/CSS reference prototypes. Not deployed. Copy patterns out; never modify.
- `assets/` — embedded HTML engines, fonts, images. `notes/` — dev docs. `supabase/` — migrations + email templates. `scripts/` — build/CI tooling (includes `generate-rosebud-prompt.mjs`).

### Prototype Files Validation Strategy

`example-design/` is the single source of truth for visual reference. Production code never imports from it. When porting a pattern:

1. Read the prototype in `example-design/`, identify the design tokens (colors, spacing, typography) used.
2. If a token is missing in `tailwind.config.js` or `constants/theme.ts`, add it there first — never inline a raw hex / `space-y-*` / hardcoded pixel value in `app/` or `components/`.
3. Port the markup into React Native + NativeWind. Do not copy the HTML/CSS literally; map Tailwind classes 1:1 and confirm the dark-variant side.
4. For high-frequency rendering layers (e.g. `assets/memory-graph/engine.html`), the runtime engine lives under `assets/`, **not** in `example-design/`. The prototype in `example-design/` is a design reference only.
5. If you change a prototype, you do not change production code in the same diff. The port is a separate, reviewable change.

Validation: a change is not "done" until the produced screen has been light/dark mode QA'd and the `npm run check:design`, `npx tsc --noEmit`, `npm run lint`, and `npm test` gates are all green.

## What NOT to touch

- Lockfiles (`package-lock.json`, etc.).
- `supabase/migrations/` — new migration file only; never edit an applied one.
- `node_modules/`, `dist/`, `.expo/`, build outputs; anything `// DO NOT EDIT` or `@generated` (regenerate from source instead).
- `example-design/`.

## Concrete commands

```bash
npm test                                                # all
npm test -- --testPathPattern="ChatScreen"              # one file
npm test -- --testPathPattern="EmotionalLandscape|KeyThemes"  # OR pattern
npm test -- --watch / --verbose

# Unit: history / prompt / tools / compact
npx jest --runInBand __tests__/utils/date.test.ts __tests__/services/dayDigestStorage.test.ts __tests__/services/ai/historyTools.test.ts __tests__/services/ai/agentLoop.test.ts __tests__/services/ai/conversationCompact.test.ts __tests__/constants/rosebudCompanionPrompt.test.ts __tests__/features/chatFlows.test.ts

# Live AI (real OpenRouter key in gitignored .env) — PowerShell:
#   $env:RUN_INTEGRATION_TESTS='1'
#   npx jest --runInBand __tests__/integration/rosebudHistoryLive.test.ts --forceExit
# Also: __tests__/integration/nanoGptRealKey.test.ts
RUN_INTEGRATION_TESTS=1 npx jest --runInBand --testPathPattern="integration" --forceExit

# Regenerate long companion prompt (keep 5k–8k words)
node scripts/generate-rosebud-prompt.mjs

npx tsc --noEmit
npm run lint
npm run check:design
cd backend && npx tsc --noEmit
cd backend && npm test
```

### Client AI env (primary path — phone → provider)

Project root `.env` (gitignored):
```
EXPO_PUBLIC_NANO_GPT_API_KEY=...          # OpenRouter or OpenAI-compat key
EXPO_PUBLIC_NANO_GPT_API_BASE_URL=https://openrouter.ai/api/v1
EXPO_PUBLIC_NANO_GPT_MODEL=dots-studio/dots-3-note-preview:free
EXPO_PUBLIC_NANO_GPT_FLASH_MODEL=dots-studio/dots-3-note-preview:free
```
Names are legacy (`NANO_GPT_*`); OpenRouter free is the recommended default. Prefer free models with **≥32k** context when using the long freeform prompt.

### Backend (optional local agent) — `backend/.env`

```
PORT=8787
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081
NANO_GPT_API_KEY=...
NANO_GPT_API_BASE_URL=https://nano-gpt.com/api/v1
NANO_GPT_MODEL=moonshotai/kimi-k2.5:thinking
NANO_GPT_FLASH_MODEL=moonshotai/kimi-k2.5
```
Start: `cd backend && npm install && npm run dev`, set `EXPO_PUBLIC_AGENT_BASE_URL`, restart Expo. **Not required** for day digests / tools / freeform history — those are client-side.

---

## Repo-specific gotchas

- **Data provider toggle:** `EXPO_PUBLIC_DATA_PROVIDER` switches legacy app-data sync between Supabase and local. It does not affect AI memory (Hindsight is separate). Local mode must never reach the network.
- **WebView layers:** high-frequency rendering (`react-native-webview`) runs raw JS modules inside the WebView, not the RN bridge; state crosses via synchronized data bridges. Theme/color scheme must be pushed explicitly (`SET_THEME` for memory graph) — the WebView does not inherit NativeWind `dark:`.
- **Web dark mode hook:** `hooks/theme/use-color-scheme.web.ts` must use NativeWind's `useColorScheme` (responds to `setColorScheme()`), not RN's.
- **Memory change events:** mutations in `services/memory/localMemory.ts` notify `subscribeMemoryChanges` listeners; access bookkeeping (`markAccessed`) deliberately does not (would loop). Keep that invariant. Day-digest UI refresh piggybacks on the same subscription via `useRecentDaysContext`.
- **Context window resolve:** `streamChat` resolves context **locally** (custom settings / known model map) — do not hang on network model-list fetch for compact budgeting.
- **Jest + AsyncStorage:** live/integration tests that call `directTransport` must `setCustomModelStorageAdapter(...)` so Jest does not dynamic-import AsyncStorage (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`).
- **NativeWind:** no `space-y-*` / `space-x-*` (rule 2). Every `<Text>` needs `dark:` (rule 1).
- **Test layout:** >10 tests in a folder → split into `__tests__/{components,hooks,services,screens}/`. `<Subject>.test.ts(x)` matching source. Cap test files at 300 lines. Shared mocks in `__tests__/mocks/` or `__mocks__/`. Prefer user-centric assertions over snapshots.
- **No `any`:** if a type is genuinely unknown, use `unknown` and narrow it.

## AI chat architecture (mental model)

```
Screen (app/chat | intentions/chat)
  → useChatOrchestration + ChatFlow
  → composeSystemPrompt(base, { clock, digests, memory, goals, persona, tools policy })
  → streamChat
       → compactConversationIfNeeded (if near ctx limit)
       → optional agentLoop + tools (proactive)
       → soft-fail → normal SSE/XHR stream
```

Key files:

| Concern | Path |
|---|---|
| Freeform prompt | `constants/rosebudCompanionPrompt.ts` |
| Prompt exports | `constants/aiPrompts.ts` |
| Flow weave | `features/chat/flows/index.ts` |
| Tools | `services/ai/tools/*` |
| Agent loop | `services/ai/agentLoop.ts` |
| Compact | `services/ai/conversationCompact.ts` |
| Prefetch | `services/ai/historyPrefetch.ts` |
| Digests | `services/memory/dayDigestStorage.ts` |
| Capsule | `services/memory/localMemory.ts` |
| Live test | `__tests__/integration/rosebudHistoryLive.test.ts` |
| Design notes | `memory.md` |

## Workflow

1. Read `PLAN.md` / the active plan folder, confirm scope.
2. Implement with strict layering and modular structure.
3. Add or update tests for the change.
4. Run `npm test` (relevant pattern), `npx tsc --noEmit`, `npm run lint`, `npm run check:design`. Fix all failures.
5. Update `PROGRESS.md` with outcomes and follow-ups.
6. If AI chat / memory / tools / prompts changed:
   - Unit-test the layer you touched (date, digests, tools, compact, chatFlows, prompt word-count).
   - Prefer a live smoke when credentials exist: `RUN_INTEGRATION_TESTS=1` + `rosebudHistoryLive.test.ts`.
   - Backend is optional; device-direct path is the source of truth.
7. **E2E-required gate (learned the hard way):** Jest green is **not** sufficient for LLM extraction/identity/recall work. Unit tests can all pass while the live flash model rejects `response_format: json_object` and every extract soft-fails with no write. Any phase that touches structured extraction, identity write path, session digests, or memory **recall** must be verified with a real Playwright run against the running app before calling it done. Paste verbatim assistant replies, not summaries.
8. **Memory/recall E2E must run against cleared demo data.** First-launch seed (and residual seed rows) pollute digests/capsule/History and invalidate recall assertions — proven by Test B blending “Sunday reset” / “argument that kept looping” with real entries. Clear demo (or use empty storage) before recall probes.

## Done = all of these

- [ ] Design/UI files ≤ 500 lines (`npm run check:design` clean).
- [ ] Tests added or updated, all green.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run check:design` clean.
- [ ] `PROGRESS.md` updated.
- [ ] Nothing in "What NOT to touch" was modified.
- [ ] If AI history/tools/prompts changed: storage-key ownership respected; digests write on finish; clear-history clears digests; freeform vs guided prompt not swapped.

## Living changelog of pain

This file grows from real incidents only. When an agent does something wrong, add the one line that stops it recurring; when a rule stops preventing real bugs, delete it. Prefer replacing a rule with a guard test or CI check — the best rule is an automated one.

- Shipped broken Goals spacing → ban `space-*` (rule 2).
- Dark mode invisible text → every `Text` needs `dark:` (rule 1).
- Light mode stuck-black chrome (BottomNav, Open the map, memory graph canvas) → both schemes on surfaces + WebView `SET_THEME` (rule 1).
- Lost memory atoms → AsyncStorage lock + safe parse (rule 4).
- AI amnesia on "what did I talk about yesterday?" → day digests + clock + on-device tools + proactive policy (rules 9–11); do not only bulk-inject full journals every turn.
- Cross-session name amnesia → always-on `@rosebud_identity_profile` + turn/finish extraction (not capsule ranking / finish-only atoms); `update_identity` is secondary.
- Free-model context blowups → auto-compact + shorter guided prompt (rules 9–10).
- Jest live tests failing on dynamic AsyncStorage import → set custom storage adapter in integration tests.
- Flash model rejects `response_format: json_object` (hy3 400) → silent identity/atom/digest no-write. All structured flash extracts MUST use `fetchDirectJsonCompletion` (`services/ai/jsonCompletion.ts`) which freeform-retries on **400/422 format rejection only** (not 401/429/network); never wire `response_format` only at call sites. Host-level `supportsResponseFormat` is wrong granularity — models on the same host differ. Do not "fix" by swapping the flash model alone.
- Sabotage required for real behavior fixes: deliberate break → confirm red → restore → confirm green; paste real output. Never mock the unit under test.
- Test B day-slip: injected dates are **write day**; event weekdays live only in user prose. Clock doctrine + "Written YYYY-MM-DD" labels required; do not invent structured event-date extraction without a plan.
- Demo seed is **dev-only** (`__DEV__`); production first launch stays empty. Memory/recall E2E must clear seed before probes.
