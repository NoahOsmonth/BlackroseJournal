# Plan: Cursor/Pi-style visible tool-calling harness for journal chat

## Goal

Surface the existing on-device agent loop as a live, Cursor/Pi-style activity timeline in journal and intention chat, so the user can *see* tool calls start/finish (name, args summary, status) while the model works — without changing tool semantics, blocking send latency, or forking a third chat surface.

## Research anchors (what we are copying)

| Source | Pattern to adopt |
|---|---|
| **Cursor** (`InteractionUpdate`) | Typed stream events: `tool_call` start/complete with status; `thinking`; `status`. UI shows collapsible tool rows, not raw JSON. |
| **Pi** (`@earendil-works/pi-agent`) | Explicit event sequence: `tool_execution_start` → `tool_execution_end` (parallel tools OK); human `label` on tools for UI; pending/success/error styling; result as truncated text, full detail on expand. |
| **pi-gui** | Conversation-first timeline: transcript stays primary; tool activity is compact rows inline above the reply, not a separate console. |

## Current gap (BlackroseJournal)

- `runAgentTurnWithTools` (`services/ai/agentLoop.ts`) runs **non-streaming** rounds internally.
- `streamChat` (`services/ai/ai.ts`) only calls `onChunk` **after** the agent finishes, via `emitSimulatedStreaming` of the final prose.
- UI shows `TypingIndicator` / “AI is thinking” for the whole tool phase (`app/chat.tsx`, `IntentionChatBody`).
- Tool names, args, and outcomes never leave the service layer (only telemetry logs).

## Smallest interface that satisfies the goal

One optional event callback, threaded service → feature → UI. No agent rewrite, no new storage, no permission changes.

```ts
// services/ai/agentEvents.ts (new, pure types)
export type AgentToolStatus = 'running' | 'ok' | 'error' | 'refused';

export interface AgentToolCallSnapshot {
  toolCallId: string;
  name: string;
  /** Short human label from TOOL_UI_META (not the raw tool name). */
  label: string;
  /** Compact args preview for the card (e.g. "yesterday", "work stress"). */
  argsPreview: string;
  status: AgentToolStatus;
  /** ms wall-clock once finished. */
  durationMs?: number;
  /** 1-line result teaser; never the full transcript. */
  resultPreview?: string;
  round: number;
}

export type AgentActivityEvent =
  | { type: 'agent_start'; runId: string }
  | { type: 'round_start'; round: number }
  | { type: 'tool_call_start'; call: AgentToolCallSnapshot }
  | { type: 'tool_call_end'; call: AgentToolCallSnapshot }
  | { type: 'round_end'; round: number }
  | { type: 'agent_end'; usedTools: boolean; rounds: number; stopReason?: string };

export type AgentActivityListener = (event: AgentActivityEvent) => void;
```

Threading:

```ts
// AgentLoopOptions
onActivity?: AgentActivityListener;

// StreamChatOptions
onAgentActivity?: AgentActivityListener;

// useChat.sendMessage / sendInitialMessage (optional last arg or options bag)
onAgentActivity?: AgentActivityListener;
```

UI state model (feature layer):

```ts
// features/chat/types.ts
export interface StreamingMessage {
  id: string;
  role: 'assistant';
  content: string;
  reasoning: string;
  isStreaming: boolean;
  /** Live tool cards for this turn; cleared when the turn completes. */
  toolActivity?: AgentToolCallSnapshot[];
}
```

Reducer rule in `useChatOrchestration`: on `tool_call_start` upsert running card; on `tool_call_end` replace by `toolCallId`; on `agent_end` keep snapshots until final assistant message is committed (then fold a compact “N tools used” chip onto the finished message *optional phase 2*).

## Files to touch (and why)

### Phase 1 — emit (service layer)

| File | Why |
|---|---|
| `services/ai/agentEvents.ts` **(new)** | Shared event + snapshot types; keep agentLoop free of UI concerns. |
| `services/ai/tools/toolUiMeta.ts` **(new)** | `TOOL_UI_META`: per-tool human label, icon name, args formatter, result teaser. Single source of truth for copy. |
| `services/ai/agentLoop.ts` | Accept `onActivity`; emit `agent_start/round_*`; wrap each prepared call with start/end. Do **not** change loop control flow. |
| `services/ai/tools/executeTool.ts` | Optional `onToolStart`/`onToolEnd` (or emit from agentLoop around `executeToolCalls` — prefer agentLoop-level emission first to avoid executor churn). |
| `services/ai/ai.ts` | Pass `resolved.onAgentActivity` into `runAgentTurnWithTools`; fire-and-forget, never await UI. |
| `services/ai/chatTypes.ts` | Extend `StreamChatOptions` with `onAgentActivity`. |

### Phase 2 — wire (feature layer)

| File | Why |
|---|---|
| `services/ai/useChat.ts` | Accept listener; pass through to `streamChat` on freeform send (history-tools path). Bootstrap openers stay tools-off. |
| `features/chat/hooks/useChatOrchestration.ts` | Hold `toolActivity` on `streamingMessage`; apply reducer; clear on complete/error/new chat. |
| `features/chat/types.ts` | Extend `StreamingMessage`. |

### Phase 3 — render (UI, both chat surfaces)

