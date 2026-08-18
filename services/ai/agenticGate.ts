/**
 * Task-intent gating for the proactive agent loop, plus context-aware
 * turn-token budgeting for streamChat.
 *
 * Pure module: no I/O, no hooks, no side effects. The only runtime dependency
 * is detectHistoryIntent from './historyPrefetch', which is itself a pure regex
 * check — required to keep resolveHistoryToolsBranch behavior identical to the
 * previous home in ai.ts. Everything else imports type-only.
 */

import { detectHistoryIntent } from './historyPrefetch';
import type { Message, StreamChatOptions } from './chatTypes';
import type { HistoryToolsBranch } from './promptBudget';

/** Proactive tool triggers beyond pure history Q&A (rants, first turns, night cues). */
const PROACTIVE_TOOL_RE =
    /\b(tired|exhausted|can'?t sleep|insomnia|night|tonight|this morning|today|work|boss|always|never|again|spiral|anxious|anxiety|overwhelmed|rant|finally|anyway)\b/i;

export function latestUserText(messages: Message[]): string {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'user') return messages[i].content;
    }
    return '';
}

/** Synthetic bootstrap lines used to start guided chats — not real user text. */
const BOOTSTRAP_TRIGGER_RE = /^\[Start\b/i;

/**
 * Task-intent verbs + goal/habit words: when the user asks the assistant to
 * create, plan, track, or change something, the agent loop should fire.
 */
export const AGENTIC_TASK_RE =
    /\b(create|add|set up|set|make|plan|goal|habit|track|remind|remember|start|stop|save|write|update|change|schedule|organize|prepare)\b/i;

/**
 * Which shouldEnableHistoryTools arm fired (instrumentation / prompt-budget).
 * Mirrors the boolean gate exactly — first matching branch wins.
 */
export function resolveHistoryToolsBranch(
    flag: StreamChatOptions['enableHistoryTools'],
    userText: string,
    messages: readonly Message[],
): HistoryToolsBranch {
    if (flag === false) return 'forced-false';
    if (flag === true) return 'forced-true';
    const trimmed = userText.trim();
    if (BOOTSTRAP_TRIGGER_RE.test(trimmed)) return 'bootstrap';
    if (detectHistoryIntent(trimmed)) return 'historyIntent';
    if (trimmed.length >= 6 && AGENTIC_TASK_RE.test(trimmed)) return 'agentic-task';
    if (trimmed.length >= 80) return 'length>=80';
    if (PROACTIVE_TOOL_RE.test(trimmed)) return 'PROACTIVE_RE';
    const userTurns = messages.filter((m) => m.role === 'user').length;
    if (userTurns <= 2 && trimmed.length >= 12) return 'first-turns';
    return 'none';
}

export function shouldEnableHistoryTools(
    flag: StreamChatOptions['enableHistoryTools'],
    userText: string,
    messages: readonly Message[]
): boolean {
    const branch = resolveHistoryToolsBranch(flag, userText, messages);
    return branch !== 'forced-false' && branch !== 'bootstrap' && branch !== 'none';
}

/**
 * Context-aware agent-loop turn budget: half the resolved model context window,
 * floored at 12_000 tokens (protects small windows) and capped at `cap`
 * (AGENT_TURN_TOKEN_BUDGET in agentLoop.ts).
 */
export function resolveAgentTurnTokenBudget(contextWindow: number, cap: number): number {
    return Math.min(cap, Math.max(12_000, Math.floor(contextWindow * 0.5)));
}
