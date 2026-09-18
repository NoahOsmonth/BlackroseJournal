import {
    applyAuthTransition,
    AuthTransitionCancelledError,
    resolveAuthBootstrap,
    resolveAuthSessionEvent,
    type AuthBootstrapClient,
    type AuthBootstrapState,
    type AuthSessionLike,
    type AuthTransitionIntent,
} from '@/services/auth/authBootstrap';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';

interface AuthStateChangeSubscription {
    readonly data: {
        readonly subscription: { unsubscribe(): void };
    };
}

interface AuthCoordinatorClient extends AuthBootstrapClient {
    readonly auth: AuthBootstrapClient['auth'] & {
        onAuthStateChange(
            listener: (event: string, session: AuthSessionLike | null) => void
        ): AuthStateChangeSubscription;
    };
}

export interface AuthCoordinatorSnapshot {
    readonly authState: AuthBootstrapState;
    readonly isLoading: boolean;
}

export interface AuthCoordinator {
    subscribe(listener: () => void): () => void;
    getSnapshot(): AuthCoordinatorSnapshot;
    whenIdle(): Promise<void>;
    signOutLocally(): Promise<void>;
    stop(): void;
}

const SIGNED_OUT_STATE: AuthBootstrapState = {
    status: 'signed-out', account: null, session: null,
};

export function createAuthCoordinator(
    client: AuthCoordinatorClient | null
): AuthCoordinator {
    let snapshot: AuthCoordinatorSnapshot = {
        authState: SIGNED_OUT_STATE,
        isLoading: true,
    };
    let revision = 0;
    let started = false;
    let stopped = false;
    let transitionQueue: Promise<void> = Promise.resolve();
    // A local sign-out must not be undone by supabase-js re-adopting the session
    // it still holds in storage: when the server was unreachable the revoke never
    // happened, so a later successful background refresh would emit
    // TOKEN_REFRESHED and silently sign the user back in. Only a deliberate
    // sign-in clears the latch.
    let signedOutLocally = false;
    let subscription: { unsubscribe(): void } | null = null;
    const listeners = new Set<() => void>();
    const pending = new Set<Promise<void>>();

    const emit = () => listeners.forEach((listener) => listener());
    const schedule = (intent: AuthTransitionIntent, targetRevision: number): Promise<void> => {
        const isCurrent = () => !stopped && targetRevision === revision;
        const operation = transitionQueue.then(async () => {
            if (!isCurrent()) return;
            try {
                const authState = await applyAuthTransition(intent, isCurrent);
                if (!isCurrent()) return;
                snapshot = { authState, isLoading: false };
                emit();
            } catch (error) {
                if (error instanceof AuthTransitionCancelledError) return;
                if (isCurrent()) {
                    snapshot = { authState: SIGNED_OUT_STATE, isLoading: false };
                    emit();
                }
                // A failed transition drops the app back to the signed-out UI with no
                // user-visible signal (AUTH-04: signup returned a session, the app
                // persisted it, and the screen just sat there). Silent swallows made
                // that undiagnosable — always log before rethrowing.
                console.error('[auth] Session transition failed:', error);
                throw error;
            }
        });
        transitionQueue = operation.catch(() => undefined);
        return operation;
    };

    const track = (operation: Promise<void>) => {
        pending.add(operation);
        void operation.then(
            () => pending.delete(operation),
            () => pending.delete(operation),
        );
    };

    const begin = () => {
        if (started || stopped) return;
        started = true;
        const bootstrapRevision = ++revision;
        track(resolveAuthBootstrap(client).then((intent) => schedule(intent, bootstrapRevision)));
        if (client) {
            subscription = client.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
                    signedOutLocally = false;
                } else if (signedOutLocally) {
                    return;
                }
                const eventRevision = ++revision;
                track(resolveAuthSessionEvent(client, event, session)
                    .then((intent) => schedule(intent, eventRevision)));
            }).data.subscription;
        }
    };

    return {
        subscribe(listener) {
            listeners.add(listener);
            begin();
            return () => listeners.delete(listener);
        },
        getSnapshot: () => snapshot,
        async signOutLocally() {
            signedOutLocally = true;
            await schedule({ type: 'signed-out' }, ++revision);
        },
        async whenIdle() {
            while (pending.size > 0) {
                await Promise.all(Array.from(pending));
            }
            await transitionQueue;
        },
        stop() {
            stopped = true;
            revision += 1;
            subscription?.unsubscribe();
            subscription = null;
            listeners.clear();
        },
    };
}

let sharedCoordinator: AuthCoordinator | null = null;

function getSharedCoordinator(): AuthCoordinator {
    if (!sharedCoordinator) {
        sharedCoordinator = createAuthCoordinator(
            getSupabaseClient() as AuthCoordinatorClient | null
        );
    }
    return sharedCoordinator;
}

export function subscribeAuthCoordinator(listener: () => void): () => void {
    return getSharedCoordinator().subscribe(listener);
}

export function getAuthCoordinatorSnapshot(): AuthCoordinatorSnapshot {
    return getSharedCoordinator().getSnapshot();
}

/**
 * Ends local access immediately. `supabase.auth.signOut()` cannot do this while
 * Supabase is unreachable (auth-js returns the session error without removing
 * the session or emitting SIGNED_OUT), which would leave the journal on screen
 * after the user asked to sign out.
 */
export function signOutAuthCoordinator(): Promise<void> {
    return getSharedCoordinator().signOutLocally();
}
