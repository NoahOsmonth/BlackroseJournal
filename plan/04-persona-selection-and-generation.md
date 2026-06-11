# WS3 + WS6 — Persona Selection (make it work) & AI Persona Generation

> **Depends on:** WS2 (inject persona via `ChatFlow.buildSystemPrompt`). **Standalone fallback:** if WS2 slips, WS3 can be done directly in `app/chat.tsx`'s `systemPrompt` memo (noted below).
> **Goal:** (a) Selecting a persona actually changes the **main** journal chat. (b) The user can **generate a persona with AI** from a short description.

---

## Part A — Persona SELECTION wiring (WS3)

### The bug (verified)

Personas are fully wired into **intentions chat only**:
- `app/intentions/chat.tsx:54-60` destructures `usePersonas()`, `:105-114` passes `activePersona?.id` to feedback, `:120-137` injects `personaPrompt` via `buildIntentionSystemPrompt`, and `:408-423` renders `PersonaSheet` with `onSelectPersona={setActive}`.

The **main journal chat** (the 90% surface reached from the FAB) **never imports `usePersonas`**. Its `systemPrompt` memo hardcodes:
```ts
// app/chat.tsx:73-80
const systemPrompt = useMemo(() => [
  THERAPIST_SYSTEM_PROMPT, localMemoryContext, feedbackGuidance,
].filter(Boolean).join('\n\n'), [feedbackGuidance, localMemoryContext]);
```
No `activePersona`. And `services/ai/useChat.ts:72` falls back to `THERAPIST_SYSTEM_PROMPT`. So choosing a persona has **zero effect** on the main chat — exactly the user's "choosing person should work" complaint.

### Fix (via WS2 — preferred)

In `features/chat/flows/index.ts`, `composeSystemPrompt` already injects `activePersona.prompt` as `## Persona Guidance`. So WS3 reduces to **feeding `activePersona` into the flow context** and **giving the main chat a way to pick one**:

1. **`app/chat.tsx`**: `const { personas, activePersona, setActive } = usePersonas();` and include `activePersona` in `flowContext`. (Fallback path if WS2 not landed: add `activePersona?.prompt` as `## Persona Guidance` into the existing `systemPrompt` memo and its dependency array.)
2. **Header persona affordance**: add an optional `personaName` + `onPersonaPress` to `components/Header.tsx` (it currently only has `onClose`). Render a small persona pill (name + avatar) that opens a `PersonaSheet` inline — copy the exact pattern from `app/intentions/chat.tsx:408-423`, `onSelectPersona={async p => { await setActive(p.id); setOpen(false); }}`, `onCreatePersona={() => router.push('/persona/new')}`.
3. Because feedback is persona-scoped (`useAiFeedback({ personaId })` in intentions), pass `personaId: activePersona?.id` to the main chat's `useAiFeedback` too (`app/chat.tsx:66-69`) for consistent per-persona guidance.

> **Net effect:** picking a persona in the main chat changes the system prompt (verifiable), the header reflects the active persona, and the same sheet/creation path works as in intentions.

### Persona enablers (small, optional)

