/* eslint-disable import/first */
import { formatRecallHitLine, buildHindsightRecallContext } from '../../../services/memory/hindsight/hindsightRecall';

jest.mock('../../../services/memory/hindsight/hindsightClient', () => ({
    hindsightRecall: jest.fn(),
}));
import { hindsightRecall } from '../../../services/memory/hindsight/hindsightClient';
import type { HindsightRecallHit } from '../../../services/memory/hindsight/hindsightClient';

const mockedRecall = hindsightRecall as jest.MockedFunction<typeof hindsightRecall>;

const hit = (over: Partial<HindsightRecallHit> = {}): HindsightRecallHit => ({
    content: 'Maya got married', similarity: 0.91, timestamp: 1723680000000, documentId: 'journal_entry:e1',
    ...over,
});

describe('hindsightRecall block builder', () => {
    beforeEach(() => mockedRecall.mockReset());

    it('formats a line with sim tag and written date', () => {
        expect(formatRecallHitLine(hit())).toMatch(/^- sim=0\.91 Maya got married \(Written \d{4}-\d{2}-\d{2}\)$/);
    });

    it('omits date suffix when timestamp is missing', () => {
        expect(formatRecallHitLine(hit({ timestamp: undefined }))).toBe('- sim=0.91 Maya got married');
    });

    it('builds a ranked block with header', async () => {
        mockedRecall.mockResolvedValue([hit({ similarity: 0.91 }), hit({ similarity: 0.72, content: 'Priya moved' })]);
        const block = await buildHindsightRecallContext('wedding');
        expect(block).toContain('## Relevant long-term context');
        const sims = [...(block ?? '').matchAll(/sim=(\d+\.\d+)/g)].map((m) => m[1]);
        expect(sims).toEqual(['0.91', '0.72']);
    });

    it('returns undefined on empty recall (block dropped downstream)', async () => {
        mockedRecall.mockResolvedValue([]);
        await expect(buildHindsightRecallContext('nothing')).resolves.toBeUndefined();
    });

    it('returns undefined on null (soft-fail)', async () => {
        mockedRecall.mockResolvedValue(null);
        await expect(buildHindsightRecallContext('anything')).resolves.toBeUndefined();
    });

    it('passes query and limit through', async () => {
        mockedRecall.mockResolvedValue([hit()]);
        await buildHindsightRecallContext('wedding', { limit: 3 });
        expect(mockedRecall).toHaveBeenCalledWith('wedding', { limit: 3 });
    });
});
