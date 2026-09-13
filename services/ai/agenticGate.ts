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
import type { ToolCapability } from './tools/toolCapability';

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
 * Explicit user tool intent cues: direct mentions of tools, calling tools,
 * inspecting/testing device tools, looking up, pulling up, searching, or fetching.
 */
export const TOOL_CUES_RE =
    /\b(tools?|tool[- ]?calls?|tool[- ]?calling|call(?:ing)?\s+tools?|test(?:ing)?|inspect(?:ing)?|device|look(?:ing)?\s*up|pull(?:ing)?\s*up|search(?:ing)?|fetch(?:ing)?|quer(?:y|ies|ying))\b/i;

/** Short follow-up / affirmation / continuation words from the user. */
export const FOLLOW_UP_RE =
    /^(hmm\s*)?(sure|yes|yeah|yep|yup|ok|okay|k|go ahead|do it|please|tell me more|more|what else|what about|continue|keep going|and\??|why\??|how\??|what was it\??|who\??|which one\??|done\??|show me|let'?s see)\b/i;

/** Text patterns in assistant messages indicating tools or inspection were active/offered. */
const ASSISTANT_TOOL_CONTEXT_RE =
    /\b(look(?:ed|ing)?\s+(?:through|at|in|into|up)|check(?:ed|ing)?|on\s+(?:the\s+)?device|tools?|let\s+me\s+check|search(?:ed|ing)?|pull(?:ed|ing)?\s+up|found(?:\s+\d+)?|in\s+your\s+(?:past|first|earlier|previous|old)?\s*(?:entries|journal|history|conversations?|chats?)|according\s+to\s+your\s+(?:past|first|earlier|previous|old)?\s*(?:entries|journal|history|conversations?|chats?)|recall(?:ed|ing)?)\b/i;

const TRIVIAL_GREETING_RE =
    /^(hi|hello|hey|greetings|howdy|good (morning|afternoon|evening)|sup|yo)[.!?\s]*$/i;

export function isTrivialGreeting(text: string): boolean {
    return TRIVIAL_GREETING_RE.test(text.trim());
}

/**
 * Checks whether prior turns in the conversation utilized or offered tools.
 * Excludes the latest message turn being evaluated.
 */
export function hasPriorToolContext(messages: readonly Message[]): boolean {
    if (!messages || messages.length < 2) return false;
    const prior = messages.slice(0, -1);
    for (let i = prior.length - 1; i >= 0; i -= 1) {
        const m = prior[i];
        if (m.role === 'assistant') {
            if (Array.isArray(m.toolActivity) && m.toolActivity.length > 0) {
                return true;
            }
            if (ASSISTANT_TOOL_CONTEXT_RE.test(m.content)) {
                return true;
            }
        } else if (m.role === 'user') {
            if (detectHistoryIntent(m.content) || TOOL_CUES_RE.test(m.content)) {
                return true;
            }
        }
    }
    return false;
}

/** Long-term-memory cues: the recall_memory + search_history subset serves these. */
const LONG_TERM_RECALL_RE =
    /\b(remember when|recall|back then|used to|long ago|old (times|days|pattern)|childhood|years ago|first (told|mentioned|wrote|talked|met|chat|conversation|entry|session))\b/i;

/** Identity cues: the get/update_identity subset serves these. */
export const IDENTITY_CUE_RE =
    /\b(call me|my name|i go by|my pronouns|about me|who am i)\b/i;

/** Goal-task cues: the goals-tools subset serves these. */
const GOAL_TASK_RE =
    /\b(goal|habit|track|streak|routine|resolution)\b/i;

/** Offline file-memory tools (no embeddings, AsyncStorage-backed). */
const MEMORY_FILE_TOOLS = [
    'memory_search',
    'memory_list',
    'memory_get',
    'memory_overview',
    'memory_flush',
    'memory_dream',
] as const;

/** Full history-tool catalog, in registry order. */
const ALL_HISTORY_TOOL_NAMES = [
    'get_clock',
    'list_recent_days',
    'get_day',
    'get_conversation',
    'search_history',
    ...MEMORY_FILE_TOOLS,
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
    // Offline-first: file memories ride along with digests.
    'memory_search',
    'memory_list',
] as const;

/** Memory-bank cues: staged/dream/consolidation/thread requests serve the file-memory tools. */
const MEMORY_CUE_RE =
    /\b(memor(?:y|ies)|staged?|dream(?:ing|s)?|consolidat\w*|threads?|forgot(?:ten)?|forget)\b/i;

export interface ToolShortlist {
    /** Tool names to send as specs this turn (subset retrieval, ToolFace-style). */
    names: readonly string[];
    /** Which shortlist branch fired (telemetry / prompt-budget). */
    branch: 'remember-when' | 'history-days' | 'goal-task' | 'identity' | 'memory' | 'all-fallback';
}

/**
 * Which shouldEnableHistoryTools arm fired (instrumentation / prompt-budget).
 * Mirrors the boolean gate exactly — first matching branch wins.
 */
export function resolveHistoryToolsBranch(
    flag: StreamChatOptions['enableHistoryTools'],
    userText: string,
    messages: readonly Message[],
    capability?: ToolCapability | null,
): HistoryToolsBranch {
    if (flag === false) return 'forced-false';
    if (flag === true) return 'forced-true';
    const trimmed = userText.trim();
    if (BOOTSTRAP_TRIGGER_RE.test(trimmed)) return 'bootstrap';
    if (detectHistoryIntent(trimmed)) return 'historyIntent';
    if (trimmed.length >= 6 && AGENTIC_TASK_RE.test(trimmed)) return 'agentic-task';
    if (IDENTITY_CUE_RE.test(trimmed)) return 'agentic-task';
    if (TOOL_CUES_RE.test(trimmed)) return 'tool-cue';
    if (hasPriorToolContext(messages) && !isTrivialGreeting(trimmed)) {
        return 'conversation-followup';
    }
    if (trimmed.length >= 80) return 'length>=80';
    if (PROACTIVE_TOOL_RE.test(trimmed)) return 'PROACTIVE_RE';
    const userTurns = messages.filter((m) => m.role === 'user').length;
    if (userTurns <= 2 && trimmed.length >= 12) return 'first-turns';
    if (
        (capability?.mode === 'structured' || (capability?.mode as string) === 'native')
        && !isTrivialGreeting(trimmed)
    ) {
        return 'native-capable';
    }
    return 'none';
}

export function shouldEnableHistoryTools(
    flag: StreamChatOptions['enableHistoryTools'],
    userText: string,
    messages: readonly Message[],
    capability?: ToolCapability | null,
): boolean {
    const branch = resolveHistoryToolsBranch(flag, userText, messages, capability);
    return branch !== 'forced-false' && branch !== 'bootstrap' && branch !== 'none';
}

/**
 * Per-turn tool shortlist: send only the specs the turn plausibly needs.
 * Unions every matching subset so combined intents ("call me Maya, remember
 * that") keep both tools; unknown turns fall back to the full catalog.
 * get_clock rides along in every narrowed shortlist (chains start with it).
 */
export function selectToolShortlist(
    userText: string,
    messages?: readonly Message[]
): ToolShortlist {
    const text = userText.trim();
    const names = new Set<string>();
    const branches: ToolShortlist['branch'][] = [];

    if (LONG_TERM_RECALL_RE.test(text)) {
        for (const name of ['get_clock', 'memory_search', 'recall_memory', 'search_history', 'list_recent_days', 'get_day', 'get_conversation']) {
            names.add(name);
        }
        branches.push('remember-when');
    }
    if (MEMORY_CUE_RE.test(text)) {
        names.add('get_clock');
        for (const name of MEMORY_FILE_TOOLS) names.add(name);
        branches.push('memory');
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
    if (TOOL_CUES_RE.test(text)) {
        for (const name of ALL_HISTORY_TOOL_NAMES) names.add(name);
        branches.push('all-fallback');
    }

    if (names.size === 0) {
        if (messages && messages.length > 0) {
            for (let i = messages.length - 1; i >= 0; i -= 1) {
                const m = messages[i];
                if (m.role === 'user' && m.content !== userText) {
                    const prior = selectToolShortlist(m.content);
                    if (prior.branch !== 'all-fallback') {
                        return prior;
                    }
                }
            }
        }
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
