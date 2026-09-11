/**
 * Unit tests for the Pi keep-alive promise detector.
 * Pure function — no transport, no timers.
 */
import {
    looksLikeUnfinishedPromise,
    PROMISE_CONTINUATION_MAX,
    PROMISE_TEXT_MAX_LENGTH,
} from '../../../services/ai/agentPromise';

describe('looksLikeUnfinishedPromise', () => {
    it('flags the GLM status-line shape that leaked as a final answer', () => {
        expect(looksLikeUnfinishedPromise('Let me actually go dig rather than guess. One sec.')).toBe(true);
    });

    it('flags short verb-first promises', () => {
        expect(looksLikeUnfinishedPromise('One sec — checking yesterday.')).toBe(true);
        expect(looksLikeUnfinishedPromise('Hold on, let me look at that day.')).toBe(true);
        expect(looksLikeUnfinishedPromise('I will now search your history.')).toBe(true);
        expect(looksLikeUnfinishedPromise('Still searching through the digests.')).toBe(true);
        expect(looksLikeUnfinishedPromise('digging deeper')).toBe(true);
    });

    it('does not flag a real multi-paragraph answer that mentions searching', () => {
        const answer = [
            'I searched back through last week and there is a thread running through all of it.',
            '',
            'On Monday you wrote about the deck going out three times and how the Slack pings never stopped.',
            'By Wednesday the tone shifted — you were less frustrated and more tired, and you said the sleep was broken.',
            '',
            'What I notice is that the work stress and the sleep are tangled together. You keep writing about them in the same breath.',
            'That is worth sitting with: is the tiredness the cause or the cost?',
        ].join('\n');
        expect(answer.length).toBeGreaterThan(PROMISE_TEXT_MAX_LENGTH);
        expect(looksLikeUnfinishedPromise(answer)).toBe(false);
    });

    it('does not flag a short answer that merely uses a past-tense verb', () => {
        expect(looksLikeUnfinishedPromise('I checked yesterday and it was a quiet day.')).toBe(false);
        expect(looksLikeUnfinishedPromise('Nothing in there about work.')).toBe(false);
    });

    it('does not flag phrases that are promises in a social sense, not a work status', () => {
        expect(looksLikeUnfinishedPromise('Let me know how today goes.')).toBe(false);
        expect(looksLikeUnfinishedPromise('Hold on to that thought — it matters.')).toBe(false);
    });

    it('does not flag empty or whitespace-only text', () => {
        expect(looksLikeUnfinishedPromise('')).toBe(false);
        expect(looksLikeUnfinishedPromise('   \n\t ')).toBe(false);
    });

    it('does not flag tool-call syntax (dump path owns that)', () => {
        expect(looksLikeUnfinishedPromise('get_day({"date":"yesterday"})')).toBe(false);
        expect(looksLikeUnfinishedPromise('```json\n{"name":"search_history"}\n```')).toBe(false);
    });

    it('does not flag long text even when it starts with a promise verb', () => {
        const long = `let me check ${'and then I kept going '.repeat(20)}`;
        expect(long.length).toBeGreaterThan(PROMISE_TEXT_MAX_LENGTH);
        expect(looksLikeUnfinishedPromise(long)).toBe(false);
    });

    it('caps promise continuations at 2 per turn', () => {
        expect(PROMISE_CONTINUATION_MAX).toBe(2);
    });
});
