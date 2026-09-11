/**
 * Unfinished-promise detection for the agent loop (Pi keep-alive).
 *
 * Free models love to end a turn on a status line ("Let me actually go dig.
 * One sec.") and never come back with the answer. Shipping that as the final
 * reply is the single worst UX failure of the harness, so the loop treats a
 * short promise-only message as "not final" and runs another turn.
 *
 * Pure + exported: tune the pattern against real gateway traces.
 */

import { looksLikeToolDump } from './tools/parseTextToolCalls';

/**
 * A promise is only credible in a short message. Long answers that merely
 * mention a search in passing ("I searched last week and found…") must never
 * be re-run.
 */
export const PROMISE_TEXT_MAX_LENGTH = 280;

/** How many promise-continuations one agent turn may spend. */
export const PROMISE_CONTINUATION_MAX = 2;

/**
 * Verb-first or future-first status lines. Includes live free-model traces
 * ("Let me pull that up for you.") that a dig/check-only list misses.
 * Still excludes "let me know" / "hold on to that thought".
 */
const PROMISE_PATTERN =
    /\b(one sec(ond)?|give me a (sec|moment)|one moment|just a (sec|moment)|coming (right )?up|hold on(?! to\b)|brb|let me (actually |just |go |now )?(dig|search|check|look|read|find|recall|pull|get|fetch|grab|open)|i('| wi)ll (now )?(dig|search|check|look|read|recall|pull|get|fetch)|still (looking|searching|checking)|digging deeper|going deeper|pull (that|it|this) (up|out|for you)|get (that|it|this) (for you|up|out)|fetch (that|it|this|the entry|the conversation))\b/i;

/** Short working-status shape: opener + optional intent verb (structural gate). */
const STATUS_OPENER_RE =
    /^(let me|i'?ll|i will|just |one |hold on|coming|sure[, ]|ok[, ]|okay[, ])/i;
const INTENT_FETCH_RE =
    /\b(pull|get|fetch|grab|open)\b.*\b(that|it|this|up|out|the entry|the conversation|your)\b/i;

/** Shorter than a promise: status-only replies are tiny, not journal answers. */
export const STATUS_ONLY_MAX_LENGTH = 120;

/**
 * Structural short-status detector (industry-aligned: don't ship "I'll look"
 * as the answer). True for ≤120-char working lines with an intent-to-act
 * shape — catches phrases the regex list will always miss.
 */
export function looksLikeStatusOnlyReply(raw: string): boolean {
    try {
        const text = (raw ?? '').trim();
        if (!text || text.length > STATUS_ONLY_MAX_LENGTH) return false;
        if (looksLikeToolDump(text)) return false;
        // Social "let me know" / "hold on to that" are not working status.
        if (/\blet me know\b|\bhold on to\b/i.test(text)) return false;
        // Multi-clause answers ("Yeah I remember. September 1st — …") are never status.
        const sentenceEnds = (text.match(/[.!?]/g) ?? []).length;
        if (sentenceEnds >= 3 && text.length > 80) return false;
        // Bare "let me" needs a fetch/work verb — "Let me know how today goes." is social.
        if (/^let me\b/i.test(text)) {
            return /\b(let me)\s+(actually\s+|just\s+|go\s+|now\s+)?(dig|search|check|look|read|find|recall|pull|get|fetch|grab|open)\b/i.test(text);
        }
        return STATUS_OPENER_RE.test(text) || INTENT_FETCH_RE.test(text);
    } catch {
        return false;
    }
}

/**
 * True when the cleaned text is plausibly a "I'm still working" status line
 * rather than a real answer. Never throws — the loop must not die on this.
 */
export function looksLikeUnfinishedPromise(raw: string): boolean {
    try {
        const text = (raw ?? '').trim();
        if (!text || text.length > PROMISE_TEXT_MAX_LENGTH) return false;
        // Tool syntax is handled by the dump path, not by the promise path.
        if (looksLikeToolDump(text)) return false;
        if (PROMISE_PATTERN.test(text)) return true;
        return looksLikeStatusOnlyReply(text);
    } catch {
        return false;
    }
}

/**
 * Injected once per promise streak: the model said it would keep looking, so
 * make it either actually call tools or actually answer.
 */
export const PROMISE_CONTINUE_NOTE =
    'System note: You said you would keep looking. Do not stop on a status line. '
    + 'Call the tools you need now (structured tool_calls). For a past chat/entry: get_day '
    + 'then get_conversation — not only get_clock. Then wrap with a complete answer, or if '
    + 'you are truly done, answer fully now (substance, not "one sec"). Never invent results.';

/**
 * Injected when the promise cap is spent and the forced no-tools pass runs:
 * the status line must not survive as the answer.
 */
export const PROMISE_STOP_NOTE =
    'System note: stop looking. Answer the user now with what you already have. '
    + 'A complete reply — never a status line like "one sec" or "let me check".';
