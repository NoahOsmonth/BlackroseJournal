import {
    activateAccount,
    clearActiveAccount,
    getActiveAccountId,
} from '../../../services/account/accountRuntime';
import {
    isAccountLeaseError,
    runLocalOperationWithAccountRecovery,
} from '../../../services/account/accountOperationRecovery';

const LEASE_ABORT = new Error('Account operation was aborted.');

describe('account operation recovery', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        await activateAccount('recovery-user');
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('recognises the three lease failure messages and nothing else', () => {
        expect(isAccountLeaseError(new Error('Account operation was aborted.'))).toBe(true);
        expect(isAccountLeaseError(new Error('Account switch is in progress.'))).toBe(true);
        expect(isAccountLeaseError(new Error('Account-bound operation is unavailable before auth bootstrap completes.'))).toBe(true);
        expect(isAccountLeaseError(new Error('Failed to fetch'))).toBe(false);
        expect(isAccountLeaseError('Account operation was aborted.')).toBe(false);
        expect(isAccountLeaseError(undefined)).toBe(false);
    });

    it('retries a local operation once when the lease was aborted under it', async () => {
        let attempts = 0;
        const result = await runLocalOperationWithAccountRecovery('recovery-user', async () => {
            attempts += 1;
            if (attempts === 1) {
                throw LEASE_ABORT;
            }
            return 'wiped';
        });

        expect(result).toBe('wiped');
        expect(attempts).toBe(2);
    });

    it('propagates genuine failures instead of retrying them', async () => {
        let attempts = 0;
        await expect(runLocalOperationWithAccountRecovery('recovery-user', async () => {
            attempts += 1;
            throw new Error('Disk is full');
        })).rejects.toThrow('Disk is full');
        expect(attempts).toBe(1);
    });

    it('never runs the operation for a different active account', async () => {
        let attempts = 0;
        await activateAccount('someone-else');

        await expect(runLocalOperationWithAccountRecovery('recovery-user', async () => {
            attempts += 1;
            return 'should not happen';
        })).rejects.toThrow('Account operation was aborted.');

        // Refused up front: a switched account must never scope the retry.
        expect(attempts).toBe(0);
        expect(getActiveAccountId()).toBe('someone-else');
    });

    it('stays out of the way when no account is pinned yet', async () => {
        await clearActiveAccount();
        let attempts = 0;

        await expect(runLocalOperationWithAccountRecovery(null, async () => {
            attempts += 1;
            return 'ran';
        })).resolves.toBe('ran');

        expect(attempts).toBe(1);
    });

    it('reports a lease failure that happens twice', async () => {
        await expect(runLocalOperationWithAccountRecovery('recovery-user', async () => {
            throw LEASE_ABORT;
        })).rejects.toThrow('Account operation was aborted.');
    });
});