- **Models** are hardcoded to 2 Kimi variants inline in `app/persona/advanced.tsx:16-24`. Extract to `constants/aiModels.ts` (shared with WS4's model list) so generation and the picker draw from one list.
- **Avatars** are limited to 2 presets (`constants/personas.ts`). Add an optional `avatarUrl?: string` to `Persona`/`PersonaCreateInput` so generated personas can carry a distinct identity (non-blocking).

---

## Part B — Persona GENERATION with AI (WS6)

> **Depends on:** WS3 (personas applied) + WS4 (shared model list). Build last.

### Current state: does not exist
No `generatePersonaWithAI` anywhere. Personas are only hand-authored via `PersonaForm` (`app/persona/new.tsx`).

### 6.1 `services/personas/personasAiGeneration.ts` (new)

Reuse the existing JSON-returning AI pattern from `services/ai/insights.ts` (which already does structured generation with a fallback) and the transport in `services/ai/ai.ts#completeChat`.

```ts
import { completeChat } from '@/services/ai/ai';
import type { PersonaCreateInput } from './personasStorage.types';

const SYSTEM = `You design a journaling companion persona. Given the user's
description, return STRICT JSON: { "name", "tagline", "prompt", "voice",
"imagination" }. "prompt" is a 2nd-person system prompt describing tone,
values, and how to respond in a reflective journaling chat. "voice" is one of
the allowed TTS voices. "imagination" is 0-100 (lower = consistent, higher =
creative). No prose outside JSON.`;

export interface GeneratePersonaInput {
  description: string;        // "a calm stoic mentor who asks short questions"
  allowedVoices: string[];
}

export async function generatePersonaWithAI(
  input: GeneratePersonaInput
): Promise<PersonaCreateInput> {
  const { content } = await completeChat(
    [{ id: '1', role: 'user', content: input.description, timestamp: Date.now() }],
    SYSTEM,
  );
  const parsed = safeParsePersonaJson(content, input.allowedVoices); // validate + clamp + fallbacks
  return {
    name: parsed.name,
    tagline: parsed.tagline,
    prompt: parsed.prompt,
    voice: parsed.voice,
    model: DEFAULT_PERSONA_MODEL,   // from constants/aiModels.ts
    imagination: parsed.imagination,
    avatarKey: 'persona-new',
  };
}
```

`safeParsePersonaJson` mirrors the defensive JSON handling in `insights.ts` (strip code fences, `JSON.parse` in try/catch, clamp `imagination` 0–100, coerce `voice` to an allowed value, fall back to sensible defaults on any miss). **Never throws** to the UI.

### 6.2 `app/persona/generate.tsx` (new screen)

- A single prompt: *"Describe the guide you want."* + a text input + example chips ("A warm encouraging coach", "A blunt stoic mentor", "A playful curious friend").
- On submit: loading state → `generatePersonaWithAI` → navigate to a **review** step that prepopulates `PersonaForm` with the generated values so the user can tweak before saving. Reuse `PersonaForm` (`app/persona/new.tsx` pattern) — pass `initialValues` from the generated draft.
- On save: `usePersonas().create(values)` then `setActive(newId)` so the just-made persona is immediately in use.

### 6.3 Entry points
- "✨ Generate with AI" button on `app/persona/new.tsx` (top of the form) → `router.push('/persona/generate')`.
- "Generate with AI" option in the `PersonaSheet`'s create affordance (alongside "Create persona").
- Register `/persona/generate` in `app/_layout.tsx`.

---

## Files touched

| File | Change |
|---|---|
| `app/chat.tsx` | import `usePersonas`; feed `activePersona` into flow context; persona-scoped feedback; header persona pill + sheet |
| `components/Header.tsx` | optional `personaName`/`onPersonaPress` + pill |
| `features/chat/flows/index.ts` | (already injects persona via `composeSystemPrompt` — verify) |
| `constants/aiModels.ts` | **new** — shared model list (extracted from `persona/advanced.tsx`) |
| `app/persona/advanced.tsx` | import models from `constants/aiModels.ts` |
| `services/personas/personasStorage.types.ts` | optional `avatarUrl?` |
| `services/personas/personasAiGeneration.ts` | **new** — `generatePersonaWithAI` |
| `app/persona/generate.tsx` | **new** — describe → generate → review → save |
| `app/persona/new.tsx` | "Generate with AI" button |
| `components/personas/PersonaSheet.tsx` | "Generate with AI" create option |
| `app/_layout.tsx` | register `/persona/generate` |

---

## Tests

- `__tests__/features/chatFlows.persona.test.ts`: with `activePersona`, the main-chat flow's system prompt contains `## Persona Guidance` + the persona prompt; without, it doesn't.
- `__tests__/services/personas/personasAiGeneration.test.ts`: valid JSON → mapped `PersonaCreateInput`; malformed JSON / out-of-range imagination / unknown voice → clamped/fallback, never throws.
- `__tests__/screens/PersonaGenerate.test.tsx`: submit description → mocked generator → review form prepopulated → save creates + activates.
- Update `__tests__/hooks/useCustomAiModels.test.ts` only if the model-list extraction touches it.

---

## Acceptance criteria (screenshot QA)

- Open main chat → tap persona pill → switch persona → the **assistant's tone changes** on the next message (verify the system prompt includes the persona via a debug assertion / response style). Switching back to default restores therapist tone.
- `persona/new` shows "Generate with AI"; entering "a blunt stoic mentor" produces a name/tagline/prompt/voice/imagination, lands in an editable review form, and saving makes it the active persona used by the main chat.
- Light + dark mode pass for the persona pill, generate screen, and review form.
