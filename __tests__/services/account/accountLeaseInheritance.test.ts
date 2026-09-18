/* eslint-disable import/first */

/**
 * Regression tests for DEF-003 (lease half): operations acquired inside an
 * account-bound operation must inherit that operation's pinned account, so a
 * live global re-bind (auth teardown/re-activation after a failed session
 * check) mid-run cannot scatter nested writes into a different account scope.
 *
 * The global is re-bound synchronously (teardown-style) rather than via
 * activateAccount/clearActiveAccount, whose switch queue would legitimately
 * block behind the in-flight outer operation.
 */

import {
    activateAccount,
    clearActiveAccount,
    runAccountBoundOperation,
    getActiveAccountId,
    acquireAccountOperationLease,
    __rebindActiveAccountIdForTests,
} from '../../../services/account/accountRuntime';

describe('account lease inheritance (DEF-003)', () => {
    beforeEach(async () => {
        await activateAccount('user-a');
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('outer lease records the account it was acquired under', async () => {
        let seen: string | null = null;
        await runAccountBoundOperation('outer', async (ctx) => {
            seen = ctx.accountId;
        });
        expect(seen).toBe('user-a');
    });

    it('inner leases inherit the outer lease account even if the global changes', async () => {
        let innerAccountId: string | null = 'sentinel';

        await runAccountBoundOperation('outer', async () => {
            // Re-bind mid-flight exactly as the auth coordinator's final state
            // mutation would after a teardown/re-activation cycle. The queue-
            // based helpers cannot run here (they would block behind this very
            // operation — quiesce waits for in-flight ops by design).
            __rebindActiveAccountIdForTests('user-b');
            const inner = acquireAccountOperationLease('inner');
            innerAccountId = inner.accountId;
            inner.release();
        });

        expect(innerAccountId).toBe('user-a');
        expect(getActiveAccountId()).toBe('user-b');
    }, 15000);
});
