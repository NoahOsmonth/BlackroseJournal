import {
    CHAT_SESSIONS_KEY,
    loadSessions,
    resetChatSessionStorageAdapter,
    setChatSessionStorageAdapter,
} from '../../../services/ai/sessionStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

function createStorageAdapter() {
    const store = new Map<string, string>();
    return {
        store,
        getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
        setItem: (key: string, value: string) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            store.delete(key);
            return Promise.resolve();
        },
    };
}

/**
 * The quiet "Thought it through · Used 2 tools" line above a reply is rendered
 * from a stored message's toolActivity, so it has to survive the read
 * sanitizer. That sanitizer is also the only thing between a corrupted payload
 * and a permanently spinning turn, so its bounds are asserted here.
 */
describe('sessionStorage tool activity', () => {
    let adapter: ReturnType<typeof createStorageAdapter>;

    beforeEach(() => {
        adapter = createStorageAdapter();
        setChatSessionStorageAdapter(adapter);
    });

    afterEach(() => {
        resetChatSessionStorageAdapter();
    });

    async function roundTrip(messages: unknown[]) {
        const now = Date.now();
        adapter.store.set(
            CHAT_SESSIONS_KEY,
            JSON.stringify([
                {
                    conversationId: 'chat_tools',
                    mode: 'freeform',
                    messages,
                    updatedAt: now,
                    createdAt: now,
                },
            ])
        );
        const [session] = await loadSessions();
        return session.messages;
    }

    const assistantWith = (toolActivity: unknown): unknown => ({
        id: 'm1',
        role: 'assistant',
        content: 'answer',
        timestamp: 1000,
        reasoning: 'thought about it',
        toolActivity,
    });

    it('keeps a finished turn’s tool calls through a load', async () => {
        const call = {
            toolCallId: 'c1',
            name: 'list_recent_days',
            label: 'Listing your recent days',
            argsPreview: 'last 7 days',
            status: 'ok',
            durationMs: 412,
            resultPreview: '7 days',
            round: 1,
            origin: 'structured',
        };

        const messages = await roundTrip([assistantWith([call])]);

        expect(messages[0].toolActivity).toEqual([call]);
    });

    it('demotes a stale running call so a finished turn cannot look live', async () => {
        const messages = await roundTrip([
            assistantWith([
                { toolCallId: 'c1', name: 'get_day', label: 'Reading yesterday', status: 'running', round: 1 },
            ]),
        ]);

        expect(messages[0].toolActivity?.[0].status).toBe('ok');
    });

    it('drops malformed calls and falls back to the tool name for a missing label', async () => {
        const messages = await roundTrip([
            assistantWith([
                { name: 'no_id' },
                { toolCallId: 'c2' },
                'not an object',
                { toolCallId: 'c3', name: 'memory_search', label: '', status: 'nonsense', round: 0 },
            ]),
        ]);

        expect(messages[0].toolActivity).toEqual([
            {
                toolCallId: 'c3',
                name: 'memory_search',
                label: 'memory_search',
                argsPreview: '',
                status: 'ok',
                durationMs: undefined,
                resultPreview: undefined,
                round: 1,
                origin: undefined,
            },
        ]);
    });

    it('caps the calls kept per turn, keeping the most recent', async () => {
        const messages = await roundTrip([
            assistantWith(
                Array.from({ length: 20 }, (_, i) => ({
                    toolCallId: `c${i + 1}`,
                    name: 'get_day',
                    label: 'Reading a day',
                    status: 'ok',
                    round: 1,
                }))
            ),
        ]);

        const calls = messages[0].toolActivity ?? [];
        expect(calls).toHaveLength(12);
        expect(calls[calls.length - 1].toolCallId).toBe('c20');
    });

    it('clips an over-long preview to the preview budget', async () => {
        const messages = await roundTrip([
            assistantWith([
                {
                    toolCallId: 'c1',
                    name: 'search_history',
                    label: 'Searching',
                    argsPreview: 'y'.repeat(400),
                    status: 'ok',
                    round: 1,
                },
            ]),
        ]);

        const preview = messages[0].toolActivity?.[0].argsPreview ?? '';
        expect(preview).toHaveLength(200);
        expect(preview.endsWith('…')).toBe(true);
    });

    it('leaves toolActivity undefined when the stored value is not an array', async () => {
        const messages = await roundTrip([assistantWith('garbage')]);
        expect(messages[0].toolActivity).toBeUndefined();
    });
});
