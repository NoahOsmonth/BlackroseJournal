# WS2 — The `ChatFlow` Abstraction (Keystone Refactor)

> **Depends on:** WS1 (autosave already lives in `useChatOrchestration`; this generalizes it).
> **Enables:** WS3 (persona), WS4 (tuning), WS5 (guided flows) to be implemented **once** instead of per-screen.
> **Goal:** Collapse the divergent, duplicated chat orchestration in `app/chat.tsx` and `app/intentions/chat.tsx` into a single engine driven by a declarative `ChatFlow` descriptor.

---

## Why this exists (the duplication, verified)

Today there are two near-parallel implementations of "assemble a system prompt + open a conversation + persist on finish":

- **`app/chat.tsx`** builds `systemPrompt` from `THERAPIST_SYSTEM_PROMPT + localMemoryContext + feedbackGuidance` (`:73-80`), no persona, and persists as a journal entry (`handleFinishEntry :172`).
- **`app/intentions/chat.tsx`** builds it via `buildIntentionSystemPrompt({ personaPrompt, areaLabel, intentionTitle, memorySummary, feedbackGuidance })` (`:120-137`), uses a bare `[Start intention check-in]` trigger (`:143-147`), and persists as a check-in/intention (`handleFinish :254`).

Both call the same `useChatOrchestration` (`app/chat.tsx:95`, `app/intentions/chat.tsx:159`) but pass different ad-hoc options. Every new capability (persona everywhere, tuning everywhere, guided stages) currently means editing **both** screens and risking drift. A descriptor fixes that.

---

## The abstraction

### 2.1 `features/chat/flows/types.ts` (new)

```ts
import type { Persona } from '@/services/personas/personasStorage.types';
import type { IntentionArea, IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';
import type { Message } from '@/services/ai/chatTypes';
import type { GenerationSettings } from '@/services/ai/generationSettings'; // WS4

export type ChatFlowId =
  | 'freeform' | 'dailyCheckIn' | 'continue'
  | 'morning' | 'evening' | 'intention' | 'intentionRefine';

export interface ChatFlowContext {
  activePersona?: Persona | null;
  localMemoryContext?: string;     // the "Local Memory Capsule"
  feedbackGuidance?: string;
  area?: IntentionArea;
  areaLabel?: string;
  intentionTitle?: string;
  checkInType?: IntentionCheckInType; // 'morning' | 'evening' | 'intention'
  memorySummary?: string;
  generation?: GenerationSettings;
}

export interface GuidedStage {
  id: string;
  /** Injected into the system prompt to steer the AI through one step. */
  instruction: string;
  /** Heuristic: when is this stage satisfied (e.g., user gave a concrete answer). */
  isComplete?: (messages: Message[]) => boolean;
}

export interface ChatFlow {
  id: ChatFlowId;
  buildSystemPrompt(ctx: ChatFlowContext): string;
  /** Warm, contextual opener that replaces bare trigger text. */
  openingMessage?(ctx: ChatFlowContext): string;
  /** Optional multi-turn scaffold (used by new-intention setting in WS5). */
  stages?: GuidedStage[];
  /** Per-flow generation tweak (e.g., evening reflection slightly warmer). */
  generationOverride?(ctx: ChatFlowContext): Partial<GenerationSettings>;
}
```

### 2.2 `features/chat/flows/index.ts` (new — the registry)

A `Record<ChatFlowId, ChatFlow>`. Each flow's `buildSystemPrompt` composes from the same building blocks **in one place**:

```ts
function composeSystemPrompt(base: string, ctx: ChatFlowContext): string {
  return [
    base,
    ctx.localMemoryContext,
    ctx.activePersona?.prompt
      ? `## Persona Guidance\n${ctx.activePersona.prompt}`
      : undefined,
    ctx.feedbackGuidance,
  ].filter(Boolean).join('\n\n');
}
```

- `freeform` / `continue` → `composeSystemPrompt(THERAPIST_SYSTEM_PROMPT, ctx)`.
- `dailyCheckIn` → wraps `buildDailyCheckInSystemPrompt` (move from `services/ai/useChat.ts:13-21`).
- `morning` / `evening` / `intention` / `intentionRefine` → delegate to the upgraded `buildIntentionSystemPrompt` (WS5 makes it time-aware), then `composeSystemPrompt` so **persona + memory + feedback are woven uniformly**.

This is the seam where WS3 (persona) becomes universal: persona is injected by `composeSystemPrompt`, so *every* flow gets it for free.

### 2.3 `useChatOrchestration` consumes a flow

Add an option `flow?: ChatFlow` and `flowContext?: ChatFlowContext`. Internally:
- Derive `systemPrompt` from `flow.buildSystemPrompt(flowContext)` (falling back to the existing `systemPrompt` string option for backward compat during migration).
- Use `flow.openingMessage?.(ctx)` for the initial assistant turn instead of bare trigger text.
- Pass `flow.generationOverride?.(ctx)` into the send path (WS4 reads it).
- Autosave (WS1) records `flow.id` as the session `mode`.

Keep the **string `systemPrompt` option working** so migration is incremental and tests stay green.

---

## Migration steps (incremental, test-guarded)

1. Land `types.ts` + `flows/index.ts` with `freeform`, `continue`, `dailyCheckIn` flows that reproduce **exactly** today's prompts. Add unit tests asserting byte-identical output to the current assembly.
2. Switch `app/chat.tsx` to pass `flow={FLOWS.freeform}` + `flowContext={{ localMemoryContext, feedbackGuidance }}` (persona added in WS3). Verify chat tests still pass.
3. Add `morning`/`evening`/`intention`/`intentionRefine` flows wrapping `buildIntentionSystemPrompt`. Switch `app/intentions/chat.tsx` to pass the appropriate flow by `checkInType`/params.
4. Delete the now-dead inline prompt assembly in both screens.

---

## Files touched

| File | Change |
|---|---|
| `features/chat/flows/types.ts` | **new** — descriptor types |
| `features/chat/flows/index.ts` | **new** — flow registry + `composeSystemPrompt` |
| `features/chat/hooks/useChatOrchestration.ts` | accept `flow`/`flowContext`; derive prompt + opener + generation; keep string fallback |
| `features/chat/index.ts` | export flows |
| `app/chat.tsx` | pass `FLOWS.freeform`/`continue`; remove inline prompt memo |
| `app/intentions/chat.tsx` | pass flow by type; remove inline assembly |
| `services/ai/useChat.ts` | move `buildDailyCheckInSystemPrompt` into flows (or keep + delegate) |

---

## Tests

- `__tests__/features/chatFlows.test.ts` (new): each flow's `buildSystemPrompt` matches the legacy assembly for the same context; persona block included iff `activePersona` present; opener non-empty for guided flows.
- Existing chat + intention-chat tests must remain green (the migration is behavior-preserving until WS3/WS4/WS5 intentionally change output).

---

## Acceptance criteria

- `app/chat.tsx` and `app/intentions/chat.tsx` no longer assemble system prompts inline; both route through `FLOWS`.
- Adding persona/tuning/guidance later touches only `flows/index.ts` + the hook, not the screens.
- No behavioral change visible in screenshot QA at this step (pure refactor); all gates green.
