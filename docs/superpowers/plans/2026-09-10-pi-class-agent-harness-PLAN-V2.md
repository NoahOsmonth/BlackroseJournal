# Plan v2 — Canonical Pi-class agent harness (from deep research)

**Audience:** implementation agent (fresh or continuing)  
**Date:** 2026-09-10  
**Supersedes for execution order:** `2026-09-10-pi-style-agent-loop.md` (keep as historical)  
**Sources:**  
- Research: `docs/superpowers/plans/research/2026-09-10-pi-class-agent-harness-research.md`  
- Addendum: `2026-09-10-pi-style-agent-loop-ADDENDUM.md`  
- Visible-timeline: `2026-09-10-visible-tool-calling-harness.md`  
- Pi / Claude Code / OpenHands / LangGraph / Vercel AI SDK (cited in research §9)  
- OmniRoute: `diegosouzapw/OmniRoute` — multi-provider OpenAI-compatible gateway

---

## 0. What OmniRoute actually is (read first)

Do **not** treat OmniRoute as “a free-model box.”

| Fact | Implication |
|---|---|
| OpenAI-compatible `/v1/chat/completions` | Phone always speaks one protocol |
| Translates OpenAI ⇄ Anthropic ⇄ Gemini, etc. | Strong models (GPT, Claude, Gemini) can return **native structured `tool_calls`** through the same URL |
| Routing + combo targets + emergency fallback | Failures may look like 504/queue errors; client already has congestion backoff |
| Local default: `http://100.107.7.52:20128/v1` | Production chat path is **device-direct**; Node `backend/` is not required |
| Free cookie/web models + paid API models share the gateway | **Capability is per-model**, not per-gateway |

**Harness rule:** one loop + one event protocol for all models. Weakness is handled by **capability tiers** and repair layers, not by forking the architecture.

---

## 1. Goal (one sentence)

Ship an on-device **Pi-class agent harness**: deterministic turn loop, live intermediate voice + tool timeline, strict finality, free-model repair — so journal chat feels like Pi/Claude Code (work → tools → wrap-up), not a black-box typing spinner.

---

## 2. Definition of “Pi-class” for this product

### Must have (80% core)

1. **Turn loop** — one LLM call + optional tool batch = one turn; loop until final.
2. **Event stream** — `agent_*` / `turn_*` / `assistant_text_*` / `tool_call_*` / `follow_up_injected`.
3. **Mixed turn content** — status text **and** tools in the same turn; text never becomes the final reply if tools ran.
4. **Strict finality** — final only if **no tool calls** **and** `!looksLikeUnfinishedPromise(text)`.
5. **Out-of-band repair** — text-dump parse, length-truncation fail, toolUse-with-zero-calls continue, arg aliases.
6. **Ephemeral UI** — live status + tool cards; on commit, drop status, keep expandable tool chip.
7. **Soft-fail** — listener throw / Hindsight down / gateway 504 never brick chat.

### Explicitly not required (do-not-copy)

- Pi `steer()` / mid-turn user queues  
- Claude permission modals / shell  
- Judge LLM / Stop hooks (OpenHands `run_goal`)  
- Subagent hierarchies  
- Raw JSON/tool dumps in the diary transcript  
- Full Pi provider adapter matrix / deferred tools / OAuth

---

## 3. Current tree inventory (do not re-implement blindly)

Another agent may have already landed much of Phase 1–2. **Inventory first:**

| Artifact | Expected if present |
|---|---|
| `services/ai/agentEvents.ts` | Event union + listener type |
| `services/ai/agentPromise.ts` | `looksLikeUnfinishedPromise`, `PROMISE_CONTINUE_NOTE`, max=2 |
| `services/ai/agentStopReason.ts` | `resolveStopMapping` → finalize / execute / truncated / tooluse_no_calls / abort |
| `services/ai/agentEmit.ts` | Soft-fail emit helpers |
| `services/ai/agentLoop.ts` | Turn loop + promise continue + length fail |
| `services/ai/tools/parseTextToolCalls.ts` | XML / dots / balanced JSON / kwargs |
| `features/chat/agentActivity.ts` | Reducer for tools + status lines |
| `components/ai/AgentToolActivity.tsx` | Live rows + compact chip |
| Tests | `agentLoop.promiseContinue`, `agentStopReason`, `agentPromise`, activity/UI |

