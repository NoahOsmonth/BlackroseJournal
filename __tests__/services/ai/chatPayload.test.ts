import { buildChatPayload } from '../../../services/ai/chatTypes';

const messages = [{
    id: 'm1',
    role: 'user' as const,
    content: 'Hello',
    timestamp: 1,
}];

describe('buildChatPayload generation settings', () => {
    it('preserves default chat generation values', () => {
        const payload = buildChatPayload('agent-default', messages, 'system', true);

        expect(payload.temperature).toBe(1);
        expect(payload.top_p).toBe(0.9);
        expect(payload.max_tokens).toBe(32_768);
    });

    it('emits temperature, top_p, and max_tokens from passed settings', () => {
        const payload = buildChatPayload(
            'agent-default',
            messages,
            'system',
            false,
            'chat-1',
            { temperature: 0.2, topP: 0.6, maxTokens: 1_024 }
        );

        expect(payload).toMatchObject({
            temperature: 0.2,
            top_p: 0.6,
            max_tokens: 1_024,
            conversationId: 'chat-1',
        });
    });
});
