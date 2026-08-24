import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '@/hooks/auth/useAuthSession';
import {
    getManagedModelSelection,
    loadManagedCatalogSnapshot,
    loadManagedModelPreference,
    refreshManagedCatalog,
    startManagedCatalogRealtime,
    subscribeManagedCatalogChanges,
    updateManagedModelPreference,
    type ManagedCatalogSnapshot,
    type ManagedModelSelection,
} from '@/services/ai/managedCatalog';
import type {
    CatalogResponse,
    PublicCatalogModel,
    UserAiPreference,
} from '@blackrose/ai-control-plane-contracts';

const EMPTY_SNAPSHOT: ManagedCatalogSnapshot = { catalog: null, preference: null };

export interface UseManagedAiCatalogReturn {
    readonly catalog: CatalogResponse | null;
    readonly models: readonly PublicCatalogModel[];
    readonly preference: UserAiPreference | null;
    readonly selection: ManagedModelSelection;
    readonly isLoading: boolean;
    readonly isRefreshing: boolean;
    readonly isUpdatingPreference: boolean;
    readonly error: string | null;
    refresh(): Promise<void>;
    selectModel(modelId: string): Promise<void>;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Managed AI is unavailable.';
}

export function useManagedAiCatalog(options: { enabled?: boolean } = {}): UseManagedAiCatalogReturn {
    const enabled = options.enabled ?? true;
    const auth = useAuthSession();
    const accountId = auth.user?.id ?? null;
    const [snapshot, setSnapshot] = useState<ManagedCatalogSnapshot>(EMPTY_SNAPSHOT);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isUpdatingPreference, setIsUpdatingPreference] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const refresh = useCallback(async () => {
        if (!enabled || !accountId || auth.isOffline) return;
        setIsRefreshing(true);
        setError(null);
        try {
            await Promise.all([refreshManagedCatalog(), loadManagedModelPreference()]);
            const current = await loadManagedCatalogSnapshot();
            if (mountedRef.current) setSnapshot(current);
        } catch (refreshError) {
            if (mountedRef.current) setError(getErrorMessage(refreshError));
        } finally {
            if (mountedRef.current) setIsRefreshing(false);
        }
    }, [accountId, auth.isOffline, enabled]);

    useEffect(() => {
        let current = true;
        let stopRealtime: (() => void) | null = null;
        setSnapshot(EMPTY_SNAPSHOT);
        setError(null);
        setIsLoading(true);

        if (!enabled) {
            setIsLoading(false);
            return () => { current = false; };
        }

        const unsubscribeChanges = subscribeManagedCatalogChanges((next) => {
            if (current) setSnapshot(next);
        });

        void loadManagedCatalogSnapshot()
            .then((cached) => {
                if (!current) return;
                setSnapshot(cached);
                setIsLoading(false);
                if (!accountId || auth.isOffline) return;
                stopRealtime = startManagedCatalogRealtime();
                void refresh();
            })
            .catch((loadError) => {
                if (!current) return;
                setError(getErrorMessage(loadError));
                setIsLoading(false);
            });

        return () => {
            current = false;
            stopRealtime?.();
            unsubscribeChanges();
        };
    }, [accountId, auth.isOffline, enabled, refresh]);

    const selectModel = useCallback(async (modelId: string) => {
        if (!enabled) throw new Error('Managed AI mode is disabled.');
        setIsUpdatingPreference(true);
        setError(null);
        try {
            const preference = await updateManagedModelPreference(
                modelId,
                snapshot.preference?.revision
            );
            if (mountedRef.current) {
                setSnapshot((current) => ({ ...current, preference }));
            }
        } catch (updateError) {
            if (mountedRef.current) setError(getErrorMessage(updateError));
            throw updateError;
        } finally {
            if (mountedRef.current) setIsUpdatingPreference(false);
        }
    }, [enabled, snapshot.preference?.revision]);

    const selection = useMemo(
        () => getManagedModelSelection(snapshot.catalog, snapshot.preference),
        [snapshot.catalog, snapshot.preference]
    );

    return {
        catalog: snapshot.catalog,
        models: snapshot.catalog?.models ?? [],
        preference: snapshot.preference,
        selection,
        isLoading,
        isRefreshing,
        isUpdatingPreference,
        error,
        refresh,
        selectModel,
    };
}
