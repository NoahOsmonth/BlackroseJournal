# BlackroseJournal — Master Implementation Plan

> **Status:** Ready to code. Do not execute until approved.
> **Authored:** 2026-06-10 from a deep 8-agent codebase exploration + first-hand source verification.
> **Scope:** Fix the lost-chat-session bug, make persona selection actually work, add AI persona generation, make morning/evening/intention flows feel like *guided AI conversations*, add real AI tuning (temperature / top_p / context-length auto-detect surfaced in UI), eliminate layout overlap / edge-hugging, kill AI-slop UI, surface hidden power-features, and tighten the whole UX.

---

## 0. How to read this plan

This folder contains a master plan (this file) and **eight workstream files**. Each workstream file is self-contained and code-ready: it lists exact files, exact edits with before/after intent, new files with their full responsibility, tests to add, and acceptance criteria.

| File | Workstream | Theme | Depends on |
|------|-----------|-------|-----------|
| `01-layout-foundation.md` | WS0 | Safe-area, spacing tokens, `ScreenContainer`, nav-aware padding, chat footer overlap | — |
| `02-chat-session-persistence.md` | WS1 | **The lost-session bug** — session store, autosave, resume, drafts split | — |
| `03-chatflow-abstraction.md` | WS2 | `ChatFlow` keystone refactor — one engine, many flows | WS1 |
| `04-persona-selection-and-generation.md` | WS3 + WS6 | Persona applies to main chat; **generate persona with AI** | WS2 |
| `05-ai-tuning.md` | WS4 | temperature/top_p store + UI, imagination→temp, context auto-detect in header | WS2 |
| `06-guided-flows.md` | WS5 | Time-aware prompts, staged intention-setting, conversational refine | WS2, WS3, WS4 |
| `07-surface-features-and-ia.md` | WS7 | Ask Rosebud + Memory Graph + Memory/"About Me" screen, nav cleanup | WS0 |
| `08-ai-slop-design-system.md` | WS8 | Branding/version, kill "coming soon", empty states, icon-color tokens, theme `BottomNav` | WS0 |

**Build order:** `WS0 → WS1` first (foundation + the bug the user is angriest about), then `WS2`, then `WS3 / WS4 / WS7 / WS8` in parallel, then `WS5 / WS6` last (they consume the others).

---

## 1. What this app is (verified ground truth)

BlackroseJournal is an **Expo SDK 54 / React Native 0.81 / expo-router** AI journaling app (Rosebud-style), styled with **NativeWind v4** (Tailwind tokens in `tailwind.config.js`) plus a JS theme in `constants/theme.ts`. AI runs through a **direct-to-NanoGPT** OpenAI-compatible transport (`services/ai/directTransport.ts`) with an optional **custom OpenAI-compatible provider** (`services/ai/customModels.ts`). There is also an optional local Express **backend** (`backend/`) that already supports generation params end-to-end.

Key architectural truths that shape this plan:

- **There is exactly one chat engine**: `features/chat/hooks/useChatOrchestration.ts` (the React-state layer) sitting on `services/ai/useChat.ts` (the in-memory message buffer) calling `services/ai/ai.ts#streamChat`. Both `app/chat.tsx` (main journal) and `app/intentions/chat.tsx` (morning/evening/intention) use it. **Fixing the engine fixes every conversational surface at once.**
- **The memory system is the crown jewel and almost entirely buried** (`services/memory/localMemory.ts`, `idea.md`). Completed entries become memory atoms; chat injects a bounded "Local Memory Capsule." Most of it is unreachable from the UI.
- **Several complete features are dark** (registered routes / built components with no entry point): Ask Rosebud (`app/ask-rosebud.tsx`), Memory Graph (`components/memory-graph/*`), the `/modal` template leftover.

### The unifying root cause
> Chat lives in ephemeral React state; persona / tuning / memory are injected in **one** flow but not the others; and powerful subsystems are built but never wired into navigation. The fix is **thread the existing systems through one canonical chat abstraction, and surface them in the information architecture** — far more wiring than net-new building.

---

## 2. The user's reported problems → where they map

