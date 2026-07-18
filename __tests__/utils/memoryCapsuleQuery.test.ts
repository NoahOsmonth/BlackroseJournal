import {
    latestUserMemoryQuery,
    MEMORY_CAPSULE_QUERY_MAX_CHARS,
    resolveMemoryCapsuleQuery,
} from '../../utils/memoryCapsuleQuery';

describe('memoryCapsuleQuery', () => {
    describe('latestUserMemoryQuery', () => {
        it('returns undefined for empty sessions', () => {
            expect(latestUserMemoryQuery([])).toBeUndefined();
        });

        it('skips assistant turns and synthetic bootstrap lines', () => {
            expect(
                latestUserMemoryQuery([
                    { role: 'user', content: '[Start freeform journal]' },
                    { role: 'assistant', content: 'Hey — what is on your mind?' },
                ]),
            ).toBeUndefined();
        });

        it('returns the latest real user message', () => {
            expect(
                latestUserMemoryQuery([
                    { role: 'user', content: 'Work has been rough' },
                    { role: 'assistant', content: 'Tell me more' },
                    { role: 'user', content: 'My manager keeps moving the goalposts' },
                ]),
            ).toBe('My manager keeps moving the goalposts');
        });

        /**
         * What would make this fail: truncate to unrelated filler, or return full rant,
         * or return a short empty/placeholder string under the length limit.
         */
        it('caps long rants while keeping the original prefix', () => {
            const rant = `Work ${'x'.repeat(MEMORY_CAPSULE_QUERY_MAX_CHARS + 50)}`;
            const out = latestUserMemoryQuery([{ role: 'user', content: rant }]);
            expect(out).toBe(rant.slice(0, MEMORY_CAPSULE_QUERY_MAX_CHARS).trim());
            expect(out!.length).toBeLessThanOrEqual(MEMORY_CAPSULE_QUERY_MAX_CHARS);
            expect(out!.startsWith('Work ')).toBe(true);
            expect(out).not.toBe(rant);
        });
    });

    describe('resolveMemoryCapsuleQuery', () => {
        it('prefers live user text over continued title', () => {
            expect(
                resolveMemoryCapsuleQuery({
                    latestUserText: 'sleep anxiety again',
                    continuedTitle: 'Old entry title',
                }),
            ).toBe('sleep anxiety again');
        });

        it('falls back to continued title when session is empty', () => {
            expect(
                resolveMemoryCapsuleQuery({
                    latestUserText: undefined,
                    continuedTitle: 'Morning spiral',
                }),
            ).toBe('Morning spiral');
        });

        it('returns undefined when both are empty', () => {
            expect(
                resolveMemoryCapsuleQuery({
                    latestUserText: '   ',
                    continuedTitle: null,
                }),
            ).toBeUndefined();
        });
    });
});
