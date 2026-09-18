/**
 * Device-local account bootstrap.
 *
 * Replaces Supabase auth with a stable, device-local account. There is no
 * sign-in: the first launch creates an account id and every later launch
 * reuses it, so all account-scoped AsyncStorage data (including data
 * previously written under a Supabase user id, which the account registry
 * already remembered) stays readable with zero migration.
 */
import { loadRememberedAccount, rememberAuthenticatedAccount, type RememberedAccount } from '@/services/account/accountRegistry';
import { activateAccount } from '@/services/account/accountRuntime';

export interface LocalAccountState {
    readonly status: 'authenticated' | 'loading';
    readonly account: RememberedAccount | null;
}

type Listener = () => void;

let snapshot: LocalAccountState = { status: 'loading', account: null };
let started = false;
let startPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
    listeners.forEach((listener) => listener());
}

function getSnapshot(): LocalAccountState {
    return snapshot;
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    void ensureLocalAccountStarted();
    return () => {
        listeners.delete(listener);
    };
}

async function startOnce(): Promise<void> {
    const remembered = await loadRememberedAccount();
    if (remembered) {
        await activateAccount(remembered.id);
        snapshot = { status: 'authenticated', account: remembered };
        emit();
        return;
    }
    // Fresh install: mint a stable device-local account id.
    const account: RememberedAccount = {
        id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
        email: null,
        lastAuthenticatedAt: Date.now(),
    };
    await activateAccount(account.id);
    await rememberAuthenticatedAccount(account);
    snapshot = { status: 'authenticated', account };
    emit();
}

export function ensureLocalAccountStarted(): Promise<void> {
    if (!started) {
        started = true;
        startPromise = startOnce().catch((error) => {
            started = false;
            throw error;
        });
    }
    return startPromise ?? Promise.resolve();
}

export const localAccountStore = {
    getSnapshot,
    subscribe,
};
