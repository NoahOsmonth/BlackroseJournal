# PR8a read-only inventory — tools + loop guards + eager augment

## Production tools (`HISTORY_TOOL_DEFINITIONS` → `runAgentTurnWithTools`)

Verbatim `name` + `description` from `services/ai/tools/definitions.ts`:

1. **get_clock** — `Return the device local date and time. Use to resolve relative day phrases.`
2. **list_recent_days** — `List recent journaling day digests (summaries + topics + session titles). Prefer this before loading full conversations.`
3. **get_day** — `Get the digest for one calendar day: summary, topics, and session ids/titles. Accepts YYYY-MM-DD, today, yesterday, or a weekday name.`
4. **get_conversation** — `Load the full transcript for one past session (journal entry or intention check-in). Prefer get_day first to discover ids.`
5. **search_history** — `Search day digests and local memory for a topic or keyword, optionally within a date range.`
6. **get_identity** — `Read the on-device always-on identity profile (preferred name, pronouns, key people, durable facts). Prefer the injected Identity block when present; call this if you need to re-check after an update.`
7. **update_identity** — `Persist durable identity facts the user clearly stated (preferred name, pronouns, about, key people, hard facts). Secondary to automatic extraction — use when you are sure and want an immediate pin. Do not invent.`

## Agent loop guards (`services/ai/agentLoop.ts`)

| Guard | Value / behavior |
|---|---|
| `MAX_AGENT_TOOL_ROUNDS` | **3** (default `maxRounds`) |
| `AGENT_ROUND_MAX_TOKENS` | **1536** hard cap per non-streaming tool round (`min(settings.maxTokens, 1536)`) |
| Exhaustion | After max rounds with tools still firing → `completeWithoutTools` final pass; telemetry `agent_max_rounds` |
| Tools unsupported | Provider 400/404/422 that looks tool-related → `ToolsUnsupportedError`, mark model unsupported, fall back text-only once mid-loop |
| inject_only capability | `runAgentLoop === false` → empty result, no API tools round |
| Text tool dumps | Optional parse + nudge if dump detected and rounds remain |
| Dedupe | `executedKeys` + `toolCallDedupeKey` skip duplicate tool calls across rounds |
| Invalid calls | `prepareToolCalls` skips invalid; counts `toolsSkippedInvalid` / `toolsRepaired` |

No wall-clock time budget in the loop (only round + max_tokens caps).

## `augmentSystemPromptForTurn` (`services/ai/historyPrefetch.ts`)

Injects (appended to system prompt with `\n\n`) when tools path is enabled:

1. **`buildRetrievedHistoryContext`** — only if `detectHistoryIntent(userText)`:
   - Up to **3** date keys from relative/absolute hints → day digests via `getDayDigest`, or
   - Else last **3** digests from `listDayDigests({ limit: 3 })`, or empty-state stub.
2. **`buildSessionRecallContext`** — session digests / rollups recall (soft-fail offline). Caps inside sessionRecall: `MAX_RECALL_LINES = 5`, `MIN_SIMILARITY = 0.28`.

**Caps:** date keys slice(0, 3); list_recent digests limit 3; session recall max 5 lines. **No char-token budget** on the concatenated eager block itself — full digest text can be large.

## `shouldEnableHistoryTools` branches (auto)

Order: `forced-false` → `forced-true` → bootstrap `[Start…` → `historyIntent` → `length>=80` → `PROACTIVE_RE` → `first-turns` (≤2 user turns & len≥12) → `none`.
