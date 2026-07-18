/**
 * Settings / UI hook for the always-on identity profile.
 * Layer: hooks → services only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    confirmIdentityPendingField,
    dismissIdentityPendingField,
    getIdentityProfile,
    subscribeIdentityChanges,
} from '@/services/memory/identityProfile';
import type { IdentityProfile, IdentityScalarField } from '@/services/memory/identityProfile.types';
import {
    countPendingIdentityCandidates,
    listConfirmedCollectionRows,
    listPendingIdentityCandidates,
    listScalarIdentityRows,
} from '@/services/memory/identityProfileView';

export function useIdentityProfile() {
    const [profile, setProfile] = useState<IdentityProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const next = await getIdentityProfile();
            setProfile(next);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh().catch(() => undefined);
        return subscribeIdentityChanges(() => {
            refresh().catch(() => undefined);
        });
    }, [refresh]);

    const confirmPending = useCallback(async (field: IdentityScalarField) => {
        setIsMutating(true);
        try {
            const next = await confirmIdentityPendingField(field);
            setProfile(next);
            return next;
        } finally {
            setIsMutating(false);
        }
    }, []);

    const dismissPending = useCallback(async (field: IdentityScalarField) => {
        setIsMutating(true);
        try {
            const next = await dismissIdentityPendingField(field);
            setProfile(next);
            return next;
        } finally {
            setIsMutating(false);
        }
    }, []);

    const scalarRows = useMemo(
        () => (profile ? listScalarIdentityRows(profile) : []),
        [profile],
    );
    const pendingRows = useMemo(
        () => (profile ? listPendingIdentityCandidates(profile) : []),
        [profile],
    );
    const collectionRows = useMemo(
        () => (profile ? listConfirmedCollectionRows(profile) : []),
        [profile],
    );
    const pendingCount = useMemo(
        () => (profile ? countPendingIdentityCandidates(profile) : 0),
        [profile],
    );

    return {
        profile,
        isLoading,
        isMutating,
        refresh,
        confirmPending,
        dismissPending,
        scalarRows,
        pendingRows,
        collectionRows,
        pendingCount,
    };
}
