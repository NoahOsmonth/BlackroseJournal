/* eslint-disable import/first */

const mockStore = new Map<string, string>();
type Deferred = { promise: Promise<void>; resolve: () => void };
let mockFailNextWrite = false;
let mockDelayedWrite: Deferred | null = null;
let mockDelayedWriteStarted: (() => void) | null = null;
let mockCrashWriteCount = 0;

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            if (mockFailNextWrite) {
                mockFailNextWrite = false;
                throw new Error('Storage is full');
            }
            // The scoped key strips the leading `@` from the owner key.
            if (key.endsWith('blackrose_crash_logs') && mockDelayedWrite && mockCrashWriteCount === 0) {
                mockCrashWriteCount += 1;
                mockDelayedWriteStarted?.();
                await mockDelayedWrite.promise;
            }
            mockStore.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockStore.delete(key);
        }),
    },
}));

import {
    CRASH_LOG_STORAGE_KEY,
    MAX_CRASH_LOG_RECORDS,
    clearCrashLogs,
    describeCrash,
    loadCrashLogState,
    markCrashLogsSeen,
    recordCrashLog,
} from '../../services/crash/crashLogStorage';
import { countUnseenCrashes } from '../../services/crash/crashReport';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import { getAccountScopedStorageKeyForAccount } from '../../services/account/accountScopedStorage';

function deferred(): Deferred {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

function scopedCrashKey(): string {
    return getAccountScopedStorageKeyForAccount(CRASH_LOG_STORAGE_KEY, 'crash-account');
}

function storedRecords() {
    const raw = mockStore.get(scopedCrashKey());
    return raw ? (JSON.parse(raw) as { records: unknown[] }).records : [];
}

describe('crashLogStorage', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        mockStore.clear();
        mockFailNextWrite = false;
        mockDelayedWrite = null;
        mockDelayedWriteStarted = null;
        mockCrashWriteCount = 0;
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-07T10:00:00Z'));
        await activateAccount('crash-account');
    });

    afterEach(async () => {
        jest.useRealTimers();
        await clearActiveAccount();
    });

    it('records a crash with its message, stack and where it was caught', async () => {
        const error = new Error('Cannot read property of undefined');
        const record = await recordCrashLog({ error, isFatal: true, component: 'globalHandler' });

        expect(record).not.toBeNull();
        expect(record?.message).toBe('Cannot read property of undefined');
        expect(record?.component).toBe('globalHandler');
        expect(record?.isFatal).toBe(true);
        expect(record?.createdAt).toBe(Date.now());

        const stored = JSON.parse(mockStore.get(scopedCrashKey()) ?? '{}');
        expect(stored.schemaVersion).toBe(1);
        expect(stored.records).toHaveLength(1);

        const state = await loadCrashLogState();
        expect(state.records).toHaveLength(1);
        expect(state.lastSeenAt).toBe(0);
    });

    it('keeps the newest records and drops the oldest past the cap', async () => {
        for (let index = 0; index < MAX_CRASH_LOG_RECORDS + 3; index += 1) {
            jest.setSystemTime(new Date(2026, 5, 7, 10, 0, index));
            await recordCrashLog({ error: new Error(`crash ${index}`) });
        }

        const state = await loadCrashLogState();
        expect(state.records).toHaveLength(MAX_CRASH_LOG_RECORDS);
        expect(state.records[0].message).toBe(`crash ${MAX_CRASH_LOG_RECORDS + 2}`);
        expect(state.records.map((entry) => entry.message)).not.toContain('crash 0');
    });

    it('serializes concurrent crash writes so neither record is lost', async () => {
        const releaseFirstWrite = deferred();
        const firstWriteStarted = deferred();
        mockDelayedWrite = releaseFirstWrite;
        mockDelayedWriteStarted = firstWriteStarted.resolve;

        const first = recordCrashLog({ error: new Error('first crash') });
        await firstWriteStarted.promise;
        const second = recordCrashLog({ error: new Error('second crash') });
        releaseFirstWrite.resolve();

        await Promise.all([first, second]);
        const state = await loadCrashLogState();
        expect(state.records.map((entry) => entry.message).sort()).toEqual([
            'first crash',
            'second crash',
        ]);
    });

    it('treats malformed persisted crash logs as an empty store', async () => {
        mockStore.set(scopedCrashKey(), '{not valid json');

        await expect(loadCrashLogState()).resolves.toEqual({ records: [], lastSeenAt: 0 });
    });

    it('reads a bare array written by an older build', async () => {
        mockStore.set(scopedCrashKey(), JSON.stringify([{
            id: 'legacy',
            message: 'Legacy crash',
            component: 'boundary',
            isFatal: true,
            createdAt: 1,
        }]));

        const state = await loadCrashLogState();
        expect(state.records).toHaveLength(1);
        expect(state.records[0].message).toBe('Legacy crash');
        expect(state.lastSeenAt).toBe(0);
    });

    it('never throws when the crash cannot be persisted', async () => {
        mockFailNextWrite = true;

        await expect(recordCrashLog({ error: new Error('boom') })).resolves.toBeNull();
        await expect(loadCrashLogState()).resolves.toEqual({ records: [], lastSeenAt: 0 });
    });

    it('marks the stored crashes as seen so the banner stops asking', async () => {
        await recordCrashLog({ error: new Error('seen me') });
        jest.setSystemTime(new Date('2026-06-07T10:05:00Z'));

        await markCrashLogsSeen();

        const state = await loadCrashLogState();
        expect(state.lastSeenAt).toBe(Date.now());
        expect(countUnseenCrashes(state)).toBe(0);
        expect(state.records).toHaveLength(1);
    });

    it('clears every stored crash', async () => {
        await recordCrashLog({ error: new Error('one') });
        await recordCrashLog({ error: new Error('two') });

        await clearCrashLogs();

        expect(storedRecords()).toEqual([]);
        await expect(loadCrashLogState()).resolves.toEqual({ records: [], lastSeenAt: 0 });
    });

    it('scopes the crash log key to the active account', async () => {
        await recordCrashLog({ error: new Error('scoped') });

        const scopedKey = getAccountScopedStorageKeyForAccount(
            CRASH_LOG_STORAGE_KEY,
            'crash-account',
        );
        expect(mockStore.has(scopedKey)).toBe(true);

        await activateAccount('other-account');
        await expect(loadCrashLogState()).resolves.toEqual({ records: [], lastSeenAt: 0 });
    });

    it('describes thrown values that are not Error instances', () => {
        expect(describeCrash('plain string')).toEqual({ message: 'plain string' });
        expect(describeCrash({ message: 'object message' })).toEqual({
            message: 'object message',
            stack: undefined,
        });
        expect(describeCrash(null).message).toBe('Non-error value thrown: null');
    });
});
