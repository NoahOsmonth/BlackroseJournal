/**
 * Lock implementation for supabase-js auth (`auth.lock`).
 *
 * Why this exists: supabase-js defaults to the Navigator LockManager on web and
 * aborts a queued acquire with a raw DOMException (`AbortError: signal is aborted
 * without reason`) once `lockAcquireTimeout` (10s) elapses. One unreachable auth
 * server is enough to hit it — `_recoverAndRefresh` retries a failed token
 * refresh **while holding the lock** for up to `AUTO_REFRESH_TICK_DURATION_MS`
 * (30s), so every other auth caller on the origin is aborted at 10s, and those
 * rejections surface as uncaught page errors (Expo red box).
 *
 * This lock keeps cross-document exclusion when it can, waits longer before
 * giving up, and finally falls back to an in-process queue instead of failing
 * the caller. It never throws a lock-acquire failure.
 */

export type AuthLockFn = <R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
) => Promise<R>;

/** Ceiling for a single cross-document acquire before we retry/fall back. */
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10_000;
/** Retry ceiling: the holder may be mid-refresh-retry (~30s tick), so wait it out. */
const CROSS_DOCUMENT_RETRY_MS = 45_000;
/**
 * Safety valve for the in-process queue: if the operation ahead of us never
 * settles (a wedged client, or an unexpected nested acquire), run anyway rather
 * than hanging the caller forever.
 */
const IN_PROCESS_WAIT_MS = 30_000;

export type LockRequestOptions = {
    mode?: 'exclusive' | 'shared';
    signal?: AbortSignal;
    ifAvailable?: boolean;
};

export interface CrossDocumentLockManager {
    request(
        name: string,
        options: LockRequestOptions,
        callback: () => Promise<unknown>
    ): Promise<unknown>;
}

const inProcessQueues = new Map<string, Promise<unknown>>();

function crossDocumentLocks(): CrossDocumentLockManager | null {
    const locks = (globalThis as {
        navigator?: { locks?: CrossDocumentLockManager };
    }).navigator?.locks;

    return locks && typeof locks.request === 'function' ? locks : null;
}

function isAbortLike(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const name = (error as { name?: unknown }).name;
    return name === 'AbortError' || name === 'TimeoutError' || name === 'NotAllowedError';
}

/**
 * Serializes same-name operations inside this JS context. Today's client is a
 * singleton, but concurrent boot callers all issue `getSession()` before the
 * first one has been granted the lock — that race is what strands them behind
 * the cross-document queue.
 */
export function runSerialized<T>(
    name: string,
    waitMs: number,
    fn: () => Promise<T>
): Promise<T> {
    const previous = inProcessQueues.get(name) ?? Promise.resolve();
    const ready = previous.then(() => undefined, () => undefined);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), waitMs);
    });

    const run = Promise.race([ready.then(() => 'ready' as const), timedOut])
        .then(async (gate) => {
            if (gate === 'timeout') {
                console.warn(
                    `[auth] Supabase auth lock "${name}" was still busy after ${waitMs}ms; proceeding without in-process exclusion.`
                );
            }
            return await fn();
        })
        .finally(() => {
            if (timer) clearTimeout(timer);
        });

    // Registered synchronously so callers in the same tick queue behind us.
    inProcessQueues.set(name, run.then(() => undefined, () => undefined));
    return run;
}

async function requestCrossDocumentLock<R>(
    locks: CrossDocumentLockManager,
    name: string,
    timeoutMs: number,
    run: () => Promise<R>
): Promise<{ granted: boolean; value: R | undefined }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let started = false;

    try {
        const value = await locks.request(
            name,
            { mode: 'exclusive', signal: controller.signal },
            async () => {
                started = true;
                clearTimeout(timer);
                return await run();
            }
        ) as R;
        return { granted: true, value };
    } catch (error) {
        // Aborted before the callback ran: someone else held the lock. Anything
        // thrown from inside `run` (or after the grant) is the caller's business.
        if (!started && isAbortLike(error)) return { granted: false, value: undefined };
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

export const resilientAuthLock: AuthLockFn = <R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> => {
    const firstCeiling = acquireTimeout > 0 ? acquireTimeout : DEFAULT_ACQUIRE_TIMEOUT_MS;

    return runSerialized(name, IN_PROCESS_WAIT_MS, async () => {
        const locks = crossDocumentLocks();
        if (!locks) return await fn();

        const first = await requestCrossDocumentLock(locks, name, firstCeiling, fn);
        if (first.granted) return first.value as R;

        const retry = await requestCrossDocumentLock(locks, name, CROSS_DOCUMENT_RETRY_MS, fn);
        if (retry.granted) return retry.value as R;

        console.warn(
            `[auth] Another tab held the Supabase auth lock "${name}" for over ${CROSS_DOCUMENT_RETRY_MS}ms; continuing without cross-tab exclusion.`
        );
        return await fn();
    });
};

/** Test seam: drops queued in-process operations. */
export function resetAuthLockQueues(): void {
    inProcessQueues.clear();
}

export const AUTH_LOCK_TIMINGS = {
    DEFAULT_ACQUIRE_TIMEOUT_MS,
    CROSS_DOCUMENT_RETRY_MS,
    IN_PROCESS_WAIT_MS,
} as const;
