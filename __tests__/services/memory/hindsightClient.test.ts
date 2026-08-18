import { hindsightRetain, hindsightRecall, hindsightReflect, hindsightHealth, notifyHindsightChanged, subscribeHindsightChanges } from '../../../services/memory/hindsight/hindsightClient';

const JSON_OK = { ok: true, status: 200, json: async () => ({}) } as Response;

describe('hindsightClient', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        // NOTE: babel-preset-expo rewrites process.env.EXPO_PUBLIC_* reads to
        // `expo/virtual/env` (a live reference captured at module load), so we
        // must mutate the existing process.env object in place rather than
        // replace it (`process.env = { ...OLD_ENV }` would be invisible).
        process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL = 'http://localhost:8888';
        global.fetch = jest.fn();
    });

    afterEach(() => {
        delete process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('retain posts items to the bank and notifies subscribers', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(JSON_OK);
        const seen: number[] = [];
        const unsub = subscribeHindsightChanges(() => seen.push(1));
        const ok = await hindsightRetain([{ content: 'hello', timestamp: 1700000000000, document_id: 'd1' }]);
        expect(ok).toBe(true);
        expect(seen).toEqual([1]);
        unsub();
        const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toContain('/v1/default/banks/rosebud/memories');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body).items).toHaveLength(1);
    });

    it('recall normalizes units/results shapes and keeps similarity', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true, status: 200,
            json: async () => ({
                units: [
                    { content: 'Maya got married', similarity: 0.91, timestamp: 1700000000000, document_id: 'journal_entry:e1' },
                ],
            }),
        } as Response);
        const hits = await hindsightRecall('when did Maya get married');
        expect(hits).toHaveLength(1);
        expect(hits![0].content).toBe('Maya got married');
        expect(hits![0].similarity).toBeCloseTo(0.91);
        expect(hits![0].documentId).toBe('journal_entry:e1');
    });

    it('retain serializes epoch timestamps to ISO strings on the wire', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(JSON_OK);
        await hindsightRetain([{ content: 'hello', timestamp: 1700000000000, document_id: 'd1' }]);
        const [, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(JSON.parse(init.body).items[0].timestamp).toBe('2023-11-14T22:13:20.000Z');
    });

    it('recall normalizes the container result shape (text/scores/occurred_start)', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true, status: 200,
            json: async () => ({
                results: [
                    {
                        id: 'r1',
                        text: 'Maya got married on July 28, 2026',
                        type: 'world',
                        document_id: 'needle_wedding',
                        occurred_start: '2026-07-28T12:00:00+00:00',
                        scores: { final: 0.91, semantic: 0.88, reranker: 0.9 },
                    },
                ],
            }),
        } as Response);
        const hits = await hindsightRecall('when did Maya get married');
        expect(hits).toHaveLength(1);
        expect(hits![0].content).toBe('Maya got married on July 28, 2026');
        expect(hits![0].similarity).toBeCloseTo(0.91);
        expect(hits![0].documentId).toBe('needle_wedding');
        expect(hits![0].timestamp).toBe(Date.parse('2026-07-28T12:00:00+00:00'));
    });

    it('recall returns null on non-OK status (soft-fail, no throw)', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 } as Response);
        await expect(hindsightRecall('anything')).resolves.toBeNull();
    });

    it('recall returns null when disabled', async () => {
        delete process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
        await expect(hindsightRecall('anything')).resolves.toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('recall returns null on network failure', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
        await expect(hindsightRecall('anything')).resolves.toBeNull();
    });

    it('aborts (timeouts) and returns null', async () => {
        (global.fetch as jest.Mock).mockImplementation((_url: string, init: { signal?: AbortSignal }) =>
            new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
            })
        );
        await expect(hindsightRecall('anything')).resolves.toBeNull();
    });

    it('reflect normalizes string and object responses', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => 'A grounded reflection' } as Response);
        await expect(hindsightReflect('question')).resolves.toBe('A grounded reflection');
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ reflection: 'Object form' }) } as Response);
        await expect(hindsightReflect('question')).resolves.toBe('Object form');
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ text: 'Container text form' }) } as Response);
        await expect(hindsightReflect('question')).resolves.toBe('Container text form');
    });

    it('health returns false when disabled or failing', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 } as Response);
        await expect(hindsightHealth()).resolves.toBe(true); // fetch mocked ok
        delete process.env.EXPO_PUBLIC_HINDSIGHT_BASE_URL;
        await expect(hindsightHealth()).resolves.toBe(false);
    });
});
