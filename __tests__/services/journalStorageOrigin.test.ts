import {
    clearAllEntries,
    createEntry,
    getEntry,
    importJournalEntriesSnapshot,
    resetStorageAdapter,
    setStorageAdapter,
} from '../../services/journal/journalStorage';
import type { StorageAdapter } from '../../services/journal/journalStorage.types';

function createAdapter(): StorageAdapter {
    const store = new Map<string, string>();
    return {
        getItem: (key) => Promise.resolve(store.get(key) ?? null),
        setItem: (key, value) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key) => {
            store.delete(key);
            return Promise.resolve();
        },
    };
}

const message = { id: 'm1', role: 'user' as const, content: 'Calm mornings help.', timestamp: 1 };

describe('journal entry origin', () => {
    beforeEach(() => setStorageAdapter(createAdapter()));
    afterEach(async () => {
        await clearAllEntries();
        resetStorageAdapter();
    });

    it("records 'threads' for a note written on Explore", async () => {
        const entry = await createEntry({ messages: [message], status: 'completed', origin: 'threads' });
        expect(entry.origin).toBe('threads');
        await expect(getEntry(entry.id)).resolves.toMatchObject({ origin: 'threads' });
    });

    it("leaves origin undefined for a chat entry, so old readers are unaffected", async () => {
        const entry = await createEntry({ messages: [message], status: 'completed' });
        expect(entry.origin).toBeUndefined();
    });

    it('preserves origin through an export/import round-trip', async () => {
        const entry = await createEntry({ messages: [message], status: 'completed', origin: 'threads' });
        const snapshot = JSON.stringify({ [entry.id]: entry });
        await importJournalEntriesSnapshot(snapshot);
        await expect(getEntry(entry.id)).resolves.toMatchObject({ origin: 'threads' });
    });
});
