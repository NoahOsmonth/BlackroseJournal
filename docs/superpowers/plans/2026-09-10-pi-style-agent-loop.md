# Plan: Pi-style agent loop for BlackroseJournal journal chat

**Status:** ready to implement  
**Audience:** another AI agent (executor)  
**Constraint:** do **not** invent a third chat surface; do **not** break free-model tool resilience; do **not** change storage keys / Hindsight / tool semantics without a migration note.

---

## 0. Goal (one sentence)

Rewrite the journal-chat agent path to follow **Pi’s turn/event architecture**: stream intermediate assistant text live, keep looping while the model wants tools, surface every tool execution as typed events, and only finish when a turn has **no tool calls and no unfinished work promise** — so free models that say “let me dig more” actually dig more.

---

## 1. Reference architecture (copy this, not Cursor)

Source of truth: Pi `@earendil-works/pi-agent` (`packages/agent/src/agent-loop.ts`) + JSON/RPC event docs.

### 1.1 Event union (adapted names for this repo)

Extend `services/ai/agentEvents.ts` (keep existing events for back-compat; add new ones):

```ts
export type AgentToolStatus = 'running' | 'ok' | 'error' | 'refused';

export interface AgentToolCallSnapshot {
  toolCallId: string;
  name: string;
  label: string;          // from TOOL_UI_META
  argsPreview: string;
  status: AgentToolStatus;
  durationMs?: number;
  resultPreview?: string;
  round: number;          // 1-based turn index
  origin?: 'structured' | 'text';
}

export type AgentActivityEvent =
  // lifecycle
  | { type: 'agent_start'; runId: string }
  | { type: 'agent_end'; usedTools: boolean; rounds: number; stopReason?: AgentStopReason }

  // turn = one LLM call + zero-or-more tool executions (Pi turn_start/turn_end)
  | { type: 'turn_start'; round: number }
  | { type: 'turn_end'; round: number; hasToolCalls: boolean }

  // assistant message for THIS turn (may contain text AND/OR tool calls)
  | { type: 'assistant_text_start'; round: number }
  | { type: 'assistant_text_delta'; round: number; delta: string }
  | { type: 'assistant_text_end'; round: number; text: string }

  // tools (existing)
  | { type: 'tool_call_start'; call: AgentToolCallSnapshot }
  | { type: 'tool_call_end'; call: AgentToolCallSnapshot }

  // optional (phase 3)
  | { type: 'follow_up_injected'; reason: 'thin_result' | 'promised_more' | 'duplicate' };

export type AgentStopReason =
  | 'complete'                 // last turn: no tools, real answer
  | 'promised_more_timeout'    // kept saying "one sec" until budget/rounds
  | 'max_rounds'
  | 'token_budget'
  | 'timeout'
  | 'duplicate_call'
  | 'skipped'
  | 'error';

export type AgentActivityListener = (event: AgentActivityEvent) => void;
```

**Keep** `round_start` / `round_end` as aliases that emit the same as `turn_start` / `turn_end` for one release, **or** update all call sites in one PR and drop them. Prefer one PR: rename to `turn_*` and update tests.

### 1.2 Turn semantics (Pi)

```
agent_start
loop:
  turn_start(round)
  assistant = complete/stream one LLM call (may include tools schema)
  emit assistant_text_*  (if content non-empty after strip)
  if assistant has toolCalls:
    for each call: tool_call_start → execute → tool_call_end
    push tool results into context (structured or text protocol)
    turn_end(hasToolCalls=true)
    continue loop
  else:
    turn_end(hasToolCalls=false)
    if looksLikeUnfinishedPromise(text) && rounds remain:
      push system/user nudge; continue   // Pi keep-alive
    else:
      return final content
agent_end
```

**Finality rule (must implement exactly):**

A turn is **final** iff **all** of:

1. Zero tool calls after structured parse + text-dump parse + repair.
2. `!looksLikeUnfinishedPromise(cleanedText)`.
3. Not already in a forced final pass (`stopReason` path).

