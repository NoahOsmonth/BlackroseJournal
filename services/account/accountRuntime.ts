export type AccountTeardown = () => void | Promise<void>;
export type AccountChangeListener = (accountId: string | null) => void;

let activeAccountId: string | null = null;
let switchQueue: Promise<void> = Promise.resolve();
const teardownHandlers = new Set<AccountTeardown>();
const accountChangeListeners = new Set<AccountChangeListener>();

export function getActiveAccountId(): string | null {
    return activeAccountId;
}

export function requireActiveAccountId(): string {
    if (!activeAccountId) {
        throw new Error('Account-scoped storage is unavailable before auth bootstrap completes.');
    }
    return activeAccountId;
}

export function registerAccountTeardown(handler: AccountTeardown): () => void {
    teardownHandlers.add(handler);
    return () => {
        teardownHandlers.delete(handler);
    };
}

export function subscribeActiveAccount(listener: AccountChangeListener): () => void {
    accountChangeListeners.add(listener);
    return () => {
        accountChangeListeners.delete(listener);
    };
}

function notifyAccountChange(): void {
    accountChangeListeners.forEach((listener) => listener(activeAccountId));
}

async function runTeardownHandlers(): Promise<void> {
    for (const handler of teardownHandlers) {
        await handler();
    }
}

function enqueueSwitch(operation: () => Promise<void>): Promise<void> {
    const result = switchQueue.then(operation, operation);
    switchQueue = result.catch(() => undefined);
    return result;
}

export function activateAccount(accountId: string): Promise<void> {
    const normalizedId = accountId.trim();
    if (!normalizedId) {
        return Promise.reject(new Error('Account id is required.'));
    }

    return enqueueSwitch(async () => {
        if (activeAccountId === normalizedId) {
            return;
        }
        if (activeAccountId) {
            await runTeardownHandlers();
        }
        activeAccountId = normalizedId;
        notifyAccountChange();
    });
}

export function clearActiveAccount(): Promise<void> {
    return enqueueSwitch(async () => {
        if (!activeAccountId) {
            return;
        }
        await runTeardownHandlers();
        activeAccountId = null;
        notifyAccountChange();
    });
}
