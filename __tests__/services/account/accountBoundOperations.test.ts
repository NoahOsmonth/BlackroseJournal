import {
    activateAccount,
    clearActiveAccount,
    getActiveAccountId,
    runAccountBoundOperation,
} from '../../../services/account/accountRuntime';
import {
    CHAT_SESSIONS_KEY,
    resetChatSessionStorageAdapter,
    saveSession,
    setChatSessionStorageAdapter,
} from '../../../services/ai/sessionStorage';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('account-bound private operations', () => {
    beforeEach(async () => {
        await clearActiveAccount();
    });

    afterEach(async () => {
        resetChatSessionStorageAdapter();
        await clearActiveAccount();
    });

    it('aborts and awaits an outstanding private operation before exposing another account', async () => {
        await activateAccount('account-a');
        const release = deferred<void>();
        let observedAbort = false;
        const operation = runAccountBoundOperation('test-owner', async ({ signal, accountId }) => {
            expect(accountId).toBe('account-a');
            signal.addEventListener('abort', () => { observedAbort = true; });
            await release.promise;
        });

        const switching = activateAccount('account-b');
        await Promise.resolve();
        expect(observedAbort).toBe(true);
        expect(getActiveAccountId()).toBe('account-a');

        release.resolve();
        await operation;
        await switching;
        expect(getActiveAccountId()).toBe('account-b');
    });

    it('keeps a delayed chat-session read-modify-write in the account where it began', async () => {
        const values = new Map<string, string>();
        const readStarted = deferred<void>();
        const releaseRead = deferred<void>();
        setChatSessionStorageAdapter({
            async getItem(key) {
                const accountAtRead = getActiveAccountId();
                readStarted.resolve();
                await releaseRead.promise;
                return values.get(`${accountAtRead}:${key}`) ?? null;
            },
            async setItem(key, value) {
                values.set(`${getActiveAccountId()}:${key}`, value);
            },
            async removeItem(key) {
                values.delete(`${getActiveAccountId()}:${key}`);
            },
        });
        await activateAccount('account-a');
        const saving = saveSession({
            conversationId: 'conversation-a',
            mode: 'freeform',
            messages: [],
            createdAt: 1,
            updatedAt: 1,
        });
        await readStarted.promise;

        const switching = activateAccount('account-b');
        await Promise.resolve();
        releaseRead.resolve();
        await saving;
        await switching;

        expect(values.has(`account-a:${CHAT_SESSIONS_KEY}`)).toBe(true);
        expect(values.has(`account-b:${CHAT_SESSIONS_KEY}`)).toBe(false);
    });
});