Otherwise, if `round < maxRounds` and token/time budget allow → **continue**.

### 1.3 `looksLikeUnfinishedPromise(text)`

Pure function in `services/ai/agentLoop.ts` (or `services/ai/agentPromise.ts` if file is too large). Unit-test heavy.

True when cleaned text is **short** (< ~280 chars) **and** matches any of (case-insensitive):

- `\b(one sec(ond)?|give me a (sec|moment)|hold on|i('| wi)ll (now )?(dig|search|check|look|read|recall)\b`
- `\blet me (actually |just |go )?(dig|search|check|look|read|find|recall)\b`
- `\b(still (looking|searching|checking)|digging deeper|going deeper)\b`
- Ends with “One sec.” / “One second.” / “brb” style status only

**False** (must NOT match):

- Real multi-paragraph answers that merely contain the word “search” in past tense (“I searched last week…”).
- Empty / whitespace-only.
- Text that is only tool-call syntax (already handled by `lookedLikeToolDump`).

Heuristic helper:

```ts
export function looksLikeUnfinishedPromise(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.length > 280) return false;
  if (looksLikeToolDump(t)) return false; // reuse existing helper
  const re = /\b(one sec(ond)?|give me a (sec|moment)|hold on|let me (actually |just |go )?(dig|search|check|look|read|find)|i('| wi)ll (now )?(dig|search|check|look)|still (looking|searching|checking)|digging deeper|going deeper)\b/i;
  return re.test(t);
}
```

Tune with real GLM traces in live tests; keep the function pure and exported.

### 1.4 Keep-alive nudge (inject once per promise streak)

When promise detected and continuing:

```
System note: You said you would keep looking. Do not stop on a status line.
Either call the tools you need now (structured tool_calls), then wrap with a complete
answer in a later turn — or if you are truly done, give the full final answer now
(substance, not "one sec"). Never invent tool results.
```

Emit `{ type: 'follow_up_injected', reason: 'promised_more' }`.

Cap: at most **2** promise-continuations per agent turn (`PROMISE_CONTINUATION_MAX = 2`). After that, force final no-tools pass (current exhaustion path).

### 1.5 Intermediate text to UI

When a turn has cleaned assistant text **and** also has tool calls (or will continue), emit:

- `assistant_text_start`
- one or more `assistant_text_delta` (can be a single delta of the full non-streaming chunk)
- `assistant_text_end`

**UI:** show that text as a **status line** under the tool stack for that turn (not as a committed chat bubble). Label: “Working…” / keep raw text. When the turn’s tools finish, keep the line until the next turn or final answer.

**Final answer path unchanged:** after the loop returns, `streamChat` still `emitSimulatedStreaming`s the final content (phase 2 can switch final path to real streaming if available).

### 1.6 Streaming per turn (optional but preferred)

Today each round is non-streaming `fetchAiChatCompletion`. Pi streams every turn.

**Phase 2 (required for “literally Pi” feel on final turn):** stream the **final** no-tools pass (or last turn without tools) via existing XHR SSE so the answer types out live.

**Phase 3 (nice):** stream each tool-round completion for text deltas; tool_calls can still be assembled from the final non-stream chunk if the provider only emits tool_calls at the end (GLM often does). If provider streams `tool_call_delta`, parse like Pi; if not, fall back to current extract-after-complete.

**Do not block Phase 1 on streaming.** Phase 1 = loop control + intermediate text events + promise continue. Phase 2 = live final streaming. Phase 3 = per-turn stream.

---

## 2. Current code map (what you will change)

