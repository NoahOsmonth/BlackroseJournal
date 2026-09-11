# ADDENDUM — Pi-style agent loop (research after plan v1)

**For:** agent currently executing `2026-09-10-pi-style-agent-loop.md`  
**Status:** advisory — merge into implementation if not already done  
**Sources:** Pi `@earendil-works/pi` types + agent-loop, OpenHands SDK goal/judge, LangGraph stream modes

---

## A. Plan is mostly enough — these 6 gaps are real

### A1. `length` stop = do not execute truncated tool calls (HIGH)

Pi `AssistantMessage.stopReason` includes `"length"`. Their loop:

> A "length" stop means the output was cut off by the token limit, so every tool call in the message may carry truncated arguments. Fail them all instead of executing potentially borked calls.

**Implement:** if provider `finish_reason === 'length'` (or equivalent) **and** tool calls were extracted, do **not** run them. Emit `tool_call_start` + `tool_call_end` with `status: 'error'` and resultPreview like `truncated by max_tokens — re-issue`. Then continue the loop once (same as Pi). Prevents `get_day` with `{"date":"yester` garbage.

### A2. `finish_reason === 'toolUse'` but 0 parsed tools (HIGH)

If the provider says the turn ended for tools, but structured parse + text-dump parse yield **zero** calls, **do not treat as final**. That is the GLM “narrated a plan then stopped” shape or a dump we failed to parse.

**Implement:** continue with a nudge (reuse thin-result / TEXT_TOOL_NUDGE / promise note) unless max rounds. Log `agent_tooluse_no_calls`.

### A3. Promise continue should bias tools, not only chat (MEDIUM)

On promise continuation, besides the system note, if `capability.sendToolsInApi`:

- Prefer keeping `tool_choice: 'auto'`.
- Optional: once after first promise, send `tool_choice: 'required'` if the gateway accepts it; **soft-fail** if 400 → fall back to `auto` (do not mark tools unsupported).

At minimum the **note must demand tool_calls or a complete answer** — already in plan §1.4; do not weaken it.

### A4. One assistant message can hold text **and** toolCalls (MEDIUM — confirm)

Pi content is a **block array**:

```ts
content: (TextContent | ThinkingContent | ToolCall)[]
```

Same turn: “Let me check yesterday.” + `get_day` toolCall. UI order: **text first, then tools** (already in plan). Do **not** discard text when tools exist; do **not** ship that text as the final user answer if tools ran — it is intermediate status.

### A5. Map provider `finish_reason` → internal stop (MEDIUM)

| Provider | Internal |
|---|---|
| `stop` / empty | `stop` (candidate final) |
| `tool_calls` / `toolUse` | tools expected |
| `length` | truncated — fail tool args, continue |
| `content_filter` / error | soft-fail → final no-tools or stream fallback |

Store on `AgentLoopResult` as `providerStopReason?: string` for telemetry.

### A6. Optional later — external “is it done?” (LOW for journal)

OpenHands `run_goal` uses a **judge LLM** after each run. Claude Code uses **Stop hooks**.  
**Do not implement in P1/P2.** Only if promise heuristic fails on live GLM. Journal tools already return evidence; a second LLM judge is cost + latency.

---

## B. Patterns confirmed by other harnesses

| Harness | Pattern we keep |
|---|---|
| **Pi** | Turn = stream message → tools → next turn. Final = no toolCalls. Intermediate text is normal. `steer`/follow-up queues optional later. |
| **OpenHands** | Action → Observation → LLM again. Events streamed to UI (`oh_event`). Goal/judge only for verifiable tasks. |
| **LangGraph** | Separate channels: `messages` (text tokens) vs `tools` (`on_tool_start/end`). UI shows both concurrently. |

Our dual `assistant_text_*` + `tool_call_*` events match LangGraph/Pi. Good.

---

## C. GLM 5.3 flash / free OmniRoute notes

1. Often returns **text-only** “let me dig” with `finish_reason: stop` — promise detector is the right fix (plan §1.3).
2. May put tool dumps in `content` instead of `tool_calls` — keep `parseTextToolDumps`.
3. `reasoning_content` is not user-facing intermediate chat; only stream it if you already do (ChatMessage reasoning). Do not treat reasoning as the final answer.
4. Budget: promise continues cost an extra non-stream round — keep `PROMISE_CONTINUATION_MAX = 2`.

---

## D. Suggested telemetry lines (add if missing)

```
agent_promise_continue { round, promiseContinuations }
agent_tooluse_no_calls { round }
agent_length_truncate { round, callCount }
```

---

## E. Paste-ready handoff for the executing agent

```text
HANDOFF ADDENDUM — merge into docs/superpowers/plans/2026-09-10-pi-style-agent-loop.md while implementing.

Do not restart from scratch. After (or while) Phase 1, ensure these behaviors:

1. LENGTH TRUNCATION
   If provider finish_reason is "length" (or body indicates max_tokens cut) AND tool calls
   were parsed: do NOT execute them. Emit tool_call_end status=error with a short
   "arguments truncated — re-issue" preview. Continue the loop once. (Pi agent-loop does this.)

2. TOOLUSE + ZERO PARSED CALLS
   If finish_reason indicates tool use but structured+text parse yield 0 calls, do NOT
   finalize. Inject nudge, continue if budget/rounds remain. Telemetry: agent_tooluse_no_calls.

3. MIXED TEXT + TOOLS
   When cleaned assistant text is non-empty AND tool calls exist: emit assistant_text_*
   THEN tool_call_*. Never return that text as the final user answer if tools ran this turn.
   Collect it in AgentLoopResult.intermediateTexts.

4. PROMISE CONTINUE (already in plan)
   looksLikeUnfinishedPromise + PROMISE_CONTINUATION_MAX=2 + PROMISE_CONTINUE_NOTE.
   On continue: clear any "about to return final" path; emit follow_up_injected.
   Optional: try tool_choice:"required" once; soft-fail 400 → tool_choice:"auto".

5. STOP MAPPING
   Record providerStopReason on AgentLoopResult for tests/telemetry.
   stop/toolUse/length must not share the same finalize branch blindly.

6. UI (Phase 2)
   Status lines are ephemeral — do not persist on Message. Tool chip on committed message stays.

7. DO NOT implement in this pass
   OpenHands-style judge LLM, Claude Stop hooks, Pi steer queues, per-turn SSE (unless Phase 3).

8. GATES
   npx tsc --noEmit
   npx jest --runInBand __tests__/services/ai/agentLoop __tests__/services/ai/agentLoop.promiseContinue.test.ts
   npm run check:design
   Live OmniRoute probe before calling Phase 1 done (AGENTS.md rule 7).

Reference:
- Pi length handling: packages/agent/src/agent-loop.ts failToolCallsFromTruncatedMessage
- Pi content blocks: packages/ai/src/types.ts AssistantMessage.content
- LangGraph dual stream: messages + tools channels
```

---

## F. Is the plan enough?

| Layer | Verdict |
|---|---|
| Loop control / finality | **Yes** with A1–A2 |
| Intermediate UI | **Yes** (P2) |
| Free-model resilience | **Yes** if dumps + promise + A2 stay |
| True token streaming | Deferred P3 — fine |
| Judge/Stop hooks | Optional later — fine to skip |
| Storage / Hindsight | Correctly out of scope |

**Bottom line:** plan v1 is the right architecture. Ship A1–A3 before calling the loop “Pi-like”; A4–A5 are correctness polish; A6 is product polish.
