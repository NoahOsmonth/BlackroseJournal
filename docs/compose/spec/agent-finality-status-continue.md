---
feature: agent-finality-status-continue
status: delivered
updated: 2026-09-10
branch: main
commits: (working tree — not yet committed)
---

# Agent Finality: Status-Only Continue (Structural + Prompt + Regex)

## Report

**What was built** — Status lines like “Let me pull that up for you.” no longer finalize the turn. `looksLikeUnfinishedPromise` uses a wider phrase list plus structural `looksLikeStatusOnlyReply` (≤120 chars; “let me know” excluded). Promise continue sets `tool_choice: 'required'` on the next round (400/422 soft-fail → auto). Policy + note require get_day→get_conversation for past chats, not only get_clock.

**Verification** — `tsc --noEmit` clean; 6 suites / 50 tests pass; `check:design` pass. Live OmniRoute E2E not run this session.

**Journey log**
1. Promise regex is invented (not Pi); industry stop is structural no-tool_calls.
2. Broad “let me” status false-positived social “let me know” — require a work verb.
3. Policy shorten dropped test-pinned curiosity phrases — restored under 900 chars.
4. `tool_choice: 'required'` needed transport type widening.

## [S1] Problem

Free models on OmniRoute still ship status lines as the user-facing reply:

- “Let me pull that up for you.” — **missed** by `PROMISE_PATTERN` (`pull` not in list) → committed as a chat bubble.
- Next user push → model only ran `get_clock`; clock output leaked into the transcript as if it were the answer.

Root cause: finality is regex-only and too narrow. Industry harnesses (Pi, LangGraph, Vercel) stop **structurally** (no tool_calls); they do not rely on status-line regex. Ours is a free-model patch and must stay, but needs **structural short-status continue**, **tool_choice pressure**, and a **wider phrase corpus** from real traces.

## [S2] Design

### S2.1 Promise / status detection (widen + structural)

Keep `looksLikeUnfinishedPromise` as the public API. Expand `PROMISE_PATTERN` with real phrases from live traces:

- `pull (that|it|this) (up|out|for you)`
- `get (that|it|this) (for you|up|out)`
- `fetch (that|it|this|the entry|the conversation)`
- `one moment`
- `coming (right )?up`
- `just a (sec|moment)`
- `let me (pull|get|fetch|grab|open)`
- existing: one sec / let me dig|search|check|look / still looking / digging deeper / hold on(?! to)

Add **structural** helper (exported, pure):

```ts
export function looksLikeStatusOnlyReply(raw: string): boolean
```

True when **all** hold:

1. Length ≤ 120 chars (tighter than promise max 280).
2. Not a tool dump.
3. No multi-clause “answer shape”: fewer than 2 sentence-final periods **or** no long mid-text (not a journal answer).
4. Matches an **intent-to-act** opener/verb: `^(let me|i'?ll|i will|just |one |hold on|coming|sure[, ]|ok[, ])` **or** contains pull/get/fetch/open + (that|it|this|up|the entry|the conversation|your).

`looksLikeUnfinishedPromise` becomes: regex **OR** (status-only **and** intent-to-act). Never throws.

### S2.2 Loop continue (already wired) + tool_choice pressure

On promise continue (existing branch in `agentLoop.ts` ~872–890):

1. Keep `PROMISE_CONTINUE_NOTE` (tighten wording: if the user asked for a past entry/conversation, **must** call `get_conversation` / `get_day` — never only `get_clock`).
2. Set `forceToolsNextRound = true` for the **next** `completeWithTools` call.
3. `completeWithTools(..., { toolChoice: 'required' })` when flag set.
4. Soft-fail: if provider 400/422 on `tool_choice: required`, retry once with `'auto'` and clear the flag (do **not** `markToolsUnsupported` solely for that).

`forceToolsNextRound` clears after that one round.

### S2.3 Prompt (HISTORY_TOOLS_POLICY)

Amend STOP / decision line (stay **&lt; 900 chars**, keep test gate):

- Status text is OK only in the **same turn** as `tool_calls`.
- Never end a turn on “let me pull that up” / “one sec” alone.
- “Whole conversation” / “first chat” → `get_day` then `get_conversation` — not only `get_clock`.

### S2.4 Out of scope

- Stop-hook / second LLM judge.
- Steer queues.
- Persisting status lines.
- Rewriting agentLoop event union.

## [S3] Out of Scope

See S2.4. No storage schema changes. No UI redesign (status lines already ephemeral).

## Tasks

- [x] T1: Widen `PROMISE_PATTERN` + add `looksLikeStatusOnlyReply` in `services/ai/agentPromise.ts` — acceptance: unit cases include “Let me pull that up for you.” = true; “Let me know how today goes.” = false; long answers = false (covers: S2.1)
- [x] T2: Wire `forceToolsNextRound` + `tool_choice: required` soft-fail in `agentLoop.ts` / `completeWithTools` — acceptance: promise continue path issues required once; 400 falls back to auto without tools-unsupported (covers: S2.2; depends: T1)
- [x] T3: Update `PROMISE_CONTINUE_NOTE` + `HISTORY_TOOLS_POLICY` — acceptance: historyTools test still &lt;900 and contains new stop language (covers: S2.3)
- [x] T4: Unit tests — acceptance: `agentPromise.test.ts` + `agentLoop.promiseContinue.test.ts` green; no regression in stopReason suite (covers: S2.1, S2.2)
- [x] T5: Gates — acceptance: `npx tsc --noEmit`, targeted jest, `npm run check:design` clean (covers: S2)
