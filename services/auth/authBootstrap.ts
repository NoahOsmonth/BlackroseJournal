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
    readonly error: { readonly message: string } | null;
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

async function openSessionAccount(
    session: AuthSessionLike,
    status: 'authenticated' = 'authenticated'
): Promise<AuthBootstrapState> {
    const account = {
        id: session.user.id,
        email: session.user.email ?? null,
        lastAuthenticatedAt: Date.now(),
    };
    await activateAccount(account.id);
    await rememberAuthenticatedAccount(account);
    return { status, account, session };
}

async function openRememberedAccountOffline(): Promise<AuthBootstrapState> {
    const account = await loadRememberedAccount();
    if (!account) {
        await clearActiveAccount();
        return { status: 'signed-out', account: null, session: null };
    }
    await activateAccount(account.id);
    return { status: 'offline', account, session: null };
}

export async function bootstrapAuth(
    client: AuthBootstrapClient | null
): Promise<AuthBootstrapState> {
    if (!client) {
        return openRememberedAccountOffline();
    }

    try {
        const { data, error } = await client.auth.getSession();
        if (error) {
            return openRememberedAccountOffline();
        }
        if (data.session && !data.session.user.is_anonymous) {
            return openSessionAccount(data.session);
        }
        await clearRememberedAccount();
        await clearActiveAccount();
        return { status: 'signed-out', account: null, session: null };
    } catch {
        return openRememberedAccountOffline();
    }
}

export async function handleAuthSessionChange(
    session: AuthSessionLike | null
): Promise<AuthBootstrapState> {
    if (session && !session.user.is_anonymous) {
        return openSessionAccount(session);
    }
    await clearRememberedAccount();
    await clearActiveAccount();
    return { status: 'signed-out', account: null, session: null };
}
