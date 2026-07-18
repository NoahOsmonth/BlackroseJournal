import type { Message } from '../../../services/ai/chatTypes';
import {
    buildExtractiveConversationSummary,
    compactConversationIfNeeded,
    estimatePromptTokens,
    shouldCompactConversation,
    SUMMARY_TOKEN_BUDGET_MAX,
} from '../../../services/ai/conversationCompact';

function msg(role: 'user' | 'assistant', content: string, id: string): Message {
    return { id, role, content, timestamp: 1_700_000_000_000 + Number(id) };
}

function longThread(turns: number, chunk = 'word '.repeat(80)): Message[] {
    const out: Message[] = [];
    for (let i = 0; i < turns; i += 1) {
        out.push(msg(i % 2 === 0 ? 'user' : 'assistant', `${chunk} turn-${i}`, String(i)));
    }
    return out;
}

describe('conversationCompact', () => {
    it('does not compact short threads', () => {
        const messages = [
            msg('user', 'hello', '1'),
            msg('assistant', 'hi there', '2'),
        ];
        const result = compactConversationIfNeeded(messages, {
            systemPrompt: 'sys',
            contextWindow: 16_384,
        });
        expect(result.compacted).toBe(false);
        expect(result.messages).toHaveLength(2);
    });

    it('compacts when estimated tokens approach a small free-model window', () => {
        const messages = longThread(40);
        const systemPrompt = 'S'.repeat(2000);
        expect(
            shouldCompactConversation(systemPrompt, messages, { contextWindow: 8_192 })
        ).toBe(true);

        const result = compactConversationIfNeeded(messages, {
            systemPrompt,
            contextWindow: 8_192,
            keepRecent: 6,
        });
        expect(result.compacted).toBe(true);
        expect(result.estimatedTokensAfter).toBeLessThan(result.estimatedTokensBefore);
        expect(result.messages.some((m) => m.content.includes('auto-compacted'))).toBe(true);
        // Recent turns preserved
        expect(result.messages[result.messages.length - 1].content).toContain('turn-39');
    });

    it('builds an extractive summary under a token budget', () => {
        const older = longThread(20);
        const summary = buildExtractiveConversationSummary(older, 500);
        expect(summary).toContain('Conversation memory');
        expect(estimatePromptTokens('', [msg('user', summary, 's')])).toBeLessThan(900);
    });

    it('summary budget max is large enough for ~10–15k summarized history on big windows', () => {
        expect(SUMMARY_TOKEN_BUDGET_MAX).toBeGreaterThanOrEqual(10_000);
        expect(SUMMARY_TOKEN_BUDGET_MAX).toBeLessThanOrEqual(15_000);
    });
});