| User complaint (verbatim intent) | Root cause (file:line) | Workstream |
|---|---|---|
| "press +, chat, go back, + again → **session is gone**" | Chat is ephemeral `useState`; only persistence is `handleClose()` (`app/chat.tsx:140`) wired to the Header X only. Back gesture / tab switch / FAB unmount → GC'd. `conversationId` regenerated per mount (`app/chat.tsx:62`). | **WS1** |
| "morning/night journal & setting intention should be **AI chat**, not manual typing" | They're *already* chat (`today.tsx:109-115` → `/intentions/chat`). But morning==evening prompt (`intentionPrompts.ts:13`), bare `[Start intention check-in]` trigger, no guided scaffold. The only true form (`IntentionForm.tsx`) is the **edit** path. | **WS5** |
| "**choosing person should work**" | Personas apply in intentions chat only. Main chat (`app/chat.tsx:75-78`) hardcodes `THERAPIST_SYSTEM_PROMPT`, never imports `usePersonas`. | **WS3** |
| "**generate persona with AI**" | No `generatePersonaWithAI` exists anywhere. | **WS6** |
| "ui is **hugging the edges / overlapping** other ui" | All 7 screens use `edges={['top']}` (no bottom safe area), static `paddingBottom:140` ≠ real nav height, chat footer inside ScrollView overlaps last message. | **WS0** |
| "AI should have **default temperature, top_p; context length auto-detect once model detected, shown on UI**" | `temperature:1.0, max_tokens:32768` hardcoded (`chatTypes.ts:71`); **no top_p anywhere**; imagination slider is dead weight; context detect exists for custom provider only, never surfaced in chat. | **WS4** |
| "find AI slop UI and improve, **best UI/UX**, more features that help the user" | `'Journal App v1.0.0'` placeholder, "coming soon" alerts, undefined `accent-green` token (invisible badge), hardcoded hex everywhere, dead `DailyJournalingCard`, two clashing theme systems. Buried Ask Rosebud / Memory Graph / Memory inspector. | **WS7 + WS8** |
| "run on `npm run dev`, **screenshot and view the images**, make sure it's good" | QA protocol (§6 below). | All |

---

## 3. Cross-cutting design principles (apply in every workstream)

These come straight from `AGENTS.md` and the dark-mode rules — they are **non-negotiable** because violations here are how invisible UI bugs (like `accent-green`) happen:

1. **Design/UI files: 200–500 lines, hard max 500.** If a screen approaches 450, extract subcomponents/hooks.
2. **Functions target 5–15 lines; components < 200 lines.** Separation of concerns: UI renders, hooks manage state, services do I/O.
3. **All colors come from `tailwind.config.js` tokens.** NativeWind *silently drops* undefined tokens (this is the `accent-green` bug). Add a token before using it.
4. **Every `<Text>` needs a `dark:` variant.** RN text does not inherit color.
5. **Never hardcode icon colors** — use `useColorScheme()` or the new `useIconColors()` hook (WS8).
6. **Tests are mandatory for every change.** Update or add. Guard tests (`tailwind-config.test.ts`, `dark-mode-contrast.test.ts`) must stay green.
7. **Two color systems coexist** (`constants/theme.ts` JS + `tailwind.config.js`). Note: the `theme` export in `constants/theme.ts:92-100` (cyan `#45f3ff`, dark `#0b0c10`) is **slop bleed from `new-plan.md`** and conflicts with the real palette (`Colors`, orange `#FF9F0A`). WS8 reconciles this.
8. **Update `PROGRESS.md`** after each workstream with what changed + follow-ups.

---

## 4. Target information architecture

**Current tabs:** `Today · Memory(explore) · Insights · History(entries) · Settings` (5, with a center FAB).

The bottom nav is already 5 slots + FAB. Rather than add tabs (budget is full), WS7 **surfaces hidden features through the existing IA**:

- **`explore` tab → real Memory hub** ("About Me"): editable profile, searchable/deletable atoms, link into the Memory Graph (`app/memory-graph.tsx`, new route wrapping the existing WebView). Today `explore` is a thin memory-graph screen described in the slop `new-plan.md`; it becomes the proper Memory home.
- **Ask Rosebud** surfaced as a prominent action on **Insights** (and a Today card), rebranded "Ask about your journal." Saved insights linked from there.
- **Insights become interactive**: tap a theme/emotion/character → filtered entries or the memory graph.
- **Delete `/modal`** (orphan template), wire `useNavBack()` fallback, standardize `navigate` (tab↔tab) vs `push` (tab→detail).

