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

/** Long-term-memory cues: the recall_memory + search_history subset serves these. */
const LONG_TERM_RECALL_RE =
    /\b(remember when|recall|back then|used to|long ago|old (times|days|pattern)|childhood|years ago|first (told|mentioned|wrote|talked|met))\b/i;

/** Identity cues: the get/update_identity subset serves these. */
const IDENTITY_CUE_RE =
    /\b(call me|my name|i go by|my pronouns|about me|who am i)\b/i;

/** Goal-task cues: the goals-tools subset serves these. */
const GOAL_TASK_RE =
    /\b(goal|habit|track|streak|routine|resolution)\b/i;

/** Full history-tool catalog, in registry order. */
const ALL_HISTORY_TOOL_NAMES = [
    'get_clock',
    'list_recent_days',
    'get_day',
    'get_conversation',
    'search_history',
    'recall_memory',
    'get_identity',
    'update_identity',
    'list_goals',
    'create_goal',
] as const;

const DAY_TOOLS = [
    'get_clock',
    'list_recent_days',
    'get_day',
    'get_conversation',
    'search_history',
] as const;

export interface ToolShortlist {
    /** Tool names to send as specs this turn (subset retrieval, ToolFace-style). */
    names: readonly string[];
    /** Which shortlist branch fired (telemetry / prompt-budget). */
    branch: 'remember-when' | 'history-days' | 'goal-task' | 'identity' | 'all-fallback';
}

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
 * Per-turn tool shortlist: send only the specs the turn plausibly needs.
 * Unions every matching subset so combined intents ("call me Maya, remember
 * that") keep both tools; unknown turns fall back to the full catalog.
 * get_clock rides along in every narrowed shortlist (chains start with it).
 */
export function selectToolShortlist(userText: string): ToolShortlist {
    const text = userText.trim();
    const names = new Set<string>();
    const branches: ToolShortlist['branch'][] = [];

    if (LONG_TERM_RECALL_RE.test(text)) {
        for (const name of ['get_clock', 'recall_memory', 'search_history', 'list_recent_days', 'get_day', 'get_conversation']) {
            names.add(name);
        }
        branches.push('remember-when');
    }
    if (detectHistoryIntent(text)) {
        for (const name of DAY_TOOLS) names.add(name);
        branches.push('history-days');
    }
    if (GOAL_TASK_RE.test(text)) {
        for (const name of ['get_clock', 'list_goals', 'create_goal']) names.add(name);
        branches.push('goal-task');
    }
    if (IDENTITY_CUE_RE.test(text)) {
        for (const name of ['get_clock', 'get_identity', 'update_identity']) names.add(name);
        branches.push('identity');
    }

    if (names.size === 0) {
        return { names: [...ALL_HISTORY_TOOL_NAMES], branch: 'all-fallback' };
    }
    return { names: [...names], branch: branches[0] ?? 'all-fallback' };
}

/**
 * Context-aware agent-loop turn budget: half the resolved model context window,
 * floored at 12_000 tokens (protects small windows) and capped at `cap`
 * (AGENT_TURN_TOKEN_BUDGET in agentLoop.ts).
 */
export function resolveAgentTurnTokenBudget(contextWindow: number, cap: number): number {
    return Math.min(cap, Math.max(12_000, Math.floor(contextWindow * 0.5)));
}
