# J-Space Workspace Ledger

## Goal
Remove app-side embeddings stack from BlackroseJournal (keep hindsight/Voyage server-side untouched)

## Core
- Two live entries: (a) the agentic upgrade contract — MAX_AGENT_TOOL_ROUNDS=6, AGENT_TURN_TOKEN_BUDGET=24_000, AGENT_TURN_TIMEOUT_MS=45_000, one-shot THIN_RESULT_RETRY_NOTE, resolveAgentTurnTokenBudget=min(cap, max(12k, floor(ctx*0.5))); (b) Voyage embeddings — OpenAI-compatible provider, base URL api.voyageai.com/v1, voyage-4-lite, 1024 dims auto-detected, never set OPENAI_DIMENSIONS, volume reset on embedding-space switch. LLM is OpenRouter dots-3-note-preview:free, never Gemini.
- Parallel dispatch (user directive "maximize subagent"): 3 disjoint agents (agentLoop core / goals tools / gating), each read j-space SKILL.md + did the loop pass with in-conversation ledger; I orchestrated, merged, gated, committed.

## Verified
- ✓01 Three subagents returned: agentLoop suite 21/21, goalsTools|toolSchemaPin 10/10 + validateToolCalls 12/12, agenticGate 12/12 + chatPayload|promptBudget 16/16 — verified by: agent reports with verbatim jest output
- ✓02 Full gates green after merge: `npm test` 899 passed / 0 failed / 26 skipped (201 suites); `npx tsc --noEmit` clean; `npm run lint` 0 errors (pre-existing warnings only); `npm run check:design` clean — verified by: my own gate runs
- ✓03 Retry nudge sabotage-verified: isThinToolResult always-false -> 3 retry tests RED; restore -> 4/4 GREEN — verified by: jest runs with real output
- ✓04 Voyage end-to-end earlier in session: volume reset, redeploy health 200 in 24s, dim 1024 auto-detected, 5 facts re-retained, recall probes PASS (app shape 968ms, Meridian final=1.0866), simulated full-loop answered "You named your compass **Meridian**" — verified by: /tmp probes
- ✓05 Committed + pushed: b6ffcae (voyage + recall wiring), 9dfc6ec (agentic upgrade), plus 3172c01 (CORS shim); origin/main updated — verified by: git log/push output

## Open
- Browser E2E under Voyage — BLOCKED on detached ZCode in-app browser pane; needs the pane reopened/restarted at host level (browser guest not attached). Then re-run retain/recall/full-loop UI probes with verbatim replies; also exercise the new agentic path ("add a goal…", thin-result retry) live.

## Next
delegate removal to subagent
