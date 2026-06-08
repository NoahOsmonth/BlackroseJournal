import { classifyJournalEntry } from '../../../services/memory/memoryClassifier';

describe('memoryClassifier', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('normalizes successful Kimi classification responses', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            layer: 'profile',
                            salience: 99,
                            confidence: 2,
                            tags: ['rest'],
                        }),
                    },
                }],
            }),
        }) as jest.Mock;

        const atom = await classifyJournalEntry({
            id: 'entry-1',
            title: 'Rest',
            content: 'I need slower evenings.',
            createdAt: '2026-01-01T00:00:00.000Z',
        }, 'api-key');

        expect(atom.layer).toBe('profile');
        expect(atom.salience).toBe(10);
        expect(atom.confidence).toBe(1);
        expect(atom.tags).toEqual(['rest']);
    });

    it('falls back to a note atom when classification fails', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as jest.Mock;

        const atom = await classifyJournalEntry({
            id: 'entry-2',
            content: 'Unclassified memory.',
            createdAt: '2026-01-02T00:00:00.000Z',
        }, 'api-key');

        expect(atom).toMatchObject({
            id: 'atom_entry-2',
            entryId: 'entry-2',
            title: 'Fallback Node',
            layer: 'note',
            salience: 3,
            confidence: 0.5,
        });
    });
});
