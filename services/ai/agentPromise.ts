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
 * Verb-first or future-first status lines. Deliberately narrow: "let me know",
 * "hold on to that thought", "I'll remember that" do NOT match.
 */
const PROMISE_PATTERN =
    /\b(one sec(ond)?|give me a (sec|moment)|hold on(?! to\b)|brb|let me (actually |just |go )?(dig|search|check|look|read|find|recall)|i('| wi)ll (now )?(dig|search|check|look|read|recall)|still (looking|searching|checking)|digging deeper|going deeper)\b/i;

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
        return PROMISE_PATTERN.test(text);
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
    + 'Either call the tools you need now (structured tool_calls), then wrap with a complete '
    + 'answer in a later turn — or if you are truly done, give the full final answer now '
    + '(substance, not "one sec"). Never invent tool results.';

/**
 * Injected when the promise cap is spent and the forced no-tools pass runs:
 * the status line must not survive as the answer.
 */
export const PROMISE_STOP_NOTE =
    'System note: stop looking. Answer the user now with what you already have. '
    + 'A complete reply — never a status line like "one sec" or "let me check".';
