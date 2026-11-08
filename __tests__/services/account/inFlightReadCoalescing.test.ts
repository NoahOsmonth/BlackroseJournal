import {
    accountScopedStorage,
    createAccountScopedStorageAdapter,
    getStorageForAccount,
    resetAccountStorageAdapter,
    setAccountStorageAdapter,
} from '@/services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '@/services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '@/services/account/accountRuntime';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((next) => { resolve = next; });
    return { promise, resolve };
}

function countingAdapter() {
    const values = new Map<string, string>();
    const reads: string[] = [];
    let gate: { promise: Promise<string | null>; resolve: (v: string | null) => void } | null = null;
    const adapter: AccountStorageAdapter = {
        getItem: async (key) => {
            reads.push(key);
            // One-shot: only the FIRST read is held, so a later read after a
            // write sees the real stored value (models a real backend).
            if (gate) {
                const held = gate;
                gate = null;
                return held.promise;
            }
            return values.get(key) ?? null;
        },
        setItem: async (key, value) => { values.set(key, value); },
        removeItem: async (key) => { values.delete(key); },
    };
    return { adapter, values, reads, setGate: (g: typeof gate) => { gate = g; } };
}

describe('cold-mount in-flight read coalescing', () => {
    beforeEach(async () => {
        await clearActiveAccount();
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetAccountStorageAdapter();
    });

    it('N concurrent readers of one key share ONE underlying read', async () => {
        const c = countingAdapter();
        const gate = deferred<string | null>();
        c.setGate(gate);
        setAccountStorageAdapter(c.adapter);
        await activateAccount('account-a');

        const readers = Array.from({ length: 8 }, () =>
            getStorageForAccount('account-a').getItem('@journal_entries'));
        expect(c.reads).toHaveLength(1);
        gate.resolve('payload');
        const results = await Promise.all(readers);
        expect(results.every((value) => value === 'payload')).toBe(true);
        expect(c.reads).toHaveLength(1);
    });

    it('does NOT cache a settled value: a later read hits storage again', async () => {
        const c = countingAdapter();
        setAccountStorageAdapter(c.adapter);
        await activateAccount('account-a');
        const store = getStorageForAccount('account-a');
        await store.getItem('@goals');
        await store.getItem('@goals');
        expect(c.reads).toHaveLength(2);
    });

    it('keeps different keys and different accounts separate', async () => {
        const c = countingAdapter();
        const gate = deferred<string | null>();
        c.setGate(gate);
        setAccountStorageAdapter(c.adapter);
        await activateAccount('account-a');
        const a = getStorageForAccount('account-a');
        const b = getStorageForAccount('account-b');
        const pending = [
            a.getItem('@goals'), a.getItem('@journal_entries'), b.getItem('@goals'),
        ];
        expect(c.reads).toHaveLength(3);
        gate.resolve(null);
        await Promise.all(pending);
    });

    it('a write between reads invalidates the pending promise (freshness)', async () => {
        const c = countingAdapter();
        const gate = deferred<string | null>();
        c.setGate(gate);
        setAccountStorageAdapter(c.adapter);
        await activateAccount('account-a');
        const store = getStorageForAccount('account-a');
        const first = store.getItem('@goals');
        expect(c.reads).toHaveLength(1);
        // Write resolves with the new value and breaks the shared read. The
        // pending reader keeps its own promise, but the NEXT read is fresh.
        await store.setItem('@goals', 'new');
        const second = store.getItem('@goals');
        expect(c.reads).toHaveLength(2);
        gate.resolve('old');
        await first;
        expect(await second).toBe('new');
    });

    it('removeItem invalidates too', async () => {
        const c = countingAdapter();
        const gate = deferred<string | null>();
        c.setGate(gate);
        setAccountStorageAdapter(c.adapter);
        await activateAccount('account-a');
        const store = getStorageForAccount('account-a');
        const first = store.getItem('@goals');
        await store.removeItem('@goals');
        const second = store.getItem('@goals');
        expect(c.reads).toHaveLength(2);
        gate.resolve('x');
        await Promise.all([first, second]);
    });

    it('a rejected read does not poison the map', async () => {
        // Same adapter, no reset/swap: only the .finally() cleanup can clear it.
        const values = new Map<string, string>();
        let calls = 0;
        const flaky: AccountStorageAdapter = {
            getItem: async (key) => {
                calls += 1;
                if (calls === 1) throw new Error('backend offline');
                return values.get(key) ?? null;
            },
            setItem: async (key, value) => { values.set(key, value); },
            removeItem: async (key) => { values.delete(key); },
        };
        setAccountStorageAdapter(flaky);
        await activateAccount('account-a');
        const store = getStorageForAccount('account-a');
        await expect(store.getItem('@goals')).rejects.toThrow('backend offline');
        // A settled-value cache would leave the rejection cached forever.
        expect(await store.getItem('@goals')).toBeNull();
        expect(calls).toBe(2);
    });

    it('the shared singleton coalesces too', async () => {
        const c = countingAdapter();
        const gate = deferred<string | null>();
        c.setGate(gate);
        setAccountStorageAdapter(c.adapter);
        await activateAccount('account-a');
        const readers = Array.from({ length: 5 }, () => accountScopedStorage.getItem('@goals'));
        expect(c.reads).toHaveLength(1);
        gate.resolve('v');
        await Promise.all(readers);
    });

    it('swapping the adapter clears pending reads', async () => {
        const first = countingAdapter();
        const gate = deferred<string | null>();
        first.setGate(gate);
        setAccountStorageAdapter(first.adapter);
        await activateAccount('account-a');
        const pending = getStorageForAccount('account-a').getItem('@goals');
        const second = countingAdapter();
        setAccountStorageAdapter(second.adapter);
        const fresh = getStorageForAccount('account-a').getItem('@goals');
        expect(second.reads).toHaveLength(1);
        gate.resolve('a');
        await pending;
        expect(await fresh).toBeNull();
    });

    it('the constructor itself coalesces when used directly', async () => {
        const c = countingAdapter();
        const gate = deferred<string | null>();
        c.setGate(gate);
        const adapter = createAccountScopedStorageAdapter(c.adapter, 'account-a');
        const readers = Array.from({ length: 4 }, () => adapter.getItem('@goals'));
        expect(c.reads).toHaveLength(1);
        gate.resolve('v');
        await Promise.all(readers);
    });
});
