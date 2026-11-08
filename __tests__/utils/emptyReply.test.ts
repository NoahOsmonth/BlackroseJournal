import { EMPTY_REPLY_FALLBACK, replyOrFallback } from '@/utils/emptyReply';

describe('replyOrFallback', () => {
    it('keeps the AI\u2019s own words when it wrote some', () => {
        expect(replyOrFallback('Steady, and a little tired.')).toBe('Steady, and a little tired.');
    });

    it('answers in plain words when the reply is empty', () => {
        // Regression for DEF-032: an empty finish left the chat on "Thinking".
        expect(replyOrFallback('')).toBe(EMPTY_REPLY_FALLBACK);
    });

    it('treats a stream of spaces as no answer', () => {
        expect(replyOrFallback('   \n\t ')).toBe(EMPTY_REPLY_FALLBACK);
    });

    it('never shows a blank line to the writer', () => {
        expect(replyOrFallback('').length).toBeGreaterThan(20);
    });

    it('says nothing technical', () => {
        expect(EMPTY_REPLY_FALLBACK).not.toMatch(/model|provider|token|context window|api/i);
    });
});