**Step 0 of implementation:** run gates; fill gaps; do not rewrite green modules.

```bash
npx tsc --noEmit
npx jest --runInBand __tests__/services/ai/agentLoop __tests__/services/ai/agentPromise.test.ts __tests__/services/ai/agentStopReason.test.ts __tests__/components/AgentToolActivity.test.tsx __tests__/features/agentActivity.test.ts
npm run check:design
```

---

## 4. Target architecture

### 4.1 Event union (canonical)

```ts
// services/ai/agentEvents.ts
export type AgentToolStatus = 'running' | 'ok' | 'error' | 'refused';

export interface AgentToolCallSnapshot {
  toolCallId: string;
  name: string;
  label: string;
  argsPreview: string;
  status: AgentToolStatus;
  durationMs?: number;
  resultPreview?: string;
  round: number;
  origin?: 'structured' | 'text';
}

export type AgentStopReason =
  | 'complete' | 'promised_more_timeout' | 'max_rounds'
  | 'token_budget' | 'timeout' | 'duplicate_call' | 'skipped' | 'error';

export type AgentActivityEvent =
  | { type: 'agent_start'; runId: string }
  | { type: 'agent_end'; usedTools: boolean; rounds: number; stopReason?: AgentStopReason }
  | { type: 'turn_start'; round: number }
  | { type: 'turn_end'; round: number; hasToolCalls: boolean }
  | { type: 'assistant_text_start'; round: number }
  | { type: 'assistant_text_delta'; round: number; delta: string }
  | { type: 'assistant_text_end'; round: number; text: string }
  | { type: 'tool_call_start'; call: AgentToolCallSnapshot }
  | { type: 'tool_call_end'; call: AgentToolCallSnapshot }
  | { type: 'follow_up_injected'; reason: 'thin_result' | 'promised_more' | 'duplicate' | 'truncated_tools' | 'tooluse_no_calls' };
```

`AgentLoopResult` additive fields: `intermediateTexts`, `providerStopReason`, `stopReason`.

### 4.2 State machine (implement exactly)

See research §3.2 mermaid. Control order per turn:

1. Budget/timeout check → force final if exceeded  
2. LLM complete (tools schema per capability)  
3. Parse: structured → text-dump → repair  
4. Map provider `finish_reason` via `resolveStopMapping`  
5. **length + calls** → fail calls (error status), nudge, continue (cap 1)  
6. **toolUse + 0 calls** → nudge, continue (cap 1)  
7. **calls > 0** → emit text (if any) → execute tools → feed results → thin-result nudge (cap 1) → continue  
8. **0 calls + promise** → continue (cap 2) with `PROMISE_CONTINUE_NOTE`  
9. **0 calls + real prose** → FINAL  
10. Exhaustion → forced no-tools pass → `AGENT_EXHAUSTION_FALLBACK` if empty  

### 4.3 Capability tiers (OmniRoute-aware)

Extend `services/ai/tools/toolCapability.ts` (or sibling) so **model id**, not “gateway = free,” drives mode:

| Tier | Examples (via OmniRoute model ids) | Mode |
|---|---|---|
| **A structured** | `gpt-*`, `o3*`, `claude*`, `gemini*`, strong Qwen/Kimi | `structured`; prefer `role:tool`; minimal dump parse |
| **B hybrid** | `*:free`, dots-3, GLM flash, hy3 | `hybrid`; dump parse + promise + length + toolUse-zero |
| **C inject_only** | known non-tool tiny models | prompt digests only |

Keep existing regex heuristics; **do not** assume every OmniRoute model is weak.

### 4.4 Streaming policy

| Round type | Transport |
|---|---|
| Tool-bearing turns | **Non-stream** `completeWithTools` (reliable free-model tool JSON) |
| Intermediate voice | Atomic `assistant_text_end` (optionally fake one delta) |
| Final no-tools answer | `emitSimulatedStreaming` now; optional real SSE in Phase 3 |

Rationale (research §3.3 + Phase 3 risk): free upstream tool-call deltas via OmniRoute translator are flaky.