| File | Why |
|---|---|
| `components/ai/AgentToolActivity.tsx` **(new)** | Cursor-style list of tool rows + expandable detail. Shared by both surfaces (rule 5). |
| `app/chat.tsx` | Mount activity above `ChatMessage` when `streamingMessage.toolActivity?.length`. |
| `components/intentions/IntentionChatBody.tsx` | Same component; gate replaces bare `TypingIndicator` when tools are running. |

### Tests / gates

| File | Why |
|---|---|
| `__tests__/services/ai/agentLoop.activity.test.ts` **(new)** | Spy listener: structured tool path emits start+end with matching ids; no-tools turn emits only agent_start/end; timeout path still emits agent_end. |
| `__tests__/services/ai/toolUiMeta.test.ts` **(new)** | Every registry tool has meta; labels unique; argsPreview never dumps >120 chars. |
| `__tests__/components/AgentToolActivity.test.tsx` **(new)** | Renders running/ok/error; expand toggles; dark+light class tokens present; a11y labels. |
| Existing agentLoop tests | Unchanged control-flow assertions still pass. |

**Do not touch:** storage keys, Hindsight client, tool definitions/semantics, `HISTORY_TOOLS_POLICY`, session persist schema (phase 1), `example-design/`.

## UI spec (journal-friendly, not IDE-chrome)

Style anchor: **Pi tool rows + Cursor compact activity**, adapted to the existing chat bubble language (NativeWind tokens, Reanimated enter).

1. **Live row** (running): muted surface, 12px Material icon, human label (“Checking the time”, “Reading yesterday”), spinner; optional args chip (`yesterday` / `work stress`).
2. **Done row**: check / error icon, label, duration (`120ms`); collapsed by default after success.
3. **Error / refused row**: warning tint; short system note preview.
4. **Expand**: args JSON pretty-printed truncated (~6 lines) + result teaser (~4 lines). Full storage contents never dumped.
5. **While tools run and no prose yet**: show activity stack **instead of** bare `TypingIndicator`. Keep a tiny “thinking” footer under the last running row.
6. **After prose starts streaming**: collapse activity to a single compact chip (“Used 3 tools · details”) above the text so the reply stays primary (pi-gui conversation-first).
7. **Both schemes**: `bg-surface-light/95 dark:bg-slate-800/80`, text `text-text-light dark:text-white`, accent from existing theme tokens. No `space-*`. Every `<Text>` has `dark:`.
8. **File budget**: `AgentToolActivity.tsx` ≤ 250 lines; split rows/meta if needed. `useChatOrchestration` must stay ≤ 500 (extract `applyAgentActivity` reducer to `features/chat/agentActivity.ts` if needed).

### TOOL_UI_META sketch

| name | label | argsPreview | resultPreview |
|---|---|---|---|
| `get_clock` | Checking the time | `—` | `Tue Sep 10, 21:14` |
| `list_recent_days` | Scanning recent days | `7 days` | `5 active days` |
| `get_day` | Reading a day | `yesterday` | summary first line |
| `get_conversation` | Opening a past entry | `journal · id…` | title + length |
| `search_history` | Searching your history | `work stress` | `3 hits` |
| `recall_memory` | Searching long-term memory | `argument…` | `2 recollections` |
| `get_identity` | Reading your profile | `—` | preferred name only |
| `update_identity` | Saving profile facts | `name: Sam` | `updated` |
| `list_goals` | Listing goals | `—` | `N goals` |
| `create_goal` | Creating a goal | `Run 3x/week` | created title |

Privacy rule: previews never include full journal body, only digests/titles/counts the tools already return to the model.

## Out of scope (explicit)

- True token-level streaming of tool-round assistant text (provider still non-streaming in agent loop).
- Steering mid-tool-run (Pi `steer`) — future.
- Persisting tool activity into session/history transcripts — optional later with schemaVersion bump.
- Changing shortlist / capability / telemetry.
- Ask-Rosebud surface.

## Ripple / risk flags

1. **>3 files by design** — event types + agentLoop + streamChat + useChat + orchestration + 2 screens + new component. Mitigate by shipping Phase 1 (emit + unit tests) before any UI.
2. **No new permissions.** Tools already run on-device; this only narrates them.
3. **Perf:** activity events are fire-and-forget; coalesce UI updates with a single `setState` per event batch if RN re-renders thrash (prefer requestAnimationFrame batch in orchestration).
4. **Soft-fail rule:** if `onActivity` throws, catch and `logToolTelemetry` — never break the agent turn.
5. **Layering:** UI must not import `agentLoop`; only `features/chat` types + `components/ai`.
6. **Rule 5:** one shared component for journal + intention chat.

## Implementation order

1. Types + `toolUiMeta` + agentLoop emit + unit tests (service green).
2. Thread through `streamChat` / `useChat` / orchestration reducer + hook test.
3. `AgentToolActivity` + wire both chat screens + component tests.
4. Design QA light/dark; `npx tsc --noEmit`, `npm run lint`, `npm run check:design`, targeted jest.
5. Manual golden path: ask “what did I write about work last week?” with OmniRoute up — paste real timeline labels into PROGRESS.md.
6. Update `PROGRESS.md`.

## Done when

- User asking a history question sees labeled tool rows update live, then the prose reply.
- Inject-only / no-tools turns show no tool chrome (or a quiet “no tools” nothing).
- Agent timeout/error still ends the activity stack cleanly.
- All gates green; both surfaces share one component.