Full detail and the routing table are in `07-surface-features-and-ia.md`.

---

## 5. The keystone: the `ChatFlow` abstraction (WS2)

Everything conversational currently diverges across `app/chat.tsx` and `app/intentions/chat.tsx`, each re-deriving system prompts, opening messages, and persistence. WS2 introduces a single declarative descriptor consumed by `useChatOrchestration`:

```ts
// features/chat/flows/types.ts (new)
export interface ChatFlowContext {
  activePersona?: Persona | null;
  localMemoryContext?: string;
  feedbackGuidance?: string;
  area?: IntentionArea;
  intentionTitle?: string;
  checkInType?: 'morning' | 'evening' | 'intention';
  generation?: GenerationSettings;   // WS4
}

export interface ChatFlow {
  id: 'freeform' | 'dailyCheckIn' | 'morning' | 'evening' | 'intention' | 'intentionRefine';
  buildSystemPrompt(ctx: ChatFlowContext): string;   // persona + memory + feedback woven in ONE place
  openingMessage?(ctx: ChatFlowContext): string;      // warm contextual greeting, replaces bare trigger
  stages?: GuidedStage[];                             // optional multi-turn scaffold (intention setting)
  generationOverride?(ctx: ChatFlowContext): Partial<GenerationSettings>;
}
```

Why this matters: persona injection (WS3), generation params (WS4), session autosave (WS1), and guided scaffolding (WS5) are then implemented **once** and inherited by every surface. It also collapses the duplicated prompt-assembly in `app/chat.tsx:73-80` and `services/intentions/intentionPrompts.ts`.

---

## 6. Verification & screenshot-QA protocol (the user explicitly asked for this)

Every workstream's "Done" requires this loop. The app runs on web via `npm run dev` (`expo start --web`).

### 6.1 Automated gates (run after every workstream)
```bash
npm run test:run          # Jest — all green; every change ships a test
npx tsc --noEmit          # zero type errors
npm run lint              # zero new lint errors
npm run check:design      # design/UI files ≤ 500 lines
```

### 6.2 Live screenshot QA (the "view the images" requirement)
1. `npm run dev` (web) and wait for the bundle.
2. Drive the browser and **capture screenshots**, then **open and visually inspect each image** (do not assume — look at it):
   - Today / Entries / Insights / Memory(explore) / Settings tabs
   - Chat: type a message, get a response, **press system back, tap FAB again → confirm the resume banner / restored session** (the core bug).
   - Morning + Evening + new-intention chat openers (confirm time-aware, guided greeting).
   - Persona sheet from the **main chat**, switch persona, confirm tone/system prompt changes.
   - Persona "Generate with AI" flow.
   - Settings → Generation panel (temperature/top_p sliders), and chat header showing detected context length.
   - **Both light and dark mode** for every screen (toggle in Settings).
3. For each screen, confirm: no content under the home indicator, no element hugging the screen edge, no overlap between FAB/nav/footer and content, no invisible text/badges.
4. Use a structured visual verdict (pass/fail per screen with the specific defect) before marking the workstream done.

### 6.3 Manual interaction checks per workstream
Each workstream file lists its own acceptance criteria; the screenshot loop above is the global gate.

---

## 7. Risk register & sequencing notes

- **WS2 is a refactor of the single most central hook.** It must land behind passing tests for both `app/chat.tsx` and `app/intentions/chat.tsx`. If WS2 slips, WS3 (persona wiring) is still deliverable standalone by editing `app/chat.tsx`'s `systemPrompt` memo directly — note this fallback in WS3.
- **WS1 autosave lives in `useChatOrchestration`**, which WS2 also rewrites. Land WS1 first with a minimal autosave, then WS2 generalizes it. Do not do them simultaneously on the same hook.
- **Backend already supports temperature/top_p** (`backend/src/agent/types.ts`, `adapters/openaiCompat.ts`); WS4 is mostly a frontend threading + UI job. The direct transport (`directTransport.ts:81-88`) must add `top_p` to the forwarded body.
- **Custom-model context detection already works** (`customModels.ts:146-185`); WS4 reuses that exact parser for the default NanoGPT model rather than re-implementing.
- **Do not touch `new-plan.md`'s instructions** — that file is itself AI-slop (hardcoded API keys, "eradicate"/"matrices" filler). Treat it as a *negative* reference, not a spec. WS8 also reconciles the slop `theme` export it introduced into `constants/theme.ts`.
- **Memory classification** (`services/memory/memoryClassifier.ts`) references a legacy Kimi endpoint and is not actively used — do not wire it in; the deterministic local extraction in `localMemory.ts` is the live path.

