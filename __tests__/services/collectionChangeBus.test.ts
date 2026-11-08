import { createAccountScopedStorageAdapter, subscribeCollectionChanges } from '../../services/account/accountScopedStorage';

function memoryAdapter() {
    const rows = new Map<string, string>();
    const writes: string[] = [];
    return {
        rows,
        writes,
        adapter: {
            getItem: (k: string) => Promise.resolve(rows.get(k) ?? null),
            setItem: (k: string, v: string) => { rows.set(k, v); writes.push(k); return Promise.resolve(); },
            removeItem: (k: string) => { rows.delete(k); writes.push(k); return Promise.resolve(); },
        },
    };
}

describe('collection change bus', () => {
    it('notifies with the UNSCOPED owner key after a real write', async () => {
        const m = memoryAdapter();
        const a = createAccountScopedStorageAdapter(m.adapter, 'account-a');
        const seen: string[] = [];
        const off = subscribeCollectionChanges((k) => seen.push(k));
        await a.setItem('@journal_entries', '{"ok":1}');
        expect(seen).toEqual(['@journal_entries']);
        // The value is really there; the signal is not a phantom.
        expect(m.rows.size).toBe(1);
        off();
    });

    it('notifies on remove, and stops after unsubscribe', async () => {
        const m = memoryAdapter();
        const a = createAccountScopedStorageAdapter(m.adapter, 'account-a');
        const seen: string[] = [];
        const off = subscribeCollectionChanges((k) => seen.push(k));
        await a.removeItem('@goals');
        off();
        await a.setItem('@goals', '{}');
        expect(seen).toEqual(['@goals']);
    });

    it('does NOT notify when a write fails', async () => {
        const seen: string[] = [];
        const off = subscribeCollectionChanges((k) => seen.push(k));
        const failing = {
            getItem: () => Promise.resolve(null),
            setItem: () => Promise.reject(new Error('disk full')),
            removeItem: () => Promise.reject(new Error('disk full')),
        };
        const a = createAccountScopedStorageAdapter(failing, 'account-a');
        await expect(a.setItem('@journal_entries', '{}')).rejects.toThrow('disk full');
        expect(seen).toEqual([]);
        off();
    });

    it('a broken listener cannot break the write', async () => {
        const m = memoryAdapter();
        const a = createAccountScopedStorageAdapter(m.adapter, 'account-a');
        const seen: string[] = [];
        const bad = subscribeCollectionChanges(() => { throw new Error('listener exploded'); });
        const good = subscribeCollectionChanges((k) => seen.push(k));
        await expect(a.setItem('@intentions', '{}')).resolves.toBeUndefined();
        expect(seen).toEqual(['@intentions']);
        bad(); good();
    });

    it('reads do not notify, and coalesced reads still return the value', async () => {
        const m = memoryAdapter();
        const a = createAccountScopedStorageAdapter(m.adapter, 'account-a');
        const seen: string[] = [];
        const off = subscribeCollectionChanges((k) => seen.push(k));
        await a.setItem('@journal_entries', '{"v":2}');
        seen.length = 0;
        const [one, two] = await Promise.all([
            a.getItem('@journal_entries'),
            a.getItem('@journal_entries'),
        ]);
        expect(one).toBe('{"v":2}');
        expect(two).toBe('{"v":2}');
        expect(seen).toEqual([]);
        off();
    });

    it('a read started after a write never joins a pre-write promise', async () => {
        const m = memoryAdapter();
        const a = createAccountScopedStorageAdapter(m.adapter, 'account-a');
        await a.setItem('@goals', '{"v":1}');
        const read = a.getItem('@goals');
        await a.setItem('@goals', '{"v":2}');
        const fresh = await a.getItem('@goals');
        expect(fresh).toBe('{"v":2}');
        await read;
    });
});
