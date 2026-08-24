import {
    applyAuthTransition,
    resolveAuthBootstrap,
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
    let subscription: { unsubscribe(): void } | null = null;
    const listeners = new Set<() => void>();
    const pending = new Set<Promise<void>>();

    const emit = () => listeners.forEach((listener) => listener());
    const schedule = (intent: AuthTransitionIntent, targetRevision: number): Promise<void> => {
        const operation = transitionQueue.then(async () => {
            if (stopped || targetRevision !== revision) return;
            const authState = await applyAuthTransition(intent);
            if (stopped || targetRevision !== revision) return;
            snapshot = { authState, isLoading: false };
            emit();
        });
        transitionQueue = operation.catch(() => undefined);
        return operation;
    };

    const track = (operation: Promise<void>) => {
        pending.add(operation);
        void operation.finally(() => pending.delete(operation));
    };

    const begin = () => {
        if (started || stopped) return;
        started = true;
        const bootstrapRevision = ++revision;
        track(resolveAuthBootstrap(client).then((intent) => schedule(intent, bootstrapRevision)));
        if (client) {
            subscription = client.auth.onAuthStateChange((_event, session) => {
                const eventRevision = ++revision;
                const intent: AuthTransitionIntent = session && !session.user.is_anonymous
                    ? { type: 'session', session }
                    : { type: 'signed-out' };
                track(schedule(intent, eventRevision));
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
