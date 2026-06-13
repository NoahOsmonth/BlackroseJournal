import {
    CHAT_SESSIONS_KEY,
    getMostRecentActiveSession,
    getSession,
    loadSessions,
    pruneStaleSessions,
    removeJournalChatSessions,
    removeSession,
    resetChatSessionStorageAdapter,
    saveSession,
    setChatSessionStorageAdapter,
    type ChatSession,
} from '../../../services/ai/sessionStorage';
import type { Message } from '../../../services/ai/chatTypes';

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

function makeMessages(...texts: string[]): Message[] {
    return texts.map((content, index) => ({
        id: `m${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content,
        timestamp: 1000 + index,
    }));
}

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
    const now = Date.now();
    return {
        conversationId: 'chat_1',
        mode: 'freeform',
        messages: makeMessages('hello'),
        updatedAt: now,
        createdAt: now,
        ...overrides,
    };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('sessionStorage', () => {
    let adapter: ReturnType<typeof createStorageAdapter>;

    beforeEach(() => {
        adapter = createStorageAdapter();
        setChatSessionStorageAdapter(adapter);
    });

    afterEach(() => {
        resetChatSessionStorageAdapter();
        jest.restoreAllMocks();
    });

    it('upserts, gets, and removes a session', async () => {
        await saveSession(makeSession({ conversationId: 'chat_a' }));
        await saveSession(makeSession({ conversationId: 'chat_b', messages: makeMessages('hi there') }));

        const all = await loadSessions();
        expect(all).toHaveLength(2);

        const fetched = await getSession('chat_b');
        expect(fetched?.messages[0].content).toBe('hi there');

        // Upsert updates messages in place (no duplicate).
        await saveSession(makeSession({ conversationId: 'chat_a', messages: makeMessages('updated') }));
        const afterUpsert = await loadSessions();
        expect(afterUpsert).toHaveLength(2);
        expect((await getSession('chat_a'))?.messages[0].content).toBe('updated');

        await removeSession('chat_a');
        expect(await getSession('chat_a')).toBeNull();
        expect(await loadSessions()).toHaveLength(1);
    });

    it('preserves createdAt across upserts but refreshes updatedAt', async () => {
        const created = Date.now() - 5000;
        await saveSession(makeSession({ conversationId: 'chat_keep', createdAt: created, updatedAt: created }));
        await saveSession(makeSession({ conversationId: 'chat_keep', messages: makeMessages('again') }));

        const session = await getSession('chat_keep');
        expect(session?.createdAt).toBe(created);
        expect(session?.updatedAt).toBeGreaterThanOrEqual(created);
    });

    it('getMostRecentActiveSession returns the newest non-empty fresh session', async () => {
        const now = Date.now();
        await saveSession(makeSession({ conversationId: 'older', updatedAt: now - 2000, messages: makeMessages('old') }));
        await saveSession(makeSession({ conversationId: 'newer', updatedAt: now, messages: makeMessages('new') }));

        const active = await getMostRecentActiveSession();
        expect(active?.conversationId).toBe('newer');
    });

    it('getMostRecentActiveSession ignores empty sessions', async () => {
        // Write an empty session directly (saveSession allows empty, recovery filters it out).
        await saveSession(makeSession({ conversationId: 'empty', messages: [] }));
        expect(await getMostRecentActiveSession()).toBeNull();
    });

    it('getMostRecentActiveSession ignores stale (>7d) sessions', async () => {
        const stale = Date.now() - 8 * DAY_MS;
        adapter.store.set(CHAT_SESSIONS_KEY, JSON.stringify([
            makeSession({ conversationId: 'stale', updatedAt: stale, createdAt: stale }),
        ]));
        expect(await getMostRecentActiveSession()).toBeNull();
    });

    it('pruneStaleSessions drops sessions older than 7 days', async () => {
        const now = Date.now();
        adapter.store.set(CHAT_SESSIONS_KEY, JSON.stringify([
            makeSession({ conversationId: 'fresh', updatedAt: now, createdAt: now }),
            makeSession({ conversationId: 'stale', updatedAt: now - 8 * DAY_MS, createdAt: now - 8 * DAY_MS }),
        ]));

        const remaining = await pruneStaleSessions();
        expect(remaining.map((s) => s.conversationId)).toEqual(['fresh']);
    });

    it('pruneStaleSessions caps the store at 10 sessions by updatedAt', async () => {
        const now = Date.now();
        const many = Array.from({ length: 14 }, (_, i) =>
            makeSession({
                conversationId: `c${i}`,
                updatedAt: now - i * 1000,
                createdAt: now - i * 1000,
            })
        );
        adapter.store.set(CHAT_SESSIONS_KEY, JSON.stringify(many));

        const remaining = await pruneStaleSessions();
        expect(remaining).toHaveLength(10);
        // Newest kept, oldest dropped.
        expect(remaining[0].conversationId).toBe('c0');
        expect(remaining.some((s) => s.conversationId === 'c13')).toBe(false);
    });

    it('caps to 10 on save when more sessions accumulate', async () => {
        const now = Date.now();
        for (let i = 0; i < 12; i += 1) {
            await saveSession(makeSession({
                conversationId: `s${i}`,
                updatedAt: now + i,
                createdAt: now + i,
            }));
        }
        const all = await loadSessions();
        expect(all.length).toBeLessThanOrEqual(10);
    });

    it('returns a safe default when stored JSON is corrupt', async () => {
        adapter.store.set(CHAT_SESSIONS_KEY, '{ this is not json');
        expect(await loadSessions()).toEqual([]);
        expect(await getMostRecentActiveSession()).toBeNull();
    });

    it('sanitizes malformed session records on read', async () => {
        adapter.store.set(CHAT_SESSIONS_KEY, JSON.stringify([
            { conversationId: 'ok', mode: 'freeform', messages: makeMessages('valid'), updatedAt: Date.now(), createdAt: Date.now() },
            { mode: 'freeform', messages: [] }, // missing conversationId
            { conversationId: 'badmode', mode: 'nope', messages: [] }, // invalid mode
            'not-an-object',
        ]));

        const sessions = await loadSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0].conversationId).toBe('ok');
    });

    it('drops malformed messages but keeps valid ones', async () => {
        adapter.store.set(CHAT_SESSIONS_KEY, JSON.stringify([
            {
                conversationId: 'mixed',
                mode: 'freeform',
                messages: [
                    { id: 'a', role: 'user', content: 'good', timestamp: 1 },
                    { id: 'b', role: 'banana', content: 'bad role' },
                    { id: 'c', role: 'assistant' }, // missing content
                ],
                updatedAt: Date.now(),
                createdAt: Date.now(),
            },
        ]));

        const session = await getSession('mixed');
        expect(session?.messages).toHaveLength(1);
        expect(session?.messages[0].content).toBe('good');
    });

    it('removeJournalChatSessions clears freeform and continue sessions only', async () => {
        const now = Date.now();
        await saveSession(makeSession({
            conversationId: 'journal_freeform', mode: 'freeform', updatedAt: now - 2000, createdAt: now - 2000,
        }));
        await saveSession(makeSession({
            conversationId: 'journal_continue', mode: 'continue', updatedAt: now - 1500, createdAt: now - 1500,
        }));
        await saveSession(makeSession({
            conversationId: 'intention_morning', mode: 'morning', updatedAt: now - 1000, createdAt: now - 1000,
        }));
        await saveSession(makeSession({
            conversationId: 'intention_checkin', mode: 'intention', updatedAt: now - 500, createdAt: now - 500,
        }));

        await removeJournalChatSessions();

        const remaining = await loadSessions();
        expect(remaining.map((s) => s.conversationId)).toEqual([
            'intention_checkin',
            'intention_morning',
        ]);
    });
});
