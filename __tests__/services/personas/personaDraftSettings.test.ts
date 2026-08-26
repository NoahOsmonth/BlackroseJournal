/** Account-switch regression tests for the persona creation draft. */

/* eslint-disable import/first */

const mockStore = new Map<string, string>();
type Deferred = { promise: Promise<void>; resolve: () => void };
let mockDelayedReadKey: string | null = null;
let mockDelayedRead: Deferred | null = null;
let mockDelayedReadStarted: (() => void) | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => {
            if (key === mockDelayedReadKey && mockDelayedRead) {
                mockDelayedReadStarted?.();
                await mockDelayedRead.promise;
            }
            return mockStore.get(key) ?? null;
        }),
        setItem: jest.fn(async (key: string, value: string) => {
            mockStore.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            mockStore.delete(key);
        }),
    },
}));

import { activateAccount, clearActiveAccount } from '@/services/account/accountRuntime';
import { getAccountScopedStorageKeyForAccount } from '@/services/account/accountScopedStorage';
import {
    clearPersonaDraftSettings,
    loadPersonaDraftSettings,
    savePersonaDraftSettings,
} from '@/services/personas/personaDraftSettings';
import type { PersonaDraftSettings } from '@/services/personas/personaDraftSettings';

const DRAFT_SETTINGS_KEY = '@persona_draft_settings';

function deferred(): Deferred {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('personaDraftSettings', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        mockStore.clear();
        mockDelayedReadKey = null;
        mockDelayedRead = null;
        mockDelayedReadStarted = null;
    });

    afterEach(async () => {
        await clearActiveAccount();
    });

    it('isolates saved and cleared drafts by account namespace', async () => {
        const draftA: PersonaDraftSettings = { model: 'model-a', imagination: 20 };
        const draftB: PersonaDraftSettings = { model: 'model-b', imagination: 80 };

        await activateAccount('persona-account-a');
        await savePersonaDraftSettings(draftA);
        expect(mockStore.get(getAccountScopedStorageKeyForAccount(DRAFT_SETTINGS_KEY, 'persona-account-a')))
            .toBe(JSON.stringify(draftA));

        await activateAccount('persona-account-b');
        await expect(loadPersonaDraftSettings()).resolves.toBeNull();
        await savePersonaDraftSettings(draftB);
        await clearPersonaDraftSettings();
        await expect(loadPersonaDraftSettings()).resolves.toBeNull();

        await activateAccount('persona-account-a');
        await expect(loadPersonaDraftSettings()).resolves.toEqual(draftA);
    });

    it('aborts a draft read when the account switch makes its result stale', async () => {
        const accountAKey = getAccountScopedStorageKeyForAccount(DRAFT_SETTINGS_KEY, 'persona-account-a');
        mockStore.set(accountAKey, JSON.stringify({ model: 'model-a', imagination: 20 }));
        const releaseRead = deferred();
        const readStarted = deferred();
        mockDelayedReadKey = accountAKey;
        mockDelayedRead = releaseRead;
        mockDelayedReadStarted = readStarted.resolve;

        await activateAccount('persona-account-a');
        const pending = loadPersonaDraftSettings();
        await readStarted.promise;
        const switching = activateAccount('persona-account-b');
        releaseRead.resolve();

        await expect(pending).rejects.toThrow('Account operation was aborted');
        await switching;
        await expect(loadPersonaDraftSettings()).resolves.toBeNull();
    });
});