### 4.5 UI transcript rules

**Live:** latest status line (italic secondary) + tool card stack + thinking footer if running.  
**Committed:** discard status lines; tool cards → compact “Used N tools · details” on the assistant bubble (journal + intention).  
**Never:** persist status lines into session storage; never show raw tool JSON bodies.

---

## 5. Free-model repair playbook (priority order)

1. **Text-dump extractors** — XML tags, `dots_function_call`, fences, kwargs, balanced JSON, param→tool inference (`date`→get_day, `query`→search_history).  
2. **Promise anti-stall** — `looksLikeUnfinishedPromise` + cap 2 + keep-alive note.  
3. **Length truncation** — never execute partial args; error status + re-issue note (Pi `failToolCallsFromTruncatedMessage`).  
4. **Arg repair** — aliases (`day`/`when`→`date`, `q`/`term`→`query`), type coercion, drop invalid.  
5. **Dual re-entry** — OpenAI `role:tool` vs plain user block (`preferTextResultProtocol`).

---

## 6. Stop / continue decision table

| Condition | Action | Next |
|---|---|---|
| stop + 0 tools + real prose | finalize | COMPLETE |
| stop + 0 tools + short promise | PROMISE_CONTINUE_NOTE | CONTINUE (≤2) |
| tool_calls + parsed > 0 | execute on-device | CONTINUE |
| length + candidate calls | fail calls, TRUNCATED_TOOL_NOTE | CONTINUE (≤1) |
| tool_use + 0 parsed | TOOLUSE_NO_CALLS_NOTE | CONTINUE (≤1) |
| duplicate executed call | DUPLICATE_TOOL_CALL_NOTE | FORCE_FINAL |
| all results thin | THIN_RESULT_RETRY_NOTE | CONTINUE (≤1) |
| token budget / 45s / 6 rounds | force final pass | FORCE_FINAL |

---

## 7. Implementation phases (executor checklist)

### Phase 0 — Inventory & baseline (required)

- [ ] Read tree; list which of §3 artifacts exist  
- [ ] Run full gates; record red/green in `PROGRESS.md`  
- [ ] If another agent is mid-write on the same files, **coordinate or wait** — do not thrash `agentLoop.ts`

### Phase 1 — Loop correctness (core)

**Files:** `agentEvents.ts`, `agentPromise.ts`, `agentStopReason.ts`, `agentLoop.ts`, `parseTextToolCalls.ts`, `definitions.ts` (policy copy ≤900 chars)

- [ ] Event union matches §4.1 (rename `round_*` → `turn_*` if needed; update tests)  
- [ ] Finality: no tools ∧ ¬promise  
- [ ] length / toolUse-zero / promise / thin / duplicate paths  
- [ ] `intermediateTexts` collected; never returned as sole final if tools ran  
- [ ] `HISTORY_TOOLS_POLICY`: short status OK **only with** tool_calls; never stop on “one sec” alone  

**Tests:** promiseContinue, stopReason, agentPromise, agentStopReason, existing agentLoop suite  

**Gates:** `tsc` + those jest files + `check:design`

### Phase 2 — UI working voice

**Files:** `features/chat/types.ts`, `agentActivity.ts`, `useChatOrchestration.ts`, `AgentToolActivity.tsx`, `ChatMessage.tsx`, `IntentionChatBody.tsx` / `IntentionChatMessage.tsx`

- [ ] `statusLines` ephemeral; ref-synced like toolActivity  
- [ ] Live: status + expanded tool rows (`compact=false` while streaming)  
- [ ] Commit: drop status; tool chip on message (`Message.toolActivity`)  
- [ ] No double TypingIndicator when tools running  
- [ ] Theme tokens only (`ToolStatusColors` / `tool-*`)  

**Tests:** ChatMessage tool cases, AgentToolActivity, orchestration commit-fold  

### Phase 3 — Capability tiers + polish (OmniRoute)

**Files:** `toolCapability.ts`, `toolUiMeta.ts`, telemetry logs

- [ ] Tier A models skip aggressive dump nudge when structured tools work  
- [ ] Telemetry: `agent_promise_continue`, `agent_tooluse_no_calls`, `agent_length_truncate`  
- [ ] `get_conversation` result preview = title/length only (privacy)  
- [ ] Optional: true final-answer SSE (only after A/B live on tier A model)

