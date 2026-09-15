import {
    AUTH_LOCK_TIMINGS,
    resetAuthLockQueues,
    resilientAuthLock,
    runSerialized,
    type LockRequestOptions,
} from '@/services/supabase/authLock';

interface RecordedRequest {
    name: string;
    options: LockRequestOptions;
}

/** Lets queued microtasks (and the zero-delay gate) settle. */
function flushTimers(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function abortError(): Error {
    const error = new Error('signal is aborted without reason');
    error.name = 'AbortError';
    return error;
}

function installNavigatorLocks(locks: unknown): () => void {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { locks },
        configurable: true,
        writable: true,
    });
    return () => {
        if (original) {
            Object.defineProperty(globalThis, 'navigator', original);
        } else {
            delete (globalThis as { navigator?: unknown }).navigator;
        }
    };
}

function grantingLockManager(requests: RecordedRequest[]) {
    return {
        request: async (
            name: string,
            options: LockRequestOptions,
            callback: () => Promise<unknown>
        ) => {
            requests.push({ name, options });
            return await callback();
        },
    };
}

/** Mimics Chrome: the request only rejects, with a raw AbortError, when aborted. */
function neverGrantingLockManager(requests: RecordedRequest[]) {
    return {
        request: (name: string, options: LockRequestOptions) => {
            requests.push({ name, options });
            return new Promise((_resolve, reject) => {
                options.signal?.addEventListener('abort', () => reject(abortError()));
            });
        },
    };
}

describe('resilientAuthLock', () => {
    let restoreNavigator: (() => void) | null = null;
    let warn: jest.SpyInstance;

    beforeEach(() => {
        resetAuthLockQueues();
        warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        restoreNavigator?.();
        restoreNavigator = null;
        warn.mockRestore();
        jest.useRealTimers();
    });

    it('runs the operation directly when no Navigator lock manager exists', async () => {
        restoreNavigator = installNavigatorLocks(undefined);

        await expect(resilientAuthLock('lock:auth', 10_000, async () => 'value'))
            .resolves.toBe('value');
    });

    it('acquires the cross-document lock and returns the operation result', async () => {
        const requests: RecordedRequest[] = [];
        restoreNavigator = installNavigatorLocks(grantingLockManager(requests));

        await expect(
            resilientAuthLock('lock:auth', 10_000, async () => 'granted')
        ).resolves.toBe('granted');
        expect(requests).toHaveLength(1);
        expect(requests[0].name).toBe('lock:auth');
        expect(requests[0].options.mode).toBe('exclusive');
    });

    it('falls back in-process instead of throwing when the acquire aborts', async () => {
        jest.useFakeTimers();
        const requests: RecordedRequest[] = [];
        restoreNavigator = installNavigatorLocks(neverGrantingLockManager(requests));
        const operation = jest.fn(async () => 'offline-value');

        const pending = resilientAuthLock('lock:auth', AUTH_LOCK_TIMINGS.DEFAULT_ACQUIRE_TIMEOUT_MS, operation);
        await jest.advanceTimersByTimeAsync(
            AUTH_LOCK_TIMINGS.DEFAULT_ACQUIRE_TIMEOUT_MS + AUTH_LOCK_TIMINGS.CROSS_DOCUMENT_RETRY_MS + 1
        );

        // Two cross-document attempts abort (10s ceiling + retry ceiling), then the
        // operation still runs — supabase-js would have rejected with the AbortError.
        await expect(pending).resolves.toBe('offline-value');
        expect(requests).toHaveLength(2);
        expect(operation).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalled();
    });

    it('propagates a real failure thrown by the operation', async () => {
        restoreNavigator = installNavigatorLocks(undefined);

        await expect(
            resilientAuthLock('lock:auth', 10_000, async () => {
                throw new Error('storage exploded');
            })
        ).rejects.toThrow('storage exploded');
    });

    it('queues same-name operations behind the previous one', async () => {
        restoreNavigator = installNavigatorLocks(undefined);
        const order: string[] = [];
        let releaseFirst: () => void = () => undefined;
        const firstGate = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });

        const first = runSerialized('lock:auth', AUTH_LOCK_TIMINGS.IN_PROCESS_WAIT_MS, async () => {
            order.push('first:start');
            await firstGate;
            order.push('first:end');
        });
        const second = runSerialized('lock:auth', AUTH_LOCK_TIMINGS.IN_PROCESS_WAIT_MS, async () => {
            order.push('second:start');
        });

        await flushTimers();
        expect(order).toEqual(['first:start']);
        releaseFirst();
        await Promise.all([first, second]);

        expect(order).toEqual(['first:start', 'first:end', 'second:start']);
    });
});
