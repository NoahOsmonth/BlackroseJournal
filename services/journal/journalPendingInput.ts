import type { Message } from '@/services/ai/chatTypes';
import { createTemporalMessage } from '@/services/ai/messageTemporalMetadata';

/**
 * Words still sitting in the composer belong to the next save. Send paths clear
 * the composer before messages state settles; Close and Finish must not drop
 * the last thought just because it was typed and not sent.
 */
export function withPendingInput(messages: Message[], inputValue: string): Message[] {
    const trimmed = inputValue.trim();
    if (!trimmed) return [...messages];
    return [
        ...messages,
        createTemporalMessage({
            id: `pending-${Date.now()}`,
            role: 'user',
            content: trimmed,
        }),
    ];
}