### Phase 4 — Live E2E (mandatory before “done”)

AGENTS.md rule 7. Clear demo seed first.

**Probes (OmniRoute key in gitignored `.env`):**

1. **Weak model** (default dots-3 / GLM flash):  
   Prompt: “our first conversation tho?” or “what did I write about work last week?”  
   Expect: tools + intermediate status **or** tools + full answer — **never** sole “One sec.” when tools were possible.  
2. **Strong model** (if key routes GPT/Claude/Gemini): same prompt; expect clean structured tool_calls, fewer repairs.

**Deliverable:** paste verbatim timeline (labels, statuses, final prose) into `PROGRESS.md`.

Also: `RUN_INTEGRATION_TESTS=1` on `__tests__/integration/agentPromiseLive.test.ts` and `toolCallingMultiTurnLive.test.ts`.

### Phase 5 — Explicit non-goals (do not implement)

Steer queues, permission UI, judge LLM, subagents, storage of status lines, OpenRouter re-add, cloud memory platform.

---

## 8. Public API contract (no breaks)

- `runAgentTurnWithTools(options)` — same name; additive options (`onActivity`) / result fields only  
- `StreamChatOptions.onAgentActivity` — event union widens  
- `Message.toolActivity` — optional; status lines **not** on Message  
- Storage keys — unchanged  
- Soft-fail listener — required  

---

## 9. Acceptance criteria

1. Premature “One sec.” finals fixed on weak model (unit + live).  
2. Intermediate status visible live; gone after commit; tools remain as chip.  
3. length truncated tools never execute.  
4. toolUse + 0 parsed → continue, not final.  
5. Tier A model path remains structured-first.  
6. `tsc`, targeted jest, `check:design` green.  
7. `PROGRESS.md` has architecture note + live evidence.  
8. Both chat surfaces share one UI component (rule 5).

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Concurrent agent editing same files | Phase 0 inventory; prefer additive commits; don’t rewrite green code |
| Promise false positives | ≤280 chars + dump guard + unit corpus from research |
| OmniRoute 504 / queue | Existing congestion backoff; turn timeout → forced final |
| Streaming tool deltas corrupt | Keep non-stream tool rounds (default) |
| Prompt budget blowup | Keep 24k turn budget + 6 rounds + compact |
| `agentLoop.ts` size | Extract promise/stop/emit modules (already started) |

---

## 11. Suggested work order for the executor (single pass)

```
P0 inventory/gates
 → P1 loop paths + unit tests
 → P2 UI status/chip + component tests
 → P3 capability tiers + telemetry + privacy previews
 → P4 live weak (+ strong if available) + PROGRESS
 → final full targeted jest + tsc + check:design
```

Do **not** start Phase 3 streaming before P1–P2 green.

---

## 12. One-paragraph mental model

Treat every LLM call through **one OpenAI-compatible OmniRoute endpoint** as a **Pi turn**. Show what the model said that turn. If it called tools, run them on the phone and go again. If it only promised to dig, push it once more (capped). If the provider cut off tool JSON, fail those calls and re-ask — never run half-arguments. Strong models on the same gateway should barely notice the repair layer; free models should still finish with a real journal answer. When the turn has no tools and no unfinished promise, that text is the reply — tool cards collapse into a chip and the diary stays clean.

---

## 13. Handoff blurb (paste to implementing agent)

```text
You are implementing Plan v2:
docs/superpowers/plans/2026-09-10-pi-class-agent-harness-PLAN-V2.md

Read that file fully, then:
1. Inventory existing agentPromise/agentStopReason/agentLoop/UI — do not rewrite green modules.
2. Implement missing stop-continue paths from §6 and UI rules from §4.5.
3. Capability tiers are per-model on OmniRoute (not “all free”).
4. Gates: tsc, targeted jest, check:design.
5. Live OmniRoute E2E required before done (AGENTS rule 7); paste verbatim UI timeline to PROGRESS.md.
6. Do not implement steer/permission/judge/subagents/status-line persistence.
Research background: docs/superpowers/plans/research/2026-09-10-pi-class-agent-harness-research.md
```