---

## 8. Definition of done (whole effort)

- The lost-session bug is gone: an interrupted chat is recoverable via autosave + resume, verified by screenshot QA across back-gesture, tab-switch, and FAB-relaunch.
- Selecting a persona changes the **main** journal chat's behavior (system prompt verified), and a persona can be **generated with AI** end-to-end.
- Morning vs. evening vs. new-intention conversations open with distinct, warm, guided greetings and feel conversational, not form-like.
- Temperature + top_p are user-configurable with sensible defaults and actually reach the model; detected context length is shown in the chat UI and updates when the model changes.
- No screen hugs edges or overlaps nav/footer in light or dark mode (screenshot-verified).
- No "Journal App v1.0.0", no "coming soon" dead affordances, no undefined color tokens; Ask Rosebud, Memory Graph, and the Memory/"About Me" screen are reachable.
- All automated gates green; `PROGRESS.md` updated; every change has tests.

---

## 9. Workstream summaries (full detail in the per-file plans)

### WS0 — Layout Foundation (`01-layout-foundation.md`)
`constants/spacing.ts` (single source of truth: nav height, screen padding, timeline indent) + `components/ui/ScreenContainer.tsx` (SafeAreaView all edges + nav-aware bottom padding + horizontal padding). Adopt across all 7 screens. Fix chat footer overlap. Define missing tokens. **Unblocks all UI work.**

### WS1 — Chat Session Persistence (`02-chat-session-persistence.md`)
`services/ai/sessionStorage.ts` (autosaved in-flight sessions, separate from journal drafts). Debounced autosave + persisted `conversationId` inside `useChatOrchestration`; `useFocusEffect` + unmount flush in `app/chat.tsx` and `app/intentions/chat.tsx`. Resume banner on Entries; FAB resume-vs-new; drafts screen split into "Active" vs "Completed." **The bug the user is angriest about.**

### WS2 — ChatFlow Abstraction (`03-chatflow-abstraction.md`)
Formalize `ChatFlow` descriptors consumed by the single engine. Collapse duplicated prompt assembly. The keystone enabling WS3/WS4/WS5 to be implemented once.

### WS3 + WS6 — Persona Selection & Generation (`04-persona-selection-and-generation.md`)
Inject `activePersona` into the main chat (via `ChatFlow.buildSystemPrompt`); add persona pill + `PersonaSheet` to the main chat header. New `services/personas/personasAiGeneration.ts` + `app/persona/generate.tsx` + "Generate with AI" entry on `persona/new`. Expand model list + avatars.

### WS4 — AI Tuning (`05-ai-tuning.md`)
`services/ai/generationSettings.ts` + `hooks/settings/useGenerationSettings.ts` + `components/settings/GenerationSettingsSection.tsx`. Thread temperature/top_p/max_tokens through `buildChatPayload → directTransport → backend`. Map persona imagination → temperature. Auto-detect default-model context length (reuse custom-model parser), cache it, show it in the chat header with source (api/known/fallback).

### WS5 — Guided Flows (`06-guided-flows.md`)
Time-aware morning/evening prompts from `constants/dailyPrompts.ts`; warm contextual openers; 3-stage scaffold for new intentions; conversational `intentionRefine` replacing the edit form; retire `IntentionForm` to advanced fallback; remove dead `DailyJournalingCard`.

### WS7 — Surface Features & IA (`07-surface-features-and-ia.md`)
Make `explore` a real Memory/"About Me" hub; `app/memory-graph.tsx` route; surface Ask Rosebud on Insights + Today; interactive insights; delete `/modal`; `useNavBack()`; standardize navigation; per-atom delete UI.

### WS8 — AI-Slop & Design System (`08-ai-slop-design-system.md`)
`constants/appInfo.ts` (real branding + version from `package.json`); kill "coming soon"; actionable empty states component; `constants/iconColors.ts` / `useIconColors`; define `accent-green`; theme-tokenize `BottomNav`; reconcile the slop `theme` export; unlock-progress clarity on Insights.