| File | Role today | Change |
|---|---|---|
| `services/ai/agentEvents.ts` | Activity types | Add turn/text events + stop reasons |
| `services/ai/agentLoop.ts` | Non-stream multi-round tools loop | Pi turn loop, promise continue, intermediate text emit, rename rounds→turns |
| `services/ai/ai.ts` | Wires `runAgentTurnWithTools` → simulated stream | Pass through new events; stream final answer (P2) |
| `services/ai/chatTypes.ts` | `onAgentActivity` | No API break; events widen |
| `services/ai/useChat.ts` | Forwards listener | Unchanged unless final stream API changes |
| `features/chat/agentActivity.ts` | Reducer | Handle `assistant_text_*`; keep per-turn text lines |
| `features/chat/types.ts` | `StreamingMessage` | Add `agentStatusLines?: { round: number; text: string }[]` |
| `features/chat/hooks/useChatOrchestration.ts` | Applies events | Apply text lines; commit final message |
| `components/ai/AgentToolActivity.tsx` | Tool rows + chip | Render status lines above/below tools |
| `components/ChatMessage.tsx` | ToolActivity mount | Pass status lines through |
| `components/intentions/IntentionChatBody.tsx` | Same | Same |
| `services/ai/tools/definitions.ts` | `HISTORY_TOOLS_POLICY` | Soften “never narrate”; allow short status **with** tools |
| Tests | activity / loop / UI | Rewrite for turn semantics |

**Do not touch:** storage keys, Hindsight client, `executeTool.ts` execClass policy (except optional per-tool duration hooks in P3), `example-design/`.

---

## 3. Phased execution

### Phase 0 — Safety rails (30 min)

1. Branch / worktree from current main (ask human if concurrent edits).
2. Run baseline:
   ```bash
   npx tsc --noEmit
   npx jest --runInBand __tests__/services/ai/agentLoop.activity.test.ts __tests__/services/ai/agentLoop.test.ts
   ```
3. Record green baseline in `PROGRESS.md` under a new heading **before** refactors.

### Phase 1 — Pi turn loop + intermediate text (core)

**1a. Types** — extend `agentEvents.ts` as in §1.1. Export `AgentStopReason`.

**1b. Promise detector** — `export function looksLikeUnfinishedPromise` in `agentLoop.ts` or new `services/ai/agentPromise.ts`. Unit tests:

| Input | Expected |
|---|---|
| `Let me actually go dig rather than guess. One sec.` | true |
| `One sec — checking yesterday.` | true |
| Full 3-paragraph journal answer mentioning “I searched” | false |
| `` / tool dump only | false |

**1c. Rewrite `runAgentTurnWithTools` loop** (keep function name for callers):

- Keep `MAX_AGENT_TOOL_ROUNDS = 6`, `AGENT_TURN_TIMEOUT_MS`, `AGENT_TURN_TOKEN_BUDGET`, thin-result retry, duplicate guard, shortlist, soft-fail `safeEmitActivity`.
- Replace early `return` on `toolCalls.length === 0` with:

```ts
if (toolCalls.length === 0) {
  // existing: duplicate / dump / max_rounds
  const cleaned = finalizeUserFacingContent(content, reasoning);
  emit assistant_text_* for cleaned (if non-empty)

  if (promiseContinuations < PROMISE_CONTINUATION_MAX
      && looksLikeUnfinishedPromise(cleaned)
      && Date.now() - turnStartedAt < turnTimeoutMs
      && cumulativePromptTokens < turnBudget) {
    promiseContinuations += 1
    agentMessages.push({ role: 'assistant', content: cleaned })
    agentMessages.push({ role: 'user', content: PROMISE_CONTINUE_NOTE })
    emitActivity({ type: 'follow_up_injected', reason: 'promised_more' })
    continue  // next turn
  }

  // true final
  return { content: cleaned, ..., stopReason: 'complete' }
}
```

- When tool calls exist: emit `assistant_text_*` for `cleanedAssistant` **before** `tool_call_start` (so UI order matches Pi: text then tools).
- Rename loop variable comments to “turn”; emit `turn_start` / `turn_end`.
- `finally { emitAgentEnd(stopReason) }` stays.

**1d. Intermediate text on results**

`AgentLoopResult` (additive):

```ts
/** Status lines the model wrote between tool turns (not the final answer). */
intermediateTexts?: { round: number; text: string }[];
```

