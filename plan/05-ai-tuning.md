# WS4 — AI Tuning: Temperature / top_p / Context-Length Auto-Detect

> **Depends on:** WS2 for clean param threading (backend is already ready). 
> **Goal:** Give the AI sensible, user-tunable defaults (temperature, top_p), make the existing **imagination** slider actually do something, send `top_p` (currently never sent), and **auto-detect the model's context length when a model is detected and surface it in the UI** — exactly as the user asked.

---

## Current state (verified, with line numbers)

- **Chat params are hardcoded** in `services/ai/chatTypes.ts:71-72`:
  ```ts
  temperature: 1.0,
  max_tokens: 32768,
  ```
  inside `buildChatPayload` — same for streaming and non-streaming. No user control.
- **No `top_p` anywhere** in the request path. `ChatRequestPayload` (`chatTypes.ts:26-33`) and `DirectChatRequest` (`directTransport.ts:11-18`) have no `top_p` field; the only "top" reference is `top_provider.context_length` in the context parser (`customModels.ts:61`).
- **Imagination slider is dead weight** — persisted per persona (`app/persona/advanced.tsx:71-80`, mapped Consistent/Balanced/Creative at `:26-30`) but **never read** when sending a chat. The slider literally does nothing today.
- **Insights hardcode `0.7`** in `services/ai/insights.ts` (multiple call sites).
- **Context detection exists but only for custom providers** — `customModels.ts:146-185` parses `context_length`/`contextWindow`/nested paths with `api → known → fallback(128k)` precedence, and `CustomModelSettingsSection.tsx:22-27` surfaces it. The **default NanoGPT path** (`directConfig.ts:46-69`) never queries `/models`, so for the default model the context window is unknown and unshown.
- **Backend already supports the params end-to-end** — `backend/src/agent/types.ts:12-13`, `modelClient.ts:33-34`, `adapters/openaiCompat.ts:29-34`. The frontend simply never sends them. So this is overwhelmingly a **frontend threading + UI** job.

---

## Deliverables

### 4.1 `services/ai/generationSettings.ts` (new)

AsyncStorage-backed global generation defaults, same adapter/sanitize pattern as `customModels.ts`.

```ts
export interface GenerationSettings {
  temperature: number;   // 0.0–2.0
  topP: number;          // 0.0–1.0
  maxTokens: number;     // capped to detected context window
}

export const DEFAULT_GENERATION: GenerationSettings = {
  temperature: 1.0,   // preserves today's chat behavior
  topP: 0.9,
  maxTokens: 32768,
};

// load/save/reset; clamp temperature [0,2], topP [0,1], maxTokens [256, contextWindow].
export const INSIGHTS_TEMPERATURE = 0.7; // now explicit, not implicit
```

### 4.2 `hooks/settings/useGenerationSettings.ts` (new)
`{ settings, update, reset, isLoading }` — load on mount, persist on change. Mirror `hooks/settings/useCustomAiModels.ts`.

### 4.3 `components/settings/GenerationSettingsSection.tsx` (new)
A Settings card with:
- **Temperature** slider 0.0–2.0 (reuse the `ImaginationSlider` pattern or a generic slider) with a live numeric readout and a one-line explainer.
- **Top-P** slider 0.0–1.0.
- **Presets**: Consistent / Balanced / Creative chips that set (temp, topP) pairs — reuse the existing imagination labels for consistency.
- **Detected context window** read-out (from 4.6) with its **source badge** (`api` / `known` / `fallback`) — so the user *sees* the auto-detected value the moment a model is detected.
- Wire into `app/(tabs)/settings.tsx` next to `CustomModelSettingsSection`.

### 4.4 Add `top_p` + thread params through the request path
- `services/ai/chatTypes.ts`: add `top_p?: number` to `ChatRequestPayload`; change `buildChatPayload` signature to accept a `GenerationSettings`-shaped arg (default to `DEFAULT_GENERATION`) instead of hardcoding `1.0/32768`. Emit `temperature`, `top_p`, `max_tokens`.
- `services/ai/directTransport.ts`: add `top_p?: number` to `DirectChatRequest` and **include it in the forwarded body** (`:81-88` currently drops it). Keep the "OpenAI-standard fields only" filter but add `top_p` to the allowed set.
- `services/ai/ai.ts#streamChat` / `completeChat`: accept and pass a generation arg down to `buildChatPayload`.
- `services/ai/useChat.ts`: thread a `generation` option from the hook.
- `features/chat/hooks/useChatOrchestration.ts`: read `useGenerationSettings()` and merge with `flow.generationOverride?.(ctx)` (WS2), then merge **persona imagination** (4.5).
- **Backend** `adapters/openaiCompat.ts`: ensure `top_p` is in the outgoing body (types already support it; verify the field is mapped).

