import {
    clearRememberedAccount,
    loadRememberedAccount,
    rememberAuthenticatedAccount,
    type RememberedAccount,
} from '@/services/account/accountRegistry';
import { activateAccount, clearActiveAccount } from '@/services/account/accountRuntime';

export interface AuthSessionLike {
    readonly access_token?: string;
    readonly user: {
        readonly id: string;
        readonly email?: string | null;
        readonly is_anonymous?: boolean;
    };
}

interface AuthSessionResponse {
    readonly data: { readonly session: AuthSessionLike | null };
    readonly error: {
        readonly message: string;
        readonly name?: string;
        readonly status?: number;
        readonly code?: string;
    } | null;
}

export interface AuthBootstrapClient {
    readonly auth: {
        getSession(): Promise<AuthSessionResponse>;
    };
}

export type AuthBootstrapState = {
    readonly status: 'authenticated' | 'offline';
    readonly account: RememberedAccount;
    readonly session: AuthSessionLike | null;
} | {
    readonly status: 'signed-out';
    readonly account: null;
    readonly session: null;
};

export type AuthTransitionIntent = {
    readonly type: 'session';
    readonly session: AuthSessionLike;
} | {
    readonly type: 'offline';
    readonly account: RememberedAccount;
} | {
    readonly type: 'signed-out';
};

async function openSessionAccount(
    session: AuthSessionLike,
    status: 'authenticated' = 'authenticated',
    shouldContinue: () => boolean = () => true
): Promise<AuthBootstrapState> {
    const account = {
        id: session.user.id,
        email: session.user.email ?? null,
        lastAuthenticatedAt: Date.now(),
    };
    if (!shouldContinue()) throw new AuthTransitionCancelledError();
    await activateAccount(account.id);
    if (!shouldContinue()) throw new AuthTransitionCancelledError();
    await rememberAuthenticatedAccount(account);
    if (!shouldContinue()) throw new AuthTransitionCancelledError();
    return { status, account, session };
}

export class AuthTransitionCancelledError extends Error {
    constructor() {
        super('Authentication transition was superseded.');
        this.name = 'AuthTransitionCancelledError';
    }
}

async function resolveRememberedAccountOffline(): Promise<AuthTransitionIntent> {
    const account = await loadRememberedAccount();
    return account ? { type: 'offline', account } : { type: 'signed-out' };
}

/**
 * A rejection the *server* made about the credential itself — the one case that
 * ends local access. Everything else (transport faults, lock aborts, unexpected
 * exceptions, a plain sessionless answer) only means we could not confirm a
 * session, and local-first keeps the on-device journal reachable instead.
 */
const SERVER_AUTH_REJECTION_MESSAGE =
    /invalid refresh token|refresh[-_ ]?token[-_ ]?(?:not[-_ ]?found|revoked|expired)|invalid grant|invalid jwt|invalid claim|user not found/i;

function isServerAuthRejection(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const { name, message, status } = error as {
        name?: unknown;
        message?: unknown;
        status?: unknown;
    };
    if (name === 'AuthApiError') return true;
    // 4xx means the server answered; 408/429 are throttles, not credential verdicts.
    if (typeof status === 'number' && status >= 400 && status < 500) {
        return status !== 408 && status !== 429;
    }
    return typeof message === 'string' && SERVER_AUTH_REJECTION_MESSAGE.test(message);
}

/**
 * Cold-boot ceiling for confirming a session. A blackholed Supabase connection
 * (dropped packets, no RST) leaves `getSession()` pending forever, including the
 * `initialize()` chain it awaits — without this bound the app would sit on the
 * loading screen indefinitely instead of opening offline.
 */
export const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

const BOOTSTRAP_TIMED_OUT = Symbol('auth-bootstrap-timeout');

export async function resolveAuthBootstrap(
    client: AuthBootstrapClient | null
): Promise<AuthTransitionIntent> {
    // No Supabase configured — or no client could be created — is not a reason to
    // hide the on-device journal: the last known account opens offline.
    if (!client) {
        return resolveRememberedAccountOffline();
    }

    const pending = client.auth.getSession();
    // The raced-away promise must not surface as an unhandled rejection.
    pending.catch(() => undefined);
    let cancelTimeout: () => void = () => undefined;
    const timedOut = new Promise<typeof BOOTSTRAP_TIMED_OUT>((resolve) => {
        const handle = setTimeout(() => resolve(BOOTSTRAP_TIMED_OUT), AUTH_BOOTSTRAP_TIMEOUT_MS);
        cancelTimeout = () => clearTimeout(handle);
    });

    try {
        const settled = await Promise.race([pending, timedOut]);

        if (settled === BOOTSTRAP_TIMED_OUT) {
            return resolveRememberedAccountOffline();
        }

        const { data, error } = settled;
        if (data.session && !data.session.user.is_anonymous) {
            return { type: 'session', session: data.session };
        }
        if (error && isServerAuthRejection(error)) {
            return { type: 'signed-out' };
        }
        return resolveRememberedAccountOffline();
    } catch (error) {
        return isServerAuthRejection(error)
            ? { type: 'signed-out' }
            : resolveRememberedAccountOffline();
    } finally {
        cancelTimeout();
    }
}

export async function applyAuthTransition(
    intent: AuthTransitionIntent,
    shouldContinue: () => boolean = () => true
): Promise<AuthBootstrapState> {
    if (intent.type === 'session') {
        return openSessionAccount(intent.session, 'authenticated', shouldContinue);
    }
    if (intent.type === 'offline') {
        if (!shouldContinue()) throw new AuthTransitionCancelledError();
        await activateAccount(intent.account.id);
        if (!shouldContinue()) throw new AuthTransitionCancelledError();
        return { status: 'offline', account: intent.account, session: null };
    }
    if (!shouldContinue()) throw new AuthTransitionCancelledError();
    await clearRememberedAccount();
    if (!shouldContinue()) throw new AuthTransitionCancelledError();
    await clearActiveAccount();
    if (!shouldContinue()) throw new AuthTransitionCancelledError();
    return { status: 'signed-out', account: null, session: null };
}

export async function bootstrapAuth(
    client: AuthBootstrapClient | null
): Promise<AuthBootstrapState> {
    return applyAuthTransition(await resolveAuthBootstrap(client));
}

/**
 * Maps a supabase-js auth event to a transition intent.
 *
 * A null session only means "signed out" when supabase-js says so explicitly:
 * `SIGNED_OUT` is emitted after it removed the stored session (user sign-out, or
 * a refresh token the server rejected). Every other sessionless event means we
 * merely *could not confirm* a session — a cold boot whose expired token cannot
 * be refreshed while Supabase is unreachable — so it re-derives through
 * `resolveAuthBootstrap` and keeps the remembered account offline instead of
 * logging the user out of their own journal.
 */
export async function resolveAuthSessionEvent(
    client: AuthBootstrapClient | null,
    event: string,
    session: AuthSessionLike | null
): Promise<AuthTransitionIntent> {
    if (session && !session.user.is_anonymous) {
        return { type: 'session', session };
    }
    if (event === 'SIGNED_OUT') {
        return { type: 'signed-out' };
    }
    return resolveAuthBootstrap(client);
}