Collect every non-final cleaned assistant text. `streamChat` may ignore this if UI used events only — keep for tests/telemetry.

**1e. Prompt policy** — edit `HISTORY_TOOLS_POLICY` STOP line (~900 char budget still enforced by test):

Replace:

> Never narrate tool names or fake tool syntax — structured tool_calls only.

With (keep under budget):

> Short status text is OK **only if the same turn also includes tool_calls**. Never stop the turn on “one sec” / “let me dig” alone — either call tools or finish with a complete answer. Never invent results; never fake tool syntax.

Update `__tests__/services/ai/historyTools.test.ts` length/substring asserts if they pin exact strings.

**1f. Unit tests** — `__tests__/services/ai/agentLoop.promiseContinue.test.ts` (new, ≤300 lines):

1. Round 1: tools → round 2: promise text only → nudge → round 3: final answer. Assert `usedTools`, intermediate text captured, `tool_call_*` events, final content is the **last** answer not the promise line.
2. Promise on first turn with no prior tools → still continues if budget allows.
3. Promise spam: 3+ promise turns → stops at `PROMISE_CONTINUATION_MAX`, `stopReason` not `complete` or is `complete` with forced final pass — **document chosen behavior in the test name**.
4. Real answer on first no-tools turn → no extra loop.

Update existing `agentLoop.activity.test.ts` for `turn_*` if renamed.

**1g. Gates**

```bash
npx tsc --noEmit
npx jest --runInBand __tests__/services/ai/agentLoop
npm run check:design
```

### Phase 2 — UI: status lines + live final stream

**2a. Feature state**

```ts
// features/chat/types.ts
export interface AgentStatusLine {
  id: string;          // `t${round}-${index}`
  round: number;
  text: string;
}

export interface StreamingMessage {
  // ...
  toolActivity?: AgentToolCallSnapshot[];
  statusLines?: AgentStatusLine[];
}
```

Reducer (`features/chat/agentActivity.ts` or new `applyAgentStatusLines`):

- `assistant_text_end` → upsert status line for `round` (replace same round).
- `agent_end` → keep lines until commit (same as tools).
- On `agent_start` / new send → clear.

**2b. Orchestration**

- Mirror `statusLines` in a ref (like toolActivity) for commit.
- On complete: fold `toolActivity` onto `Message` (already done); also fold `statusLines` **or drop them** if the final answer supersedes them — **recommendation: drop status lines on commit** (chat transcript stays clean; only tool chip remains). Intermediate lines are ephemeral working UI.

**2c. `AgentToolActivity`**

Props:

```ts
{
  toolActivity: AgentToolCallSnapshot[];
  statusLines?: AgentStatusLine[];
  compact?: boolean;
}
```

Render order (live, non-compact):

1. Latest status line (or all lines for current max round, newest last) — italic secondary text, e.g. “Let me actually go dig rather than guess. One sec.”
2. Tool rows
3. Thinking footer if any running

Compact (finished message): tool chip only (current).

**2d. Live final answer streaming**

In `streamChat` after agent loop returns with content:

- Prefer real SSE/XHR stream of a **follow-up completion** that has tools disabled and history + tool results in context?  
  **Simpler (recommended):** keep `emitSimulatedStreaming` for P2 but bump chunk cadence; **or** if last agent turn already streamed (P3), use that text as final without re-stream.

Minimal P2 UX win: intermediate status lines already make it feel agentic even if final is simulated.

**2e. Component tests**

- Status line appears while streaming when `statusLines` non-empty.
- Status line does not appear on finished compact chip.
- Intention + journal both show live lines.

### Phase 3 — Per-turn streaming + per-tool duration (optional)

1. Each `completeWithTools` → stream; accumulate text; extract tool_calls from final message (and mid-stream if provider sends them).
2. Emit `assistant_text_delta` as tokens arrive.
3. Move tool start/end into `executeToolCalls` for true per-tool `durationMs`.

