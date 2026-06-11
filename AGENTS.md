# AGENTS.md

You are a brilliant, fast, literal-minded contractor with amnesia between tasks. You follow exactly what is written here, nothing more. This file is a **behavioral correction layer for this repo's specific failure modes** — not general best practices. If a rule isn't here, don't infer it from vibes.

Every rule below prevents a real bug. Don't add aspirational rules. Don't restate what the model already knows.

---

## Most-violated rules (read first)

### 1. Every color is a token. Every `<Text>` has a `dark:` variant.

Bare `<Text className="text-gray-900">` is **invisible in dark mode** because RN text does not inherit color from parent Views. This is the #1 recurring bug in this repo.

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
- `tailwind.config.js` — NativeWind classes (`text-gray-900`, `bg-surface`, etc.). Add new tokens here first. NativeWind silently drops undefined tokens — no error, just invisible UI.
- `constants/theme.ts` — JS runtime values for non-NativeWind code.

Guard tests catch this and must not be skipped: `__tests__/tailwind-config.test.ts` (23 color tokens) and `__tests__/dark-mode-contrast.test.ts` (hardcoded icon colors). Web dark mode requires `darkMode: 'class'` in `tailwind.config.js` for `setColorScheme()` to work.

### 2. UI → hooks → services. Never skip a layer. Never loop back.

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
- Hooks may call services and expose simple state + actions to UI.
- `utils/` is pure — no I/O, no hooks, no side effects.
- No circular dependencies across layers.

### 3. Design/UI files are 200–500 lines, hard max 500.

Applies to: `app/`, `components/`, `components/ui/`, `global.css`, `constants/theme.ts`, and any theme/style helpers. At 450 lines, split — extract subcomponents, hooks, styles, or helpers. Enforced by `npm run check:design`.

### 4. Tests are part of the diff.

Every change updates or adds tests. If a test isn't feasible, document the reason in `PROGRESS.md` and create a follow-up task — never silently skip.

### 5. Use the shared navigation primitives.

- `AppHeader` in `components/navigation` for Today + History headers.
- `useHeaderActions` for Settings/Rewards buttons.
- `useTabNavigation` for tab switching.
- Prefer `router.navigate` over `router.push` for tab switches.

Don't reinvent navigation per screen.

---

## Directory intent

Don't memorize file lists. These are boundaries and purpose:

- `app/` — routes and screens. No business logic.
- `components/` — reusable composite UI. `components/ui/` is atomic primitives only.
- `hooks/<feature>/` and `services/<feature>/` — feature-scoped state and I/O. New code imports from the feature path, not from root.
- `backend/` — Node.js AI agent and routes. AI provider/profile config lives in `backend/src/config/ai/`. **The `NANO_GPT_*` env var names are legacy** — current default model is `moonshotai/kimi-k2.5:thinking`.
- `example-design/` — HTML/CSS reference prototypes. Not deployed. Production ports extract runtime engine specs into `assets/` modules, not into the prototype folder.
- `assets/` — embedded HTML engines, fonts, images.
- `notes/` — developer docs (Supabase setup, local storage).
- `supabase/` — migrations and email templates.
- `scripts/` — build/CI tooling (e.g. `check-design-limits.js`).

Legacy root-level files in `hooks/` and `services/` may exist as re-exports only. New code imports from the feature path.

---

## What NOT to touch

- `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` — lockfiles.
- `supabase/migrations/` — schema changes need a review and a **new** migration file. Never edit an applied migration.
- `node_modules/`, `dist/`, `.expo/`, `.next/`, build outputs.
- Anything marked `// DO NOT EDIT`, `// @generated`, or produced by a script.
- `example-design/` — copy patterns out, don't modify the reference.

If a generated file looks wrong, regenerate it from its source. Don't hand-edit.

---

## Concrete commands

Copy-paste these. Don't guess.

### Tests

```bash
npm test                                                # all
npm test -- --testPathPattern="ChatScreen"              # one file
npm test -- --testPathPattern="EmotionalLandscape|KeyThemes"  # OR pattern
npm test -- --testPathPattern="services"                # one folder
npm test -- --watch                                     # watch mode
npm test -- --verbose                                   # verbose output
RUN_INTEGRATION_TESTS=1 npm test -- --testPathPattern="integration"  # Supabase + agent smoke
```

### Type-check, lint, design-limits

```bash
npx tsc --noEmit              # TS check
npm run lint                  # lint
npm run check:design          # design/UI file size enforcement
cd backend && npx tsc --noEmit
cd backend && npm test
```

### Backend (local AI agent)

`backend/.env`:
```
PORT=8787
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081
NANO_GPT_API_KEY=...
NANO_GPT_API_BASE_URL=https://nano-gpt.com/api/v1
NANO_GPT_MODEL=moonshotai/kimi-k2.5:thinking
NANO_GPT_FLASH_MODEL=moonshotai/kimi-k2.5
```

Start: `cd backend && npm install && npm run dev`. Set `EXPO_PUBLIC_AGENT_BASE_URL` (or `AGENT_BASE_URL`) in the app env, then restart Expo.

---

## Repo-specific gotchas

- **Data provider toggle:** `EXPO_PUBLIC_DATA_PROVIDER` switches between Supabase and local. Local mode **must** intercept all storage calls locally — never reach the network.
- **React Native WebView:** High-frequency rendering layers run encapsulated raw JS modules inside the WebView, not in the RN bridge. State transfers go through synchronized data bridges.
- **Web dark mode hook:** `hooks/theme/use-color-scheme.web.ts` uses NativeWind's `useColorScheme`, not React Native's. RN's hook only reads media queries; NativeWind's responds to `setColorScheme()`.
- **Test layout:** Once a folder has >10 tests, split into `__tests__/{components,hooks,services,screens}/`. Naming: `<Subject>.test.ts(x)` matching the source file. Cap test files at 300 lines. Shared mocks go in `__tests__/mocks/` or `__mocks__/`.
- **Snapshots:** Keep small and intentional. Prefer user-centric assertions (visible text, a11y labels) over implementation details.
- **No `any`:** If a type is genuinely unknown, use `unknown` and narrow it.

---

## Workflow

1. Read `PLAN.md` / `TASKS/`, confirm scope.
2. Implement with strict SoC and modular structure.
3. Add or update tests for the change.
4. Run `npm test` (relevant pattern), `npx tsc --noEmit`, `npm run lint`, `npm run check:design`. Fix all failures.
5. Update `PROGRESS.md` with outcomes and follow-ups.
6. If AI chat features changed, confirm backend is running and `EXPO_PUBLIC_AGENT_BASE_URL` is set.

---

## Done = all of these

- [ ] Design/UI files ≤ 500 lines (`npm run check:design` clean).
- [ ] Tests added or updated, all green.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run check:design` clean.
- [ ] `PROGRESS.md` updated.
- [ ] Nothing in the "What NOT to touch" list was modified.

---

## Living changelog of pain

This file grows from real incidents, not from imagined failure modes. When an agent does something wrong, add the one line that stops it recurring. If a rule is no longer preventing real bugs, delete it.
