import {
    dedupeRecallHits, hindsightClear, hindsightRecall, hindsightReflect, hindsightRetain,
    resetHindsightSessionProvider, setHindsightSessionProvider, subscribeHindsightChanges,
} from '../../../services/memory/hindsight/hindsightClient';

describe('hindsight gateway client', () => {
    const originalGateway = process.env.EXPO_PUBLIC_AGENT_BASE_URL;
    let fetchMock: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = 'https://gateway.example/';
        setHindsightSessionProvider(async () => ({ accessToken: 'account-token', userId: 'account-a' }));
        fetchMock = jest.fn();
        global.fetch = fetchMock;
    });
    afterEach(() => {
        process.env.EXPO_PUBLIC_AGENT_BASE_URL = originalGateway;
        resetHindsightSessionProvider();
        jest.restoreAllMocks();
    });

    it('retains through the authenticated gateway without a client bank selector', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ retained: true }), { status: 200 }));
        const changes: number[] = [];
        const unsubscribe = subscribeHindsightChanges(() => changes.push(1));
        await expect(hindsightRetain([{
            content: 'hello', timestamp: 1_700_000_000_000, document_id: 'journal_entry:one',
        }])).resolves.toBe(true);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://gateway.example/v1/memory/retain');
        expect(init?.headers).toEqual({
            Accept: 'application/json', Authorization: 'Bearer account-token',
            'Content-Type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
            content: 'hello', documentId: 'journal_entry:one',
            createdAt: '2023-11-14T22:13:20.000Z',
            metadata: { source: 'journal', sourceId: 'one', completed: true,
                writtenAt: '2023-11-14T22:13:20.000Z' },
        });
        expect(String(init?.body)).not.toContain('bank');
        expect(changes).toEqual([1]);
        unsubscribe();
    });

    it('normalizes contract-safe recall and reflect responses', async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(JSON.stringify({ results: [
                { documentId: 'j1', content: 'Rest helped', score: 0.8 },
                { documentId: 'j2', content: 'Today rest helped', score: 0.7 },
            ] }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ reflection: 'Rest recurs.' }), { status: 200 }));
        await expect(hindsightRecall(' rest ', { limit: 4 })).resolves.toEqual([
            { documentId: 'j1', content: 'Rest helped', similarity: 0.8 },
        ]);
        await expect(hindsightReflect(' pattern ')).resolves.toBe('Rest recurs.');
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ query: 'rest', limit: 4 });
    });

    it('soft-fails when auth or the gateway is unavailable', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        setHindsightSessionProvider(async () => null);
        await expect(hindsightRecall('anything')).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
        setHindsightSessionProvider(async () => ({ accessToken: 'token', userId: 'account-a' }));
        fetchMock.mockRejectedValueOnce(new Error('offline'));
        await expect(hindsightRetain([{ content: 'x', timestamp: 1, document_id: 'j' }]))
            .resolves.toBe(false);
    });

    it('clears only through the authenticated bankless gateway route', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ cleared: true }), { status: 200 }));
        await expect(hindsightClear()).resolves.toBe(true);
        expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.example/v1/memory');
        expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
        expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
    });

    it('deduplicates near-identical recall hits by descending score', () => {
        expect(dedupeRecallHits([
            { content: 'called Priya after work', similarity: 0.7 },
            { content: 'After work I called Priya', similarity: 0.9 },
            { content: 'slept early', similarity: 0.5 },
        ], 2)).toEqual([
            { content: 'After work I called Priya', similarity: 0.9 },
            { content: 'slept early', similarity: 0.5 },
        ]);
    });
});
