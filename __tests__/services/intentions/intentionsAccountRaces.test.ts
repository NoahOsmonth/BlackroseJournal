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

import {
    createCheckIn,
    createIntention,
    listCheckIns,
} from '../../../services/intentions/intentionsStorage';
import { saveIntentionCheckInMemories } from '../../../services/memory/localMemory';
import { upsertCheckInDayDigest } from '../../../services/memory/dayDigestStorage';
import { extractIdentityFromSessionTranscript } from '../../../services/memory/identityExtraction';
import { buildAndSaveSessionDigest } from '../../../services/memory/sessionDigestBuild';
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

});
