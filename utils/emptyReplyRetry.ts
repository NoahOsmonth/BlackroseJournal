/**
 * What to do when the AI finishes a turn with no words (Kaneo #50).
 *
 * A reasoning-only model can spend a whole reply thinking and then produce no
 * answer. DEF-032 made that visible with a plain sentence; this decides whether
 * to try once more before showing it.
 *
 * The order is deliberate and cheap-first:
 *   1. Retry once with tools turned off. Tool-calling is the most common cause
 *      of a turn that ends in syntax or silence, and it costs no extra setup.
 *   2. If a fallback AI option is configured, try that once. Someone who listed
 *      a backup did so for exactly this reason.
 *   3. Otherwise give up and show the plain sentence.
 *
 * Pure — the caller performs the attempts. That keeps every branch testable
 * without a network.
 */

export type EmptyReplyStep =
    | { readonly kind: 'retry-without-tools' }
    | { readonly kind: 'retry-with-fallback-model'; readonly model: string }
    | { readonly kind: 'give-up' };

export interface EmptyReplyContext {
    /** Have we already retried without tools on this turn? */
    readonly triedWithoutTools: boolean;
    /** Have we already used a fallback AI option on this turn? */
    readonly triedFallback: boolean;
    /** The configured backups, in the writer's order of preference. */
    readonly fallbackModels: readonly string[];
    /** Was the turn that just failed already a no-tools attempt? */
    readonly toolsWereOff: boolean;
}

export function nextEmptyReplyStep(ctx: EmptyReplyContext): EmptyReplyStep {
    // Trying again with the same setup would only repeat the same silence.
    if (!ctx.triedWithoutTools && !ctx.toolsWereOff) {
        return { kind: 'retry-without-tools' };
    }
    if (!ctx.triedFallback) {
        const model = ctx.fallbackModels.find((id) => id.trim().length > 0);
        if (model) return { kind: 'retry-with-fallback-model', model };
    }
    return { kind: 'give-up' };
}

/**
 * The retry is worth doing at all only when there was no answer.
 *
 * A reply of punctuation or whitespace is no answer either, which is the same
 * judgement `replyOrFallback` makes — kept here so the decision is one idea.
 */
export function isEmptyReply(content: string): boolean {
    return content.replace(/[\s\u200B-\u200D\uFEFF]/g, '').length === 0;
}
