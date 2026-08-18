/* eslint-disable import/first */

import { recallMemoryToolHandler } from '../../../services/ai/tools/hindsightTools';

jest.mock('../../../services/memory/hindsight/hindsightClient', () => ({
    hindsightRecall: jest.fn(),
}));
import { hindsightRecall } from '../../../services/memory/hindsight/hindsightClient';

const mockedRecall = hindsightRecall as jest.MockedFunction<typeof hindsightRecall>;

describe('recallMemoryToolHandler', () => {
    beforeEach(() => mockedRecall.mockReset());

    it('returns formatted recollections', async () => {
        mockedRecall.mockResolvedValue([
            { content: 'Maya got married', similarity: 0.91, timestamp: 1723680000000, documentId: 'journal_entry:e1' },
        ]);
        const out = await recallMemoryToolHandler({ query: 'wedding' });
        expect(out).toContain('Long-term recollections (1):');
        expect(out).toContain('Maya got married');
        expect(mockedRecall).toHaveBeenCalledWith('wedding', { limit: 6 });
    });

    it('explains when nothing is found', async () => {
        mockedRecall.mockResolvedValue([]);
        await expect(recallMemoryToolHandler({ query: 'q' })).resolves.toContain('No long-term recollections');
    });

    it('handles missing query', async () => {
        await expect(recallMemoryToolHandler({})).resolves.toContain('No query provided');
        expect(mockedRecall).not.toHaveBeenCalled();
    });

    it('clamps limit to 1..10', async () => {
        mockedRecall.mockResolvedValue([]);
        await recallMemoryToolHandler({ query: 'q', limit: 99 });
        expect(mockedRecall).toHaveBeenCalledWith('q', { limit: 10 });
    });
});
