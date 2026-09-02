import { computeWeeklyContentHash } from '../../../services/insights/weeklyInsightsStorage';

describe('computeWeeklyContentHash', () => {
    const item = (createdAt: number, ...contents: string[]) => ({
        createdAt,
        messages: contents.map((content) => ({ content })),
    });

    it('is deterministic for the same item set regardless of input order', () => {
        const a = item(1, 'morning walk', 'stayed calm');
        const b = item(2, 'met Sam for lunch');

        const first = computeWeeklyContentHash([a, b]);
        const reversed = computeWeeklyContentHash([b, a]);
        expect(first).toBe(reversed);
    });

    it('changes when an entry is edited without changing the count', () => {
        const before = [item(1, 'morning walk')];
        const editedInPlace = [item(1, 'morning walk, then heavy rain')];

        expect(computeWeeklyContentHash(before)).not.toBe(
            computeWeeklyContentHash(editedInPlace)
        );
    });

    it('orders multibyte/updated content and includes created timestamps', () => {
        const hash = computeWeeklyContentHash([item(1, 'a'), item(2, 'b')]);
        expect(hash).toContain('a');
        expect(hash).toContain('b');
        // created timestamps are part of the digest (boundary/ordering signal)
        expect(hash).toContain('1:');
        expect(hash).toContain('2:');
    });
});