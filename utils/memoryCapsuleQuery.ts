/**
 * Memory capsule retrieval query helpers.
 *
 * Identity lives in a separate always-on block; this only ranks episodic /
 * semantic atoms. Empty query starves the lexical weight (0.44), so freeform
 * chat should prefer the latest real user message over a continued-entry title.
 */

const SYNTHETIC_BOOTSTRAP_RE = /^\[Start\b/i;

/** Cap so ranking stays cheap if the user pasted a long rant. */
export const MEMORY_CAPSULE_QUERY_MAX_CHARS = 400;

export interface MemoryCapsuleQueryMessage {
    role: string;
    content: string;
}

/**
 * Latest non-bootstrap user message text, trimmed and length-capped.
 * Returns undefined when the session has no real user input yet.
 */
export function latestUserMemoryQuery(
    messages: readonly MemoryCapsuleQueryMessage[],
    maxChars = MEMORY_CAPSULE_QUERY_MAX_CHARS,
): string | undefined {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const msg = messages[i];
        if (msg.role !== 'user') continue;
        const text = msg.content.trim();
        if (!text || SYNTHETIC_BOOTSTRAP_RE.test(text)) continue;
        return text.length > maxChars ? text.slice(0, maxChars).trim() : text;
    }
    return undefined;
}

/**
 * Prefer live session text; fall back to continue-mode entry title.
 */
export function resolveMemoryCapsuleQuery(options: {
    latestUserText?: string | null;
    continuedTitle?: string | null;
}): string | undefined {
    const live = options.latestUserText?.trim();
    if (live) return live;
    const title = options.continuedTitle?.trim();
    return title || undefined;
}
