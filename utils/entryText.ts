/**
 * Pure entry-text helpers shared by the entry service and the entry-detail
 * screen. No I/O, no hooks (AGENTS.md: utils/ stays pure).
 */

import type { Message } from '@/services/ai/chatTypes';

/** The authored body of an entry: every user turn joined in order. */
export function buildEntryText(messages: readonly Message[]): string {
    return messages
        .filter((message) => message.role === 'user')
        .map((message) => message.content.trim())
        .filter(Boolean)
        .join('\n\n');
}

/**
 * Rebuild a transcript around an edited body.
 *
 * The edited text becomes the single authored turn (reusing the first user
 * message's id so nothing downstream re-keys) and assistant replies are kept so
 * the reflection context survives the edit. Collapsing the user turns is what
 * makes the visible entry text exactly what the user typed — editing a single
 * turn would leave the other turns' words on screen.
 */
export function rebuildMessagesForEditedText(
    messages: readonly Message[],
    text: string,
): Message[] {
    const trimmed = text.trim();
    const anchor = messages.find((message) => message.role === 'user');
    const assistants = messages.filter((message) => message.role === 'assistant');
    const authored: Message = {
        ...(anchor ?? {
            id: `msg_${Date.now()}`,
            timestamp: Date.now(),
            role: 'user' as const,
            content: '',
        }),
        role: 'user',
        content: trimmed,
    };
    return [authored, ...assistants];
}
