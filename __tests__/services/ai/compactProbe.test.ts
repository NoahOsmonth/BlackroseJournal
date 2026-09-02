import {
    compactConversationIfNeeded,
    estimateTokens,
    estimateMessagesTokens,
    estimatePromptTokens,
    shouldCompactConversation,
    usableContextBudget,
    summaryTokenBudget,
} from '../../../services/ai/conversationCompact';
import {
    assembleAugmentBlob,
} from '../../../services/ai/historyPrefetch';

// Note: this is a PROBING spec. It asserts invariants that MUST hold for a
// healthy compact implementation. If any probe here turns red on a bug in the
// implementation (not a wrong expectation), the fix belongs in the service.

describe('compact budget invariants', () => {
    it('estimated tokens never decrease to negative for empty', () => {
        expect(estimateTokens('')).toBe(0);
        expect(estimateMessagesTokens([])).toBe(0);
        expect(estimatePromptTokens('sys', [])).toBeGreaterThan(0);
        expect(usableContextBudget(16384)).toBe(16384 - 2048);
        expect(summaryTokenBudget(16384)).toBe(Math.min(12000, Math.max(800, Math.floor(16384 * 0.15))));
    });

    it('shouldCompact triggers at ~62% and not under budget', () => {
        // 13×700-char turns ≈ 13×(175+4)=2327 tokens > 2222 trigger, so compact fires.
        const msgs = Array.from({ length: 13 }, (_, i) => ({
            id: `m${i}`, role: 'user' as const, content: 'y'.repeat(700), timestamp: i * 1000,
        }));
        expect(shouldCompactConversation('', msgs, { contextWindow: 4096, outputReserve: 512 })).toBe(true);
        expect(shouldCompactConversation('', [], { contextWindow: 4096, outputReserve: 512 })).toBe(false);
    });
});

describe('compactConversationIfNeeded', () => {
    function mk(role: 'user' | 'assistant', content: string, i: number) {
        return { id: `m${i}`, role, content, timestamp: i * 1000 };
    }

    it('does not compact a short conversation', () => {
        const msgs = [mk('user', 'hi', 0), mk('assistant', 'hello', 1)];
        const r = compactConversationIfNeeded(msgs, { systemPrompt: 's' });
        expect(r.compacted).toBe(false);
        expect(r.reason).toBe('too-few-messages');
        expect(r.messages).toHaveLength(2);
    });

    it('compact output preserves the newest turns verbatim', () => {
        const sys = 'x'.repeat(3000);
        const msgs = Array.from({ length: 30 }, (_, i) =>
            mk(i % 2 === 0 ? 'user' : 'assistant', `turn-${i} ` + 'y'.repeat(300), i));
        const r = compactConversationIfNeeded(msgs, { systemPrompt: sys, contextWindow: 4096, outputReserve: 512 });
        expect(r.compacted).toBe(true);
        expect(r.messages.length).toBeLessThan(msgs.length);
        // Recent turns preserved verbatim (summary + bridge + recent)
        expect(r.messages[r.messages.length - 1].content).toContain('turn-29');
    });

    it('summary is bounded by budget', () => {
        const sys = 'x'.repeat(1000);
        const msgs = Array.from({ length: 100 }, (_, i) =>
            mk(i % 2 === 0 ? 'user' : 'assistant', 'abc '.repeat(30), i));
        const r = compactConversationIfNeeded(msgs, { systemPrompt: sys, contextWindow: 4096 });
        expect(r.estimatedTokensAfter).toBeLessThan(r.estimatedTokensBefore);
        expect(r.messages[0].content.length).toBeLessThanOrEqual(summaryTokenBudget(4096) * 4 + 2000);
    });
});

describe('augment blob capping', () => {
    const mkSeg = (role: 'recall' | 'digest' | 'fixed', text: string, similarity?: number, dateKey?: string) => ({
        role,
        text,
        ...(similarity !== undefined ? { similarity } : {}),
        ...(dateKey !== undefined ? { dateKey } : {}),
    });

    it('keeps everything under budget', () => {
        const segs = Array.from({ length: 50 }, (_, i) =>
            mkSeg('recall', `- recall line ${i} ` + 'word '.repeat(30), 1 - i / 50));
        const blob = assembleAugmentBlob(segs, 200);
        expect(estimateTokens(blob)).toBeLessThanOrEqual(200);
    });

    it('drops lowest-similarity recall lines first', () => {
        const segs = [
            mkSeg('recall', '- high value', 0.9),
            mkSeg('recall', '- low value', 0.1),
            mkSeg('recall', '- mid value', 0.5),
        ];
        const blob = assembleAugmentBlob(segs, 1);
        expect(blob).not.toContain('- low value');
    });
});