### 4.5 Wire imagination → temperature (make the slider real)
In the merge step (orchestration hook), map the active persona's `imagination` (0–100) to a temperature, overriding the global default when a persona is active:
- `0–33` → ~0.3 (Consistent)
- `34–66` → 0.7–1.0 (Balanced)
- `67–100` → 1.5–2.0 (Creative)

Precedence: **persona imagination > per-flow override > global settings default.** Document this in the hook. Now the long-dead `ImaginationSlider` finally changes model behavior.

### 4.6 Context-length auto-detect for the **default** model + surface in UI
- `services/ai/modelContext.ts` (new): `detectDefaultModelContextWindow(): Promise<{ contextWindow: number; source: 'api'|'known'|'fallback' }>`. After `getDirectConfig()`, call `GET {apiBaseUrl}/models`, then **reuse the existing parser** `parseOpenAiCompatibleModels` / `readContextFromApi` from `customModels.ts` (export those if not already) to extract the active model's `context_length`. Cache in AsyncStorage keyed by `{baseUrl, model}` so it's detected once and reused; refresh on model change.
- **Surface it**: a new `components/chat/ChatHeader.tsx` (or extend `components/Header.tsx`) shows the active model name + detected context length (e.g., "Kimi K2.5 · 128k ctx"). Also show it in the Generation settings section (4.3) with the source badge.
- **Cap `maxTokens`** to the detected window in `generationSettings` clamp so we never request more than the model allows.

### 4.7 Insights explicitness
Replace the magic `0.7` in `services/ai/insights.ts` with `INSIGHTS_TEMPERATURE` from `generationSettings.ts` (no behavior change, just de-magic-numbered and centrally tunable).

---

## Files touched

| File | Change |
|---|---|
| `services/ai/generationSettings.ts` | **new** — store + defaults + clamps |
| `hooks/settings/useGenerationSettings.ts` | **new** |
| `components/settings/GenerationSettingsSection.tsx` | **new** — sliders + presets + detected-ctx readout |
| `app/(tabs)/settings.tsx` | mount the new section |
| `services/ai/chatTypes.ts` | `top_p` field; `buildChatPayload` takes generation arg |
| `services/ai/directTransport.ts` | `top_p` in `DirectChatRequest` + forwarded body |
| `services/ai/ai.ts` | thread generation into payload |
| `services/ai/useChat.ts` | generation option |
| `features/chat/hooks/useChatOrchestration.ts` | merge settings + flow override + persona imagination |
| `services/ai/modelContext.ts` | **new** — detect + cache default-model context window |
| `services/ai/customModels.ts` | export `readContextFromApi`/parser if needed |
| `components/chat/ChatHeader.tsx` (or `Header.tsx`) | show model + context length |
| `services/ai/insights.ts` | use `INSIGHTS_TEMPERATURE` |
| `backend/src/agent/adapters/openaiCompat.ts` | verify `top_p` mapped (types already support) |

---

## Tests

- `__tests__/services/ai/generationSettings.test.ts`: clamps temp/topP/maxTokens; preset pairs; persists.
- `__tests__/services/ai/chatPayload.test.ts`: `buildChatPayload` emits `temperature`/`top_p`/`max_tokens` from the passed settings; defaults preserve `1.0`.
- `__tests__/services/ai/directTransport.topP.test.ts`: `top_p` reaches the request body.
- `__tests__/services/ai/modelContext.test.ts`: parses `/models` context; `api>known>fallback`; caches; caps maxTokens.
- `__tests__/services/ai/imaginationToTemperature.test.ts`: 0/50/100 → expected ranges; persona overrides global.
- Update `__tests__/services/ai/directTransport.test.ts` (exists, modified) for the new field.

---

## Acceptance criteria (screenshot QA)

- Settings → Generation panel: temperature + top_p sliders move and persist; presets work; **detected context window shows with a source badge**.
- Chat header shows the active model + context length; switching to a custom model updates both.
- Setting temperature to 0.1 vs 1.8 produces visibly different response variability.
- Selecting a persona with high "Creative" imagination yields more varied responses than a "Consistent" one (the slider is no longer dead).
- `top_p` is present in the network request (verify via the request inspector during QA).
- All gates green.
