import { JournalEntry } from '../../services/journalStorage.types';
import {
    buildAskRosebudContext,
    ingestJournalEntry,
    resetSupermemoryStorageAdapter,
    searchMemories,
    setSupermemoryStorageAdapter,
} from '../../services/supermemory';

const mockExtra: Record<string, string | undefined> = {};

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        expoConfig: { extra: mockExtra },
        expoGoConfig: { extra: mockExtra },
        manifest: { extra: mockExtra },
    },
}));

describe('supermemory service', () => {
    const originalApiKey = process.env.SUPERMEMORY_API_KEY;

    beforeEach(() => {
        process.env.SUPERMEMORY_API_KEY = 'test-supermemory-key';
        global.fetch = jest.fn();
    });

    afterEach(() => {
        resetSupermemoryStorageAdapter();
        jest.clearAllMocks();
        if (originalApiKey === undefined) {
            delete process.env.SUPERMEMORY_API_KEY;
        } else {
            process.env.SUPERMEMORY_API_KEY = originalApiKey;
        }
    });

    it('ingests journal entries with metadata', async () => {
        const storageAdapter = {
            getItem: jest.fn(async () => 'user_test'),
            setItem: jest.fn(async () => undefined),
            removeItem: jest.fn(async () => undefined),
        };

        setSupermemoryStorageAdapter(storageAdapter);

        const entry: JournalEntry = {
            id: 'entry_123',
            title: 'Test Entry',
            emoji: '📝',
            status: 'completed',
            messages: [
                { id: 'm1', role: 'user', content: 'Hello', timestamp: 1 },
                { id: 'm2', role: 'assistant', content: 'Hi', timestamp: 2 },
            ],
            createdAt: 1700000000000,
            updatedAt: 1700000001000,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ id: 'doc_123', status: 'queued' }),
        });

        await ingestJournalEntry(entry);

        const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(options.body);

        expect(url).toContain('/v3/documents');
        expect(body.customId).toBe('entry_123');
        expect(body.containerTag).toBe('user_test');
        expect(body.metadata.entry_status).toBe('completed');
        expect(body.metadata.entry_id).toBe('entry_123');
    });

    it('uses memory search mode for weekly Ask Rosebud queries', async () => {
        const storageAdapter = {
            getItem: jest.fn(async () => 'user_test'),
            setItem: jest.fn(async () => undefined),
            removeItem: jest.fn(async () => undefined),
        };

        setSupermemoryStorageAdapter(storageAdapter);

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({
                    profile: { static: [], dynamic: [] },
                    searchResults: { results: [] },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ results: [] }),
            });

        const now = new Date('2026-01-15T12:00:00Z');
        await buildAskRosebudContext({
            question: 'What patterns do you see?',
            timeRange: 'this-week',
            now,
        });

        const [, searchOptions] = (global.fetch as jest.Mock).mock.calls[1];
        const searchBody = JSON.parse(searchOptions.body);

        expect(searchBody.searchMode).toBe('memories');
        expect(searchBody.filters.AND.length).toBe(2);
    });

    it('uses hybrid search mode for yearly Ask Rosebud queries', async () => {
        const storageAdapter = {
            getItem: jest.fn(async () => 'user_test'),
            setItem: jest.fn(async () => undefined),
            removeItem: jest.fn(async () => undefined),
        };

        setSupermemoryStorageAdapter(storageAdapter);

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({
                    profile: { static: [], dynamic: [] },
                    searchResults: { results: [] },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ results: [] }),
            });

        await buildAskRosebudContext({
            question: 'How has my mindset changed?',
            timeRange: 'this-year',
            now: new Date('2026-01-15T12:00:00Z'),
        });

        const [, searchOptions] = (global.fetch as jest.Mock).mock.calls[1];
        const searchBody = JSON.parse(searchOptions.body);

        expect(searchBody.searchMode).toBe('hybrid');
        expect(searchBody.filters.AND.length).toBe(2);
    });

    it('throws on Supermemory request errors', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized',
        });

        await expect(
            searchMemories({
                containerTag: 'user_test',
                query: 'test',
                searchMode: 'memories',
            })
        ).rejects.toThrow('status 401');
    });
});
