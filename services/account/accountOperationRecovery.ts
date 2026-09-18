import { activateAccount, getActiveAccountId } from './accountRuntime';

/**
 * Account-lease recovery for strictly local operations.
 *
 * WHAT WENT WRONG (docs/qa/DEFECTS.md DEF-011 / DEF-012): a destructive
 * device-local action (Clear History, Restore local backup) ran inside one
 * long account lease. A step in that lease reached for a remote gateway, the
 * auth refresh failed against an unreachable auth host, the auth coordinator
 * re-bound the account, and `quiesceAccountOperations` aborted every in-flight
 * lease. The local deletes therefore never ran, and the only error channel was
 * `Alert.alert` - a no-op on web - so the wipe looked "silent". (The remote
 * gateway and the remote auth host were both removed on 2026-09-18; the
 * account binding they used to race with is now device-local, so the lease
 * retry below stays as cheap insurance rather than a live failure mode.)
 *
 * The doctrine these helpers encode: a device-local write must not be
 * defeated by an unreachable network. Local work runs first, and a transient
 * lease abort is retried once with a fresh lease instead of being reported as
 * a failure the user cannot see.
 */

const LEASE_ERROR_FRAGMENTS = [
    'account operation was aborted',
    'account switch is in progress',
    'account-bound operation is unavailable before auth bootstrap completes',
];

export function isAccountLeaseError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    const message = error.message.toLowerCase();
    return LEASE_ERROR_FRAGMENTS.some((fragment) => message.includes(fragment));
}

/**
 * Run a local-only operation, retrying once when the account lease was
 * aborted out from under it (a re-bind, not a real failure).
 *
 * Recovery is deliberately narrow:
 * - Only lease errors retry; genuine failures still propagate.
 * - The pinned account must still be the active account. A real switch to a
 *   different user is never fought, so this cannot resurrect a signed-out
 *   session or write into the wrong scope.
 * - `activateAccount` is enqueued even when it is the same account: that is
 *   how we wait for the in-flight switch queue to drain before retrying.
 */
export async function runLocalOperationWithAccountRecovery<T>(
    pinnedAccountId: string | null,
    operation: () => Promise<T>,
): Promise<T> {
    // No pinned account (auth bootstrap has not bound one yet): stay out of
    // the way and let the operation apply its own guard, exactly as before.
    if (!pinnedAccountId) {
        return operation();
    }

    const assertPinned = (): void => {
        if (getActiveAccountId() !== pinnedAccountId) {
            throw new Error('Account operation was aborted.');
        }
    };

    try {
        assertPinned();
        return await operation();
    } catch (error) {
        if (!isAccountLeaseError(error)) {
            throw error;
        }
        assertPinned();
        // Enqueued even for the same account: that is how we wait for the
        // in-flight switch queue to drain before retrying.
        await activateAccount(pinnedAccountId);
        // Re-check AFTER the drain, immediately before the operation runs. The
        // operation acquires its lease synchronously, so no switch can slip in
        // and scope the retry to a different account.
        assertPinned();
        return await operation();
    }
}
