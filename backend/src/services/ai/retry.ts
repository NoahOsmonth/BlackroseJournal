/**
 * PR3 — withRetry helper.
 *
 * Wraps an async operation with bounded retries. Backoff uses
 * `baseMs * 4^attempt` (default 200ms → 800ms) with ±20% jitter to avoid
 * thundering herd. Non-retryable errors propagate immediately.
 *
 * Defaults: maxAttempts=2 (1 initial + 1 retry), baseMs=200. These map
 * directly to the openai-compat adapter's 429/503 policy.
 */

export interface RetryError {
    status?: number;
    name?: string;
    message?: string;
}

export interface RetryOptions {
    maxAttempts?: number;
    baseMs?: number;
}

export type IsRetryable = (err: unknown) => boolean;

const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_BASE_MS = 200;
const JITTER = 0.2;

function computeBackoffMs(attempt: number, baseMs: number): number {
    const base = baseMs * Math.pow(4, attempt);
    const variance = base * JITTER;
    const offset = (Math.random() * 2 - 1) * variance;
    return Math.max(0, Math.round(base + offset));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    isRetryable: IsRetryable,
    opts: RetryOptions = {}
): Promise<T> {
    const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const baseMs = opts.baseMs ?? DEFAULT_BASE_MS;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (!isRetryable(err)) {
                throw err;
            }
            const isLast = attempt === maxAttempts - 1;
            if (isLast) {
                break;
            }
            const delay = computeBackoffMs(attempt, baseMs);
            await sleep(delay);
        }
    }

    throw lastError;
}
