/**
 * PR3 — withRetry contract tests.
 *
 * The retry helper backs the adapter's 429/503 retry policy. It must:
 *   - default to maxAttempts=2 (1 initial + 1 retry)
 *   - back off baseMs * 4^attempt with ±20% jitter
 *   - skip retries when isRetryable returns false
 *   - surface the last error after exhausting attempts
 */
import { withRetry } from '../../../backend/src/services/ai/retry';

interface RetryableError extends Error {
    status?: number;
}

function retryableError(status: number, message = 'retryable'): RetryableError {
    const err = new Error(message) as RetryableError;
    err.status = status;
    err.name = 'RetryableError';
    return err;
}

function nonRetryableError(): RetryableError {
    const err = new Error('non-retryable') as RetryableError;
    err.status = 400;
    err.name = 'NonRetryableError';
    return err;
}

const isRetryable = (err: unknown): boolean => {
    const e = err as RetryableError;
    return e?.status === 429 || e?.status === 503;
};

describe('withRetry', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('1. returns the first result when isRetryable returns false (no retry needed)', async () => {
        const fn = jest.fn().mockResolvedValue('ok');
        const promise = withRetry(fn, () => false);
        await expect(promise).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('2. retries once on a retryable error and then succeeds', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(retryableError(429))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, isRetryable);
        // First attempt rejects, then we schedule a 200ms backoff, then retry.
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(promise).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('3. throws the last error after maxAttempts on a persistent retryable error', async () => {
        const fn = jest.fn().mockRejectedValue(retryableError(503));
        const promise = withRetry(fn, isRetryable, { maxAttempts: 2, baseMs: 1 });
        promise.catch(() => undefined);
        await jest.advanceTimersByTimeAsync(10_000);
        await expect(promise).rejects.toThrow('retryable');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('4. non-retryable error propagates immediately without retry', async () => {
        const fn = jest.fn().mockRejectedValue(nonRetryableError());
        const promise = withRetry(fn, isRetryable);
        await expect(promise).rejects.toThrow('non-retryable');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('5. backoff delay is within ±20% of baseMs * 4^attempt', async () => {
        const baseMs = 200;
        // Spy on setTimeout to capture the actual scheduled delay.
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const fn = jest
            .fn()
            .mockRejectedValueOnce(retryableError(429))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, isRetryable, { baseMs, maxAttempts: 2 });
        await jest.advanceTimersByTimeAsync(2_000);
        await expect(promise).resolves.toBe('ok');

        // The first backoff schedule (after attempt 0) should be near 200ms ± 20%.
        const scheduleCalls = setTimeoutSpy.mock.calls
            .map(([, delay]) => delay)
            .filter((d): d is number => typeof d === 'number');
        const expectedFirst = 200;
        const firstBackoff = scheduleCalls[0] ?? 0;
        expect(firstBackoff).toBeGreaterThanOrEqual(expectedFirst * 0.8);
        expect(firstBackoff).toBeLessThanOrEqual(expectedFirst * 1.2);
        setTimeoutSpy.mockRestore();
    });

    it('6. honors custom maxAttempts and baseMs', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(retryableError(429))
            .mockRejectedValueOnce(retryableError(429))
            .mockResolvedValueOnce('ok');
        const promise = withRetry(fn, isRetryable, { maxAttempts: 3, baseMs: 50 });
        await jest.advanceTimersByTimeAsync(5_000);
        await expect(promise).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(3);
    });
});
