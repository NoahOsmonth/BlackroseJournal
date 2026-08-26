/* eslint-disable import/first */

const mockValues = new Map<string, string>();
let mockDelayedReadKey: string | null = null;
let mockReadStarted: (() => void) | null = null;
let mockReadRelease: Promise<void> | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => {
            if (key === mockDelayedReadKey && mockReadRelease) {
                mockReadStarted?.();
                await mockReadRelease;
            }
            return mockValues.get(key) ?? null;
        }),
        setItem: jest.fn(async (key: string, value: string) => {
            mockValues.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockValues.delete(key);
        }),
    },
}));

jest.mock('../../../services/intentions/intentionsRemote', () => ({
    fetchRemoteCheckIns: jest.fn(() => Promise.resolve(null)),
    fetchRemoteIntentions: jest.fn(() => Promise.resolve(null)),
    mergeCheckIns: jest.fn((local: Record<string, unknown>, remote: { id: string }[]) => ({
        ...local,
        ...Object.fromEntries(remote.map((item) => [item.id, item])),
    })),
    mergeIntentions: jest.fn((local: object) => local),
    pushCheckIns: jest.fn(() => Promise.resolve(false)),
    pushIntentions: jest.fn(() => Promise.resolve(false)),
    queueCheckInDelete: jest.fn(() => Promise.resolve()),
    queueCheckInUpsert: jest.fn(() => Promise.resolve()),
    queueIntentionDelete: jest.fn(() => Promise.resolve()),
    queueIntentionUpsert: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../services/memory/localMemory', () => ({
    saveIntentionCheckInMemories: jest.fn(async () => []),
}));
jest.mock('../../../services/memory/dayDigestStorage', () => ({
    upsertCheckInDayDigest: jest.fn(async () => null),
}));
jest.mock('../../../services/memory/identityExtraction', () => ({
    extractIdentityFromSessionTranscript: jest.fn(async () => null),
}));
jest.mock('../../../services/memory/sessionDigestBuild', () => ({
    buildAndSaveSessionDigest: jest.fn(async () => null),
}));
jest.mock('../../../services/memory/hindsight/hindsightRetain', () => ({
    retainCheckInToHindsight: jest.fn(async () => true),
}));

import {
    createCheckIn,
    createIntention,
    listCheckIns,
} from '../../../services/intentions/intentionsStorage';
import {
    fetchRemoteCheckIns,
    queueCheckInUpsert,
} from '../../../services/intentions/intentionsRemote';
import { saveIntentionCheckInMemories } from '../../../services/memory/localMemory';
import { upsertCheckInDayDigest } from '../../../services/memory/dayDigestStorage';
import { extractIdentityFromSessionTranscript } from '../../../services/memory/identityExtraction';
import { buildAndSaveSessionDigest } from '../../../services/memory/sessionDigestBuild';
import { retainCheckInToHindsight } from '../../../services/memory/hindsight/hindsightRetain';
import {
    activateAccount,
    clearActiveAccount,
} from '../../../services/account/accountRuntime';
import { getAccountScopedStorageKeyForAccount } from '../../../services/account/accountScopedStorage';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

async function waitForCall(mock: jest.Mock): Promise<void> {
    while (mock.mock.calls.length === 0) await Promise.resolve();
}

describe('intentions account-switch races', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        mockValues.clear();
        mockDelayedReadKey = null;
        mockReadStarted = null;
        mockReadRelease = null;
        jest.clearAllMocks();
        await activateAccount('account-a');
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('rejects a create mutation that crosses an account switch during its local read', async () => {
        const release = deferred<void>();
        mockReadRelease = release.promise;
        mockDelayedReadKey = getAccountScopedStorageKeyForAccount('@intentions', 'account-a');
        const readGate = new Promise<void>((resolve) => { mockReadStarted = resolve; });

        const pending = createIntention({
            title: 'A private intention',
            description: 'Only account A may receive this.',
            area: 'wellbeing',
        });
        await readGate;

        const switching = activateAccount('account-b');
        release.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(mockValues.has(getAccountScopedStorageKeyForAccount('@intentions', 'account-b')))
            .toBe(false);
    });

    it('discards a remote check-in pull that resolves after switching accounts', async () => {
        const remote = deferred<{
            id: string;
            type: 'morning';
            title: string;
            summary: string;
            status: 'completed';
            createdAt: number;
            updatedAt: number;
        }[]>();
        jest.mocked(fetchRemoteCheckIns).mockReturnValue(remote.promise);

        const pending = listCheckIns();
        await waitForCall(jest.mocked(fetchRemoteCheckIns));

        const switching = activateAccount('account-b');
        remote.resolve([{
            id: 'checkin-a',
            type: 'morning',
            title: 'A private check-in',
            summary: 'A-only writing',
            status: 'completed',
            createdAt: 1,
            updatedAt: 1,
        }]);

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(mockValues.has(getAccountScopedStorageKeyForAccount('@intention_checkins', 'account-b')))
            .toBe(false);
    });

    it('does not launch completed check-in side effects after its remote step becomes stale', async () => {
        const release = deferred<void>();
        jest.mocked(queueCheckInUpsert).mockReturnValue(release.promise);

        const pending = createCheckIn({
            type: 'evening',
            title: 'A private check-in',
            summary: 'A-only writing',
            status: 'completed',
            messages: [{
                id: 'message-a',
                role: 'user',
                content: 'A-only writing',
                timestamp: 1,
            }],
        });
        await waitForCall(jest.mocked(queueCheckInUpsert));

        const switching = activateAccount('account-b');
        release.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        expect(mockValues.has(getAccountScopedStorageKeyForAccount('@intention_checkins', 'account-b')))
            .toBe(false);
        expect(saveIntentionCheckInMemories).not.toHaveBeenCalled();
        expect(upsertCheckInDayDigest).not.toHaveBeenCalled();
        expect(extractIdentityFromSessionTranscript).not.toHaveBeenCalled();
        expect(buildAndSaveSessionDigest).not.toHaveBeenCalled();
        expect(retainCheckInToHindsight).not.toHaveBeenCalled();
    });
});
