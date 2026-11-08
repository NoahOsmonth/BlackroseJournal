/**
 * What the chat says when the AI produces no words at all.
 *
 * A provider can answer with nothing but thinking, or with tool-call syntax
 * that strips to blank. Showing that as an empty reply left the writer watching
 * "Thinking" forever, so the transport substitutes this line and the turn ends
 * like any other (DEF-032).
 */
export const EMPTY_REPLY_FALLBACK =
    'I could not put that into a reply. Try sending it again, or say it a slightly different way.';

/**
 * Returns the words to show for a finished turn: the model's own answer when it
 * gave one, otherwise the plain fallback sentence. Whitespace-only output counts
 * as no answer — a stream that sent only spaces is the same dead end.
 */
export function replyOrFallback(content: string, fallback = EMPTY_REPLY_FALLBACK): string {
    const trimmed = typeof content === 'string' ? content.trim() : '';
    return trimmed ? content : fallback;
}
