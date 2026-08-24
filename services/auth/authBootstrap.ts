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

function isNetworkTransportFailure(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as {
        message?: unknown;
        name?: unknown;
        status?: unknown;
        code?: unknown;
    };
    if (candidate.status === 0 || candidate.name === 'AuthRetryableFetchError') return true;
    if (candidate.code === 'NETWORK_ERROR' || candidate.code === 'ETIMEDOUT') return true;
    if (typeof candidate.message !== 'string') return false;
    return /network request failed|failed to fetch|fetch failed|network unavailable|\boffline\b|timed? out/i
        .test(candidate.message);
}

export async function resolveAuthBootstrap(
    client: AuthBootstrapClient | null
): Promise<AuthTransitionIntent> {
    if (!client) {
        return { type: 'signed-out' };
    }

    try {
        const { data, error } = await client.auth.getSession();
        if (error) {
            return isNetworkTransportFailure(error)
                ? resolveRememberedAccountOffline()
                : { type: 'signed-out' };
        }
        if (data.session && !data.session.user.is_anonymous) {
            return { type: 'session', session: data.session };
        }
        return { type: 'signed-out' };
    } catch (error) {
        return isNetworkTransportFailure(error)
            ? resolveRememberedAccountOffline()
            : { type: 'signed-out' };
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

export async function handleAuthSessionChange(
    session: AuthSessionLike | null
): Promise<AuthBootstrapState> {
    return applyAuthTransition(
        session && !session.user.is_anonymous
            ? { type: 'session', session }
            : { type: 'signed-out' }
    );
}
