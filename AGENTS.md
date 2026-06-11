# AGENTS.md

You are a brilliant, fast, literal-minded contractor with amnesia between tasks. You follow exactly what is written here, nothing more. This file is a **behavioral correction layer for this repo's specific failure modes** — not general best practices. If a rule isn't here, don't infer it from vibes.

Every rule below prevents a real bug that already happened. Rules are ordered by how often they get violated.

---

## Most-violated rules (read first)

### 1. Every color is a token. Every `<Text>` has a `dark:` variant.

Bare `<Text className="text-gray-900">` is **invisible in dark mode** because RN text does not inherit color from parent Views. #1 recurring bug in this repo.

```tsx
// BAD
<Text className="text-gray-900">Hello</Text>
<Icon color="#111827" />

// GOOD
<Text className="text-gray-900 dark:text-gray-100">Hello</Text>
const { colorScheme } = useColorScheme();
const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';
```

Two color systems coexist — pick the right one per file:
- `tailwind.config.js` — NativeWind classes. Add new tokens here first. NativeWind silently drops undefined tokens — no error, just invisible UI.
- `constants/theme.ts` — JS runtime values for non-NativeWind code.

Guard tests: `__tests__/tailwind-config.test.ts`, `__tests__/dark-mode-contrast.test.ts`. Web dark mode requires `darkMode: 'class'` in `tailwind.config.js`.

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

### 6. Design/UI files are 200–500 lines, hard max 500.

Applies to `app/`, `components/`, `global.css`, `constants/theme.ts`, theme/style helpers. At 450 lines, split. Enforced by `npm run check:design`.

### 7. Tests are part of the diff.

Every change updates or adds tests. If a test isn't feasible, document why in `PROGRESS.md` and create a follow-up task — never silently skip.

### 8. Use the shared navigation primitives.

`AppHeader` (`components/navigation`) for Today + History headers, `useHeaderActions`, `useTabNavigation`. Prefer `router.navigate` over `router.push` for tab switches. Don't reinvent navigation per screen.

---

## Storage keys (one owner each)

| Key | Owning module |
|---|---|
| `@journal_entries` | `services/journal/journalStorage.ts` |
| `@intentions`, `@intention_checkins` | `services/intentions/intentionsStorage.ts` |
| `@goals` | `services/goals/goalsStorage.ts` |
| `@rosebud_local_memory` (v2 envelope, pruned at 400 atoms) | `services/memory/localMemory.ts` |
| chat autosave sessions | `services/ai/sessionStorage.ts` |

View-model types must not reuse a stored type's name (e.g. `MemoryGraphAtom` is the graph display model — ISO dates, 1–10 salience — never write it back to storage).

---

## Directory intent

- `app/` — routes and screens. No business logic.
- `components/` — reusable composite UI. `components/ui/` is atomic primitives only.
- `hooks/<feature>/` and `services/<feature>/` — feature-scoped state and I/O. New code imports from the feature path, not from root (root-level files may exist as legacy re-exports only).
- `backend/` — Node.js AI agent. AI provider config in `backend/src/config/ai/`. **`NANO_GPT_*` env names are legacy** — current default model is `moonshotai/kimi-k2.5:thinking`.
- `example-design/` — HTML/CSS reference prototypes. Not deployed. Copy patterns out; never modify.
- `assets/` — embedded HTML engines, fonts, images. `notes/` — dev docs. `supabase/` — migrations + email templates. `scripts/` — build/CI tooling.

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
RUN_INTEGRATION_TESTS=1 npm test -- --testPathPattern="integration"

npx tsc --noEmit
npm run lint
npm run check:design
cd backend && npx tsc --noEmit
cd backend && npm test
```

Backend (local AI agent) — `backend/.env`:
```
PORT=8787
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081
NANO_GPT_API_KEY=...
NANO_GPT_API_BASE_URL=https://nano-gpt.com/api/v1
NANO_GPT_MODEL=moonshotai/kimi-k2.5:thinking
NANO_GPT_FLASH_MODEL=moonshotai/kimi-k2.5
```
Start: `cd backend && npm install && npm run dev`, set `EXPO_PUBLIC_AGENT_BASE_URL`, restart Expo.

---

## Repo-specific gotchas

- **Data provider toggle:** `EXPO_PUBLIC_DATA_PROVIDER` switches Supabase vs local. Local mode must never reach the network.
- **WebView layers:** high-frequency rendering (`react-native-webview`) runs raw JS modules inside the WebView, not the RN bridge; state crosses via synchronized data bridges.
- **Web dark mode hook:** `hooks/theme/use-color-scheme.web.ts` must use NativeWind's `useColorScheme` (responds to `setColorScheme()`), not RN's.
- **Memory change events:** mutations in `services/memory/localMemory.ts` notify `subscribeMemoryChanges` listeners; access bookkeeping (`markAccessed`) deliberately does not (would loop). Keep that invariant.
- **Test layout:** >10 tests in a folder → split into `__tests__/{components,hooks,services,screens}/`. `<Subject>.test.ts(x)` matching source. Cap test files at 300 lines. Shared mocks in `__tests__/mocks/` or `__mocks__/`. Prefer user-centric assertions over snapshots.
- **No `any`:** if a type is genuinely unknown, use `unknown` and narrow it.

## Workflow

1. Read `PLAN.md` / the active plan folder, confirm scope.
2. Implement with strict layering and modular structure.
3. Add or update tests for the change.
4. Run `npm test` (relevant pattern), `npx tsc --noEmit`, `npm run lint`, `npm run check:design`. Fix all failures.
5. Update `PROGRESS.md` with outcomes and follow-ups.
6. If AI chat features changed, confirm backend is running and `EXPO_PUBLIC_AGENT_BASE_URL` is set.

## Done = all of these

- [ ] Design/UI files ≤ 500 lines (`npm run check:design` clean).
- [ ] Tests added or updated, all green.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run check:design` clean.
- [ ] `PROGRESS.md` updated.
- [ ] Nothing in "What NOT to touch" was modified.

## Living changelog of pain

This file grows from real incidents only. When an agent does something wrong, add the one line that stops it recurring; when a rule stops preventing real bugs, delete it. Prefer replacing a rule with a guard test or CI check — the best rule is an automated one.
