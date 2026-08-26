/* eslint-disable import/first */

jest.mock('../../../services/account/accountScopedStorage', () => ({
    claimLegacyStorageKey: jest.fn(async () => 'missing'),
    claimLegacyStoragePrefix: jest.fn(async () => 0),
    hasLegacyStorage: jest.fn(async () => false),
}));
jest.mock('../../../services/goals/goalsStorage', () => ({
    hasLegacyGoals: jest.fn(async () => false),
    migrateLegacyGoalsToActiveAccount: jest.fn(async () => undefined),
}));
jest.mock('../../../services/intentions/intentionsStorage', () => ({
    hasLegacyIntentions: jest.fn(async () => false),
    migrateLegacyIntentionsToActiveAccount: jest.fn(async () => undefined),
}));
jest.mock('../../../services/journal/journalStorage', () => ({
    hasLegacyJournalEntries: jest.fn(async () => false),
    migrateLegacyJournalEntriesToActiveAccount: jest.fn(async () => undefined),
}));
jest.mock('../../../services/supabase/syncQueue', () => ({
    hasLegacySyncQueue: jest.fn(async () => false),
    migrateLegacySyncQueueToActiveAccount: jest.fn(async () => undefined),
}));

import {
    activateAccount,
    clearActiveAccount,
} from '../../../services/account/accountRuntime';
import {
    hasLegacyStorage,
    claimLegacyStorageKey,
    claimLegacyStoragePrefix,
} from '../../../services/account/accountScopedStorage';
import {
    hasUnclaimedLegacyData,
    confirmLegacyDataOwnership,
} from '../../../services/account/legacyDataOwnership';
import {
    hasLegacyJournalEntries,
    migrateLegacyJournalEntriesToActiveAccount,
} from '../../../services/journal/journalStorage';
import { migrateLegacyGoalsToActiveAccount } from '../../../services/goals/goalsStorage';
import { migrateLegacyIntentionsToActiveAccount } from '../../../services/intentions/intentionsStorage';
import { migrateLegacySyncQueueToActiveAccount } from '../../../services/supabase/syncQueue';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('legacy data ownership account races', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('rejects a legacy-data inspection that becomes stale during a read', async () => {
        const readStarted = deferred();
        const releaseRead = deferred();
        jest.mocked(hasLegacyJournalEntries).mockImplementation(async () => {
            readStarted.resolve();
            await releaseRead.promise;
            return true;
        });

        await activateAccount('account-a');
        const inspecting = hasUnclaimedLegacyData();
        await readStarted.promise;
        const switching = activateAccount('account-b');
        releaseRead.resolve();

        await expect(inspecting).rejects.toThrow('Account operation was aborted.');
        await switching;
        expect(jest.mocked(hasLegacyStorage)).toHaveBeenCalled();
    });

    it('stops a legacy ownership claim after an account switch', async () => {
        const migrationStarted = deferred();
        const releaseMigration = deferred();
        jest.mocked(migrateLegacyJournalEntriesToActiveAccount).mockImplementation(async () => {
            migrationStarted.resolve();
            await releaseMigration.promise;
        });

        await activateAccount('account-a');
        const claiming = confirmLegacyDataOwnership('account-a');
        await migrationStarted.promise;
        const switching = activateAccount('account-b');
        releaseMigration.resolve();

        await expect(claiming).rejects.toThrow('Account operation was aborted.');
        await switching;
        expect(jest.mocked(migrateLegacyGoalsToActiveAccount)).not.toHaveBeenCalled();
        expect(jest.mocked(migrateLegacyIntentionsToActiveAccount)).not.toHaveBeenCalled();
        expect(jest.mocked(claimLegacyStorageKey)).not.toHaveBeenCalled();
        expect(jest.mocked(claimLegacyStoragePrefix)).not.toHaveBeenCalled();
        expect(jest.mocked(migrateLegacySyncQueueToActiveAccount)).not.toHaveBeenCalled();
    });
});
