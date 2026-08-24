import {
    confirmLegacyDataOwnership,
    hasUnclaimedLegacyData,
} from '@/services/account/legacyDataOwnership';
import { useCallback, useEffect, useState } from 'react';

export function useLegacyDataOwnership(accountId: string | null) {
    const [isChecking, setIsChecking] = useState(Boolean(accountId));
    const [needsConfirmation, setNeedsConfirmation] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setError(null);
        setNeedsConfirmation(false);
        setIsChecking(Boolean(accountId));
        if (!accountId) return () => { active = false; };

        hasUnclaimedLegacyData()
            .then((hasLegacyData) => {
                if (active) setNeedsConfirmation(hasLegacyData);
            })
            .catch((nextError: unknown) => {
                if (active) {
                    setError(nextError instanceof Error ? nextError.message : 'Could not inspect local data.');
                }
            })
            .finally(() => {
                if (active) setIsChecking(false);
            });
        return () => {
            active = false;
        };
    }, [accountId]);

    const confirmOwnership = useCallback(async () => {
        if (!accountId || isMigrating) return;
        setIsMigrating(true);
        setError(null);
        try {
            await confirmLegacyDataOwnership(accountId);
            setNeedsConfirmation(false);
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Could not claim local data.');
        } finally {
            setIsMigrating(false);
        }
    }, [accountId, isMigrating]);

    const continueWithoutLegacyData = useCallback(() => {
        setNeedsConfirmation(false);
        setError(null);
    }, []);

    return {
        isChecking,
        needsConfirmation,
        isMigrating,
        error,
        confirmOwnership,
        continueWithoutLegacyData,
    };
}
