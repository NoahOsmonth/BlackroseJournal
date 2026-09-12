/**
 * Async helpers shared across features. Pure — no I/O, no hooks, no side effects.
 */

/**
 * Rejects with a labelled error if `promise` has not settled within `ms`.
 *
 * Used to keep one hung provider call from pinning a user-facing screen or
 * blocking the Finish path: callers fall back to their safe default and let
 * the original promise settle unobserved.
 */
export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label = 'Operation',
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
        try {
            promise.then(
                (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                (error: unknown) => {
                    clearTimeout(timer);
                    reject(error);
                },
            );
        } catch (error: unknown) {
            // A non-thenable input (bad mock, untyped caller) must not leak the timer.
            clearTimeout(timer);
            reject(error);
        }
    });
}
