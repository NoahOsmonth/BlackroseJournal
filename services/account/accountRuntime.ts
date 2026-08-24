export type AccountTeardown = () => void | Promise<void>;
export type AccountChangeListener = (accountId: string | null) => void;
export interface AccountOperationContext {
    readonly accountId: string | null;
    readonly signal: AbortSignal;
}
export interface AccountOperationLease extends AccountOperationContext {
    release(): void;
}

interface ActiveAccountOperation {
    readonly owner: string;
    readonly controller: AbortController;
    completion: Promise<void>;
}

let activeAccountId: string | null = null;
let switchQueue: Promise<void> = Promise.resolve();
const teardownHandlers = new Set<AccountTeardown>();
const accountChangeListeners = new Set<AccountChangeListener>();
const activeOperations = new Set<ActiveAccountOperation>();
let acceptsAccountOperations = true;

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

async function quiesceAccountOperations(): Promise<void> {
    acceptsAccountOperations = false;
    const operations = Array.from(activeOperations);
    operations.forEach((operation) => operation.controller.abort());
    await Promise.allSettled(operations.map((operation) => operation.completion));
}

export function runAccountBoundOperation<T>(
    owner: string,
    operation: (context: AccountOperationContext) => Promise<T>
): Promise<T> {
    let lease: AccountOperationLease;
    try {
        lease = acquireAccountOperationLease(owner);
    } catch (error) {
        return Promise.reject(error);
    }
    return Promise.resolve()
        .then(() => operation(lease))
        .finally(() => lease.release());
}

export function acquireAccountOperationLease(owner: string): AccountOperationLease {
    if (!acceptsAccountOperations) {
        throw new Error('Account switch is in progress.');
    }
    const normalizedOwner = owner.trim();
    if (!normalizedOwner) {
        throw new Error('Account operation owner is required.');
    }
    const accountId = activeAccountId;
    if (!accountId && process.env.NODE_ENV !== 'test') {
        throw new Error(
            'Account-bound operation is unavailable before auth bootstrap completes.'
        );
    }
    const controller = new AbortController();
    let releaseCompletion!: () => void;
    const completion = new Promise<void>((resolve) => { releaseCompletion = resolve; });
    const record: ActiveAccountOperation = {
        owner: normalizedOwner,
        controller,
        completion,
    };
    activeOperations.add(record);
    let released = false;
    const lease: AccountOperationLease = {
        accountId,
        signal: controller.signal,
        release() {
            if (released) return;
            released = true;
            activeOperations.delete(record);
            releaseCompletion();
        },
    };
    return lease;
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
        acceptsAccountOperations = false;
        try {
            if (activeAccountId) {
                await quiesceAccountOperations();
                await runTeardownHandlers();
            }
            activeAccountId = normalizedId;
            notifyAccountChange();
        } finally {
            acceptsAccountOperations = true;
        }
    });
}

export function clearActiveAccount(): Promise<void> {
    return enqueueSwitch(async () => {
        if (!activeAccountId) {
            return;
        }
        acceptsAccountOperations = false;
        try {
            await quiesceAccountOperations();
            await runTeardownHandlers();
            activeAccountId = null;
            notifyAccountChange();
        } finally {
            acceptsAccountOperations = true;
        }
    });
}