Only do this after Phase 1–2 are green on live OmniRoute.

### Phase 4 — Live verification (mandatory)

AGENTS.md rule 7: LLM loop changes need a real run.

1. Clear demo seed / empty storage for a clean history probe.
2. `RUN_INTEGRATION_TESTS=1` live test (new):  
   `__tests__/integration/agentPromiseLive.test.ts`  
   Prompt: “our first conversation tho?” or “what did I write about work last week?”  
   Assert: either multi-turn tools with intermediate events, **or** tools + full final answer — never a lone “One sec.” as the only assistant content when tools exist on the model side.
3. Manual Playwright / device: paste **verbatim** UI transcript into `PROGRESS.md`.

---

## 4. Exact contracts for the executor

### 4.1 Public API (no breaks)

- `runAgentTurnWithTools(options): Promise<AgentLoopResult>` — same name, additive options/fields only.
- `StreamChatOptions.onAgentActivity` — same; events widen (union).
- `Message.toolActivity` — keep.
- Storage schema — **no new required fields**. Optional `statusLines` not persisted.

### 4.2 Soft-fail

- Listener throw → catch, telemetry `agent_activity_listener_error`, never abort turn.
- Promise detector throw → treat as `false` (safe final).

### 4.3 Budgets (do not raise without reason)

| Constant | Value |
|---|---|
| `MAX_AGENT_TOOL_ROUNDS` | 6 |
| `PROMISE_CONTINUATION_MAX` | 2 |
| `AGENT_TURN_TIMEOUT_MS` | 45_000 |
| `AGENT_TURN_TOKEN_BUDGET` | 24_000 |
| `AGENT_ROUND_MAX_TOKENS` | 1_536 |
| Promise text max length for detector | 280 chars |

### 4.4 Layering

```
app/ + components/  →  features/chat  →  services/ai  →  tools/
```

UI never imports `agentLoop`. Status lines live in `features/chat` types + `components/ai`.

### 4.5 Design tokens (already landed)

- Surfaces: `bg-surface-light/95 dark:bg-slate-800/80`
- Status icons: `ToolStatusColors` in `constants/theme.ts` matching `tool-*` tailwind tokens
- No `space-y-*`; every `<Text>` has `dark:`
- Files ≤ 500 lines (`npm run check:design`)

---

## 5. Suggested implementation order (checklist for executor)

- [ ] P0 baseline tests + PROGRESS note
- [ ] P1 types + `looksLikeUnfinishedPromise` + unit tests
- [ ] P1 loop rewrite (no UI yet) + activity tests
- [ ] P1 `HISTORY_TOOLS_POLICY` + historyTools tests
- [ ] P1 all `agentLoop*` jest green + tsc
- [ ] P2 statusLines reducer + orchestration ref
- [ ] P2 AgentToolActivity + ChatMessage + IntentionChatBody
- [ ] P2 component tests + tsc + check:design
- [ ] P3 only if P2 feels insufficient live
- [ ] P4 live OmniRoute run + PROGRESS verbatim paste
- [ ] Full targeted jest + lint on touched files

---

## 6. Out of scope

- Claude Code `Stop` hooks / permission system
- Pi steering queue (`steer` / follow-up from user mid-turn) — design-compatible later via a new `follow_up_injected` reason
- Changing tool definitions / shortlist policy / Hindsight
- Ask-Rosebud surface
- Persisting intermediate status lines into journal session storage

---

## 7. Acceptance criteria (definition of done)

1. **No premature “One sec.” finals:** live or mocked multi-round test where model emits promise text only after tools → loop continues → final is a real answer (or forced final after max promises, with telemetry).
2. **Visible intermediate chat:** UI shows status text between tool batches while the turn is still running (not only a chip after the fact).
3. **Tool timeline still works:** running/ok/error/refused rows; compact chip on committed message; both chat surfaces.
4. **Free-model safety intact:** text-dump parse, thin-result retry, duplicate guard, soft-fail listener, inject_only path unchanged.
5. **Gates green:** `npx tsc --noEmit`, targeted jest, `npm run check:design`.
6. **PROGRESS.md** updated with architecture note + live evidence or honest gap.

