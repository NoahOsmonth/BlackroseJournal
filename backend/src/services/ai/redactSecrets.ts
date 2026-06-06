/**
 * PR3 — Key-based secret redaction helper.
 *
 * Replaces every literal occurrence of `key` in `input` with the string
 * `'[REDACTED]'`. API keys are case-sensitive, so the match is too. If
 * `key` is missing/empty, the input is returned untouched.
 *
 * Used by the adapter before every `console.warn` / `console.error` so a
 * raw key never lands in logs.
 */
export function redactSecrets(input: string, key?: string): string {
    if (!key) {
        return input;
    }
    return input.split(key).join('[REDACTED]');
}