---

## 7b. HANDOFF ADDENDUM (merged while implementing)

Provider stop reasons are **not interchangeable**. Collapsing `stop` / `tool_use` /
`length` into one finalize branch is how an agent ships half-executed tool calls
and hollow replies. Pi's rule (`failToolCallsFromTruncatedMessage`) is adopted:

### A1. Length truncation — never execute

`finish_reason: "length"` **and** tool calls parsed → do **not** execute them.
Emit `tool_call_end` with `status: 'error'`, `resultPreview: "arguments truncated
— re-issue"`; push the model a re-issue note; continue **once** (`TRUNCATED_TOOL_NOTE`).
Second truncation → `stopReason: 'error'` and the forced tools-disabled final pass.

Implementation detail (found by test): validation drops a mid-JSON call, so the
guard keys on the **raw candidate count**, not the post-repair count. The
transcript must **not** carry an assistant `tool_calls` block without matching
`tool` results — OpenAI-shaped gateways reject the next turn — so the nudge is
plain prose plus a user note.

### A2. Tool-use with zero parsed calls — never finalize

`finish_reason` says tool use but structured + text parse yield 0 calls → nudge
(`TOOLUSE_NO_CALLS_NOTE`) and continue once; telemetry `agent_tooluse_no_calls`.
If the nudge is spent and the provider still claims a call with nothing to run,
stop with `stopReason: 'error'` so the tools-disabled final pass answers instead
of shipping an empty reply.

### A3. Mixed text + tools

Cleaned text **and** tool calls → `assistant_text_*` events fire **before**
`tool_call_*`, and that text is recorded in `AgentLoopResult.intermediateTexts`.
It is never returned as the final user-facing answer for that turn.

### A4. Stop mapping module

`services/ai/agentStopReason.ts` — pure table: `normalizeStopReason`,
`isStop`, `resolveStopMapping`, `resolveFinishReason`. `AgentLoopResult`
carries `providerStopReason`. Telemetry `agent_max_rounds` includes it.

### A5. Explicitly NOT implemented (per handoff)

Judge LLM, Claude-Code Stop hooks, Pi steer queues, per-turn SSE streaming
(Phase 3). Tool chip on the committed message stays; status lines are
ephemeral and never persisted on `Message`.

### A6. Gates

`npx tsc --noEmit` · `npx jest --runInBand __tests__/services/ai/agentLoop` ·
`npm run check:design` · live OmniRoute probe before Phase 1 is "done"
(AGENTS.md rule 7).

Refs: Pi `packages/agent/src/agent-loop.ts`, `packages/ai/src/types.ts`
`AssistantMessage.content`.

---

## 8. Known risks

| Risk | Mitigation |
|---|---|
| Promise heuristic false-positive on long answers | Length cap + `looksLikeToolDump` + unit cases |
| Extra LLM rounds burn tokens | Promise cap 2; existing turn budget/timeout |
| GLM still returns tools as text only | Keep `parseTextToolDumps` path; promise continue after dump nudge too |
| UI clutter from many status lines | Show only latest line per turn; drop lines on commit |
| File size of `agentLoop.ts` | Extract `agentPromise.ts` + `emitToolActivity.ts` if > ~1100 lines |

---

## 9. One-paragraph mental model (for the implementing agent)

Treat each LLM call as a **Pi turn**. Stream or surface whatever the model said that turn. If it attached tools, run them and go again. If it only said “I’m still digging,” **do not ship that as the user-facing answer** — inject one keep-alive note and run another turn (max 2). Only when a turn has no tools and no unfinished-promise language do you return that text as the final reply and let `streamChat` type it into the chat. The UI already has tool cards; this plan adds the missing **intermediate assistant voice** and the missing **continue** so the harness feels like Pi/Claude Code instead of a one-shot tool dump plus a shrug.
